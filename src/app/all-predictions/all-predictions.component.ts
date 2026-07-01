import { Component, OnInit, inject, OnDestroy, AfterViewInit, ElementRef, ChangeDetectorRef, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';

import { AllPredictionsPointsService } from './all-predictions-points.service';
import { AllPredictionsThemeService } from './all-predictions-theme.service';
import { AllPredictionsRealtimeService } from './all-predictions-realtime.service';
import { AllPredictionsExportService } from './all-predictions-export.service';
import { AllPredictionsBackupService } from './all-predictions-backup.service';
import { AllPredictionsPredictionFlowService } from './all-predictions-prediction-flow.service';
import { AllPredictionsMapperService } from './all-predictions-mapper.service';
import { getDeepObjectDifferences } from './deep-object-diff.util';
import { Bet, Match, MatchesApiResponse, Prediction, PredictionBackupEntry, Team, User } from './all-predictions.models';
import { OneMatchToInsert, SupabaseService } from '../supabase';
import { AdminService } from '../services/admin.service';
import { ThemeService } from '../services/theme.service';
import { SelectedUserService } from '../services/selected-user.service';
import { UiPreferencesService } from '../services/ui-preferences.service';
import { environment } from '../../../environments/environment';
import { FifaCalendarMatch, FifaCalendarService } from '../services/fifa-calendar.service';
import { firstValueFrom, map } from 'rxjs';

interface PredictionRollbackState {
    home: number;
    away: number;
    winner: string;
}

@Component({
    selector: 'app-all-predictions',
    templateUrl: './all-predictions.component.html',
    styleUrls: ['./all-predictions.component.css'],
    imports: [TableModule, ToastModule, TranslateModule, FormsModule, CommonModule, SelectModule],
    providers: [MessageService]
})
export class AllPredictionsComponent implements OnInit, AfterViewInit, OnDestroy {
    protected IS_SMALL_SCREEN = this.computeIsSmallScreen();
    private readonly MATCHES_POLLING_INTERVAL_MS = Math.max(1000, environment.MATCHES_POLLING_INTERVAL_MS ?? 10000);
    private readonly GROUP_FILTER_STORAGE_KEY = 'all_predictions.selected_group_filter';
    private readonly TEAM_FILTER_STORAGE_KEY = 'all_predictions.selected_team_filter';
    private readonly FEATURES_NOTICE_MAIN_STORAGE_KEY = 'all_predictions.features_notice.main.v1.dismissed';
    private readonly FEATURES_NOTICE_PHASE_STORAGE_KEY = 'all_predictions.features_notice.phase.v1.dismissed';
    private readonly FEATURES_NOTICE_GROUPS_TAB_STORAGE_KEY = 'all_predictions.features_notice.groups_tab.v1.dismissed';
    private readonly FEATURES_NOTICE_ELIMINATIONS_TAB_STORAGE_KEY = 'all_predictions.features_notice.eliminations_tab.v1.dismissed';
    private readonly HIDDEN_GROUPS_STORAGE_KEY = 'hiddenGroups';
    private readonly BACKUP_DOWNLOAD_USER_ID = 1;
    private readonly BACKUP_DOWNLOAD_MATCH_ID = 202601;
    private readonly fifaGoalEventTypes = new Set([0, 34]);
    private readonly cellWriteDebounceMs = 180;
    betsToShow: Bet[] = [];
    selectedPlayerId: number | null = null;
    allUsersNamesFromDB: User[] = [];
    allUsersNames: User[] = [];
    allPredictions: Prediction[] = [];
    allMatches: Match[] = [];
    fifaMatches: FifaCalendarMatch[] = [];
    allTeams: Team[] = [];
    themeColor = '#ffffff';
    themeBackground = '#ffffff';
    themeTextColor = '#000000';
    mixColor = '#ffffff';
    mixPercent = '85%';
    // Stats properties
    totalMatches = 0;
    finishedMatches = 0;
    inProgressMatches = 0;
    upcomingMatches = 0;
    userAccuracy = 0;
    showStatsCards = true;
    selectedGroupFilter: string | null = null;
    selectedTeamFilter: string | null = null;
    selectedPhaseFilter: string | null = null;
    showFeaturesNoticeMain = false;
    showFeaturesNoticePhase = false;
    showFeaturesNoticeGroupsTab = false;
    showFeaturesNoticeEliminationsTab = false;
    isDownloadingExcel90 = false;

    private supabaseService = inject(SupabaseService);
    private cdr = inject(ChangeDetectorRef);
    private el = inject(ElementRef);
    private translate = inject(TranslateService);
    private messageService = inject(MessageService);
    private pointsService = inject(AllPredictionsPointsService);
    private themeService = inject(AllPredictionsThemeService);
    private realtimeService = inject(AllPredictionsRealtimeService);
    private exportService = inject(AllPredictionsExportService);
    private backupService = inject(AllPredictionsBackupService);
    private predictionFlowService = inject(AllPredictionsPredictionFlowService);
    public mapperService = inject(AllPredictionsMapperService);
    protected readonly adminService = inject(AdminService);
    private globalThemeService = inject(ThemeService);
    private selectedUserService = inject(SelectedUserService);
    private fifaCalendarService = inject(FifaCalendarService);
    private uiPreferencesService = inject(UiPreferencesService);
    private predictionsChannel: RealtimeChannel | null = null;
    private matchesPollingInterval: ReturnType<typeof setInterval> | null = null;
    private destroyRef = inject(DestroyRef);
    private lastMatchesDataHash = '';
    private groupHeaderScrollContainer: HTMLElement | null = null;
    private groupHeaderScrollListener: (() => void) | null = null;
    private cellWriteVersions = new Map<string, number>();
    private activeCellWrites = new Set<string>();
    private recentlySavedCells = new Set<string>();
    ngAfterViewInit(): void {
        setTimeout(() => this.syncGroupHeaderTop());
    }

    private syncGroupHeaderTop(): void {
        const thead = this.el.nativeElement.querySelector('.p-datatable-thead');
        if (thead) {
            this.el.nativeElement.style.setProperty('--group-header-top', `${thead.offsetHeight}px`);
        }
    }

    async insertMissingMatchEntries() {
        const existingMatches = ((await this.supabaseService.getMatches()).data)?.filter((val) => val.id > 202600)
        const matchesToInsert: OneMatchToInsert[] = []
        this.allMatches.forEach((match) => {
            const existingMatch = existingMatches?.find((prediction) => prediction.id === match.myId)
            if (existingMatch === undefined) {
                const id = match.myId
                const home_team_id = this.allTeams.find(team => team.name_en === match.homeTeam.name)?.id;
                const away_team_id = this.allTeams.find(team => team.name_en === match.awayTeam.name)?.id;
                const groupName = match.stage
                if (home_team_id && away_team_id) {
                    const newMatch: OneMatchToInsert = {
                        id: id,
                        home_team_id: home_team_id,
                        away_team_id: away_team_id,
                        utc_date: match.utcDate,
                        group_name: groupName
                    }
                    matchesToInsert.push(newMatch)
                }
            }
            return false
        })

        if (this.allMatches.length > 0 && matchesToInsert.length > 0) {
            this.supabaseService.mutateRows({
                table: 'matches',
                action: 'insert',
                payload: matchesToInsert,
            }).then((val) => {
                console.log(val)
            })
        }
    }

    // Method to calculate stats
    calculateStats(): void {
        if (!this.allMatches || this.allMatches.length === 0) {
            this.totalMatches = 0;
            this.finishedMatches = 0;
            this.inProgressMatches = 0;
            this.upcomingMatches = 0;
            this.userAccuracy = 0;
            return;
        }

        this.totalMatches = this.allMatches.length;

        this.finishedMatches = this.allMatches.filter((match) => this.isFinishedMatchStatus(match.status)).length;
        this.inProgressMatches = this.allMatches.filter((match) => this.isInProgressMatchStatus(match.status)).length;

        this.upcomingMatches = Math.max(0, this.totalMatches - this.finishedMatches - this.inProgressMatches);

        this.userAccuracy = this.selectedPlayerId === null
            ? this.getAllPlayersAverageAccuracy()
            : this.getSelectedPlayerAccuracy();


        this.cdr.markForCheck();
    }

    get finishedMatchesDisplay(): string {
        if (this.inProgressMatches > 0) {
            return `${this.finishedMatches} + ${this.inProgressMatches}`;
        }

        return `${this.finishedMatches}`;
    }

    private isInProgressMatchStatus(status: string | null | undefined): boolean {
        const normalized = String(status ?? '').toUpperCase();
        return normalized === 'IN_PLAY'
            || normalized === 'PAUSED'
            || normalized === 'EXTRA_TIME'
            || normalized === 'PENALTY_SHOOTOUT'
            || normalized === 'SUSPENDED'
            || normalized === 'LIVE';
    }

    protected isMatchInProgress(bet: Bet | null | undefined): boolean {
        return this.isInProgressMatchStatus(bet?.matchStatus);
    }

    private isFinishedMatchStatus(status: string | null | undefined): boolean {
        return String(status ?? '').toUpperCase() === 'FINISHED';
    }

    // Method to determine cell background color
    getCellColorClass(user: User, bet: Bet, j: number): string {
        // Only color the points column (j === 3)
        if (j !== 3) {
            return '';
        }

        // Get the predicted value (points)
        const prediction = this.mapperService.getUserPredictionValue(user, bet, j, this.allPredictions, false);
        if (!prediction) {
            return '';
        }

        // Parse the points value
        const points = parseInt(prediction, 10);
        if (isNaN(points)) {
            return '';
        }

        // Return color class based on points
        if (points >= 3) {
            return 'points-3'; // Green for 3 points or great then 3
        } else if (points === 2) {
            return 'points-2'; // Yellow for 2 points
        } else if (points === 1) {
            return 'points-1'; // Blue for 1 point
        } else if (points === 0) {
            return 'points-0'; // Red for 0 points
        }

        return '';
    }

    getGroupHeaderStageTitle(product: Bet): string {
        return this.translate.instant(`${product.stage}_TITLE`);
    }

    getGroupHeaderCoefficientLabel(product: Bet): string {
        const matchPhaseKey = this.allMatches.find((match) => match.myId === product.id)?.myGroup;
        const multiplier = this.pointsService.getPhasePointMultiplier(matchPhaseKey ?? product.group ?? product.stage);
        const coefficientLabel = this.translate.instant('TABLE.PHASE_COEFFICIENT');

        return `${coefficientLabel} ${this.formatDisplayNumber(multiplier)}`;
    }

    private formatDisplayNumber(value: number): string {
        return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
    }

    // Calculates weighted accuracy for the selected player based on earned points (0..3 per finished match).
    private getSelectedPlayerAccuracy(): number {
        if (this.selectedPlayerId === null) {
            return 0;
        }

        return this.getPlayerAccuracyById(this.selectedPlayerId);
    }

    private getAllPlayersAverageAccuracy(): number {
        if (!this.allUsersNames || this.allUsersNames.length === 0) {
            return 0;
        }

        const accuracies = this.allUsersNames
            .map((user) => this.getPlayerAccuracyById(user.id))
            .filter((accuracy) => Number.isFinite(accuracy));

        if (accuracies.length === 0) {
            return 0;
        }

        const total = accuracies.reduce((sum, accuracy) => sum + accuracy, 0);
        return Math.round(total / accuracies.length);
    }

    private getPlayerAccuracyById(playerId: number): number {
        if (!this.allPredictions || this.allPredictions.length === 0 || !this.allMatches || this.allMatches.length === 0) {
            return 0;
        }

        const selectedId = Number(playerId);
        if (!Number.isFinite(selectedId)) {
            return 0;
        }

        const selectedUserPredictions = this.allPredictions.filter((prediction) => Number(prediction.users?.id) === selectedId);
        if (selectedUserPredictions.length === 0) {
            return 0;
        }

        const matchesById = new Map<number, Match>(
            this.allMatches.map((match) => [Number(match.myId ?? match.id), match])
        );

        let earnedPoints = 0;
        let evaluatedPredictions = 0;

        for (const prediction of selectedUserPredictions) {
            const predictionMatchId = Number(prediction.matches?.id);
            const match = matchesById.get(predictionMatchId);
            const score = match?.score?.fullTime;

            // Only evaluate matches with final full-time score.
            if (!score || typeof score.home !== 'number' || typeof score.away !== 'number' || score.home < 0 || score.away < 0) {
                continue;
            }

            const points = this.pointsService.calculatePredictionPoints(match, prediction);
            if (points < 0) {
                continue;
            }

            earnedPoints += points;
            evaluatedPredictions++;
        }

        const maxPossiblePoints = evaluatedPredictions * 3;
        return maxPossiblePoints > 0 ? Math.round((earnedPoints / maxPossiblePoints) * 100) : 0;
    }

    get playerSelectOptions(): { label: string; value: number | null }[] {
        const allPlayersLabel = this.translate.instant('TABLE.ALL_PLAYERS');
        return [
            { label: allPlayersLabel, value: null },
            ...this.allUsersNames
                // .filter((user) => user.id !== 1) // Aiko
                .map((user) => ({
                    label: this.mapperService.getNameFromUser(user),
                    value: user.id,
                })),
        ];
    }

    get playerSelectScrollHeight(): string {
        const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
        const optionCount = this.allUsersNames.length + 1;
        const optionHeight = this.IS_SMALL_SCREEN ? 46 : 44;
        const panelPadding = 16;
        const minHeight = this.IS_SMALL_SCREEN ? 280 : 264;
        const maxViewportRatio = this.IS_SMALL_SCREEN ? 0.85 : 0.7;
        const maxHeight = Math.floor(viewportHeight * maxViewportRatio);
        const maxVisibleRows = Math.max(1, Math.floor((maxHeight - panelPadding) / optionHeight));
        const visibleRows = Math.max(1, Math.min(optionCount, maxVisibleRows));
        const desiredHeight = visibleRows * optionHeight + panelPadding;
        const clampedHeight = Math.min(maxHeight, Math.max(minHeight, desiredHeight));

        return `${clampedHeight}px`;
    }

    get filteredBetsToShow(): Bet[] {
        if (!this.selectedGroupFilter && !this.selectedTeamFilter && !this.selectedPhaseFilter) {
            return this.betsToShow;
        }

        return this.betsToShow.filter((bet) => {
            const isGroupMatch = !this.selectedGroupFilter || bet.group === this.selectedGroupFilter;
            const isTeamMatch = !this.selectedTeamFilter || bet.home_team === this.selectedTeamFilter || bet.away_team === this.selectedTeamFilter;
            const isPhaseMatch = !this.selectedPhaseFilter || bet.stage === this.selectedPhaseFilter;
            return isGroupMatch && isTeamMatch && isPhaseMatch;
        });
    }

    get selectedGroupFilterLabel(): string {
        if (!this.selectedGroupFilter) {
            return '';
        }

        return this.translate.instant(this.selectedGroupFilter);
    }

    get selectedTeamFilterLabel(): string {
        return this.selectedTeamFilter ?? '';
    }

    get selectedPhaseFilterLabel(): string {
        if (!this.selectedPhaseFilter) {
            return '';
        }

        return this.translate.instant(`${this.selectedPhaseFilter}_TITLE`);
    }

    @HostListener('window:resize')
    onWindowResize(): void {
        const nextIsSmallScreen = this.computeIsSmallScreen();
        if (nextIsSmallScreen !== this.IS_SMALL_SCREEN) {
            this.IS_SMALL_SCREEN = nextIsSmallScreen;
        }

        this.syncGroupHeaderTop();
        this.cdr.markForCheck();
    }

    isShowRow(product: Bet): boolean {
        return !this.getHiddenGroups().includes(product.phase);
    }

    isAllowedToEdit(user: User, product: Bet, j: number): boolean {
        if (this.activeCellWrites.size > 0) {
            return false;
        }

        let result = false;
        if (this.selectedPlayerId === null) {
            result = false;
        }

        // Allow editing own column
        if (this.selectedPlayerId === user.id) {
            result = true;
        }

        // Disallow editing winner for non-admins
        if (j === 2 && !this.adminService.isAdmin()) {
            const roundKey = product.group.split('.')[1]
            const roundPrefix = roundKey.split('_')[0]

            if (roundPrefix !== "GROUP" && (roundKey === 'LAST_32' || roundKey === 'LAST_16' || roundKey === 'QUARTER_FINALS' || roundKey === 'SEMI_FINALS' || roundKey === 'THIRD_PLACE' || roundKey === 'FINAL')) {
                const selectedPrediction = this.allPredictions
                    .filter((item) => item.matches.id === product.id)
                    .find((item) => item.users.id === user.id)
                if (selectedPrediction) {
                    if (selectedPrediction?.home_ft === selectedPrediction?.away_ft) {
                        // Now I have predict with DRAW predict
                        result = true
                    }
                    else {
                        // Now I have predict with NOT DRAW predict
                        result = false
                    }
                }
                else {
                    result = false
                    // User not Give predict
                }
            } else {
                result = !(product.group.split('.')[1].split('_')[0] === 'GROUP');
            }

        }

        // Disallow editing points points for non-admins
        if (j === 3 && !this.adminService.isAdmin()) {
            result = false;
        }

        //matchStatus: "FINISHED"
        if (product.matchStatus === 'FINISHED' && !this.adminService.isAdmin()) {
            result = false;
        }

        if (result) {
            const homeTeamName = this.allMatches.find((item) => item.myId === product.id)?.homeTeam.name
            const awayTeamName = this.allMatches.find((item) => item.myId === product.id)?.awayTeam.name
            const toResFalse = homeTeamName === null || awayTeamName === null
            result = toResFalse ? false : true
        }

        return result;
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
        const parsedPlayerId = playerId === null || playerId === '' ? Number.NaN : Number(playerId);

        if (!Number.isFinite(parsedPlayerId)) {
            this.resetSelectedPlayer();
            return;
        }

        this.selectedPlayerId = parsedPlayerId;
        this.selectedUserService.setSelectedUserId(parsedPlayerId);
        this.calculateStats();
        this.fixPredictions();
        this.cdr.markForCheck();
    }

    private resetSelectedPlayer(): void {
        this.selectedPlayerId = null;
        this.selectedUserService.clearSelectedUserId();
        this.calculateStats();
        this.fixPredictions();
        this.cdr.markForCheck();
    }

    ngOnInit(): void {
        this.showStatsCards = this.uiPreferencesService.getShowStatsCards();
        this.selectedGroupFilter = this.loadSelectedGroupFilter();
        this.selectedTeamFilter = this.loadSelectedTeamFilter();
        this.showFeaturesNoticeMain = this.loadShouldShowFeaturesNotice(this.FEATURES_NOTICE_MAIN_STORAGE_KEY);
        this.showFeaturesNoticePhase = this.loadShouldShowFeaturesNotice(this.FEATURES_NOTICE_PHASE_STORAGE_KEY);
        this.showFeaturesNoticeGroupsTab = this.loadShouldShowFeaturesNotice(this.FEATURES_NOTICE_GROUPS_TAB_STORAGE_KEY);
        this.showFeaturesNoticeEliminationsTab = this.loadShouldShowFeaturesNotice(this.FEATURES_NOTICE_ELIMINATIONS_TAB_STORAGE_KEY);

        this.applyThemeState();
        this.selectedPlayerId = this.selectedUserService.getSelectedUserId();
        this.fixUsers();
        this.fixTeams();
        this.getAllMatches();
        this.startMatchesPolling();
        if (!this.predictionsChannel) {
            this.predictionsChannel = this.realtimeService.subscribeToPredictions(this.supabaseService, () => this.fixPredictions());
        }

        this.translate.onLangChange
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.fixBetToShow();
            });

        this.globalThemeService.themeColor$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.applyThemeState();
                this.cdr.markForCheck();
            });

        this.globalThemeService.darkModeActive$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.applyThemeState();
                this.cdr.markForCheck();
            });

        this.uiPreferencesService.showStatsCards$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((showStatsCards) => {
                this.showStatsCards = showStatsCards;
                this.cdr.markForCheck();
            });

        setTimeout(() => this.bindGroupHeaderScrollSync(), 0);
    }

    private getAllMatches(): void {
        this.fifaCalendarService.getSeasonMatches()
            .pipe(map((response) => response.Results ?? []))
            .subscribe((responseFromFifa) => {
                this.fifaMatches = responseFromFifa;

                this.supabaseService.getLiveMatchesFullFromBE().subscribe((data) => {
                    this.insertMissingMatchEntries().then(() => {
                        const newDate = [...data]
                        // newDate.map((match) => this.fixScoreFromToZero(match))
                        newDate.map((match) => this.fixScoreFromFifa(match))
                        if (this.isDataChanged(newDate)) {
                            this.fixAllMatches(newDate);
                        }
                    })
                });
            })
    }

    private applyThemeState(): void {
        const themeState = this.themeService.buildThemeState();
        this.themeColor = themeState.themeColor;
        this.themeTextColor = themeState.themeTextColor;
        this.themeBackground = themeState.themeBackground;
        this.mixColor = themeState.mixColor;
        this.mixPercent = themeState.mixPercent;
    }

    fixScoreFromToZero(oldMatch: Match) {
        const newMatch = { ...oldMatch }

        newMatch.score.fullTime.home = 0
        newMatch.score.fullTime.away = 0

        return oldMatch
    }

    fixScoreFromFifa(oldMatch: Match) {
        const newMatch = { ...oldMatch }
        const fifaMatch = this.fifaCalendarService.findMatchByDate(
            this.fifaMatches,
            newMatch.utcDate,
            newMatch.homeTeam.name,
            newMatch.awayTeam.name,
        )

        if (fifaMatch === undefined) {
            return oldMatch
        }

        const homeTeamScore = this.fifaCalendarService.getMatchScore(fifaMatch, 'HomeTeamScore');
        const awayTeamScore = this.fifaCalendarService.getMatchScore(fifaMatch, 'AwayTeamScore');

        if (homeTeamScore === null || awayTeamScore === null) {
            return oldMatch;
        }

        newMatch.score.fullTime.home = homeTeamScore
        newMatch.score.fullTime.away = awayTeamScore

        return oldMatch
    }

    private fixAllMatches(data: MatchesApiResponse): void {
        if (!data || data.length === 0) {
            this.allMatches = [];
        } else {
            this.allMatches = data.map((match: Match, index: number) => {
                if (match.id === 537333) {
                    match.status = 'FINISHED';
                    match.score.fullTime.home = 1;
                    match.score.fullTime.away = 1;
                    match.score.duration = "REGULAR";
                    match.score.halfTime.home = 0;
                    match.score.halfTime.away = 1;
                    match.score.winner = "DRAW";
                }

                if (match.id === 537352) {
                    match.status = 'FINISHED';
                }
                if (match.score.winner === null) {
                    const fifaMatch = this.fifaCalendarService.findMatchByDate(
                        this.fifaMatches,
                        match.utcDate,
                        match.homeTeam.name,
                        match.awayTeam.name,
                    )
                    if (fifaMatch) {
                        const winnerSide = this.fifaCalendarService.getWinnerSide(fifaMatch);
                        if (winnerSide) {
                            match.score.winner = winnerSide;
                        }
                    }
                }

                return {
                    ...match,
                    myId: Number(`2026${String(index + 1).padStart(2, '0')}`),
                    myGroup: this.mapperService.getPhase(match.stage, match.group),
                }
            });
            void this.insertMissingMatchEntries();
        }

        this.fixPredictions();
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

    private startMatchesPolling(): void {
        if (this.matchesPollingInterval) {
            return;
        }

        this.matchesPollingInterval = setInterval(() => {
            this.getAllMatches();
        }, this.MATCHES_POLLING_INTERVAL_MS);
    }

    fixPredictions(): void {
        this.supabaseService.getPredictionsWithUsers().then((response) => {
            this.allPredictions = response.data || [];

            const result = this.pointsService.applyPointsAndRankings(
                this.allPredictions,
                this.allMatches,
                this.allUsersNamesFromDB,
                this.selectedPlayerId
            );

            this.allPredictions = result.predictions;
            this.allUsersNames = result.users;
            this.fixBetToShow();
        })
    }

    private fixTeams(): void {
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
        const prediction = this.allPredictions.find(p => p.matches.id === bet.id && p.users.id === user.id);
        const cellKey = this.getCellWriteKey(user.id, bet.id, columnIndex);
        const writeVersion = (this.cellWriteVersions.get(cellKey) ?? 0) + 1;
        this.cellWriteVersions.set(cellKey, writeVersion);
        const optimisticUpdate = this.applyOptimisticPredictionUpdate(prediction, bet, columnIndex, newValue);
        newValue = optimisticUpdate.normalizedValue;

        await this.delay(this.cellWriteDebounceMs);
        if (!this.isWriteVersionCurrent(cellKey, writeVersion)) {
            return;
        }

        if (!(await this.acquireCellWriteTurn(cellKey, writeVersion))) {
            return;
        }

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

            if (!this.isWriteVersionCurrent(cellKey, writeVersion)) {
                return;
            }

            if (!result.error && result.shouldRefresh) {
                this.showPredictionSaveToast(result.isDelete);
                this.markCellAsRecentlySaved(cellKey);
                this.fixPredictions();
            } else {
                if (this.isConflictLikeError(result.error)) {
                    this.fixPredictions();
                    return;
                }

                this.rollbackOptimisticPrediction(prediction, optimisticUpdate.rollback);
                this.showPredictionErrorToast();
            }
        } finally {
            this.activeCellWrites.delete(cellKey);
            this.cdr.markForCheck();
        }
    }

    private applyOptimisticPredictionUpdate(
        prediction: Prediction | undefined,
        bet: Bet,
        columnIndex: number,
        rawValue: string
    ): { normalizedValue: string; rollback?: PredictionRollbackState } {
        if (!prediction) {
            return { normalizedValue: rawValue };
        }

        if (columnIndex < 2) {
            const rollback: PredictionRollbackState = {
                home: prediction.home_ft,
                away: prediction.away_ft,
                winner: prediction.winner,
            };

            const score = Number.parseInt(rawValue, 10);
            const scoreToSet = Number.isNaN(score) ? -1 : score;

            if (columnIndex === 0) {
                prediction.home_ft = scoreToSet;
            } else {
                prediction.away_ft = scoreToSet;
            }

            prediction.winner = this.resolveWinnerFromScore(prediction, bet.id);
            this.cdr.markForCheck();
            return { normalizedValue: rawValue, rollback };
        }

        if (columnIndex === 2) {
            const normalizedWinner = this.normalizeWinnerInput(rawValue);
            prediction.winner = normalizedWinner;
            this.cdr.markForCheck();
            return { normalizedValue: normalizedWinner };
        }

        return { normalizedValue: rawValue };
    }

    private resolveWinnerFromScore(prediction: Prediction, matchId: number): string {
        if (prediction.home_ft === -1 || prediction.away_ft === -1) {
            return '';
        } else if (prediction.home_ft > prediction.away_ft) {
            return 'HOME_TEAM';
        } else if (prediction.away_ft > prediction.home_ft) {
            return 'AWAY_TEAM';
        } else if (prediction.home_ft === prediction.away_ft) {
            const isGroup = this.allMatches.find((item) => item.myId === matchId)?.myGroup?.toLowerCase().includes("group");
            return !isGroup ? '' : 'DRAW';
        } else {
            return '';
        }
    }

    private normalizeWinnerInput(value: string): string {
        if (!value) {
            return '';
        }

        const normalized = value.toLowerCase();
        if (normalized === '1' || normalized === 'h' || normalized === 'д') {
            return 'HOME_TEAM';
        }

        if (normalized === '2' || normalized === 'a' || normalized === 'а') {
            return 'AWAY_TEAM';
        }

        return '';
    }

    private rollbackOptimisticPrediction(
        prediction: Prediction | undefined,
        rollbackState: PredictionRollbackState | undefined
    ): void {
        if (!prediction || !rollbackState) {
            return;
        }

        prediction.home_ft = rollbackState.home;
        prediction.away_ft = rollbackState.away;
        prediction.winner = rollbackState.winner;
        this.cdr.markForCheck();
    }

    private isWriteVersionCurrent(cellKey: string, writeVersion: number): boolean {
        return this.cellWriteVersions.get(cellKey) === writeVersion;
    }

    private async acquireCellWriteTurn(cellKey: string, writeVersion: number): Promise<boolean> {
        while (this.activeCellWrites.has(cellKey)) {
            await this.delay(30);
            if (!this.isWriteVersionCurrent(cellKey, writeVersion)) {
                return false;
            }
        }

        this.activeCellWrites.add(cellKey);
        this.cdr.markForCheck();
        await this.delay(30);
        return true;
    }

    private showPredictionSaveToast(isDelete: boolean): void {
        if (isDelete) {
            this.showToast('info', 'TOAST.PREDICTION_DELETED_TITLE', 'TOAST.PREDICTION_DELETED_MESSAGE', 3000);
            return;
        }

        this.showToast('success', 'TOAST.PREDICTION_SAVED_TITLE', 'TOAST.PREDICTION_SAVED_MESSAGE', 3000);
    }

    private showPredictionErrorToast(): void {
        this.showToast('error', 'TOAST.ERROR_TITLE', 'TOAST.ERROR_MESSAGE', 3000);
    }

    private showToast(
        severity: 'success' | 'info' | 'warn' | 'error',
        summaryKey: string,
        detailKey: string,
        life: number,
        detailParams?: Record<string, unknown>
    ): void {
        this.messageService.add({
            severity,
            summary: this.translate.instant(summaryKey),
            detail: this.translate.instant(detailKey, detailParams),
            life,
        });
    }

    private markCellAsRecentlySaved(cellKey: string): void {
        this.recentlySavedCells.add(cellKey);
        setTimeout(() => {
            this.recentlySavedCells.delete(cellKey);
            this.cdr.markForCheck();
        }, 1500);
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
        this.exportPredictionsToExcel(this.betsToShow, {
            includeDateTimeAndGroup: true,
            includePhaseRows: true,
        });
    }

    downloadTableAsExcelMini() {
        const timedBetsToShow = this.betsToShow.filter((bet: Bet) =>
            String(bet.matchStatus).toUpperCase() === 'FINISHED'
        );

        this.exportPredictionsToExcel(timedBetsToShow, {
            includeDateTimeAndGroup: false,
            includePhaseRows: false,
        });
    }

    downloadTableAsExcel90(): void {
        if (this.isDownloadingExcel90) {
            return;
        }

        this.isDownloadingExcel90 = true;
        const timelineRequests: Promise<Bet | null>[] = this.fifaMatches.map((fifaMatchItem) => {
            const { IdCompetition, IdSeason, IdStage, IdMatch } = fifaMatchItem;

            return firstValueFrom(
                this.fifaCalendarService.getMatchTimeline(IdCompetition, IdSeason, IdStage, IdMatch))
                .then((lineupData) => {
                    const hasLateScoringEvent = (lineupData.Event ?? []).some((event) =>
                        this.isScoringEventAtOrAfter90(event)
                    );

                    if (!hasLateScoringEvent) {
                        return null;
                    }

                    const normalMatch = this.findNormalMatchFromFifa(fifaMatchItem);
                    if (!normalMatch) {
                        return null;
                    }

                    return this.betsToShow.find((item) => item.id === normalMatch.myId) ?? null;
                })
                .catch((error) => {
                    console.error(`Failed to get timeline for match ${IdMatch}:`, error);
                    return null;
                });
        });

        Promise.all(timelineRequests)
            .then((bets) => {
                const timedBetsToShow = bets.filter((bet): bet is Bet => bet !== null);

                this.allUsersNames = [...this.allUsersNames].sort((a, b) => a.name_bg.localeCompare(b.name_bg));

                this.exportPredictionsToExcel(timedBetsToShow, {
                    includeDateTimeAndGroup: false,
                    includePhaseRows: false,
                });
            })
            .finally(() => {
                this.isDownloadingExcel90 = false;
            });
    }

    private isScoringEventAtOrAfter90(event: { Type?: number; MatchMinute?: string }): boolean {
        if (typeof event.Type !== 'number' || !this.fifaGoalEventTypes.has(event.Type)) {
            return false;
        }

        return this.parseTimelineMinute(event.MatchMinute) >= 90;
    }

    private parseTimelineMinute(matchMinute?: string): number {
        if (!matchMinute) {
            return 0;
        }

        const numberParts = matchMinute.match(/\d+/g);
        if (!numberParts) {
            return 0;
        }

        return numberParts.reduce((sum, part) => sum + Number(part), 0);
    }

    private findNormalMatchFromFifa(fifaMatchItem: FifaCalendarMatch): Match | undefined {
        return this.allMatches
            .filter((match) => match.utcDate === fifaMatchItem.Date)
            .find((match) => this.fifaCalendarService.findMatchByDate(
                this.fifaMatches,
                match.utcDate,
                match.homeTeam.name,
                match.awayTeam.name,
            )?.IdMatch === fifaMatchItem.IdMatch);
    }

    private exportPredictionsToExcel(
        betsToShow: Bet[],
        options: { includeDateTimeAndGroup: boolean; includePhaseRows: boolean }
    ): void {
        const exportResult = this.exportService.exportToExcel({
            allUsersNames: this.allUsersNames,
            betsToShow,
            includeDateTimeAndGroup: options.includeDateTimeAndGroup,
            includePhaseRows: options.includePhaseRows,
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

        void this.persistPredictionBackupRemotely(
            this.buildDownloadBackupEntry('excel_export', { table_snapshot: JSON.stringify(exportResult.wsData) })
        );

        this.showToast('success', 'TOAST.EXCEL_DOWNLOADED_TITLE', 'TOAST.EXCEL_DOWNLOADED_MESSAGE', 2500);
    }

    async downloadPredictionBackup() {
        const entries = await this.backupService.getPredictionBackupEntries(this.supabaseService);
        this.backupService.downloadEntriesAsJson(entries);

        if (entries.length === 0) {
            this.showToast('success', 'TOAST.BACKUP_DOWNLOADED_TITLE', 'TOAST.BACKUP_DOWNLOADED_EMPTY_MESSAGE', 2500);
            return;
        }

        this.showToast('success', 'TOAST.BACKUP_DOWNLOADED_TITLE', 'TOAST.BACKUP_DOWNLOADED_MESSAGE', 2500, { count: entries.length });
    }

    private buildDownloadBackupEntry(inputValue: string, payload: Record<string, string>): PredictionBackupEntry {
        return {
            event_id: this.backupService.generateBackupEventId(),
            timestamp: new Date().toISOString(),
            action: 'download',
            user_id: this.BACKUP_DOWNLOAD_USER_ID,
            match_id: this.BACKUP_DOWNLOAD_MATCH_ID,
            prediction_id: null,
            column_index: -1,
            input_value: inputValue,
            payload,
        };
    }

    private async persistPredictionBackupRemotely(entry: PredictionBackupEntry): Promise<void> {
        const backupResult = await this.backupService.persistPredictionBackupRemotely(this.supabaseService, entry);
        if (backupResult.warnOnce) {
            this.showToast('warn', 'TOAST.BACKUP_REMOTE_WARN_TITLE', 'TOAST.BACKUP_REMOTE_WARN_MESSAGE', 4500);
        }
    }

    fixBetToShow(): void {
        this.betsToShow = this.mapperService.buildBetsToShow(this.allMatches, this.allTeams);
        this.calculateStats();
        this.cdr.markForCheck();
        setTimeout(() => {
            this.syncGroupHeaderTop();
            this.bindGroupHeaderScrollSync();
        }, 0);
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

    private getGroupHeaderSyncElements(): { host: HTMLElement; container: HTMLElement } | null {
        const host = document.querySelector('.table-container') as HTMLElement | null;
        const container = document.querySelector('.sticky_top .p-datatable-table-container') as HTMLElement | null;

        if (!host || !container) {
            return null;
        }

        return { host, container };
    }

    private runGroupHeaderSync(host: HTMLElement, container: HTMLElement): void {
        this.syncGroupHeaderTopOffset(host);
        host.style.setProperty('--group-scroll-x', `${container.scrollLeft}px`);
        this.updateGroupHeaderTops(container, host);
    }

    private bindGroupHeaderScrollSync(): void {
        const syncElements = this.getGroupHeaderSyncElements();
        if (!syncElements) {
            return;
        }

        const { host, container } = syncElements;

        if (this.groupHeaderScrollContainer === container && this.groupHeaderScrollListener) {
            this.groupHeaderScrollListener();
            return;
        }

        this.unbindGroupHeaderScrollSync();

        this.groupHeaderScrollListener = () => this.runGroupHeaderSync(host, container);

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
        const hiddenGroups = this.getHiddenGroups();
        const updated = hiddenGroups.includes(pro.phase)
            ? hiddenGroups.filter((x: string) => x !== pro.phase)
            : [...hiddenGroups, pro.phase];
        localStorage.setItem(this.HIDDEN_GROUPS_STORAGE_KEY, JSON.stringify(updated));
        this.cdr.markForCheck();
    }

    onGroupClick(groupKey: string | null | undefined): void {
        if (!groupKey) {
            this.setSelectedGroupFilter(null);
            return;
        }

        this.setSelectedGroupFilter(this.selectedGroupFilter === groupKey ? null : groupKey);
    }

    clearGroupFilter(): void {
        this.setSelectedGroupFilter(null);
    }

    onTeamClick(teamName: string | null | undefined): void {
        if (!teamName) {
            this.setSelectedTeamFilter(null);
            return;
        }

        this.setSelectedTeamFilter(this.selectedTeamFilter === teamName ? null : teamName);
    }

    clearTeamFilter(): void {
        this.setSelectedTeamFilter(null);
    }

    dismissFeaturesNoticeMain(): void {
        this.dismissFeaturesNotice(this.FEATURES_NOTICE_MAIN_STORAGE_KEY, 'main');
    }

    dismissFeaturesNoticePhase(): void {
        this.dismissFeaturesNotice(this.FEATURES_NOTICE_PHASE_STORAGE_KEY, 'phase');
    }

    dismissFeaturesNoticeGroupsTab(): void {
        this.dismissFeaturesNotice(this.FEATURES_NOTICE_GROUPS_TAB_STORAGE_KEY, 'groups');
    }

    dismissFeaturesNoticeEliminationsTab(): void {
        this.dismissFeaturesNotice(this.FEATURES_NOTICE_ELIMINATIONS_TAB_STORAGE_KEY, 'eliminations');
    }

    private dismissFeaturesNotice(
        storageKey: string,
        type: 'main' | 'phase' | 'groups' | 'eliminations'
    ): void {
        if (type === 'main') {
            this.showFeaturesNoticeMain = false;
        } else if (type === 'phase') {
            this.showFeaturesNoticePhase = false;
        } else if (type === 'groups') {
            this.showFeaturesNoticeGroupsTab = false;
        } else {
            this.showFeaturesNoticeEliminationsTab = false;
        }

        localStorage.setItem(storageKey, '1');
        this.cdr.markForCheck();
    }

    private getHiddenGroups(): string[] {
        return JSON.parse(localStorage.getItem(this.HIDDEN_GROUPS_STORAGE_KEY) ?? '[]') as string[];
    }

    private loadSelectedGroupFilter(): string | null {
        return this.loadStoredFilter(this.GROUP_FILTER_STORAGE_KEY);
    }

    private setSelectedGroupFilter(value: string | null): void {
        if (this.selectedGroupFilter === value) {
            return;
        }

        this.selectedGroupFilter = value;
        this.persistStoredFilter(this.GROUP_FILTER_STORAGE_KEY, value);
        this.cdr.markForCheck();
    }

    private loadSelectedTeamFilter(): string | null {
        return this.loadStoredFilter(this.TEAM_FILTER_STORAGE_KEY);
    }

    private setSelectedTeamFilter(value: string | null): void {
        if (this.selectedTeamFilter === value) {
            return;
        }

        this.selectedTeamFilter = value;
        this.persistStoredFilter(this.TEAM_FILTER_STORAGE_KEY, value);
        this.cdr.markForCheck();
    }

    private loadStoredFilter(storageKey: string): string | null {
        const storedValue = localStorage.getItem(storageKey);
        return storedValue || null;
    }

    private persistStoredFilter(storageKey: string, value: string | null): void {
        if (!value) {
            localStorage.removeItem(storageKey);
            return;
        }

        localStorage.setItem(storageKey, value);
    }

    private loadShouldShowFeaturesNotice(storageKey: string): boolean {
        return localStorage.getItem(storageKey) !== '1';
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
            return false;
        }

        this.lastMatchesDataHash = hash;
        return true;
    }

    private computeIsSmallScreen(): boolean {
        return typeof window !== 'undefined' && window.innerWidth < 768;
    }
}