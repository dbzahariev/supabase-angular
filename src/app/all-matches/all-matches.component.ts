import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { TableModule } from "primeng/table";
import { IconField } from "primeng/iconfield";
import { InputIcon } from "primeng/inputicon";
import { Button } from "primeng/button";
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../supabase';
import { formatDate } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseChatService } from '../supabase-chat.service';

interface PredictionRecord {
    users: { id: number; name_bg?: string; name_en?: string };
    matches: { id: number };
    home_ft?: number | null;
    away_ft?: number | null;
    winner?: string;
    points?: number;
}

interface ScoreShape {
    winner?: string | null;
    duration?: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
}

interface MatchWithMeta {
    id: number;
    stage: string;
    group?: string | null;
    utcDate: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    score?: ScoreShape;
}

interface BetRow {
    score: ScoreShape | undefined;
    groupRowsBy: string;
    group: string;
    phaseLabel: string;
    row_index: number;
    my_id: number;
    match_day: string;
    match_time: string;
    home_team: string;
    away_team: string;
    home_team_score: number | null | undefined;
    away_team_score: number | null | undefined;
    predictions: PredictionRecord[];
}

type ExpandedRows = Record<string, boolean>;

@Component({
    selector: 'app-all-matches',
    templateUrl: './all-matches.component.html',
    styleUrls: ['./all-matches.component.css'],
    imports: [TableModule, IconField, InputIcon, Button, TranslateModule]
})
export class AllMatchesComponent implements OnInit, OnDestroy {
    private readonly supabaseService = inject(SupabaseService);
    private readonly translate = inject(TranslateService);
    private readonly chatService = inject(SupabaseChatService);
    private socket: Socket;
    isLocal = false;
    betsToShow: BetRow[] = [];
    loading = true;
    allUsersNames: { name: string; points: number; id: number }[] = [];
    expandedRows: ExpandedRows = JSON.parse(localStorage.getItem('expandedGroups') || '{"ROUND_2":true,"ROUND_3":true,"ROUND_4":true,"ROUND_5":true}') as ExpandedRows;
    allMatches: MatchWithMeta[] = [];
    // groups: string[] = [];
    private predictionsChannel: RealtimeChannel | null = null;
    private countryTranslationCache: {
        id: number,
        name_en: string,
        name_bg: string
    }[] = [];
    private latestPredictions: PredictionRecord[] = [];
    private groupTranslationCache = new Map<string, string>();
    private dateCache = new Map<string, { day: string; time: string }>();

    constructor() {
        this.socket = io(this.isLocal ? 'http://localhost:3000' : 'https://simple-node-proxy.onrender.com');

        if (!this.socket.hasListeners('connect')) {
            this.socket.on('connect', () => undefined);
        }

        // Avoid duplicate event listeners
        if (!this.socket.hasListeners('matchesUpdate')) {
            this.socket.on('matchesUpdate', (data: { matches: MatchWithMeta[] }) => {
                this.allMatches = data.matches;
                void this.getPredictionFromView();
            });
        }

        this.initializeCountryCache();
    }

    ngOnInit(): void {
        this.subscribeToTestPredictions();
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
        this.predictionsChannel = this.supabaseService.subscribeToTable('predictions', () => {
            void this.getPredictionFromView();
        });
    }

    async getPredictionFromView() {
        try {
            const { data, error } = await this.supabaseService.getPredictionsWithUsers();
            if (error) throw error;
            this.latestPredictions = (data ?? []).map((row) => ({
                users: Array.isArray(row.users) ? row.users[0] : row.users,
                matches: Array.isArray(row.matches) ? row.matches[0] : row.matches,
                home_ft: row.home_ft,
                away_ft: row.away_ft,
                winner: row.winner,
                points: 0,
            })) as PredictionRecord[];

            this.composeBetsRows();
        } catch (error) {
            console.error('Error fetching predictions:', error);
            this.latestPredictions = [];
        }
    }

    private async initializeCountryCache() {
        this.supabaseService.getAllTeams().then(({ data: teams }) => {
            this.countryTranslationCache = teams?.map(team => ({
                id: team.id,
                name_en: team.name_en,
                name_bg: team.name_bg
            })) ?? [];
        });
    }

    getUserName(user: PredictionRecord): string {
        const lngMini = this.getLngMini();
        const newName = user.users?.[`name_${lngMini}`] ?? '';
        return newName;
    }

    private composeBetsRows() {
        const lng = this.getLng();
        const lngMini = this.getLngMini();
        this.allUsersNames = [];

        this.betsToShow = this.allMatches?.map((bet: MatchWithMeta, index) => {
            const newMatchRow = this.buildMatchRow(bet, index, lng, lngMini);
            newMatchRow.predictions.forEach((prediction: PredictionRecord) => {
                this.allUsersNames.push({ name: this.getUserName(prediction), points: prediction.points ?? 0, id: prediction.users.id });
            })
            return newMatchRow;
        })
        this.allUsersNames = this.aggregateUserPoints(this.allUsersNames);
        this.loading = false;
    }

    aggregateUserPoints(users: { name: string; points: number, id: number }[]): { name: string; points: number, id: number }[] {
        const userMap = new Map<string, number>();

        users.forEach(user => {
            const currentPoints = userMap.get(user.name) || 0;
            userMap.set(user.name, currentPoints + user.points);
        });

        return Array.from(userMap.entries()).map(([name, points]) => ({
            name,
            points,
            id: users.find(u => u.name === name)?.id ?? 0
        }));
    }

    private buildMatchRow(bet: MatchWithMeta, index: number, lng: "bg-BG" | "en-US", lngMini: "bg" | "en"): BetRow {
        const cachedDate = this.getCachedDate(bet.utcDate, lng);
        const homeTeam = this.findTeamByName(bet.homeTeam.name);
        const awayTeam = this.findTeamByName(bet.awayTeam.name);
        const { phaseLabel, group, groupRowsBy } = this.getStageInfo(bet);
        const score = this.getScoreWithOverrides(bet);
        const myId = Number("2026" + (index + 1 < 10 ? "0" + (index + 1) : (index + 1).toString()));

        const predictionsForMatch = this.latestPredictions
            .filter((prediction: PredictionRecord) => prediction.matches.id === myId)
            .map((prediction: PredictionRecord) => {
                const points = this.chatService.getPointFromMatch(
                    {
                        score: {
                            fullTime: {
                                home: score?.fullTime?.home ?? 0,
                                away: score?.fullTime?.away ?? 0,
                            },
                            winner: score?.winner ?? '',
                        },
                    },
                    {
                        home_ft: prediction.home_ft ?? 0,
                        away_ft: prediction.away_ft ?? 0,
                        winner: prediction.winner ?? '',
                    }
                );
                return {
                    ...prediction,
                    points
                };
            });

        return {
            score,
            groupRowsBy,
            group,
            phaseLabel,
            row_index: index + 1,
            my_id: myId,
            match_day: cachedDate.day,
            match_time: cachedDate.time,
            home_team: homeTeam?.[`name_${lngMini}`] ?? '',
            away_team: awayTeam?.[`name_${lngMini}`] ?? '',
            home_team_score: score?.fullTime?.home,
            away_team_score: score?.fullTime?.away,
            predictions: predictionsForMatch
        };
    }

    private getScoreWithOverrides(bet: MatchWithMeta): ScoreShape | undefined {
        if (!bet?.score) {
            return bet?.score;
        }

        const score: ScoreShape = {
            ...bet.score,
            fullTime: {
                home: bet.score.fullTime?.home ?? 0,
                away: bet.score.fullTime?.away ?? 0,
            },
            halfTime: {
                home: bet.score.halfTime?.home ?? 0,
                away: bet.score.halfTime?.away ?? 0,
            }
        };

        if (bet.id === 537327) {
            score.duration = "FULL_TIME";
            score.fullTime.home = 3;
            score.fullTime.away = 4;
            score.halfTime.home = 1;
            score.halfTime.away = 2;
            score.winner = "AWAY_TEAM";
        } else if (bet.id === 537328) {
            score.duration = "FULL_TIME";
            score.fullTime.home = 4;
            score.fullTime.away = 3;
            score.halfTime.home = 2;
            score.halfTime.away = 1;
            score.winner = "HOME_TEAM";
        } else if (bet.id === 537333) {
            score.duration = "FULL_TIME";
            score.fullTime.home = 2;
            score.fullTime.away = 2;
            score.halfTime.home = 1;
            score.halfTime.away = 1;
            score.winner = "DRAW";
        }

        return score;
    }

    private getCachedDate(utcDate: string, lng: string) {
        if (!this.dateCache.has(utcDate)) {
            const date = new Date(utcDate);
            this.dateCache.set(utcDate, {
                day: formatDate(date, 'dd.MM.yyyy', lng),
                time: formatDate(date, 'HH:mm', lng)
            });
        }
        return this.dateCache.get(utcDate)!;
    }

    private findTeamByName(name: string) {
        return this.countryTranslationCache.find(team => team.name_en === name);
    }

    private getGroupTranslation(groupKey: string) {
        if (!this.groupTranslationCache.has(groupKey)) {
            this.groupTranslationCache.set(groupKey, this.translate.instant('TABLE.' + groupKey));
        }
        return this.groupTranslationCache.get(groupKey)!;
    }

    private getStageInfo(bet: MatchWithMeta) {
        const stage = bet.stage ?? 'GROUP_STAGE';
        const { group } = bet;
        const groupKey = group ?? stage ?? "UNKNOWN_GROUP";
        const phaseMap = this.getPhaseMap();
        const phaseLabel = this.getPhaseLabel(stage, groupKey);
        const groupRowsBy = stage === 'GROUP_STAGE' ? "A" : phaseMap[stage];

        return {
            groupRowsBy,
            phaseLabel,
            group: this.getGroupTranslation(groupKey),
        };
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

    private getPhaseLabel(stage: string, groupKey: string): string {
        return stage === 'GROUP_STAGE'
            ? this.getPhaseMap()[stage]
            : this.getGroupTranslation(groupKey);
    }

    getLng(): "bg-BG" | "en-US" {
        return (localStorage.getItem('lang') ?? 'bg') === 'bg' ? 'bg-BG' : 'en-US';
    }

    getLngMini(): "bg" | "en" {
        return this.getLng().slice(0, 2) as "bg" | "en";
    }

    getUserPredictionValue(fullUser: { id: number }, product: BetRow, columnIndex: number): string {
        const selectedUser = product.predictions.find((p: PredictionRecord) => p.users.id === fullUser.id);

        if (selectedUser) {
            if (columnIndex === 0) return this.formatPredictionValue(selectedUser.home_ft);
            if (columnIndex === 1) return this.formatPredictionValue(selectedUser.away_ft);
            if (columnIndex === 2) return this.returnTranslatedWinner(selectedUser);
            if (columnIndex === 3) return this.formatPredictionValue(selectedUser.points ?? 0, true);

            return "";
        }
        return "";
    }

    /*
    getUserPredictionValue2(fullUser: any, product: any, columnIndex: number): string {
        let selectedUser = product.all_users[fullUser];
        if (selectedUser) {
            console.log("Selected user for column", columnIndex, ":", selectedUser, "Points:", selectedUser?.points);
        }
        if (selectedUser) {
            if (columnIndex === 0) return this.formatPredictionValue(selectedUser.home_ft);
            if (columnIndex === 1) return this.formatPredictionValue(selectedUser.away_ft);
            if (columnIndex === 2) return selectedUser.winner ?? "6";
            if (columnIndex === 3) return this.formatPredictionValue(selectedUser.points ?? 0, true);

            return "";
        }
        return "";
    }
    */

    private formatPredictionValue(value: number | string | null | undefined, fallbackZero = false): string {
        if (value === null || value === undefined) {
            return fallbackZero ? "0" : "";
        }
        return value.toString();
    }

    returnTranslatedWinner(bet: { winner?: string; score?: ScoreShape }): string {
        let result = "";

        if (!bet?.score?.fullTime) {
            result = this.translate.instant("TABLE." + bet.winner).slice(0, 1);
        }
        else {
            const homeScore = bet.score.fullTime.home ?? 0;
            const awayScore = bet.score.fullTime.away ?? 0;
            if (homeScore > awayScore) {
                result = 'HOME_TEAM';
            } else if (homeScore === awayScore) {
                result = 'DRAW';
            } else {
                result = 'AWAY_TEAM';
            }

            if (bet.score.duration === 'FULL_TIME') {
                result = this.translate.instant("TABLE." + result).slice(0, 1);
            }
            else {
                result = ""
            }
        }
        return result;
    }
    getProductResultRow(product: BetRow, columnIndex: number): string {
        if (columnIndex === 0) return String(product.home_team_score ?? product.score?.fullTime?.home ?? '');
        if (columnIndex === 1) return String(product.away_team_score ?? product.score?.fullTime?.away ?? '');
        if (columnIndex === 2) return this.returnTranslatedWinner(product)
        return "";
    }

    toggleGroup() {
        localStorage.setItem('expandedGroups', JSON.stringify(this.expandedRows));
    }
}
