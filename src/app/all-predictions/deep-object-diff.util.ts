export type DeepDiffType = 'added' | 'removed' | 'changed' | 'type-changed';

export interface DeepDiffEntry {
    path: string;
    type: DeepDiffType;
    before: unknown;
    after: unknown;
}

const hasOwn = (obj: object, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(obj, key);

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isDate = (value: unknown): value is Date => value instanceof Date;

const isSameReference = (a: unknown, b: unknown): boolean => Object.is(a, b);

const toPath = (base: string, segment: string): string => {
    if (!base) {
        return segment;
    }

    return segment.startsWith('[') ? `${base}${segment}` : `${base}.${segment}`;
};

const markVisitedPair = (
    visited: WeakMap<object, WeakSet<object>>,
    left: object,
    right: object
): boolean => {
    const rightSet = visited.get(left);
    if (rightSet?.has(right)) {
        return true;
    }

    if (rightSet) {
        rightSet.add(right);
        return false;
    }

    const nextSet = new WeakSet<object>();
    nextSet.add(right);
    visited.set(left, nextSet);
    return false;
};

export function getDeepObjectDifferences(left: unknown, right: unknown): DeepDiffEntry[] {
    const differences: DeepDiffEntry[] = [];
    const visitedPairs = new WeakMap<object, WeakSet<object>>();

    const walk = (leftNode: unknown, rightNode: unknown, path: string): void => {
        if (isSameReference(leftNode, rightNode)) {
            return;
        }

        if (isDate(leftNode) && isDate(rightNode)) {
            if (leftNode.getTime() !== rightNode.getTime()) {
                differences.push({
                    path,
                    type: 'changed',
                    before: leftNode,
                    after: rightNode,
                });
            }
            return;
        }

        if (Array.isArray(leftNode) && Array.isArray(rightNode)) {
            const maxLength = Math.max(leftNode.length, rightNode.length);

            for (let i = 0; i < maxLength; i += 1) {
                const itemPath = toPath(path, `[${i}]`);
                const leftExists = i < leftNode.length;
                const rightExists = i < rightNode.length;

                if (!leftExists && rightExists) {
                    differences.push({
                        path: itemPath,
                        type: 'added',
                        before: undefined,
                        after: rightNode[i],
                    });
                    continue;
                }

                if (leftExists && !rightExists) {
                    differences.push({
                        path: itemPath,
                        type: 'removed',
                        before: leftNode[i],
                        after: undefined,
                    });
                    continue;
                }

                walk(leftNode[i], rightNode[i], itemPath);
            }

            return;
        }

        if (Array.isArray(leftNode) !== Array.isArray(rightNode)) {
            differences.push({
                path,
                type: 'type-changed',
                before: leftNode,
                after: rightNode,
            });
            return;
        }

        if (isObjectLike(leftNode) && isObjectLike(rightNode)) {
            if (markVisitedPair(visitedPairs, leftNode, rightNode)) {
                return;
            }

            const keys = new Set<string>([
                ...Object.keys(leftNode),
                ...Object.keys(rightNode),
            ]);

            for (const key of keys) {
                const keyPath = toPath(path, key);
                const leftHasKey = hasOwn(leftNode, key);
                const rightHasKey = hasOwn(rightNode, key);

                if (!leftHasKey && rightHasKey) {
                    differences.push({
                        path: keyPath,
                        type: 'added',
                        before: undefined,
                        after: rightNode[key],
                    });
                    continue;
                }

                if (leftHasKey && !rightHasKey) {
                    differences.push({
                        path: keyPath,
                        type: 'removed',
                        before: leftNode[key],
                        after: undefined,
                    });
                    continue;
                }

                walk(leftNode[key], rightNode[key], keyPath);
            }

            return;
        }

        differences.push({
            path,
            type: typeof leftNode === typeof rightNode ? 'changed' : 'type-changed',
            before: leftNode,
            after: rightNode,
        });
    };

    walk(left, right, 'root');
    return differences;
}
