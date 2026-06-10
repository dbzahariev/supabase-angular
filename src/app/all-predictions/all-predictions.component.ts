/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit, inject, OnDestroy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { TableModule } from "primeng/table";
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../supabase';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AllPredictionsPointsService } from './all-predictions-points.service';
import { AllPredictionsThemeService } from './all-predictions-theme.service';
import { AllPredictionsRealtimeService } from './all-predictions-realtime.service';
import { AllPredictionsExportService } from './all-predictions-export.service';
import { AllPredictionsBackupService } from './all-predictions-backup.service';
import { AllPredictionsPredictionFlowService } from './all-predictions-prediction-flow.service';
import { AllPredictionsMapperService } from './all-predictions-mapper.service';
import { Bet, Match, Prediction, PredictionBackupEntry, Team, User } from './all-predictions.models';

export const IS_SMALL_SCREEN = window.innerWidth < 768;

@Component({
    selector: 'app-all-predictions',
    templateUrl: './all-predictions.component.html',
    styleUrls: ['./all-predictions.component.css'],
    imports: [TableModule, ToastModule, TranslateModule, FormsModule, CommonModule],
    providers: [MessageService]
})
export class AllPredictionsComponent implements OnInit, OnDestroy {
    protected readonly IS_SMALL_SCREEN = IS_SMALL_SCREEN;
    betsToShow: Bet[] = [];
    allUsersNamesFromDB: User[] = [];
    allUsersNames: User[] = [];
    allPredictions: Prediction[] = [];
    allMatches: Match[] = [];
    allTeams: Team[] = [];
    loading = false;
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
    private predictionsChannel: RealtimeChannel | null = null;
    private destroyRef = inject(DestroyRef);
    private lastMatchesDataHash = '';

    constructor() {
        this.realtimeService.createMatchesSocket((data) => {
                console.log('Received matches update:', data);
                if (this.isDataChanged(data)) {
                    console.log('update matches update:', data);
                    this.fixAllMatches(data);
                }
            });
    }

    isShowRow(product: any) {
        return !JSON.parse(localStorage.getItem('hiddenGrops') ?? '[]').includes(product.phase)
    }

    editCell(user: User, product: any, j: number) {
        product['edit_' + user.id + '_' + j] = true;
        setTimeout(() => {
            const input = document.querySelector(`input[data-edit-key="${user.id}_${j}"]`) as HTMLInputElement;
            if (input) {
                input.focus();
            }
        }, 0);
    }

    ngOnInit(): void {
        const themeState = this.themeService.buildThemeState();
        this.themeColor = themeState.themeColor;
        this.themeTextColor = themeState.themeTextColor;
        this.themeBackground = themeState.themeBackground;
        this.mixColor = themeState.mixColor;
        this.mixPercent = themeState.mixPercent;
        this.fixUsers();
        this.fixTeams();
        this.getAllMatche();
        this.subscribeToTestPredictions();

        // Нова логика: Слушаме за смяна на езика и рефрешваме таблицата
        this.translate.onLangChange
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.fixBetToShow();
            });
    }

    // async checkMatchesForUpdate() {
    //     let fooooo = ((await this.supabaseService.getMatches()).data)?.filter((match: any) => (match.id>202500))
    //     let foo = this.allMatches
    //     let foo2 = this.allTeams

    //     let foo3 = this.betsToShow
    //     this.betsToShow.forEach((bet:any) => {
    //         let teamHome = this.allTeams.find((team: Team) => team.name_bg === bet.home_team);
    //         let teamAway = this.allTeams.find((team: Team) => team.name_bg === bet.away_team);
    //         let selectedMatch = this.allMatches.find(match => match.homeTeam.name === teamHome?.name_en && match.awayTeam.name === teamAway?.name_en);
            
    //         if (selectedMatch) {
    //             let ffff = selectedMatch.myId
    //             let supaMatch = fooooo?.find(match => match.id === ffff)
    //             if (!supaMatch) {
    //                 debugger
    //                 let newMatch = {
    //                     "id": selectedMatch.myId,
    //                     "home_team_id": teamHome?.id,
    //                     "away_team_id": teamAway?.id,
    //                     "utc_date": bet.matchUtcDate,
    //                     "group_name": `Група ${bet.group.replace('TABLE.GROUP_', '')}`,
    //                     "home_ft": -1,
    //                     "away_ft": -1,
    //                     "home_pt": -1,
    //                     "away_pt": -1,
    //                     "winner": "DRAW"
    //                 }

    //                 // this.supabaseService.addMatch(newMatch).then(({ data, error }) => {
    //                 //     if (error) {
    //                 //         console.error('Error adding match:', error);
    //                 //     }
    //                 // });
    //             }
                
    //             let kkkkk = supaMatch?.home_team_id!==teamHome?.id 
    //             let kkkkk2 =supaMatch?.away_team_id!==teamAway?.id
    //             // if (kkkkk || kkkkk2) {
    //             //    
    //             //     debugger
    //             // }

    //             // if (kkk){
    //             //     debugger
    //             // }
    //         }
    //     })
    // }

    getAllMatche() {
        this.supabaseService.getAllMatchesFromBE().subscribe((data: any) => {
            if (this.isDataChanged(data)) {
                this.fixAllMatches(data)
            }
        });
    }

    fixAllMatches(data: any) {
        if (!data || !data.matches) {
            this.allMatches = [];
        } else {
            this.allMatches = data.matches?.map((match: any, index: number) => {
                let myId = Number("2026" + (index < 9 ? "0" + (index + 1) : (index + 1).toString()));
                let myGroup = this.mapperService.getPhase(match.stage, match.group);

                // if (match.id === 537327) {
                //     match.score.duration = "FULL_TIME";
                //     match.score.fullTime.home = 3;
                //     match.score.fullTime.away = 4;
                //     match.score.halfTime.home = 1;
                //     match.score.halfTime.away = 2;
                //     match.score.winner = "AWAY_TEAM";
                // } else if (match.id === 537328) {
                //     match.score.duration = "FULL_TIME";
                //     match.score.fullTime.home = 4;
                //     match.score.fullTime.away = 3;
                //     match.score.halfTime.home = 2;
                //     match.score.halfTime.away = 1;
                //     match.score.winner = "HOME_TEAM";
                // } else if (match.id === 537333) {
                //     match.score.duration = "FULL_TIME";
                //     match.score.fullTime.home = 2;
                //     match.score.fullTime.away = 2;
                //     match.score.halfTime.home = 1;
                //     match.score.halfTime.away = 1;
                //     match.score.winner = "DRAW";
                // }

                return {
                    ...match,
                    myId: myId,
                    myGroup: myGroup,
                }
            });
        }

        this.fixPredictions();
        // this.getAllMatche()
    }

    ngOnDestroy() {
        console.log('DEBUG: Компонентът е унищожен.');
        this.realtimeService.stopPredictionsSubscription(this.predictionsChannel);
        this.predictionsChannel = null;
    }

    subscribeToTestPredictions() {
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

    getUserPredictionValue(user: User, bet: Bet, columnIndex: number): string {
        return this.mapperService.getUserPredictionValue(user, bet, columnIndex, this.allPredictions);
    }

    getColName(idx: number): string {
        return this.mapperService.getColName(idx);
    }

    returnTranslateFromWin(winner: any): string {
        return this.mapperService.returnTranslateFromWin(winner);
    }

    getProductResultRow(bet: Bet, index: number): string {
        return this.mapperService.getProductResultRow(bet, index);
    }

    fixPredictions() {
        this.supabaseService.getPredictionsWithUsers().then((data: any) => {
            this.allPredictions = data.data || [];

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

    fixTeams() {
        this.supabaseService.getAllTeams().then((data: any) => {
            this.allTeams = data.data || [];
            this.fixBetToShow();
        })
    }

    // getPointsFromUser(user: User): number {
    //     return user.total_points || 0;
    //     // return this.allPredictions.filter(pred => pred.users.id === user.id && pred.points >= 0).reduce((acc, prediction) => acc + prediction.points, 0);
    // }

    fixUsers() {
        this.supabaseService.getUsers().then((data: any) => {
            this.allUsersNamesFromDB = data.data;
            this.cdr.detectChanges();
        })
    }

    async changePrediction(user: User, bet: Bet, columnIndex: number, newValue: string) {
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
                    life: 3000
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
            this.fixPredictions();
        } else {
            console.error('Error saving prediction:', result.error);
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('TOAST.ERROR_TITLE'),
                detail: this.translate.instant('TOAST.ERROR_MESSAGE'),
                life: 3000
            });
        }
    }

    downloadTableAsExcel() {
        const isLngBg = this.getLng() === 'bg-BG';

        const exportResult = this.exportService.exportToExcel({
            isLngBg,
            allUsersNames: this.allUsersNames,
            betsToShow: this.betsToShow,
            isShowRow: (bet: Bet) => this.isShowRow(bet),
            getNameFromUser: (user: User) => this.mapperService.getNameFromUser(user),
            getUserPredictionValue: (user: User, bet: Bet, columnIndex: number) => this.mapperService.getUserPredictionValue(user, bet, columnIndex, this.allPredictions),
            translateGroup: (groupKey: string) => this.translate.instant(groupKey),
            translateWinnerShort: (winner: string) => this.mapperService.returnTranslateFromWin(winner),
            getCycleLabelFromBet: (bet: Bet) => this.mapperService.getCycleLabelFromBet(bet),
            formatLocalDateTime: (date: Date, mode: 'display' | 'filename') => this.backupService.formatLocalDateTime(date, mode),
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





    fixBetToShow() {
        this.betsToShow = this.mapperService.buildBetsToShow(this.allMatches, this.allTeams);
        this.cdr.detectChanges();
    }



    togleGroup(pro: any) {
        const hiddenGroups = JSON.parse(localStorage.getItem('hiddenGrops') ?? '[]');
        const updated = hiddenGroups.includes(pro.phase)
            ? hiddenGroups.filter((x: string) => x !== pro.phase)
            : [...hiddenGroups, pro.phase];
        localStorage.setItem('hiddenGrops', JSON.stringify(updated));
        this.cdr.detectChanges();
    }

    private isDataChanged(data: any): boolean {
        const hashResult = this.realtimeService.hasMatchesDataChanged(data, this.lastMatchesDataHash);
        if (!hashResult.changed) {
            console.log('No data change')
            return false;
        }
        console.log('Data change', { foo1: this.lastMatchesDataHash, foo2: hashResult.hash })
        this.lastMatchesDataHash = hashResult.hash;
        return true;
    }
}