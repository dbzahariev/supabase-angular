/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit, inject, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TableModule } from "primeng/table";
import { IconField } from "primeng/iconfield";
import { InputIcon } from "primeng/inputicon";
import { Button } from "primeng/button";
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';

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
    name_en: string
}

interface Team {
    id: number;
    name_en: string;
    name_bg: string;
}

interface Prediction {
    points: number;
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
        group_name: string;
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
    imports: [TableModule, IconField, InputIcon, Button, TranslateModule, TableModule]
})
export class AllPredictionsComponent implements OnInit, OnDestroy {
    betsToShow: Bet[] = [];
    expandedRows: any = JSON.parse(localStorage.getItem('expandedGroups') || '{"ROUND_2":true,"ROUND_3":true,"ROUND_4":true,"ROUND_5":true}');
    allUsersNamesFromDB: User[] = [];
    allUsersNames: User[] = [];
    allPredictions: Prediction[] = [];
    allMatches: Match[] = [];
    allTeams: Team[] = [];
    loading = true;
    private socket: Socket;
    private supabaseService = inject(SupabaseService);
    private cdr = inject(ChangeDetectorRef);
    private translate = inject(TranslateService);
    private predictionsChannel: RealtimeChannel | null = null;

    constructor() {
        this.socket = io('https://simple-node-proxy.onrender.com');
        if (!this.socket.hasListeners('matchesUpdate')) {
            this.socket.on('matchesUpdate', (data) => {
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

                this.fixPredictions();
            });
        }
    }

    ngOnDestroy() {
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
            if (this.allPredictions) {
                this.allPredictions.forEach((el) => {
                    let predictUser = { ...el.users, total_point: 3 }
                    let allUserNamesIndex = this.allUsersNames.findIndex(user => user.id === predictUser.id)
                    if (allUserNamesIndex === -1) {
                        this.allUsersNames.push(predictUser)
                    }
                })
                this.allPredictions = this.allPredictions.map((prediction: Prediction) => {
                    let newPrediction: Prediction = { ...prediction }
                    let selectedMatch = this.allMatches.find(match => match.myId === prediction.matches.id)
                    newPrediction.points = this.getPointFromMatch(selectedMatch, prediction)
                    return newPrediction
                })
            }
            this.fixBetToShow();
        })
    }

    getPointFromMatch(bet: Match | undefined, prediction: Prediction): number {
        if (!bet) {
            return -2;
        }
        if (bet.score.fullTime.home === null){
            return -3;
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

    ngOnInit(): void {
        this.fixUsers();
        this.fixTeams();
        this.subscribeToTestPredictions();
    }

    fixTeams() {
        this.supabaseService.getAllTeams().then((data: any) => {
            this.allTeams = data.data;
        })

    }

    getPointsFromUser(user: User): number {
        return this.allPredictions.filter(pred => pred.users.id === user.id && pred.points >= 0).reduce((acc, prediction) => acc + prediction.points, 0);
    }

    fixUsers() {
        this.supabaseService.getUsers().then((data: any) => {
            this.allUsersNamesFromDB = data.data;
            this.cdr.detectChanges();
        })
    }

    getLng(): "bg-BG" | "en-US" {
        return (localStorage.getItem('lang') ?? 'bg') === 'bg' ? 'bg-BG' : 'en-US';
    }

    private getPhaseMap(): Record<string, string> {
        return {
            'GROUP_STAGE': this.translate.instant('TABLE.GROUPS_PHASE'),
            'LAST_32': 'U',
            'LAST_16': 'V',
            'QUARTER_FINALS': 'W',
            'SEMI_FINALS': 'X',
            'THIRD_PLACE': 'Y',
            'FINAL': 'Z'
        };
    }

    private getPhase(stage: string, groupKey: string): { group: string, stage: string } {
        let result = {
            stage: this.getPhaseMap()[stage],
            group: this.translate.instant('TABLE.' + (groupKey || stage)),
        }
        return result;
    }

    fixBetToShow() {
        this.betsToShow = this.allMatches.map((match: Match, index: number) => {
            let teamHome = this.allTeams.find((team: Team) => team.name_en === match.homeTeam.name);
            let teamAway = this.allTeams.find((team: Team) => team.name_en === match.awayTeam.name);

            let newBet: Bet = {
                row_index: index + 1,
                match_day: new Date(match.utcDate).toLocaleDateString(this.getLng()),
                match_time: new Date(match.utcDate).toLocaleTimeString(this.getLng()),
                group: match.myGroup,
                id: match.myId,
                home_team: (this.getLng() === 'bg-BG' ? teamHome?.name_bg ?? match.homeTeam.name : teamHome?.name_en) || "",
                away_team: (this.getLng() === 'bg-BG' ? teamAway?.name_bg ?? match.awayTeam.name : teamAway?.name_en) || "",
                score: match.score
            }

            return newBet;
        });
        this.loading = false;
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
        if (columnIndex === 0) {
            return selectedPredict?.home_ft.toString() || ""
        }
        if (columnIndex === 1) {
            return selectedPredict?.away_ft.toString() || ""
        }
        if (columnIndex === 2) {
            return this.returnTranslateFromWin(selectedPredict?.winner)
        }
        if (columnIndex === 3) {
            // return selectedPredict?.points === -1 ? "" : selectedPredict?.points.toString() || ""
            return selectedPredict?.points.toString() || ""
        }
        return "bar";
    }
}