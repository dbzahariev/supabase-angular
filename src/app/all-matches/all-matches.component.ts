import { Component, OnInit } from '@angular/core';
import { TableModule } from "primeng/table";
import { IconField } from "primeng/iconfield";
import { InputIcon } from "primeng/inputicon";
import { Button } from "primeng/button";
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../supabase';
import { formatDate } from '@angular/common';
import { io, Socket } from 'socket.io-client';

@Component({
    selector: 'app-all-matches',
    templateUrl: './all-matches.component.html',
    styleUrls: ['./all-matches.component.css'],
    imports: [TableModule, IconField, InputIcon, Button, TranslateModule]
})
export class AllMatchesComponent implements OnInit {
    private socket: Socket;
    isLocal = false;
    betsToShow: any[] = [];
    loading: boolean = true;
    allUsersNames: any[] = [];
    expandedRows: any = JSON.parse(localStorage.getItem('expandedGroups') || '{"ROUND_2":true,"ROUND_3":true,"ROUND_4":true,"ROUND_5":true}');
    rowIndexes: number[] = [];
    allMatches: any[] = [];
    groups: string[] = [];
    private countryTranslationCache: {
        id: number,
        name_en: string,
        name_bg: string
    }[] = [];
    private groupTranslationCache = new Map<string, string>();
    private dateCache = new Map<string, { day: string; time: string }>();


    constructor(
        private supabaseService: SupabaseService,
        private translate: TranslateService,
    ) {
        this.socket = io(this.isLocal ? 'http://localhost:3000' : 'https://simple-node-proxy.onrender.com');

        if (!this.socket.hasListeners('connect')) {
            this.socket.on('connect', () => { });
        }

        // Avoid duplicate event listeners
        if (!this.socket.hasListeners('matchesUpdate')) {
            this.socket.on('matchesUpdate', (data) => {
                this.allMatches = data.matches;
                this.allMatches.forEach((match: any) => {
                    let groupKey = match.group;
                    if (!this.groups.includes(groupKey)) {
                        this.groups.push(groupKey);
                    }
                });
                this.updateBetsDisplayFromApi();
            });
        }

        this.initializeCountryCache();
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

    ngOnInit(): void {

    }

    updateBetsDisplayFromApi() {
        const lng = this.getLng(true);
        const lngMini = this.getLng(false) as "bg" | "en";

        this.betsToShow = this.allMatches.map((bet: any, index) => {
            const cachedDate = this.getCachedDate(bet.utcDate, lng);
            const homeTeam = this.findTeamByName(bet.homeTeam.name);
            const awayTeam = this.findTeamByName(bet.awayTeam.name);
            const { phaseLabel, group, groupRowsBy } = this.getStageInfo(bet);

            if (bet.id === 537327) {
                bet.score.duration = "FULL_TIME";
                bet.score.fullTime.home! = 3;
                bet.score.fullTime.away! = 4;
                bet.score.halfTime.home! = 1;
                bet.score.halfTime.away! = 2;
            }
            else if (bet.id === 537328) {
                bet.score.duration = "FULL_TIME";
                bet.score.fullTime.home! = 4;
                bet.score.fullTime.away! = 3;
                bet.score.halfTime.home! = 2;
                bet.score.halfTime.away! = 1;
            }
            else if (bet.id === 537333) {
                bet.score.duration = "FULL_TIME";
                bet.score.fullTime.home! = 2;
                bet.score.fullTime.away! = 2;
                bet.score.halfTime.home! = 1;
                bet.score.halfTime.away! = 1;
            }

            return {
                ...bet,
                groupRowsBy,
                group,
                phaseLabel: phaseLabel,
                row_index: index + 1,
                match_day: cachedDate.day,
                match_time: cachedDate.time,
                home_team: homeTeam?.[`name_${lngMini}`] ?? '',
                away_team: awayTeam?.[`name_${lngMini}`] ?? '',
                home_team_score: bet.score?.fullTime?.home,
                away_team_score: bet.score?.fullTime?.away,
            };
        });

        this.loading = false;
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

    getLng(full = false) {
        let lng: "bg-BG" | "en-US" = (localStorage.getItem('lang') ?? 'bg') === 'bg' ? 'bg-BG' : 'en-US';
        if (full === false) return lng.slice(0, 2) as "bg" | "en";
        return lng as "bg-BG" | "en-US";
    }

    getUserPredictionValue(prediction: any, columnIndex: number, j: number): string {
        if (columnIndex === 0) return prediction?.predicted_home_team_score ?? "";
        if (columnIndex === 1) return prediction?.predicted_away_team_score ?? "";
        if (columnIndex === 2) return prediction?.predicted_winner ?? "";
        return "";
    }

    returnTranslatedWinner(bet: any): string {
        let result = "";

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
        return result;
    }
    getProductResultRow(product: any, columnIndex: number): string {
        if (columnIndex === 0) return product.home_team_score ?? product.home_ft
        if (columnIndex === 1) return product.away_team_score ?? product.away_ft
        if (columnIndex === 2) return this.returnTranslatedWinner(product)
        return "";
    }

    toggleGroup() {
        localStorage.setItem('expandedGroups', JSON.stringify(this.expandedRows));
    }
}
