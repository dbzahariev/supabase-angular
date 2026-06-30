import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Bet, Match, Prediction, Team, User } from './all-predictions.models';
import { SelectedUserService } from '../services/selected-user.service';

@Injectable({ providedIn: 'root' })
export class AllPredictionsMapperService {
    private translate = inject(TranslateService);
    private selectedUserService = inject(SelectedUserService);
    private readonly cycles = [
        { label: 'cycle_1', dateFrom: new Date('2026-06-11T19:00:00Z'), dateTo: new Date('2026-06-18T10:59:59Z') },
        { label: 'cycle_2', dateFrom: new Date('2026-06-18T11:00:00Z'), dateTo: new Date('2026-06-24T06:59:59Z') },
        { label: 'cycle_3', dateFrom: new Date('2026-06-24T07:00:00Z'), dateTo: new Date('2026-06-28T02:00:00Z') },
    ];

    getFinalScore(product: Bet, columnIndex: 0 | 1 | 2): string {
        if (product.id === 202675)
        console.log('getFinalScore called with product:', product, 'and columnIndex:', columnIndex);
        const score = product.score;

        if (columnIndex === 2) {
            return score?.winner ? this.translate.instant('TABLE.' + score.winner).slice(0, 1) : '';
        }

        return this.formatTeamFinalScore(score, columnIndex === 0 ? 'home' : 'away');
    }

    private formatTeamFinalScore(score: Bet['score'], side: 'home' | 'away'): string {
        const fullTime = score?.fullTime?.[side];
        const extraTime = score?.extraTime?.[side];
        const penalties = score?.penalties?.[side];

        if (penalties != null) {
            return `${fullTime ?? ''} (${penalties})`;
        }

        if (extraTime != null) {
            return `${fullTime ?? ''} (${extraTime})`;
        }

        return (fullTime ?? '').toString();
    }

    private readonly cycleLabels = {
        CYCLE_1: { bg: 'Кръг 1', en: 'Round 1' },
        CYCLE_2: { bg: 'Кръг 2', en: 'Round 2' },
        CYCLE_3: { bg: 'Кръг 3', en: 'Round 3' },
    } as const;

    private readonly undecidedTeam = {
        name_bg: 'Ще се реши',
        name_en: 'Will be decided',
    };

    getLng(): 'bg-BG' | 'en-US' {
        const lang = this.translate.currentLang || localStorage.getItem('lang') || 'bg';
        return lang === 'bg' ? 'bg-BG' : 'en-US';
    }

    getCycleLabelFromBet(bet: Bet): string {
        const languageKey = this.getLng() === 'bg-BG' ? 'bg' : 'en';
        const cycleKey = (Object.keys(this.cycleLabels) as (keyof typeof this.cycleLabels)[]).find((key) =>
            bet.stage?.includes(key)
        );

        if (cycleKey) {
            return this.cycleLabels[cycleKey][languageKey];
        }

        return '';
    }

    getPhaseMap(isToBeTranslate = true, cycle = ''): Record<string, string> {
        const cycleStr = cycle.length > 0 ? `.${cycle}` : '';
        const groupStage = isToBeTranslate ? this.translate.instant('TABLE.GROUPS_PHASE') : 'GROUP_STAGE' + cycleStr;

        return {
            'GROUP_STAGE': groupStage,
            'LAST_32': 'U',
            'LAST_16': 'V',
            'QUARTER_FINALS': 'W',
            'SEMI_FINALS': 'X',
            'THIRD_PLACE': 'Y',
            'FINAL': 'Z',
        };
    }

    getPhase(stage: string, groupKey: string): string {
        return `TABLE.${groupKey || stage}`;
    }

    getCycleLabelByDate(targetDate: string): string | undefined {
        const t = new Date(targetDate).getTime();

        const cycle = this.cycles.find(c => {
            const from = new Date(c.dateFrom).getTime();
            const to = new Date(c.dateTo).getTime();
            return t >= from && t <= to;
        });

        return cycle?.label.toUpperCase() ?? undefined;
    }

    formatDateToStandard(date: Date | null, locale = 'en-GB', timeZone?: string): string {
        if (!date) return '';
        return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone });
    }

    formatTimeToHHmm(date: Date | null, locale = 'en-GB', timeZone?: string): string {
        if (!date) return '00:00';
        return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
    }

    getTeam(allTeams: Team[], match: Match, isLngBg: boolean): { homeTeamName: string; awayTeamName: string } {
        const teamHome = allTeams.find((team: Team) => team.name_en === match.homeTeam.name) ?? this.undecidedTeam;
        const teamAway = allTeams.find((team: Team) => team.name_en === match.awayTeam.name) ?? this.undecidedTeam;

        return {
            homeTeamName: (isLngBg ? teamHome.name_bg ?? match.homeTeam.name : teamHome.name_en) || '',
            awayTeamName: (isLngBg ? teamAway.name_bg ?? match.awayTeam.name : teamAway.name_en) || '',
        };
    }

    buildBetsToShow(matches: Match[], allTeams: Team[]): Bet[] {
        if (!matches || matches.length === 0) {
            return [];
        }

        const isLngBg = this.getLng() === 'bg-BG';
        const currentLocale = isLngBg ? 'bg-BG' : 'nl-BE';
        const timeZone = isLngBg ? 'Europe/Sofia' : 'Europe/Brussels';

        return [...matches].sort((a, b) => (a.utcDate || '').localeCompare(b.utcDate || '')).map((match: Match, index: number) => {
            const utcDate = match.utcDate ? new Date(match.utcDate) : null;
            const cycleLabel = this.getCycleLabelByDate(match.utcDate);
            const teamNames = this.getTeam(allTeams, match, isLngBg);

            return {
                row_index: index + 1,
                match_day: this.formatDateToStandard(utcDate, currentLocale, timeZone),
                match_time: this.formatTimeToHHmm(utcDate, currentLocale, timeZone),
                group: this.getPhase(match.stage, match.group),
                stage: cycleLabel ? `TABLE.${match.stage}.${cycleLabel}` : `TABLE.${match.stage}`,
                phase: this.getPhaseMap(false, cycleLabel)[match.stage],
                id: match.myId,
                home_team: teamNames.homeTeamName,
                away_team: teamNames.awayTeamName,
                score: match.score,
                matchUtcDate: match.utcDate,
                matchStatus: match.status,
            };
        });
    }

    getColName(idx: number): string {
        if (idx === 0) return 'TABLE.HOME_TEAM_SHORT';
        if (idx === 1) return 'TABLE.AWAY_TEAM_SHORT';
        if (idx === 2) return 'TABLE.WINNER_SHORT';
        if (idx === 3) return 'TABLE.POINTS_SHORT';
        return '';
    }

    returnTranslateFromWin(winner: string | null | undefined): string {
        if (!winner) return '';
        return this.translate.instant('TABLE.' + (winner || '')).slice(0, 1);
    }

    private shouldHidePrediction(hidden: boolean, bet: Bet, userId: number, selectedUserId: number): boolean {
        return hidden && bet.matchStatus === 'TIMED' && userId !== selectedUserId && userId !== 1;
    }

    private getPredictionByColumn(prediction: Prediction, columnIndex: number): string {
        if (columnIndex === 0) {
            return prediction.home_ft === -1 ? '' : prediction.home_ft.toString();
        }

        if (columnIndex === 1) {
            return prediction.away_ft === -1 ? '' : prediction.away_ft.toString();
        }

        if (columnIndex === 2) {
            return this.returnTranslateFromWin(prediction.winner);
        }

        return '';
    }

    private getPointsValue(prediction: Prediction, bet: Bet): string {
        if (bet.matchStatus === 'TIMED') {
            return '';
        }

        const result = prediction.points?.toString() || '';
        return result === '-1' ? '' : result;
    }

    getUserPredictionValue(user: User, bet: Bet, columnIndex: number, predictions: Prediction[], hidden: boolean): string {
        const selectedPredict = predictions.find(pred => pred.matches.id === bet.id && pred.users.id === user.id);
        const selectedUserId = this.selectedUserService.getSelectedUserId() ?? -1;
        const shouldHide = this.shouldHidePrediction(hidden, bet, user.id, selectedUserId);

        // Finish match without predict
        if (selectedPredict === undefined && columnIndex === 3 && bet.matchStatus === 'FINISHED') {
            return '0';
        }

        if (selectedPredict === undefined) {
            return '';
        }

        if (columnIndex >= 0 && columnIndex <= 2) {
            return shouldHide ? '?' : this.getPredictionByColumn(selectedPredict, columnIndex);
        }

        if (columnIndex === 3) {
            return this.getPointsValue(selectedPredict, bet);
        }

        // Default value out of range
        return '';
    }

    getNameFromUser(user: User): string {
        return this.getLng() === 'bg-BG' ? user.name_bg : user.name_en;
    }
}
