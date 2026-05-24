/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit, inject, OnDestroy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { TableModule } from "primeng/table";
import { IconField } from "primeng/iconfield";
import { InputIcon } from "primeng/inputicon";
import { Button } from "primeng/button";
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { dummyMatches, dummyTeams, dummyPredictions, dummyUsers } from '../dummy-data'
import { CommonModule } from '@angular/common';
// import { io, Socket } from 'socket.io-client';

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

@Component({
    selector: 'app-all-predictions',
    templateUrl: './all-predictions.component.html',
    styleUrls: ['./all-predictions.component.css'],
    imports: [TableModule, IconField, InputIcon, Button, TranslateModule, FormsModule, CommonModule]
})
export class AllPredictionsComponent implements OnInit, OnDestroy {
    betsToShow: Bet[] = [];
    allUsersNamesFromDB: User[] = [];
    allUsersNames: User[] = [];
    allPredictions: Prediction[] = [];
    allMatches: Match[] = [];
    allTeams: Team[] = [];
    loading = false;
    themeColor: string = '#ffffff';
    themeBackground: string = '#ffffff';
    themeTextColor: string = '#000000';
    mixColor: string = '#ffffff';
    mixPercent: string = '85%';
    // private socket: Socket;
    private supabaseService = inject(SupabaseService);
    private cdr = inject(ChangeDetectorRef);
    private translate = inject(TranslateService);
    private predictionsChannel: RealtimeChannel | null = null;
    private destroyRef = inject(DestroyRef);

    constructor() {
        // this.socket = io('https://simple-node-proxy.onrender.com');
        // if (!this.socket.hasListeners('matchesUpdate')) {
        //     this.socket.on('matchesUpdate', (data) => {
        //         console.log('Received matches update:', data);
        //         this.fixAllMatches(data)
        //     });
        // }
    }

    isShowRow(product: any) {
        return !JSON.parse(localStorage.getItem('hiddenGrops') ?? '[]').includes(product.phase)
    }

    ngOnInit(): void {
        this.themeColor = localStorage.getItem('theme-color') || '#ffffff';
        this.themeTextColor = this.getContrastYIQ(this.themeColor);
        this.themeBackground = (localStorage.getItem('dark-mode') || 'disabled') === 'enabled' ? '#000000' : '#ffffff';
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

    getAllMatche() {
        this.supabaseService.getAllMatchesFromBE().subscribe((data: any) => {
            this.fixAllMatches(data)
        });
    }

    fixAllMatches(data: any) {
        if (!data || !data.matches) {
            this.allMatches = [];
        } else {
            this.allMatches = data.matches?.map((match: any, index: number) => {
                let myId = Number("2026" + (index < 9 ? "0" + (index + 1) : (index + 1).toString()));
                let myGroup = this.getPhase(match.stage, match.group).group;

                if (match.id === 537327) {
                    match.score.duration = "FULL_TIME";
                    match.score.fullTime.home = 3;
                    match.score.fullTime.away = 4;
                    match.score.halfTime.home = 1;
                    match.score.halfTime.away = 2;
                    match.score.winner = "AWAY_TEAM";
                } else if (match.id === 537328) {
                    match.score.duration = "FULL_TIME";
                    match.score.fullTime.home = 4;
                    match.score.fullTime.away = 3;
                    match.score.halfTime.home = 2;
                    match.score.halfTime.away = 1;
                    match.score.winner = "HOME_TEAM";
                } else if (match.id === 537333) {
                    match.score.duration = "FULL_TIME";
                    match.score.fullTime.home = 2;
                    match.score.fullTime.away = 2;
                    match.score.halfTime.home = 1;
                    match.score.halfTime.away = 1;
                    match.score.winner = "DRAW";
                }

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
        if (columnIndex > 1) return; // Only Home (0) and Away (1) scores are editable
        let selectedMatch = this.allMatches.find(match => match.myId === bet.id)

        const score = parseInt(newValue);
        if (isNaN(score)) return;

        let prediction = this.allPredictions.find(p => p.matches.id === bet.id && p.users.id === user.id) as any;

        const isNew = !prediction;
        const payload: any = {
            user_id: user.id,
            match_id: bet.id,
            match_group: selectedMatch?.group,
            home_ft: prediction ? prediction.home_ft : 0,
            away_ft: prediction ? prediction.away_ft : 0,
            home_pt: prediction ? prediction.home_pt : 0,
            away_pt: prediction ? prediction.away_pt : 0,
            winner: prediction ? prediction.winner : 'DRAW',
        };

        if (columnIndex === 0) payload.home_ft = score;
        if (columnIndex === 1) payload.away_ft = score;

        // Automatically determine winner based on scores
        if (payload.home_ft > payload.away_ft) payload.winner = 'HOME_TEAM';
        else if (payload.away_ft > payload.home_ft) payload.winner = 'AWAY_TEAM';
        else payload.winner = 'DRAW';

        const { data, error } = isNew
            ? await this.supabaseService.addPrediction(payload)
            : await this.supabaseService.updatePrediction(prediction.id, payload);

        if (!error) {
            // Refresh local state
            this.fixPredictions();
        }
    }

    getLng(): "bg-BG" | "en-US" {
        const lang = this.translate.currentLang || localStorage.getItem('lang') || 'bg';
        return lang === 'bg' ? 'bg-BG' : 'en-US';
    }

    private getPhaseMap(isToBeTranslate: boolean = true): Record<string, string> {
        let groupStage = isToBeTranslate ? this.translate.instant('TABLE.GROUPS_PHASE') : 'GROUP_STAGE';

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

    private getPhase(stage: string, groupKey: string): { group: string, stage: string } {
        let show = ""
        if (stage === 'GROUP_STAGE') {
            show = 'TABLE.GROUPS_PHASE'
        } else {
        }
        let result = {
            stage: this.getPhaseMap()[stage],
            group: this.translate.instant('TABLE.' + (groupKey || stage)),
            // show: show,//stage === 'GROUP_STAGE' ? this.translate.instant('TABLE.GROUPS_PHASE') : this.translate.instant('TABLE.' + (groupKey || stage))
        }
        return result;
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
            let teamHome = this.allTeams.find((team: Team) => team.name_en === match.homeTeam.name);
            let teamAway = this.allTeams.find((team: Team) => team.name_en === match.awayTeam.name);

            const utcDate = match.utcDate ? new Date(match.utcDate) : null;
            let phase = this.getPhaseMap(false)[match.stage];
            let phaseShow = `TABLE.${match.stage}`//this.getPhase(match.stage, match.group).show
            return {
                row_index: index + 1,
                match_day: utcDate ? utcDate.toLocaleDateString(this.getLng()) : '',
                match_time: utcDate ? utcDate.toLocaleTimeString(this.getLng(), { hour: '2-digit', minute: '2-digit' }) : '',
                group: this.getPhase(match.stage, match.group).group, // Ре-транслираме групата тук
                stage: phaseShow,
                phase: phase,
                id: match.myId,
                home_team: (this.getLng() === 'bg-BG' ? teamHome?.name_bg ?? match.homeTeam.name : teamHome?.name_en) || "",
                away_team: (this.getLng() === 'bg-BG' ? teamAway?.name_bg ?? match.awayTeam.name : teamAway?.name_en) || "",
                score: match.score
            };
        });

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
            // return selectedPredict?.points === -1 ? "" : selectedPredict?.points.toString() || ""
            return selectedPredict.points?.toString() || ""
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
}