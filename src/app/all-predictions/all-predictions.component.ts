import { Component, OnInit, inject, OnDestroy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { TableModule } from "primeng/table";
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../supabase';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SelectModule } from 'primeng/select';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AllPredictionsPointsService } from './all-predictions-points.service';
import { AllPredictionsThemeService } from './all-predictions-theme.service';
import { AllPredictionsRealtimeService } from './all-predictions-realtime.service';
import { AllPredictionsExportService } from './all-predictions-export.service';
import { AllPredictionsBackupService } from './all-predictions-backup.service';
import { AllPredictionsPredictionFlowService } from './all-predictions-prediction-flow.service';
import { AllPredictionsMapperService } from './all-predictions-mapper.service';
import { getDeepObjectDifferences } from './deep-object-diff.util';
import { Bet, Match, MatchesApiResponse, Prediction, PredictionBackupEntry, Team, User } from './all-predictions.models';
import { AdminService } from '../services/admin.service';
import { ThemeService } from '../services/theme.service';
import { SelectedUserService } from '../services/selected-user.service';
import { environment } from '../../../environments/environment';

export const IS_SMALL_SCREEN = window.innerWidth < 768;

@Component({
    selector: 'app-all-predictions',
    templateUrl: './all-predictions.component.html',
    styleUrls: ['./all-predictions.component.css'],
    imports: [TableModule, ToastModule, TranslateModule, FormsModule, CommonModule, SelectModule],
    providers: [MessageService]
})
export class AllPredictionsComponent implements OnInit, OnDestroy {
    protected readonly IS_SMALL_SCREEN = IS_SMALL_SCREEN;
    private readonly MATCHES_POLLING_INTERVAL_MS = Math.max(1000, environment.MATCHES_POLLING_INTERVAL_MS ?? 10000);
    private readonly cellWriteDebounceMs = 180;
    betsToShow: Bet[] = [];
    selectedPlayerId: number | null = null;
    allUsersNamesFromDB: User[] = [];
    allUsersNames: User[] = [];
    allPredictions: Prediction[] = [];
    allMatches: Match[] = [];
    allTeams: Team[] = [];
    themeColor = '#ffffff';
    themeBackground = '#ffffff';
    themeTextColor = '#000000';
    mixColor = '#ffffff';
    mixPercent = '85%';

    private supabaseService = inject(SupabaseService);
    private cdr = inject(ChangeDetectorRef);
    private translate = inject(TranslateService);
    private messageService = inject(MessageService);
    private pointsService = inject(AllPredictionsPointsService);
    private themeService = inject(AllPredictionsThemeService);
    private realtimeService = inject(AllPredictionsRealtimeService);
    private exportService = inject(AllPredictionsExportService);
    private backupService = inject(AllPredictionsBackupService);
    private predictionFlowService = inject(AllPredictionsPredictionFlowService);
    private mapperService = inject(AllPredictionsMapperService);
    private adminService = inject(AdminService);
    private globalThemeService = inject(ThemeService);
    private selectedUserService = inject(SelectedUserService);
    private predictionsChannel: RealtimeChannel | null = null;
    private matchesPollingInterval: ReturnType<typeof setInterval> | null = null;
    private destroyRef = inject(DestroyRef);
    private lastMatchesDataHash = '';
    private groupHeaderScrollContainer: HTMLElement | null = null;
    private groupHeaderScrollListener: (() => void) | null = null;
    private cellWriteVersions = new Map<string, number>();
    private activeCellWrites = new Set<string>();
    private recentlySavedCells = new Set<string>();

    get playerSelectOptions(): { label: string; value: number | null }[] {
        const allPlayersLabel = this.translate.instant('TABLE.ALL_PLAYERS');
        return [
            { label: allPlayersLabel, value: null },
            ...this.allUsersNames
                // .filter((user) => user.id !== 1) // Aiko
                .map((user) => ({
                    label: this.getNameFromUser(user),
                    value: user.id,
                })),
        ];
    }

    isAdmin(): boolean {
        return this.adminService.isAdmin();
    }

    isShowRow(product: Bet): boolean {
        return !JSON.parse(localStorage.getItem('hiddenGroups') ?? '[]').includes(product.phase)
    }

    isAllowedToEdit(user: User, product: Bet, j: number): boolean {
        if (this.activeCellWrites.size > 0) {
            return false;
        }

        let result = false;
        if (this.selectedPlayerId === null) {
            result = false;
        }
        if (this.selectedPlayerId!== null && user.id !== 1){
            // debugger;
        }

        // Allow editing own column
        if (this.selectedPlayerId === user.id) {
            result = true;
        }

        // Disallow editing winner for non-admins
        if (j === 2 && !this.isAdmin()) {
            result = !(product.group.split('.')[1].split('_')[0] === 'GROUP');
        }

        // Disallow editing points points for non-admins
        if (j === 3 && !this.isAdmin()) {
            result = false;
        }

        //matchStatus: "FINISHED"
        if (product.matchStatus === 'FINISHED' && !this.isAdmin()) {
            result = false;
        }
        return result
    }

    isCellSaving(user: User, bet: Bet, j: number): boolean {
        return this.activeCellWrites.has(this.getCellWriteKey(user.id, bet.id, j));
    }

    isCellSaved(user: User, bet: Bet, j: number): boolean {
        return this.recentlySavedCells.has(this.getCellWriteKey(user.id, bet.id, j));
    }

    editCell(user: User, product: Bet, j: number): void {
        if (!this.isAllowedToEdit(user, product, j)) {
            return;
        }

        Object.assign(product, { ['edit_' + user.id + '_' + j]: true });
        setTimeout(() => {
            const input = document.querySelector(`input[data-edit-key="${user.id}_${j}"]`) as HTMLInputElement;
            if (input) {
                input.focus();
            }
        }, 0);
    }

    onPlayerSelect(playerId: number | string | null): void {
        if (playerId === null || playerId === '') {
            this.selectedPlayerId = null;
            this.selectedUserService.clearSelectedUserId();
            this.cdr.markForCheck();
            return;
        }

        const parsedPlayerId = Number(playerId);
        if (!Number.isFinite(parsedPlayerId)) {
            this.selectedPlayerId = null;
            this.selectedUserService.clearSelectedUserId();
            this.cdr.markForCheck();
            return;
        }

        this.selectedPlayerId = parsedPlayerId;
        this.selectedUserService.setSelectedUserId(parsedPlayerId);
        this.cdr.markForCheck();
    }

    ngOnInit(): void {
        const themeState = this.themeService.buildThemeState();
        this.themeColor = themeState.themeColor;
        this.themeTextColor = themeState.themeTextColor;
        this.themeBackground = themeState.themeBackground;
        this.mixColor = themeState.mixColor;
        this.mixPercent = themeState.mixPercent;
        this.selectedPlayerId = this.selectedUserService.getSelectedUserId();
        this.fixUsers();
        this.fixTeams();
        this.getAllMatches();
        this.startMatchesPolling();
        this.subscribeToTestPredictions();

        this.translate.onLangChange
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.fixBetToShow();
            });

        this.globalThemeService.themeColor$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                const themeState = this.themeService.buildThemeState();
                this.themeColor = themeState.themeColor;
                this.themeTextColor = themeState.themeTextColor;
                this.themeBackground = themeState.themeBackground;
                this.mixColor = themeState.mixColor;
                this.mixPercent = themeState.mixPercent;
                this.cdr.markForCheck();
            });

        this.globalThemeService.darkModeActive$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                const themeState = this.themeService.buildThemeState();
                this.themeColor = themeState.themeColor;
                this.themeTextColor = themeState.themeTextColor;
                this.themeBackground = themeState.themeBackground;
                this.mixColor = themeState.mixColor;
                this.mixPercent = themeState.mixPercent;
                this.cdr.markForCheck();
            });

            setTimeout(() => this.bindGroupHeaderScrollSync(), 0);
    }

    getAllMatches(): void {
        this.supabaseService.getLiveMatchesFullFromBE().subscribe((data) => {
            this.refreshMatchesWithLiveOverlay(data);
        });
    }

    fixAllMatches(data: MatchesApiResponse): void {
        if (!data || data.length === 0) {
            this.allMatches = [];
        } else {
            this.allMatches = data.map((match: Match, index: number) => {
                const myId = Number("2026" + (index < 9 ? "0" + (index + 1) : (index + 1).toString()));
                const myGroup = this.mapperService.getPhase(match.stage, match.group);

                 if (match.id ===537333){
                    match.status = 'FINISHED';
                    match.score.fullTime.home = 1;
                    match.score.fullTime.away = 1;
                    match.score.duration = "REGULAR";
                    match.score.halfTime.home = 0;
                    match.score.halfTime.away = 1;
                    match.score.winner = "DRAW";
                }

                if (match.id === 537352){
                    match.status = 'FINISHED';
                }

                return {
                    ...match,
                    myId: myId,
                    myGroup: myGroup,
                }
            });
        }

        this.fixPredictions();
    }

    private refreshMatchesWithLiveOverlay(baseMatches: MatchesApiResponse): void {
        if (this.isDataChanged(baseMatches)) {
            this.fixAllMatches(baseMatches);
        }
    }

    ngOnDestroy(): void {
        this.realtimeService.stopPredictionsSubscription(this.predictionsChannel);
        this.predictionsChannel = null;

        this.unbindGroupHeaderScrollSync();

        if (this.matchesPollingInterval) {
            clearInterval(this.matchesPollingInterval);
            this.matchesPollingInterval = null;
        }
    }

    subscribeToTestPredictions(): void {
        if (this.predictionsChannel) {
            return;
        }
        this.predictionsChannel = this.realtimeService.subscribeToPredictions(this.supabaseService, () => this.fixPredictions());
    }

    private startMatchesPolling(): void {
        if (this.matchesPollingInterval) {
            return;
        }

        this.matchesPollingInterval = setInterval(() => {
            this.getAllMatches();
        }, this.MATCHES_POLLING_INTERVAL_MS);
    }

    getNameFromUser(user: User): string {
        return this.mapperService.getNameFromUser(user);
    }

    getLng(): 'bg-BG' | 'en-US' {
        return this.mapperService.getLng();
    }

    getCycleLabelFromBet(bet: Bet): string {
        return this.mapperService.getCycleLabelFromBet(bet);
    }

    getUserPredictionValue(user: User, bet: Bet, columnIndex: number, hidden: boolean): string {
        return this.mapperService.getUserPredictionValue(user, bet, columnIndex, this.allPredictions, hidden);
    }

    getColName(idx: number): string {
        return this.mapperService.getColName(idx);
    }

    returnTranslateFromWin(winner: string | null): string {
        return this.mapperService.returnTranslateFromWin(winner);
    }

    getProductResultRow(bet: Bet, index: number): string {
        return this.mapperService.getProductResultRow(bet, index);
    }

    fixPredictions(): void {
        this.supabaseService.getPredictionsWithUsers().then((response) => {
            this.allPredictions = response.data || [];

            const result = this.pointsService.applyPointsAndRankings(
                this.allPredictions,
                this.allMatches,
                this.allUsersNamesFromDB
            );

            this.allPredictions = result.predictions;
            this.allUsersNames = result.users;
            this.fixBetToShow();
        })
    }

    getPointFromMatch(bet: Match | undefined, prediction: Prediction): number {
        return this.pointsService.calculatePredictionPoints(bet, prediction);
    }

    fixTeams(): void {
        this.supabaseService.getAllTeams().then((response) => {
            this.allTeams = response.data || [];
            this.fixBetToShow();
        })
    }

    fixUsers(): void {
        this.supabaseService.getUsers().then((response) => {
            this.allUsersNamesFromDB = response.data ?? [];
            this.cdr.markForCheck();
        })
    }

    async changePrediction(user: User, bet: Bet, columnIndex: number, newValue: string) {
        // OPTIMISTIC UPDATE: Update local state immediately for instant UI feedback
        const prediction = this.allPredictions.find(p => p.matches.id === bet.id && p.users.id === user.id);
        const cellKey = this.getCellWriteKey(user.id, bet.id, columnIndex);
        const writeVersion = (this.cellWriteVersions.get(cellKey) ?? 0) + 1;
        this.cellWriteVersions.set(cellKey, writeVersion);
        
        // Store old values for rollback if needed
        let oldHome: number | undefined;
        let oldAway: number | undefined;
        let oldWinner: string | undefined;
        
        if (prediction && columnIndex < 2) {
            // Save current state for rollback
            oldHome = prediction.home_ft;
            oldAway = prediction.away_ft;
            oldWinner = prediction.winner;
            
            // Parse the new value
            const score = parseInt(newValue, 10);
            const scoreToSet = isNaN(score) ? -1 : score;
            
            // Update the prediction field
            if (columnIndex === 0) {
                prediction.home_ft = scoreToSet;
            } else if (columnIndex === 1) {
                prediction.away_ft = scoreToSet;
            }
            
            // Recalculate winner based on new values
            if (prediction.home_ft > prediction.away_ft) {
                prediction.winner = 'HOME_TEAM';
            } else if (prediction.away_ft > prediction.home_ft) {
                prediction.winner = 'AWAY_TEAM';
            } else if (prediction.home_ft === -1 || prediction.away_ft === -1) {
                prediction.winner = '';
            } else {
                prediction.winner = 'DRAW';
            }
            
            // Trigger immediate UI update
            this.cdr.markForCheck();
        }
        
        // NOW do the async database operation in the background
        await this.delay(this.cellWriteDebounceMs);
        if (this.cellWriteVersions.get(cellKey) !== writeVersion) {
            return;
        }

        while (this.activeCellWrites.has(cellKey)) {
            await this.delay(30);
            if (this.cellWriteVersions.get(cellKey) !== writeVersion) {
                return;
            }
        }

        this.activeCellWrites.add(cellKey);
        this.cdr.markForCheck();
        await this.delay(30);

        try {
        const timestamp = new Date().toISOString();
        const eventId = this.backupService.generateBackupEventId();

        const result = await this.predictionFlowService.applyChange({
            supabaseService: this.supabaseService,
            user,
            bet,
            columnIndex,
            newValue,
            allMatches: this.allMatches,
            allPredictions: this.allPredictions,
            eventId,
            timestamp,
        });

        void this.persistPredictionBackupRemotely(result.backupEntry);

        if (result.isSkip) {
            return;
        }

        if (this.cellWriteVersions.get(cellKey) !== writeVersion) {
            return;
        }

        if (!result.error && result.shouldRefresh) {
            if (result.isDelete) {
                this.messageService.add({
                    severity: 'info',
                    summary: this.translate.instant('TOAST.PREDICTION_DELETED_TITLE'),
                    detail: this.translate.instant('TOAST.PREDICTION_DELETED_MESSAGE'),
                    life: 3000,
                });
            }
            else {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate.instant('TOAST.PREDICTION_SAVED_TITLE'),
                    detail: this.translate.instant('TOAST.PREDICTION_SAVED_MESSAGE'),
                    life: 3000
                });
            }
            this.recentlySavedCells.add(cellKey);
            setTimeout(() => {
                this.recentlySavedCells.delete(cellKey);
                this.cdr.markForCheck();
            }, 1500);
            this.fixPredictions();
        } else {
            if (this.isConflictLikeError(result.error)) {
                this.fixPredictions();
                return;
            }

            // ROLLBACK: Restore old values on error
            if (prediction && oldHome !== undefined && oldAway !== undefined && oldWinner !== undefined) {
                prediction.home_ft = oldHome;
                prediction.away_ft = oldAway;
                prediction.winner = oldWinner;
                this.cdr.markForCheck();
            }
            
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('TOAST.ERROR_TITLE'),
                detail: this.translate.instant('TOAST.ERROR_MESSAGE'),
                life: 3000
            });
        }
        } finally {
            this.activeCellWrites.delete(cellKey);
            this.cdr.markForCheck();
        }
    }

    private getCellWriteKey(userId: number, betId: number, columnIndex: number): string {
        return `${userId}:${betId}:${columnIndex}`;
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private isConflictLikeError(error: { message?: string; details?: string } | null): boolean {
        if (!error) {
            return false;
        }

        const raw = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
        return raw.includes('409')
            || raw.includes('conflict')
            || raw.includes('duplicate')
            || raw.includes('unique constraint');
    }

    downloadTableAsExcel() {
        const exportResult = this.exportService.exportToExcel({
            allUsersNames: this.allUsersNames,
            betsToShow: this.betsToShow,
            isShowRow: (bet: Bet) => this.isShowRow(bet),
            getNameFromUser: (user: User) => this.mapperService.getNameFromUser(user),
            getUserPredictionValue: (user: User, bet: Bet, columnIndex: number) => this.mapperService.getUserPredictionValue(user, bet, columnIndex, this.allPredictions, true),
            translate: (key: string) => this.translate.instant(key),
            translateGroup: (groupKey: string) => this.translate.instant(groupKey),
            translateWinnerShort: (winner: string) => this.mapperService.returnTranslateFromWin(winner),
            getCycleLabelFromBet: (bet: Bet) => this.mapperService.getCycleLabelFromBet(bet),
            formatLocalDateTime: (date: Date, mode: 'display' | 'filename') => this.backupService.formatLocalDateTime(date, mode),
            getSheetName: () => this.translate.instant('TABLE.SHEET_NAME'),
        });

        void this.persistPredictionBackupRemotely({
            event_id: this.backupService.generateBackupEventId(),
            timestamp: new Date().toISOString(),
            action: 'download',
            user_id: 1,
            match_id: 202601,
            prediction_id: null,
            column_index: -1,
            input_value: 'excel_export',
            payload: { table_snapshot: JSON.stringify(exportResult.wsData) },
        });

        this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('TOAST.EXCEL_DOWNLOADED_TITLE'),
            detail: this.translate.instant('TOAST.EXCEL_DOWNLOADED_MESSAGE'),
            life: 2500,
        });
    }

    downloadTableAsExcelMini() {
        const timedBetsToShow = this.betsToShow.filter((bet: Bet) =>
            String(bet.matchStatus).toUpperCase() === "FINISHED"
        );

        const exportResult = this.exportService.exportToExcel({
            allUsersNames: this.allUsersNames,
            betsToShow: timedBetsToShow,
            includeDateTimeAndGroup: false,
            includePhaseRows: false,
            isShowRow: (bet: Bet) => this.isShowRow(bet),
            getNameFromUser: (user: User) => this.mapperService.getNameFromUser(user),
            getUserPredictionValue: (user: User, bet: Bet, columnIndex: number) => this.mapperService.getUserPredictionValue(user, bet, columnIndex, this.allPredictions, true),
            translate: (key: string) => this.translate.instant(key),
            translateGroup: (groupKey: string) => this.translate.instant(groupKey),
            translateWinnerShort: (winner: string) => this.mapperService.returnTranslateFromWin(winner),
            getCycleLabelFromBet: (bet: Bet) => this.mapperService.getCycleLabelFromBet(bet),
            formatLocalDateTime: (date: Date, mode: 'display' | 'filename') => this.backupService.formatLocalDateTime(date, mode),
            getSheetName: () => this.translate.instant('TABLE.SHEET_NAME'),
        });

        void this.persistPredictionBackupRemotely({
            event_id: this.backupService.generateBackupEventId(),
            timestamp: new Date().toISOString(),
            action: 'download',
            user_id: 1,
            match_id: 202601,
            prediction_id: null,
            column_index: -1,
            input_value: 'excel_export',
            payload: { table_snapshot: JSON.stringify(exportResult.wsData) },
        });

        this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('TOAST.EXCEL_DOWNLOADED_TITLE'),
            detail: this.translate.instant('TOAST.EXCEL_DOWNLOADED_MESSAGE'),
            life: 2500,
        });
    }

    async downloadPredictionBackup() {
        const entries = await this.backupService.getPredictionBackupEntries(this.supabaseService);
        this.backupService.downloadEntriesAsJson(entries);

        this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('TOAST.BACKUP_DOWNLOADED_TITLE'),
            detail: entries.length === 0
                ? this.translate.instant('TOAST.BACKUP_DOWNLOADED_EMPTY_MESSAGE')
                : this.translate.instant('TOAST.BACKUP_DOWNLOADED_MESSAGE', { count: entries.length }),
            life: 2500,
        });
    }

    private async persistPredictionBackupRemotely(entry: PredictionBackupEntry): Promise<void> {
        const backupResult = await this.backupService.persistPredictionBackupRemotely(this.supabaseService, entry);
        if (backupResult.warnOnce) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('TOAST.BACKUP_REMOTE_WARN_TITLE'),
                detail: this.translate.instant('TOAST.BACKUP_REMOTE_WARN_MESSAGE'),
                life: 4500,
            });
        }
    }

    fixBetToShow(): void {
        this.betsToShow = this.mapperService.buildBetsToShow(this.allMatches, this.allTeams);
        this.cdr.markForCheck();
        setTimeout(() => this.bindGroupHeaderScrollSync(), 0);
    }

    private updateGroupHeaderTops(container: HTMLElement, host: HTMLElement): void {
        const baseTopPx = parseFloat(getComputedStyle(host).getPropertyValue('--group-header-top').trim()) || 58;
        const groupHeaders = Array.from(
            container.querySelectorAll('tr.p-datatable-row-group-header')
        ) as HTMLElement[];
        if (groupHeaders.length === 0) return;
        const containerTop = container.getBoundingClientRect().top;
        let stickyTop = baseTopPx;
        for (const header of groupHeaders) {
            header.style.top = `${stickyTop}px`;
            const td = header.querySelector('td') as HTMLElement | null;
            if (td) td.style.top = `${stickyTop}px`;
            const rect = header.getBoundingClientRect();
            const visualTop = rect.top - containerTop;
            if (Math.round(visualTop) <= stickyTop + 1) {
                stickyTop += Math.round(rect.height);
            }
        }
    }

    private syncGroupHeaderTopOffset(host: HTMLElement): void {
        const stickyHead = document.querySelector('.sticky_top .p-datatable-thead') as HTMLElement | null;
        if (!stickyHead) {
            return;
        }

        const headerHeight = Math.ceil(stickyHead.getBoundingClientRect().height);
        if (headerHeight > 0) {
            host.style.setProperty('--group-header-top', `${headerHeight}px`);
        }
    }

    private bindGroupHeaderScrollSync(): void {
        const host = document.querySelector('.table-container') as HTMLElement | null;
        const container = document.querySelector('.sticky_top .p-datatable-table-container') as HTMLElement | null;
        if (!host || !container) {
            return;
        }

        if (this.groupHeaderScrollContainer === container && this.groupHeaderScrollListener) {
            this.groupHeaderScrollListener();
            return;
        }

        this.unbindGroupHeaderScrollSync();

        this.groupHeaderScrollListener = () => {
            this.syncGroupHeaderTopOffset(host);
            host.style.setProperty('--group-scroll-x', `${container.scrollLeft}px`);
            this.updateGroupHeaderTops(container, host);
        };

        container.addEventListener('scroll', this.groupHeaderScrollListener, { passive: true });
        this.groupHeaderScrollContainer = container;
        this.groupHeaderScrollListener();
    }

    private unbindGroupHeaderScrollSync(): void {
        if (this.groupHeaderScrollContainer && this.groupHeaderScrollListener) {
            this.groupHeaderScrollContainer.removeEventListener('scroll', this.groupHeaderScrollListener);
        }

        this.groupHeaderScrollContainer = null;
        this.groupHeaderScrollListener = null;
    }

    toggleGroup(pro: Bet): void {
        const hiddenGroups = JSON.parse(localStorage.getItem('hiddenGroups') ?? '[]') as string[];
        const updated = hiddenGroups.includes(pro.phase)
            ? hiddenGroups.filter((x: string) => x !== pro.phase)
            : [...hiddenGroups, pro.phase];
        localStorage.setItem('hiddenGroups', JSON.stringify(updated));
        this.cdr.markForCheck();
    }

    private isDataChanged(data: MatchesApiResponse): boolean {
        const { changed, hash } = this.realtimeService.hasMatchesDataChanged(data, this.lastMatchesDataHash);
        if (!changed) {
            return false;
        }

        const previousData: MatchesApiResponse = this.lastMatchesDataHash
            ? JSON.parse(this.lastMatchesDataHash)
            : [];

        const differences = getDeepObjectDifferences(previousData, data);

        if (differences.length === 0) {
            console.log('No differences found');
            return false;
        }
        console.log('Differences found:', differences.filter(diff => diff.before === null));

        this.lastMatchesDataHash = hash;
        return true;
    }
}