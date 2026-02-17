import { Component, OnDestroy, OnInit } from '@angular/core';
import { TableModule } from "primeng/table";
import { IconField } from "primeng/iconfield";
import { InputIcon } from "primeng/inputicon";
import { Button } from "primeng/button";
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../supabase';
import { formatDate, NgClass } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

@Component({
    selector: 'app-all-matches',
    templateUrl: './all-matches.component.html',
    styleUrls: ['./all-matches.component.css'],
    imports: [TableModule, IconField, InputIcon, Button, TranslateModule]
})
export class AllMatchesComponent implements OnInit, OnDestroy {
    private socket: Socket;
    isLocal = false;
    betsToShow: any[] = [];
    loading: boolean = true;
    allUsersNames: any[] = [];
    expandedRows: any = JSON.parse(localStorage.getItem('expandedGroups') || '{"ROUND_2":true,"ROUND_3":true,"ROUND_4":true,"ROUND_5":true}');
    allMatches: any[] = [];
    // groups: string[] = [];
    private predictionsChannel: RealtimeChannel | null = null;
    private supabase: SupabaseClient;
    private countryTranslationCache: {
        id: number,
        name_en: string,
        name_bg: string
    }[] = [];
    private latestPredictions: any[] = [];
    private groupTranslationCache = new Map<string, string>();
    private dateCache = new Map<string, { day: string; time: string }>();


    constructor(
        private supabaseService: SupabaseService,
        private translate: TranslateService,
    ) {
        this.supabase = this.supabaseService.client;
        this.socket = io(this.isLocal ? 'http://localhost:3000' : 'https://simple-node-proxy.onrender.com');

        if (!this.socket.hasListeners('connect')) {
            this.socket.on('connect', () => { });
        }

        // Avoid duplicate event listeners
        if (!this.socket.hasListeners('matchesUpdate')) {
            this.socket.on('matchesUpdate', (data) => {
                this.allMatches = data.matches;

                this.getPredictionFromView().then((data) => {
                });

                // this.getPredictionFromView().then(() => {
                //     this.prepMatchesAndSupa().then(() => {
                //         // this.composeBetsRows();
                //     });
                // });
            });
        }

        this.initializeCountryCache();
    }

    /*
    async prepMatchesAndSupa() {
        let miniMatches: any[] = await this.supabase
            .from('matches')
            .select(`*`)
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching matches:', error);
                    return [];
                }
                return data || [];
            });

        // await Promise.all(this.betsToShow.map(async (match: any, index) => {
        //     let predIndex = index + 1;
        //     let newId: string = "2026" + (predIndex < 10 ? "0" + predIndex : predIndex.toString());
        //     let minimatchEl = miniMatches.find(m => m.id.toString() === newId.toString());

        //     let away_team_id = this.findTeamByName(match.awayTeam.name)?.id;
        //     let home_team_id = this.findTeamByName(match.homeTeam.name)?.id;

        //     if (minimatchEl === undefined) {
        //         if (away_team_id !== undefined && home_team_id !== undefined) {
        //             let matchToInsert = {
        //                 id: newId,
        //                 home_team_id: home_team_id,
        //                 away_team_id: away_team_id,
        //                 utc_date: match.utcDate,
        //                 group_name: match.group,
        //                 home_ft: match.score?.fullTime?.home ?? -1,
        //                 away_ft: match.score?.fullTime?.away ?? -1,
        //                 home_pt: match.score?.halfTime?.home ?? -1,
        //                 away_pt: match.score?.halfTime?.away ?? -1,
        //                 winner: match.score ? (match.score.fullTime.home > match.score.fullTime.away ? 'HOME_TEAM' : (match.score.fullTime.home < match.score.fullTime.away ? 'AWAY_TEAM' : 'DRAW')) : null
        //             }

        //             await this.insertMatch(matchToInsert);
        //         }
        //     }
        //     else {
        //         let foundedBetsToMatch = this.betsToShow.find(m => m.id.toString() === match.id.toString());
        //         if (foundedBetsToMatch) {
        //             debugger
        //             let matchToUpdate = {
        //                 id: newId,
        //                 home_team_id: home_team_id,
        //                 away_team_id: away_team_id,
        //                 utc_date: match.utcDate,
        //                 group_name: match.group,
        //                 home_ft: foundedBetsToMatch.score.fullTime.home ?? -1,
        //                 away_ft: foundedBetsToMatch.score.fullTime.away ?? -1,
        //                 home_pt: foundedBetsToMatch.score.halfTime.home ?? -1,
        //                 away_pt: foundedBetsToMatch.score.halfTime.away ?? -1,
        //                 winner: match.score ? (match.score.fullTime.home > match.score.fullTime.away ? 'HOME_TEAM' : (match.score.fullTime.home < match.score.fullTime.away ? 'AWAY_TEAM' : 'DRAW')) : null
        //             }
        //             debugger
        //             let differences = this.getObjectDifferences(matchToUpdate, minimatchEl);
        //             if (differences.length > 0) {
        //                 debugger
        //                 await this.updateMatch(matchToUpdate, minimatchEl.id.toString(), differences);
        //             }
        //         }
        //     }
        // }))
    }
    */

    private getObjectDifferences(obj1: any, obj2: any): string[] {
        const differences: string[] = [];

        // Вземи всички уникални ключове от двата обекта
        const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

        allKeys.forEach(key => {
            // Игнорирай created_at и updated_at
            if (key === 'created_at' || key === 'updated_at') {
                return;
            }

            const val1 = obj1[key];
            const val2 = obj2[key];

            // Ако е 'id', конвертирай към string преди сравнение
            if (key === 'id') {
                if (String(val1) !== String(val2)) {
                    differences.push(key);
                }
            }
            else if (key === 'utc_date') {
                const date1 = new Date(val1).getTime();
                const date2 = new Date(val2).getTime();
                if (date1 !== date2) {
                    differences.push(key);
                }
            }
            else {
                // Провери дали стойностите са различни
                if (val1 !== val2) {
                    differences.push(key);
                }
            }
        });

        return differences;
    }

    async insertMatch(matchToInsert: any) {
        await this.supabase.from('matches')
            .insert(matchToInsert)
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error inserting match:', error);
                } else {
                    console.log('Inserted match:', data, matchToInsert);
                }
            });
    }

    async updateMatch(item: any, matchId: string, Differences?: string[]) {
        await this.supabase.from('matches')
            .update(item)
            .eq('id', matchId)
            .then(({ error }) => {
                if (error) {
                    console.error('Error updating match:', error);
                } else {
                    console.log('Updated match:', matchId, "Changes:", item, "Differences:", Differences);
                }
            });
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
        this.predictionsChannel = this.supabaseService.subscribeToTable('predictions', (payload: any) => {
            this.getPredictionFromView();
        });
    }

    async getPredictionFromView() {
        try {
            const { data, error } = await this.supabaseService.getPredictionsWithUsers();
            if (error) throw error;
            this.latestPredictions = data;

            this.composeBetsRows();
        } catch (error) {
            console.error('Error fetching predictions:', error);
            this.latestPredictions = [];
        }
    }

    private async initializeCountryCache() {
        this.supabaseService.getAllTeams().then(({ data: teams, error }) => {
            this.countryTranslationCache = teams?.map(team => ({
                id: team.id,
                name_en: team.name_en,
                name_bg: team.name_bg
            })) ?? [];
        });
    }

    getPointFromMatch(bet: any, prediction: any): number {
        const actualHome = bet.score.fullTime.home;
        const actualAway = bet.score.fullTime.away;
        const actualWinner = bet.score.winner;
        const predictedHome = prediction.home_ft;
        const predictedAway = prediction.away_ft;
        const predictedWinner = prediction.winner;

        if (actualHome === predictedHome && actualAway === predictedAway) {
            return 3; // Точен резултат
        }
        const actualAbs = Math.abs(actualHome - actualAway);
        const predictAbs = Math.abs(predictedHome - predictedAway);
        if (actualAbs === predictAbs && actualWinner === predictedWinner) {
            return 2; // Точна голова разлика
        }
        if (actualWinner === predictedWinner) {
            return 1; // Точен победител
        }
        return 0; // Неправилна прогноза
    }

    getUserName(user: any): string {
        const lngMini = this.getLngMini();
        let newName = user.users?.[`name_${lngMini}`] ?? '';
        return newName;
    }

    private composeBetsRows() {
        const lng = this.getLng();
        const lngMini = this.getLngMini();
        this.allUsersNames = [];

        this.betsToShow = this.allMatches?.map((bet: any, index) => {
            let newMatchRow = this.buildMatchRow(bet, index, lng, lngMini);
            newMatchRow.predictions.forEach((prediction: any) => {
                this.allUsersNames.push({ name: this.getUserName(prediction), points: prediction.points ?? 0, id: prediction.users.id });
            })
            return newMatchRow;
        })
        this.allUsersNames = this.aggregateUserPoints(this.allUsersNames);
        this.loading = false;
    }

    aggregateUserPoints(users: Array<{ name: string; points: number, id: number }>): Array<{ name: string; points: number, id: number }> {
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

    private updateOrAddUserPredictions(predictions: any[], user: any): any[] {
        const existingUser = predictions.find(p => p.users.id === user.users.id);

        if (existingUser) {
            existingUser.points = (existingUser.points || 0) + (user.points || 0);
            return predictions;
        }

        return [...predictions, user];
    }

    /*
    private composeBetsRows2() {
        const lng = this.getLng();
        const lngMini = this.getLngMini();
        const fooooUserPredictions: any[] = []

        this.betsToShow = this.allMatches?.map((bet: any, index) => {
            const matchRow = this.buildMatchRow(bet, index, lng, lngMini);
            let newId: number = Number("2026" + (index + 1 < 10 ? "0" + (index + 1) : (index + 1).toString()));
            const predictions = this.latestPredictions.filter((prediction: any) => prediction.matches.id === newId);
            if (predictions.length > 0) {
                const enrichedPredictions = predictions.map((prediction) => {
                    const newPoints = this.getPointFromMatch(matchRow, prediction);
                    prediction.users = {
                        ...prediction.users,
                        points: newPoints,
                    }
                    let allPoints = fooooUserPredictions.filter(p => p.name === prediction.name).reduce((acc, curr) => acc + (curr.fullPrediction.points ?? 0), 0);
                    let total_points = allPoints + newPoints

                    let oldRow = fooooUserPredictions.find(p => p.name === prediction.name);
                    if (oldRow) {
                        oldRow.fullUser = prediction.users;
                        oldRow.total_points = total_points;
                        oldRow.fullPrediction = prediction;
                    } else {
                        debugger
                        // prediction.users = {
                        //     ...prediction.users,
                        //     points: newPoints,
                        // }
                        fooooUserPredictions.push({
                            fullUser: prediction.users,
                            total_points: total_points,
                            fullPrediction: prediction
                        })
                    }

                    prediction.points = newPoints;
                    return prediction;
                });

                return {
                    ...matchRow,
                    all_users: enrichedPredictions
                };
            }
            else {
                return {
                    ...matchRow,
                    all_users: []
                }
            }
        }).filter((row: any) => row !== undefined);
        this.allUsersNames = [...fooooUserPredictions]
        this.loading = false;
    }
        */

    /*
    private composeBetsRowsOld() {
        const lng = this.getLng();
        const lngMini = this.getLngMini();
        const predictionsByMatch = this.groupPredictionsByMatch(lngMini);
        const fooooUserPredictions: any[] = []

        this.betsToShow = this.allMatches.map((bet: any, index) => {
            const matchRow = this.buildMatchRow(bet, index, lng, lngMini);
            let newId: number = Number("2026" + (index + 1 < 10 ? "0" + (index + 1) : (index + 1).toString()));
            const predictions = predictionsByMatch.get(newId) ?? [];
            if (predictions.length > 0) {

                const enrichedPredictions = predictions.map((prediction) => {
                    const newPoints = this.getPointFromMatch(matchRow, prediction);
                    let allPoints = fooooUserPredictions.filter(p => p.name === prediction.name).reduce((acc, curr) => acc + (curr.fullPrediction.points ?? 0), 0);
                    let oldRow = fooooUserPredictions.find(p => p.name === prediction.name);
                    if (oldRow) {
                        debugger
                        oldRow.name = prediction.name;
                        oldRow.total_points = allPoints + newPoints;
                        oldRow.fullPrediction = prediction;
                    } else {
                        fooooUserPredictions.push({
                            name: prediction.name,
                            total_points: allPoints + newPoints,
                            fullPrediction: prediction
                        })
                    }


                    prediction.points = newPoints;
                    return prediction;
                });

                return {
                    ...matchRow,
                    all_users: enrichedPredictions
                };
            }
        });

        this.allUsersNames = [...fooooUserPredictions]
        this.loading = false;
    }
    */

    private buildMatchRow(bet: any, index: number, lng: "bg-BG" | "en-US", lngMini: "bg" | "en") {
        const cachedDate = this.getCachedDate(bet.utcDate, lng);
        const homeTeam = this.findTeamByName(bet.homeTeam.name);
        const awayTeam = this.findTeamByName(bet.awayTeam.name);
        const { phaseLabel, group, groupRowsBy } = this.getStageInfo(bet);
        const score = this.getScoreWithOverrides(bet);
        const myId = Number("2026" + (index + 1 < 10 ? "0" + (index + 1) : (index + 1).toString()));

        const predictionsForMatch = this.latestPredictions
            .filter((prediction: any) => prediction.matches.id === myId)
            .map((prediction: any) => {
                const points = this.getPointFromMatch({...bet, score}, prediction);
                return {
                    ...prediction,
                    points
                };
            });

        if (myId === 202609) {
            // debugger
        }

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

    private getScoreWithOverrides(bet: any) {
        if (!bet?.score) {
            return bet?.score;
        }

        const score = {
            ...bet.score,
            fullTime: { ...bet.score.fullTime },
            halfTime: { ...bet.score.halfTime }
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

    /*
    private groupPredictionsByMatch(lngMini: "bg" | "en") {
        const grouped = new Map<number, any[]>();

        this.latestPredictions.forEach((prediction: any) => {
            const matchId = prediction.match_id;
            if (!matchId) {
                return;
            }

            const name = lngMini === 'bg' ? prediction.users.name_bg : prediction.users.name_en;

            const formatted = {
                name,
                home_ft: prediction.home_ft,
                away_ft: prediction.away_ft,
                winner: prediction.winner,
                winnerLabel: this.translatePredictionWinner(prediction.winner),
                full: prediction
            };

            if (!grouped.has(matchId)) {
                grouped.set(matchId, []);
            }

            grouped.get(matchId)!.push(formatted);
        });

        return grouped;
    }
    */

    private translatePredictionWinner(winner?: string) {
        if (!winner) {
            return '';
        }
        const translation = this.translate.instant('TABLE.' + winner);
        return translation ? translation.slice(0, 1) : '';
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

    private getStageInfo(bet: any) {
        const { stage, group } = bet;
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

    getUserPredictionValue(fullUser: any, product: any, columnIndex: number): string {
        let selectedUser = product.predictions.find((p: any) => p.users.id === fullUser.id);

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
            debugger
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

    returnTranslatedWinner(bet: any): string {
        let result = "";

        if (!bet?.score?.fullTime) {
            result = this.translate.instant("TABLE." + bet.winner).slice(0, 1);
        }
        else {
            if (bet.score.fullTime.home > bet.score.fullTime.away) {
                result = 'HOME_TEAM';
            } else if (bet.score.fullTime.home === bet.score.fullTime.away) {
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
    getProductResultRow(product: any, columnIndex: number): string {
        if (columnIndex === 0) return product.home_team_score ?? product.score?.fullTime?.home;
        if (columnIndex === 1) return product.away_team_score ?? product.score?.fullTime?.away;
        if (columnIndex === 2) return this.returnTranslatedWinner(product)
        return "";
    }

    toggleGroup() {
        localStorage.setItem('expandedGroups', JSON.stringify(this.expandedRows));
    }
}
