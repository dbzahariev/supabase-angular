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
            const dateKey = bet.utcDate;
            const groupKey = bet.group ?? bet.stage ?? "UNKNOWN_GROUP";

            if (!this.dateCache.has(dateKey)) {
                const date = new Date(bet.utcDate);
                this.dateCache.set(dateKey, {
                    day: formatDate(date, 'dd.MM.yyyy', lng),
                    time: formatDate(date, 'HH:mm', lng)
                });
            }

            if (!this.groupTranslationCache.has(groupKey)) {
                this.groupTranslationCache.set(groupKey,
                    this.translate.instant('TABLE.' + groupKey));
            }

            const cachedDate = this.dateCache.get(dateKey)!;
            let homeTeam = this.countryTranslationCache.find(team => team.name_en === bet.homeTeam.name);
            let awayTeam = this.countryTranslationCache.find(team => team.name_en === bet.awayTeam.name);

            return {
                ...bet,
                row_index: index + 1,
                match_day: cachedDate.day,
                match_time: cachedDate.time,
                group: this.groupTranslationCache.get(groupKey)!,
                home_team: homeTeam?.[`name_${lngMini}`] ?? '',
                away_team: awayTeam?.[`name_${lngMini}`] ?? '',
            };
        })

        this.loading = false;
    }

    updateBetsDisplayFromSupa() {
        const lng = this.getLng(true);
        const lngMini = this.getLng(false) as "bg" | "en";

        this.supabaseService.getSupaMatchesByYear(2024).then(({ data: matches, error }) => {
            if (matches) {
                this.betsToShow = matches.map((bet, index) => {
                    const dateKey = `${bet.utc_date}_${lng}`;
                    const groupKey = bet.group_name;

                    if (!this.dateCache.has(dateKey)) {
                        const date = new Date(bet.utc_date);
                        this.dateCache.set(dateKey, {
                            day: formatDate(date, 'dd.MM.yyyy', lng),
                            time: formatDate(date, 'HH:mm', lng)
                        });
                    }

                    if (!this.groupTranslationCache.has(groupKey)) {
                        this.groupTranslationCache.set(groupKey,
                            this.translate.instant('TABLE.' + groupKey));
                    }

                    const cachedDate = this.dateCache.get(dateKey)!;
                    let homeTeam = this.countryTranslationCache.find(team => team.id === bet['home_team_id']);
                    let awayTeam = this.countryTranslationCache.find(team => team.id === bet['away_team_id']);

                    return {
                        ...bet,
                        row_index: index + 1,
                        match_day: cachedDate.day,
                        match_time: cachedDate.time,
                        group: this.groupTranslationCache.get(groupKey)!,
                        home_team: homeTeam?.[`name_${lngMini}`] ?? '',
                        away_team: awayTeam?.[`name_${lngMini}`] ?? '',
                    };
                });
                this.loading = false;
            }
        })
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

    returnTranslatedWinner(product: any, foo2?: number): string {
        return "";
        let lng = this.getLng();
        let foo = product.winner.toLowerCase() + '_' + lng;
        let result = product[foo];
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
