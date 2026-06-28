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
import { FifaCalendarService } from '../services/fifa-calendar.service';

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
    private readonly cellWriteDebounceMs = 180;
    betsToShow: Bet[] = [];
    selectedPlayerId: number | null = null;
    allUsersNamesFromDB: User[] = [];
    allUsersNames: User[] = [];
    allPredictions: Prediction[] = [];
    allMatches: Match[] = [];
    fifaMatches: any[] = [];
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
    private mapperService = inject(AllPredictionsMapperService);
    private adminService = inject(AdminService);
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

    async insertMisingMatches() {
        let foo = []
        let newMatch: OneMatchToInsert | undefined = undefined
        let kk = this.supabaseService

        let kgh = ((await this.supabaseService.getMatches()).data)?.filter((val) => val.id > 202600)
        let matchToInsert: OneMatchToInsert[] = []
        this.allMatches.forEach(val => {
            let foo = kgh?.find(predict => predict.id === val.myId)
            if (foo === undefined) {
                let utcDate = new Date(val.utcDate)
                let fooo = {
                    mm: utcDate.getMonth() + 1, dd: utcDate.getDate(), year: utcDate.getFullYear(),
                    hour: utcDate.getHours(), minute: utcDate.getMinutes(), second: utcDate.getSeconds()
                }


                let id = val.myId
                let home_team_id = this.allTeams.find(team => team.name_en === val.homeTeam.name)?.id;
                let away_team_id = this.allTeams.find(team => team.name_en === val.awayTeam.name)?.id;
                let kkkk = fooo.mm + '/' + fooo.dd + '/' + fooo.year + ' ' + fooo.hour + ':' + fooo.minute + ':' + fooo.second
                let groupName = val.stage
                if (home_team_id && away_team_id) {
                    newMatch = {
                        id: id,
                        home_team_id: home_team_id,
                        away_team_id: away_team_id,
                        utc_date: val.utcDate,
                        group_name: groupName
                    }
                    matchToInsert.push(newMatch)
                }
            }
            return false
        })

        if (this.allMatches.length > 0 && matchToInsert.length>0) {
            this.supabaseService.addMatchs(matchToInsert).then((val) => {
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

    // Normalize prediction values for comparison
    private normalizeValue(value: string | undefined | null): string {
        if (!value) return '';
        const str = String(value).toUpperCase().trim();
        if (str === 'HOME_TEAM') return 'H';
        if (str === 'AWAY_TEAM') return 'A';
        if (str === 'DRAW') return 'D';
        if (str === 'H' || str === 'Д') return 'H';
        if (str === 'A' || str === 'Г') return 'A';
        if (str === 'D' || str === 'П' || str === 'DRAW') return 'D';
        return str;
    }

    // Method to determine cell background color
    getCellColorClass(user: User, bet: Bet, j: number): string {
        // Only color the points column (j === 3)
        if (j !== 3) {
            return '';
        }

        // Get the predicted value (points)
        const prediction = this.getUserPredictionValue(user, bet, j, false);
        if (!prediction) {
            return '';
        }

        // Parse the points value
        const points = parseInt(prediction, 10);
        if (isNaN(points)) {
            return '';
        }

        // Return color class based on points
        if (points === 3) {
            return 'points-3'; // Green for 3 points
        } else if (points === 2) {
            return 'points-2'; // Yellow for 2 points
        } else if (points === 1) {
            return 'points-1'; // Blue for 1 point
        } else if (points === 0) {
            return 'points-0'; // Red for 0 points
        }

        return '';
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
                    label: this.getNameFromUser(user),
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

        // Allow editing own column
        if (this.selectedPlayerId === user.id) {
            result = true;
        }

        // Disallow editing winner for non-admins
        if (j === 2 && !this.isAdmin()) {
            const newLocal = product.group.split('.')[1]
            let kkk = newLocal.split('_')[0]

            if (kkk !== "GROUP" && (newLocal === 'LAST_32' || newLocal === 'LAST_16' || newLocal === 'QUARTER_FINALS' || newLocal === 'SEMI_FINALS' || newLocal === 'THIRD_PLACE' || newLocal === 'FINAL')) {
                // result = true
            } else {
                result = !(product.group.split('.')[1].split('_')[0] === 'GROUP');
            }
        }

        // Disallow editing points points for non-admins
        if (j === 3 && !this.isAdmin()) {
            result = false;
        }

        //matchStatus: "FINISHED"
        if (product.matchStatus === 'FINISHED' && !this.isAdmin()) {
            result = false;
        }

        if (result) {
            let homeTeamName = this.allMatches.find((item) => item.myId === product.id)?.homeTeam.name
            let awayTeamName = this.allMatches.find((item) => item.myId === product.id)?.awayTeam.name
            let toResFalse = homeTeamName === null || awayTeamName === null
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
        if (playerId === null || playerId === '') {
            this.selectedPlayerId = null;
            this.selectedUserService.clearSelectedUserId();
            this.calculateStats();
            this.fixPredictions();
            this.cdr.markForCheck();
            return;
        }

        const parsedPlayerId = Number(playerId);
        if (!Number.isFinite(parsedPlayerId)) {
            this.selectedPlayerId = null;
            this.selectedUserService.clearSelectedUserId();
            this.calculateStats();
            this.fixPredictions();
            this.cdr.markForCheck();
            return;
        }

        this.selectedPlayerId = parsedPlayerId;
        this.selectedUserService.setSelectedUserId(parsedPlayerId);
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

        this.uiPreferencesService.showStatsCards$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((showStatsCards) => {
                this.showStatsCards = showStatsCards;
                this.cdr.markForCheck();
            });

        setTimeout(() => this.bindGroupHeaderScrollSync(), 0);
    }

    private getAllMatches(): void {
        this.fifaCalendarService.getSeasonMatchesResult()
            .subscribe((responseFromFifa) => {
                this.fifaMatches = responseFromFifa;

                this.supabaseService.getLiveMatchesFullFromBE().subscribe((data) => {
                    this.insertMisingMatches().then(() => {
                        let newDate = [...data]
                        // newDate.map((match) => this.fixScoreFromToZero(match))
                        newDate.map((match) => this.fixScoreFromFifa(match))
                        this.refreshMatchesWithLiveOverlay(newDate);
                    })
                });
            })
    }

    getNewName(oldName = '') {
        let newName = oldName
        newName = newName.replace("Bosnia and Herzegovina", "Bosnia-Herzegovina")
        newName = newName.replace("Korea Republic", "South Korea")
        newName = newName.replace("Curaçao", "Curaçao")
        newName = newName.replace("Côte d'Ivoire", "Ivory Coast")
        newName = newName.replace("Türkiye", "Turkey")
        newName = newName.replace("USA", "United States")
        newName = newName.replace("Cabo Verde", "Cape Verde Islands")
        newName = newName.replace("IR Iran", "Iran")

        return newName
    }

    getFifaMatch(match: Match) {
        const fifaMatches = this.fifaMatches.filter(item => item.Date === match.utcDate);

        if (fifaMatches.length === 1) {
            return fifaMatches[0];
        }

        return fifaMatches.find(item => {
            const home = this.getNewName(item.Home?.TeamName[0]?.Description ?? '');
            const away = this.getNewName(item.Away?.TeamName[0]?.Description ?? '');

            return (
                home === match.homeTeam.name &&
                away === match.awayTeam.name
            );
        });
    }

    fixScoreFromToZero(oldMatch: Match) {
        let newMatch = { ...oldMatch }

        newMatch.score.fullTime.home = 0
        newMatch.score.fullTime.away = 0

        return oldMatch
    }

    fixScoreFromFifa(oldMatch: Match) {
        let newMatch = { ...oldMatch }
        let fifaMatch = this.getFifaMatch(newMatch)

        if (fifaMatch === undefined) {
            console.log('[FE]', fifaMatch, newMatch)
        }

        if (newMatch.score.fullTime.home !== fifaMatch.HomeTeamScore) {
            console.log('[FE] Различни резултатни точки за домакин')
        }

        if (newMatch.score.fullTime.away !== fifaMatch.AwayTeamScore) {
            console.log('[FE] Различни резултатни точки за гост')
        }

        newMatch.score.fullTime.home = fifaMatch.HomeTeamScore
        newMatch.score.fullTime.away = fifaMatch.AwayTeamScore

        return oldMatch
    }

    private fixAllMatches(data: MatchesApiResponse): void {
        if (!data || data.length === 0) {
            this.allMatches = [];
        } else {
            this.allMatches = data.map((match: Match, index: number) => {
                const myId = Number("2026" + (index < 9 ? "0" + (index + 1) : (index + 1).toString()));
                const myGroup = this.mapperService.getPhase(match.stage, match.group);

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

                return {
                    ...match,
                    myId: myId,
                    myGroup: myGroup,
                }
            });
            this.insertMisingMatches().then(() => { })
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

    private subscribeToTestPredictions(): void {
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

    public getNameFromUser(user: User): string {
        return this.mapperService.getNameFromUser(user);
    }

    public getUserPredictionValue(user: User, bet: Bet, columnIndex: number, hidden: boolean): string {
        return this.mapperService.getUserPredictionValue(user, bet, columnIndex, this.allPredictions, hidden);
    }

    public getColName(idx: number): string {
        return this.mapperService.getColName(idx);
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

    onGroupClick(groupKey: string | null | undefined): void {
        if (!groupKey) {
            this.selectedGroupFilter = null;
            this.persistSelectedGroupFilter();
            this.cdr.markForCheck();
            return;
        }

        this.selectedGroupFilter = this.selectedGroupFilter === groupKey ? null : groupKey;
        this.persistSelectedGroupFilter();
        this.cdr.markForCheck();
    }

    clearGroupFilter(): void {
        if (this.selectedGroupFilter === null) {
            return;
        }

        this.selectedGroupFilter = null;
        this.persistSelectedGroupFilter();
        this.cdr.markForCheck();
    }

    onTeamClick(teamName: string | null | undefined): void {
        if (!teamName) {
            this.selectedTeamFilter = null;
            this.persistSelectedTeamFilter();
            this.cdr.markForCheck();
            return;
        }

        this.selectedTeamFilter = this.selectedTeamFilter === teamName ? null : teamName;
        this.persistSelectedTeamFilter();
        this.cdr.markForCheck();
    }

    clearTeamFilter(): void {
        if (this.selectedTeamFilter === null) {
            return;
        }

        this.selectedTeamFilter = null;
        this.persistSelectedTeamFilter();
        this.cdr.markForCheck();
    }

    dismissFeaturesNoticeMain(): void {
        this.showFeaturesNoticeMain = false;
        localStorage.setItem(this.FEATURES_NOTICE_MAIN_STORAGE_KEY, '1');
        this.cdr.markForCheck();
    }

    dismissFeaturesNoticePhase(): void {
        this.showFeaturesNoticePhase = false;
        localStorage.setItem(this.FEATURES_NOTICE_PHASE_STORAGE_KEY, '1');
        this.cdr.markForCheck();
    }

    dismissFeaturesNoticeGroupsTab(): void {
        this.showFeaturesNoticeGroupsTab = false;
        localStorage.setItem(this.FEATURES_NOTICE_GROUPS_TAB_STORAGE_KEY, '1');
        this.cdr.markForCheck();
    }

    dismissFeaturesNoticeEliminationsTab(): void {
        this.showFeaturesNoticeEliminationsTab = false;
        localStorage.setItem(this.FEATURES_NOTICE_ELIMINATIONS_TAB_STORAGE_KEY, '1');
        this.cdr.markForCheck();
    }

    private loadSelectedGroupFilter(): string | null {
        const storedValue = localStorage.getItem(this.GROUP_FILTER_STORAGE_KEY);
        return storedValue ? storedValue : null;
    }

    private persistSelectedGroupFilter(): void {
        if (!this.selectedGroupFilter) {
            localStorage.removeItem(this.GROUP_FILTER_STORAGE_KEY);
            return;
        }

        localStorage.setItem(this.GROUP_FILTER_STORAGE_KEY, this.selectedGroupFilter);
    }

    private loadSelectedTeamFilter(): string | null {
        const storedValue = localStorage.getItem(this.TEAM_FILTER_STORAGE_KEY);
        return storedValue ? storedValue : null;
    }

    private persistSelectedTeamFilter(): void {
        if (!this.selectedTeamFilter) {
            localStorage.removeItem(this.TEAM_FILTER_STORAGE_KEY);
            return;
        }

        localStorage.setItem(this.TEAM_FILTER_STORAGE_KEY, this.selectedTeamFilter);
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