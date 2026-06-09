/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit, inject, OnDestroy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { TableModule } from "primeng/table";
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import * as XLSX from 'xlsx';

export const IS_SMALL_SCREEN = window.innerWidth < 768;

interface Bet {
    row_index: number,
    match_day: string,
    match_time: string,
    group: string,
    id: number,
    home_team: string,
    away_team: string,
    score?: Match['score'];
}

interface User {
    id: number,
    name_bg: string,
    name_en: string,
    total_points?: number;
}

interface Team {
    id: number;
    name_en: string;
    name_bg: string;
}

interface Prediction {
    points?: number;
    id: number;
    utc_date: string;
    home_ft: number;
    away_ft: number;
    home_pt: number;
    away_pt: number;
    winner: string;
    users: User;
    matches: {
        id: number;
        group_name?: string;
        away_team_id: number;
        home_team_id: number;
    };
    teams: {
        away_team: { name_bg: string; name_en: string };
        home_team: { name_bg: string; name_en: string };
    };
}

interface Match {
    area: {
        id: number;
        name: string;
        code: string;
        flag: string | null;
    };
    competition: {
        id: number;
        name: string;
        code: string;
        type: string;
        emblem: string;
    };
    season: {
        id: number;
        startDate: string;
        endDate: string;
        currentMatchday: number;
        winner: string | null;
    };
    id: number;
    utcDate: string;
    status: string;
    matchday: number;
    stage: string;
    group: string;
    myGroup: string;
    lastUpdated: string;
    homeTeam: {
        id: number;
        name: string;
        shortName: string;
        tla: string;
        crest: string;
    };
    awayTeam: {
        id: number;
        name: string;
        shortName: string;
        tla: string;
        crest: string;
    };
    score: {
        winner: string | null;
        duration: string;
        fullTime: { home: number | null; away: number | null };
        halfTime: { home: number | null; away: number | null };
    };
    odds: { msg: string };
    referees: any[];
    myId: number;
}

interface PredictionBackupEntry {
    event_id: string;
    timestamp: string;
    action: 'insert' | 'update' | 'delete' | 'skip' | 'error' | 'download';
    user_id: number;
    match_id: number;
    prediction_id: number | null;
    column_index: number;
    input_value: string;
    payload: Record<string, any>;
    error_message?: string;
}

@Component({
    selector: 'app-all-predictions',
    templateUrl: './all-predictions.component.html',
    styleUrls: ['./all-predictions.component.css'],
    imports: [TableModule, ToastModule, TranslateModule, FormsModule, CommonModule],
    providers: [MessageService]
})
export class AllPredictionsComponent implements OnInit, OnDestroy {
    private remoteBackupWarningShown = false;
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
    cicles: {
        label: string;
        dateFrom: Date;
        dateTo: Date;
    }[] = [
            {
                label: "cicle_1",
                dateFrom: new Date("2026-06-11T19:00:00Z"),
                dateTo: new Date('2026-06-18T16:59:59Z')
            },
            {
                label: "cicle_2",
                dateFrom: new Date('2026-06-18T17:00:00Z'),
                dateTo: new Date('2026-06-24T01:59:59Z')
            },
            {
                label: "cicle_3",
                dateFrom: new Date('2026-06-24T02:00:00Z'),
                dateTo: new Date("2026-06-28T02:00:00Z")
            }
        ]
    private socket: Socket;
    private supabaseService = inject(SupabaseService);
    private cdr = inject(ChangeDetectorRef);
    private translate = inject(TranslateService);
    private messageService = inject(MessageService);
    private predictionsChannel: RealtimeChannel | null = null;
    private destroyRef = inject(DestroyRef);
    private lastMatchesDataHash = '';

    constructor() {
        this.socket = io('https://simple-node-proxy.onrender.com');
        if (!this.socket.hasListeners('matchesUpdate')) {
            this.socket.on('matchesUpdate', (data) => {
                console.log('Received matches update:', data);
                if (this.isDataChanged(data)) {
                    console.log('update matches update:', data);
                    this.fixAllMatches(data)
                }
            });
        }
    }

    isShowRow(product: any) {
        return !JSON.parse(localStorage.getItem('hiddenGrops') ?? '[]').includes(product.phase)
    }

    ngOnInit(): void {
        this.themeColor = localStorage.getItem('theme-color') ?? '#ffffff';
        this.themeTextColor = this.getContrastYIQ(this.themeColor);
        this.themeBackground = (localStorage.getItem('dark-mode') ?? 'disabled') === 'enabled' ? '#000000' : '#ffffff';
        this.mixColor = this.themeTextColor === '#000000' ? '#ffffff' : '#000000';
        this.mixPercent = this.themeTextColor === '#000000' ? '85%' : '40%';
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
                let myGroup = this.getPhase(match.stage, match.group);

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
        if (this.predictionsChannel) {
            this.predictionsChannel.unsubscribe();
            this.predictionsChannel = null;
        }
    }

    subscribeToTestPredictions() {
        if (this.predictionsChannel) {
            return;
        }
        this.predictionsChannel = this.supabaseService.subscribeToTable('predictions', () => { this.fixPredictions(); });
    }

    getNameFromUser(user: User): string {
        return this.getLng() === 'bg-BG' ? user.name_bg : user.name_en;
    }

    fixPredictions() {
        this.supabaseService.getPredictionsWithUsers().then((data: any) => {
            this.allPredictions = data.data;

            // Reset points for everyone before recalculating
            this.allUsersNames = this.allUsersNamesFromDB.map(u => ({ ...u, total_points: 0 }));

            if (this.allPredictions) {
                this.allPredictions = this.allPredictions.map((prediction: Prediction) => {
                    let newPrediction: Prediction = { ...prediction }
                    let selectedMatch = this.allMatches.find(match => match.myId === prediction.matches.id)
                    newPrediction.points = this.getPointFromMatch(selectedMatch, prediction)

                    let userFromDBIndex = this.allUsersNames.findIndex(user => user.id === prediction.users.id)
                    if (userFromDBIndex !== -1) {
                        if (newPrediction.points >= 0) {
                            this.allUsersNames[userFromDBIndex].total_points! += newPrediction.points;
                        }
                    }
                    return newPrediction
                })
            }

            // Sort once at the end for better performance
            this.allUsersNames.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
            this.fixBetToShow();
        })
    }

    getPointFromMatch(bet: Match | undefined, prediction: Prediction): number {
        if (!bet) {
            return -2;
        }
        if (bet.score.fullTime.home === null || bet.score.fullTime.away === null) {
            return -1;
        }
        const actualHome = bet.score.fullTime.home;
        const actualAway = bet.score.fullTime.away;
        const actualWinner = bet.score.winner;
        const predictedHome = prediction.home_ft;
        const predictedAway = prediction.away_ft;
        const predictedWinner = prediction.winner;

        if (actualHome === predictedHome && actualAway === predictedAway) {
            return 3;
        }
        const actualAbs = Math.abs(actualHome - actualAway);
        const predictAbs = Math.abs(predictedHome - predictedAway);
        if (actualAbs === predictAbs && actualWinner === predictedWinner) {
            return 2;
        }
        if (actualWinner === predictedWinner) {
            return 1;
        }
        return 0;
    }

    private getContrastYIQ(hexcolor: string): string {
        if (!hexcolor || hexcolor.length < 6) return '#000000';
        hexcolor = hexcolor.replace("#", "");
        if (hexcolor.length === 3) {
            hexcolor = hexcolor.split('').map(char => char + char).join('');
        }
        const r = parseInt(hexcolor.substr(0, 2), 16);
        const g = parseInt(hexcolor.substr(2, 2), 16);
        const b = parseInt(hexcolor.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
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
        const eventId = this.generateBackupEventId();
        let selectedMatch = this.allMatches.find(match => match.myId === bet.id)
        let prediction = this.allPredictions.find(p => p.matches.id === bet.id && p.users.id === user.id) as any;

        if (columnIndex > 1) {
            const ignoredEntry: PredictionBackupEntry = {
                event_id: eventId,
                timestamp,
                action: 'skip',
                user_id: user.id,
                match_id: bet.id,
                prediction_id: prediction?.id ?? null,
                column_index: columnIndex,
                input_value: newValue,
                payload: {
                    home_ft: prediction ? prediction.home_ft : -1,
                    away_ft: prediction ? prediction.away_ft : -1,
                    home_pt: prediction ? prediction.home_pt : -1,
                    away_pt: prediction ? prediction.away_pt : -1,
                    winner: prediction ? prediction.winner : 'DRAW',
                    match_group: selectedMatch?.group,
                },
            };
            void this.persistPredictionBackupRemotely(ignoredEntry);
            return;
        }

        let score = parseInt(newValue);
        if (isNaN(score)) {
            score = -1; // Invalid score, you can choose how to handle this case
        }

        const isNew = !prediction;
        const payload: any = {
            user_id: user.id,
            match_id: bet.id,
            match_group: selectedMatch?.group,
            home_ft: prediction ? prediction.home_ft : -1,
            away_ft: prediction ? prediction.away_ft : -1,
            home_pt: prediction ? prediction.home_pt : -1,
            away_pt: prediction ? prediction.away_pt : -1,
            winner: prediction ? prediction.winner : 'DRAW',
        };

        if (columnIndex === 0) payload.home_ft = score;
        if (columnIndex === 1) payload.away_ft = score;
        // Automatically determine winner based on scores
        if (payload.home_ft > payload.away_ft) payload.winner = 'HOME_TEAM';
        else if (payload.away_ft > payload.home_ft) payload.winner = 'AWAY_TEAM';
        else payload.winner = 'DRAW';

        const hasInvalidScore = payload.home_ft < 0 && payload.away_ft < 0;
        const shouldDelete = hasInvalidScore && !isNew;
        const shouldUpsert = !hasInvalidScore;
        const shouldSkip = hasInvalidScore && isNew;

        let error: any;
        if (shouldDelete) {
            ({ error } = await this.supabaseService.deletePrediction(prediction.id));
        } else if (shouldUpsert) {
            ({ error } = isNew
                ? await this.supabaseService.addPrediction(payload)
                : await this.supabaseService.updatePrediction(prediction.id, payload));
        }

        const backupEntry: PredictionBackupEntry = {
            event_id: eventId,
            timestamp,
            action: error ? 'error' : shouldDelete ? 'delete' : shouldUpsert ? (isNew ? 'insert' : 'update') : 'skip',
            user_id: user.id,
            match_id: bet.id,
            prediction_id: prediction?.id ?? null,
            column_index: columnIndex,
            input_value: newValue,
            payload: {
                home_ft: payload.home_ft,
                away_ft: payload.away_ft,
                home_pt: payload.home_pt,
                away_pt: payload.away_pt,
                winner: payload.winner,
                match_group: payload.match_group,
            },
            error_message: error?.message,
        };

        void this.persistPredictionBackupRemotely(backupEntry);

        if (shouldSkip && !error) {
            return;
        }

        if (!error && (shouldDelete || shouldUpsert)) {
            if (shouldDelete) {
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
            console.error('Error saving prediction:', error);
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

        const headers = [
            '#',
            isLngBg ? 'Дата' : 'Date',
            isLngBg ? 'Час' : 'Time',
            isLngBg ? 'Група' : 'Group',
            isLngBg ? 'Домакин' : 'Home team',
            isLngBg ? 'Д' : 'H',
            isLngBg ? 'Г' : 'A',
            isLngBg ? 'П' : 'W',
            isLngBg ? 'Гост' : 'Away team',
            ...this.allUsersNames.flatMap(u => [
                `${this.getNameFromUser(u)} Д`,
                `${this.getNameFromUser(u)} Г`,
                `${this.getNameFromUser(u)} П`,
                `${this.getNameFromUser(u)} Т`,
            ]),
        ];

        const rows = this.betsToShow
            .filter(bet => this.isShowRow(bet))
            .map(bet => {
                const groupLabel = this.translate.instant(bet.group);
                const result = [
                    bet.row_index,
                    bet.match_day,
                    bet.match_time,
                    groupLabel,
                    bet.home_team,
                    bet.score?.fullTime.home ?? '',
                    bet.score?.fullTime.away ?? '',
                    bet.score?.winner ? this.returnTranslateFromWin(bet.score.winner) : '',
                    bet.away_team,
                ];

                for (const user of this.allUsersNames) {
                    result.push(
                        this.getUserPredictionValue(user, bet, 0),
                        this.getUserPredictionValue(user, bet, 1),
                        this.getUserPredictionValue(user, bet, 2),
                        this.getUserPredictionValue(user, bet, 3),
                    );
                }

                return result;
            });

        const totalsRow = [
            '', '', '', '', '',
            '', '', '', isLngBg ? 'Общо' : 'Total',
            ...this.allUsersNames.flatMap(u => ['', '', '', u.total_points ?? 0]),
        ];

        const wsData = [headers, ...rows, totalsRow];
        void this.persistPredictionBackupRemotely({
            event_id: this.generateBackupEventId(),
            timestamp: new Date().toISOString(),
            action: 'download',
            user_id: 1,
            match_id: 202601,
            prediction_id: null,
            column_index: -1,
            input_value: 'excel_export',
            payload: { table_snapshot: JSON.stringify(wsData) },
        });
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, isLngBg ? 'Прогнози' : 'Predictions');

        const fileName = `predictions-${this.formatLocalDateTime(new Date(), 'filename')}.xlsx`;
        XLSX.writeFile(wb, fileName);

        this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('TOAST.EXCEL_DOWNLOADED_TITLE'),
            detail: this.translate.instant('TOAST.EXCEL_DOWNLOADED_MESSAGE'),
            life: 2500,
        });
    }

    async downloadPredictionBackup() {
        const entries = await this.getPredictionBackupEntries();

        const exportPayload = {
            exported_at: new Date().toISOString(),
            total_entries: entries.length,
            entries,
        };

        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `prediction-backup-${this.formatLocalDateTime(new Date(), 'filename')}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);

        this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('TOAST.BACKUP_DOWNLOADED_TITLE'),
            detail: entries.length === 0
                ? this.translate.instant('TOAST.BACKUP_DOWNLOADED_EMPTY_MESSAGE')
                : this.translate.instant('TOAST.BACKUP_DOWNLOADED_MESSAGE', { count: entries.length }),
            life: 2500,
        });
    }

    private async getPredictionBackupEntries(): Promise<PredictionBackupEntry[]> {
        try {
            const { data, error } = await this.supabaseService.getPredictionBackupEvents();
            if (error || !data) {
                console.warn('Could not fetch remote backup entries.', error);
                return [];
            }
            return data.map((row: any) => ({
                event_id: row.event_id,
                timestamp: this.formatLocalDateTime(new Date(row.event_timestamp)),
                action: row.action,
                user_id: row.user_id,
                match_id: row.match_id,
                prediction_id: row.prediction_id,
                column_index: row.column_index,
                input_value: row.input_value,
                payload: row.payload,
                error_message: row.error_message,
            })) as PredictionBackupEntry[];
        } catch {
            return [];
        }
    }

    private async persistPredictionBackupRemotely(entry: PredictionBackupEntry): Promise<void> {
        try {
            const { error } = await this.supabaseService.addPredictionBackupEvent({
                event_id: entry.event_id,
                event_timestamp: entry.timestamp,
                action: entry.action,
                user_id: entry.user_id,
                match_id: entry.match_id,
                prediction_id: entry.prediction_id,
                column_index: entry.column_index,
                input_value: entry.input_value,
                payload: entry.payload,
                error_message: entry.error_message,
                source: 'all-predictions',
            });

            if (error && !this.remoteBackupWarningShown) {
                this.remoteBackupWarningShown = true;
                console.warn('Remote prediction backup is unavailable. Apply SQL migration for prediction_backup_events table.', error);
                this.messageService.add({
                    severity: 'warn',
                    summary: this.translate.instant('TOAST.BACKUP_REMOTE_WARN_TITLE'),
                    detail: this.translate.instant('TOAST.BACKUP_REMOTE_WARN_MESSAGE'),
                    life: 4500,
                });
            }
        } catch (error) {
            if (!this.remoteBackupWarningShown) {
                this.remoteBackupWarningShown = true;
                console.warn('Failed to persist prediction backup remotely.', error);
                this.messageService.add({
                    severity: 'warn',
                    summary: this.translate.instant('TOAST.BACKUP_REMOTE_WARN_TITLE'),
                    detail: this.translate.instant('TOAST.BACKUP_REMOTE_WARN_MESSAGE'),
                    life: 4500,
                });
            }
        }
    }

    private formatLocalDateTime(date: Date, mode: 'display' | 'filename' = 'display'): string {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return mode === 'filename'
            ? `${d}_${m}_${y}_${hh}_${mm}_${ss}`
            : `${d}:${m}:${y}, ${hh}:${mm}:${ss}`;
    }

    private generateBackupEventId(): string {
        return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    }

    getLng(): "bg-BG" | "en-US" {
        const lang = this.translate.currentLang || localStorage.getItem('lang') || 'bg';
        return lang === 'bg' ? 'bg-BG' : 'en-US';
    }

    private getPhaseMap(isToBeTranslate = true, cicle = ''): Record<string, string> {
        let cicleStr = cicle.length > 0 ? `.${cicle}` : ""
        let groupStage = isToBeTranslate ? this.translate.instant('TABLE.GROUPS_PHASE') : 'GROUP_STAGE' + cicleStr;

        return {
            'GROUP_STAGE': groupStage,
            'LAST_32': 'U',
            'LAST_16': 'V',
            'QUARTER_FINALS': 'W',
            'SEMI_FINALS': 'X',
            'THIRD_PLACE': 'Y',
            'FINAL': 'Z'
        };
    }

    private getPhase(stage: string, groupKey: string): string {
        return `TABLE.${(groupKey || stage)}`
    }

    private getCycleLabelByDate(targetDate: Date | string) {
        const t = new Date(targetDate).getTime();

        const cycle = this.cicles.find(c => {
            const from = new Date(c.dateFrom).getTime();
            const to = new Date(c.dateTo).getTime();

            return t >= from && t <= to;
        });

        return cycle?.label.toUpperCase() ?? undefined;
    }

    private formatDateToDDMM(date: Date | null, locale = 'en-GB', timeZone?: string): string {
        if (!date) return '';
        return date.toLocaleDateString(locale, {
            day: '2-digit',
            month: '2-digit',
            timeZone: timeZone
        });
    }

    private formatTimeToHHmm(date: Date | null, locale = 'en-GB', timeZone?: string): string {
        if (!date) return '00:00';
        return date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: timeZone
        });
    }

    fixBetToShow() {
        if (!this.allMatches || this.allMatches.length === 0) {
            this.betsToShow = [];
            return;
        }

        // PrimeNG subheader grouping requires the data to be sorted by the grouped field.
        const matchesToSort = [...this.allMatches];
        matchesToSort.sort((a, b) => (a.utcDate || '').localeCompare(b.utcDate || ''));

        this.betsToShow = matchesToSort.map((match: Match, index: number) => {
            let teamHome = this.allTeams.find((team: Team) => team.name_en === match.homeTeam.name) ?? { name_bg: "Ще се реши", name_en: "Will be decided" };
            let teamAway = this.allTeams.find((team: Team) => team.name_en === match.awayTeam.name) ?? { name_bg: "Ще се реши", name_en: "Will be decided" };

            const utcDate = match.utcDate ? new Date(match.utcDate) : null;

            let isLngBg = this.getLng() === 'bg-BG'
            let curLng = isLngBg ? 'bg-BG' : "nl-BE"
            let curTZObj = { timeZone: isLngBg ? "Europe/Sofia" : "Europe/Brussels" }

            let cicle: string | undefined = this.getCycleLabelByDate(new Date(match.utcDate))

            return {
                row_index: index + 1,
                match_day: this.formatDateToDDMM(utcDate, curLng, curTZObj.timeZone), 
                match_time: this.formatTimeToHHmm(utcDate, curLng, curTZObj.timeZone),
                group: this.getPhase(match.stage, match.group),
                stage: cicle ? `TABLE.${match.stage}.${cicle}` : `TABLE.${match.stage}`,
                phase: this.getPhaseMap(false, cicle)[match.stage],
                id: match.myId,
                home_team: (this.getLng() === 'bg-BG' ? teamHome?.name_bg ?? match.homeTeam.name : teamHome?.name_en) || "",
                away_team: (this.getLng() === 'bg-BG' ? teamAway?.name_bg ?? match.awayTeam.name : teamAway?.name_en) || "",
                score: match.score,
                matchUtcDate: match.utcDate
            };
        });

        // this.checkMatchesForUpdate();

        this.cdr.detectChanges();
    }

    getProductResultRow(bet: Bet, index: number): string {
        if (index === 0) {
            return bet.score?.fullTime.home?.toString() || "";
        }
        if (index === 1) {
            return bet.score?.fullTime.away?.toString() || "";
        }
        if (index === 2) {
            return bet.score?.winner === null ? "" : this.returnTranslateFromWin(bet.score?.winner)
        }
        return "";
    }

    returnTranslateFromWin(winner: any): string {
        if (winner === undefined) return ""
        return this.translate.instant("TABLE." + (winner || "")).slice(0, 1);
    }

    getUserPredictionValue(user: User, bet: Bet, columnIndex: number): string {
        let selectedPredict = this.allPredictions.find(pred => { return pred.matches.id === bet.id && pred.users.id === user.id })
        if (selectedPredict === undefined) {
            return "";
        }
        if (columnIndex === 0) {
            return selectedPredict.home_ft.toString() || ""
        }
        if (columnIndex === 1) {
            return selectedPredict.away_ft.toString() || ""
        }
        if (columnIndex === 2) {
            return this.returnTranslateFromWin(selectedPredict.winner)
        }
        if (columnIndex === 3) {
            let result = selectedPredict.points?.toString() || "-1"
            if (result === "-1") {
                result = ""
            }
            return result
        }
        return "bar";
    }

    togleGroup(pro: any) {
        let myExpandHiddenGroup = JSON.parse(localStorage.getItem('hiddenGrops') ?? '[]');
        let oldHiddes = [...myExpandHiddenGroup]
        let newHiiden = oldHiddes.includes(pro.phase) ? oldHiddes.filter(x => x !== pro.phase) : [...oldHiddes, pro.phase]
        localStorage.setItem('hiddenGrops', JSON.stringify(newHiiden));
        this.cdr.detectChanges();
    }

    getColName(idx: number) {
        if (idx === 0) return "TABLE.HOME_TEAM_SHORT"
        if (idx === 1) return "TABLE.AWAY_TEAM_SHORT"
        if (idx === 2) return "TABLE.WINNER_SHORT"
        if (idx === 3) return "TABLE.POINTS_SHORT"
        return ""
    }

    private isDataChanged(data: any): boolean {
        let matchsCount = data.matches.length
        const currentHash = JSON.stringify(data);
        if (matchsCount === 0 || currentHash === this.lastMatchesDataHash) {
            console.log('No data change')
            return false;
        }
        console.log('Data change', { foo1: this.lastMatchesDataHash, foo2: currentHash })
        this.lastMatchesDataHash = currentHash;
        return true;
    }
}