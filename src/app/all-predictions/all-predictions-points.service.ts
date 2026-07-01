import { Injectable } from '@angular/core';
import { Match, Prediction, User } from './all-predictions.models';

@Injectable({ providedIn: 'root' })
export class AllPredictionsPointsService {

    private isValidScore(value: unknown): value is number {
        return typeof value === 'number' && Number.isFinite(value);
    }

    private normalizeWinner(value: unknown): string | null {
        if (typeof value !== 'string') {
            return null;
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed.toUpperCase() : null;
    }

    calculatePredictionPoints(match2: Match | undefined, prediction: Prediction): number {
        if (!match2) {
            return -2;
        }

        const match = { ...match2 };

        const actualHome = match.score.fullTime.home;
        const actualAway = match.score.fullTime.away;

        if (
            actualHome === null ||
            actualAway === null ||
            !this.isValidScore(actualHome) ||
            !this.isValidScore(actualAway)
        ) {
            return -1;
        }

        const predictedHome = prediction.home_ft;
        const predictedAway = prediction.away_ft;

        if (!this.isValidScore(predictedHome) || !this.isValidScore(predictedAway)) {
            return -1;
        }

        const actualDiff = actualHome - actualAway;
        const predictedDiff = predictedHome - predictedAway;

        let points = 0;

        // 3 pts - exact score
        if (actualHome === predictedHome && actualAway === predictedAway) {
            points = 3;

            // 2 pts - same goal difference (but not draw rule conflict)
        } else if (actualHome !== actualAway && actualDiff === predictedDiff) {
            points = 2;

            // 1 pt - same outcome
        } else if (Math.sign(actualDiff) === Math.sign(predictedDiff)) {
            points = 1;
        }

        // -------------------------
        // KNOCKOUT BONUS (SAFE)
        // -------------------------

        const isKnockout =
            typeof match.myGroup === 'string' &&
            match.myGroup.trim().length > 0 &&
            !match.myGroup.toLowerCase().includes('group');

        const actualWinner = this.normalizeWinner(match.score.winner);
        const predictedWinner = this.normalizeWinner(prediction.winner);

        if (isKnockout && actualWinner && predictedWinner && actualWinner === predictedWinner) {
            points += 1;
        }

        return points;
    }

    calculatePredictionPoints2(match2: Match | undefined, prediction: Prediction): number {
        let result = -1
        const match: Match | undefined = { ...match2 } as Match | undefined

        if (!match) {
            return -2;
        }
        else {
            if (match.score.fullTime.home === null || match.score.fullTime.away === null) {
                result = -1;
            }

            const actualHome = match.score.fullTime.home;
            const actualAway = match.score.fullTime.away;
            const actualWinner = match.score.winner;
            const predictedHome = prediction.home_ft;
            const predictedAway = prediction.away_ft;
            const isPredictDraw = prediction.home_ft === prediction.away_ft;
            const predictedWinner = prediction.winner;

            if (actualHome === null || actualAway === null || predictedHome === null || predictedAway === null) {
                return -1;
            }


            if (result === -1 && (actualHome === predictedHome && actualAway === predictedAway)) {
                result = 3;
            }

            const actualAbs = Math.abs(actualHome - actualAway);
            const predictAbs = Math.abs(predictedHome - predictedAway);
            if (result === -1 && (actualAbs === predictAbs && (actualWinner === predictedWinner || isPredictDraw))) {
                result = 2;
            }

            if (result === -1 && (actualWinner === predictedWinner)) {
                result = 1;
            } else {
                if (result === -1) {
                    result = 0;
                }
            }

            const isGroup = match.myGroup.toLowerCase().includes("group")
            if (!isGroup && prediction.winner === match.score.winner) {
                result += 1
            }

            return result;
        }
    }

    applyPointsAndRankings(predictions: Prediction[], matches: Match[], usersFromDb: User[], selectedUserId: User['id'] | null): { predictions: Prediction[]; users: User[] } {
        const users = usersFromDb.map(u => ({ ...u, total_points: 0 }));

        const predictionsWithPoints = predictions.map((prediction: Prediction) => {
            const selectedMatch = matches.find(match => match.myId === prediction.matches.id);
            const points = this.calculatePredictionPoints(selectedMatch, prediction);
            const nextPrediction = { ...prediction, points };

            const userIndex = users.findIndex(user => user.id === prediction.users.id);
            if (userIndex !== -1 && points >= 0) {
                users[userIndex].total_points = (users[userIndex].total_points || 0) + points;
            }

            return nextPrediction;
        });

        const firstUser = users.find(u => u.id === selectedUserId);
        const restUsers = [...users.sort((a, b) => (b.total_points || 0) - (a.total_points || 0))].filter(u => u.id !== firstUser?.id);
        const sortedUsers = firstUser ? [firstUser, ...restUsers] : restUsers;

        return {
            predictions: predictionsWithPoints,
            users: sortedUsers,
        };
    }
}
