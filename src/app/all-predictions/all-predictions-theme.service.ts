import { Injectable } from '@angular/core';

export interface AllPredictionsThemeState {
    themeColor: string;
    themeBackground: string;
    themeTextColor: string;
    mixColor: string;
    mixPercent: string;
}

@Injectable({ providedIn: 'root' })
export class AllPredictionsThemeService {
    buildThemeState(storage: Pick<Storage, 'getItem'> = localStorage): AllPredictionsThemeState {
        const themeColor = storage.getItem('theme-color') ?? '#ffffff';
        const themeTextColor = this.getContrastYIQ(themeColor);
        const themeBackground = this.isDarkModeActive(storage) ? '#000000' : '#ffffff';
        const mixColor = themeTextColor === '#000000' ? '#ffffff' : '#000000';
        const mixPercent = themeTextColor === '#000000' ? '85%' : '40%';

        return {
            themeColor,
            themeBackground,
            themeTextColor,
            mixColor,
            mixPercent,
        };
    }

    private getContrastYIQ(hexcolor: string): string {
        if (!hexcolor || hexcolor.length < 6) {
            return '#000000';
        }

        let normalized = hexcolor.replace('#', '');
        if (normalized.length === 3) {
            normalized = normalized.split('').map(char => char + char).join('');
        }

        const r = parseInt(normalized.substring(0, 2), 16);
        const g = parseInt(normalized.substring(2, 4), 16);
        const b = parseInt(normalized.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

        return yiq >= 128 ? '#000000' : '#ffffff';
    }

    private isDarkModeActive(storage: Pick<Storage, 'getItem'>): boolean {
        const mode = storage.getItem('dark-mode') ?? 'disabled';
        if (mode === 'enabled') {
            return true;
        }

        if (mode === 'disabled') {
            return false;
        }

        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }

        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
}
