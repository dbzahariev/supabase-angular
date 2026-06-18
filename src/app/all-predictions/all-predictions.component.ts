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
import { Socket } from 'socket.io-client';
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
import { environment } from '../../../environments/environment';
import { catchError, of } from 'rxjs';

export const IS_SMALL_SCREEN = window.innerWidth < 768;
const SELECTED_USER_ID_STORAGE_KEY = 'selectedUserId';

@Component({
    selector: 'app-all-predictions',
    templateUrl: './all-predictions.component.html',
    styleUrls: ['./all-predictions.component.css'],
    imports: [TableModule, ToastModule, TranslateModule, FormsModule, CommonModule, SelectModule],
    providers: [MessageService]
})
export class AllPredictionsComponent implements OnInit, OnDestroy {
    protected readonly IS_SMALL_SCREEN = IS_SMALL_SCREEN;
    private static readonly LIVE_OVERRIDE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT']);
    private readonly MATCHES_POLLING_INTERVAL_MS = Math.max(1000, environment.matchesPollingIntervalMs ?? 10000);
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
    private predictionsChannel: RealtimeChannel | null = null;
    private matchesPollingInterval: ReturnType<typeof setInterval> | null = null;
    private matchesSocket: Socket | null = null;
    private destroyRef = inject(DestroyRef);
    private lastMatchesDataHash = '';
    private groupHeaderScrollContainer: HTMLElement | null = null;
    private groupHeaderScrollListener: (() => void) | null = null;

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

    constructor() {
        this.matchesSocket = this.realtimeService.createMatchesSocket((data) => {
            const response = data as MatchesApiResponse;
            this.refreshMatchesWithLiveOverlay(response);
        });
    }

    isAdmin(): boolean {
        return this.adminService.isAdmin();
    }

    isShowRow(product: Bet): boolean {
        return !JSON.parse(localStorage.getItem('hiddenGroups') ?? '[]').includes(product.phase)
    }

    isAllowedToEdit(user: User, product: Bet, j: number): boolean {
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
            localStorage.removeItem(SELECTED_USER_ID_STORAGE_KEY);
            this.cdr.markForCheck();
            return;
        }

        const parsedPlayerId = Number(playerId);
        if (!Number.isFinite(parsedPlayerId)) {
            this.selectedPlayerId = null;
            localStorage.removeItem(SELECTED_USER_ID_STORAGE_KEY);
            this.cdr.markForCheck();
            return;
        }

        this.selectedPlayerId = parsedPlayerId;
        localStorage.setItem(SELECTED_USER_ID_STORAGE_KEY, String(parsedPlayerId));
        this.cdr.markForCheck();
    }

    ngOnInit(): void {
        const themeState = this.themeService.buildThemeState();
        this.themeColor = themeState.themeColor;
        this.themeTextColor = themeState.themeTextColor;
        this.themeBackground = themeState.themeBackground;
        this.mixColor = themeState.mixColor;
        this.mixPercent = themeState.mixPercent;
        const savedPlayerId =
            localStorage.getItem(SELECTED_USER_ID_STORAGE_KEY) ?? localStorage.getItem('selectedPlayerId');
        this.selectedPlayerId = savedPlayerId ? Number(savedPlayerId) : null;
        this.fixUsers();
        this.fixTeams();
        this.getAllMatches();
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
        this.supabaseService.getAllMatchesFromBE().subscribe((data) => {
            this.refreshMatchesWithLiveOverlay(data);
        });
    }

    getTimeWindow(utcTime: string | Date):
        "past" | "next10" | "next20" | "later" {

        const now = new Date();
        const target = new Date(utcTime);

        const diffMs = target.getTime() - now.getTime();
        const diffMin = diffMs / (1000 * 60);

        if (diffMin < 0) return "past";
        if (diffMin <= 10) return "next10";
        if (diffMin <= 20) return "next20";
        return "later";
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

                if (match.status!== 'FINISHED' && match.status!== 'TIMED'){
                    console.log('Match with id ' + match.id + ' has status ' + match.status + ' and is not FINISHED or TIMED');
                }
                const inNext10Min = this.getTimeWindow(match.utcDate) === 'next10'

                if (inNext10Min) {
                    match.status = 'IN_PLAY'
                    match.score.fullTime.home = 0
                    match.score.fullTime.away = 0
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
        this.supabaseService.getLiveMatchesFromBE()
            .pipe(catchError(() => of([] as Match[])))
            .subscribe((liveMatches) => {
                const mergedMatches = this.mergeLiveMatchData(baseMatches, liveMatches);
                if (this.isDataChanged(mergedMatches)) {
                    this.fixAllMatches(mergedMatches);
                }
            });
    }

    private mergeLiveMatchData(baseMatches: MatchesApiResponse, liveMatches: Match[]): MatchesApiResponse {
        if (!Array.isArray(baseMatches) || baseMatches.length === 0) {
            return [];
        }

        if (!Array.isArray(liveMatches) || liveMatches.length === 0) {
            return baseMatches;
        }

        const liveMatchesById = new Map(
            liveMatches
                .filter((match) => this.shouldUseLiveOverride(match))
                .map((match) => [match.id, match] as const)
        );

        if (liveMatchesById.size === 0) {
            return baseMatches;
        }

        return baseMatches.map((match) => {
            const liveMatch = liveMatchesById.get(match.id);
            if (!liveMatch) {
                return match;
            }

            return {
                ...match,
                status: liveMatch.status ?? match.status,
                lastUpdated: liveMatch.lastUpdated ?? match.lastUpdated,
                score: liveMatch.score ?? match.score,
            };
        });
    }

    private shouldUseLiveOverride(match: Match | null | undefined): boolean {
        const status = String(match?.status ?? '').toUpperCase();
        return AllPredictionsComponent.LIVE_OVERRIDE_STATUSES.has(status);
    }

    ngOnDestroy(): void {
        this.realtimeService.stopPredictionsSubscription(this.predictionsChannel);
        this.predictionsChannel = null;

        this.realtimeService.disconnectMatchesSocket();
        this.matchesSocket = null;

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
            // this.fixPredictions();
        } else {
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
            host.style.setProperty('--group-scroll-x', `${container.scrollLeft}px`);
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