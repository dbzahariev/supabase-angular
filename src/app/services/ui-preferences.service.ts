import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UiPreferencesService {
    private readonly showStatsCardsLegacyKey = 'showStatsCards';
    private readonly showStatsCardsKey = 'show-stats-cards';
    private readonly showStatsCardsSubject = new BehaviorSubject<boolean>(this.readShowStatsCardsFromStorage());

    readonly showStatsCards$ = this.showStatsCardsSubject.asObservable();

    getShowStatsCards(): boolean {
        return this.showStatsCardsSubject.value;
    }

    setShowStatsCards(show: boolean): void {
        const nextValue = !!show;
        this.showStatsCardsSubject.next(nextValue);
        localStorage.setItem(this.showStatsCardsKey, nextValue ? 'true' : 'false');
    }

    private readShowStatsCardsFromStorage(): boolean {
        this.migrateShowStatsCardsStorageKey();

        const value = localStorage.getItem(this.showStatsCardsKey);
        if (value === 'true') {
            return true;
        }

        if (value === 'false') {
            return false;
        }

        localStorage.setItem(this.showStatsCardsKey, 'false');
        return false;
    }

    private migrateShowStatsCardsStorageKey(): void {
        const legacyValue = localStorage.getItem(this.showStatsCardsLegacyKey);
        if (legacyValue === null) {
            return;
        }

        const currentValue = localStorage.getItem(this.showStatsCardsKey);
        if (currentValue === null && (legacyValue === 'true' || legacyValue === 'false')) {
            localStorage.setItem(this.showStatsCardsKey, legacyValue);
        }

        localStorage.removeItem(this.showStatsCardsLegacyKey);
    }
}