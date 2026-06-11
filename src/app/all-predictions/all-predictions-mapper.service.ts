/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Bet, Match, Prediction, Team, User } from './all-predictions.models';

@Injectable({ providedIn: 'root' })
export class AllPredictionsMapperService {
    private translate = inject(TranslateService);
    private cicles = [
        { label: 'cicle_1', dateFrom: new Date('2026-06-11T19:00:00Z'), dateTo: new Date('2026-06-18T10:59:59Z') },
        { label: 'cicle_2', dateFrom: new Date('2026-06-18T11:00:00Z'), dateTo: new Date('2026-06-24T06:59:59Z') },
        { label: 'cicle_3', dateFrom: new Date('2026-06-24T07:00:00Z'), dateTo: new Date('2026-06-28T02:00:00Z') },
    ];

    getLng(): 'bg-BG' | 'en-US' {
        const lang = this.translate.currentLang || localStorage.getItem('lang') || 'bg';
        return lang === 'bg' ? 'bg-BG' : 'en-US';
    }

    getCycleLabelFromBet(bet: Bet): string {
        const isLngBg = this.getLng() === 'bg-BG';
        if (bet.stage?.includes('CICLE_1')) return isLngBg ? 'Кръг 1' : 'Round 1';
        if (bet.stage?.includes('CICLE_2')) return isLngBg ? 'Кръг 2' : 'Round 2';
        if (bet.stage?.includes('CICLE_3')) return isLngBg ? 'Кръг 3' : 'Round 3';
        return '';
    }

    getPhaseMap(isToBeTranslate = true, cicle = ''): Record<string, string> {
        const cicleStr = cicle.length > 0 ? `.${cicle}` : '';
        const groupStage = isToBeTranslate ? this.translate.instant('TABLE.GROUPS_PHASE') : 'GROUP_STAGE' + cicleStr;

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

    getCycleLabelByDate(targetDate: Date | string): string | undefined {
        const t = new Date(targetDate).getTime();

        const cycle = this.cicles.find(c => {
            const from = new Date(c.dateFrom).getTime();
            const to = new Date(c.dateTo).getTime();
            return t >= from && t <= to;
        });

        return cycle?.label.toUpperCase() ?? undefined;
    }

    formatDateToDDMM(date: Date | null, locale = 'en-GB', timeZone?: string): string {
        if (!date) return '';
        return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone });
    }

    formatTimeToHHmm(date: Date | null, locale = 'en-GB', timeZone?: string): string {
        if (!date) return '00:00';
        return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
    }

    buildBetsToShow(matches: Match[], allTeams: Team[]): Bet[] {
        if (!matches || matches.length === 0) {
            return [];
        }

        const matchesToSort = [...matches];
        matchesToSort.sort((a, b) => (a.utcDate || '').localeCompare(b.utcDate || ''));

        return matchesToSort.map((match: Match, index: number) => {
            const teamHome = allTeams.find((team: Team) => team.name_en === match.homeTeam.name) ?? {
                name_bg: 'Ще се реши',
                name_en: 'Will be decided',
            };
            const teamAway = allTeams.find((team: Team) => team.name_en === match.awayTeam.name) ?? {
                name_bg: 'Ще се реши',
                name_en: 'Will be decided',
            };

            const utcDate = match.utcDate ? new Date(match.utcDate) : null;
            const isLngBg = this.getLng() === 'bg-BG';
            const curLng = isLngBg ? 'bg-BG' : 'nl-BE';
            const timeZone = isLngBg ? 'Europe/Sofia' : 'Europe/Brussels';
            const cicle = this.getCycleLabelByDate(new Date(match.utcDate));
            
            return {
                row_index: index + 1,
                match_day: this.formatDateToDDMM(utcDate, curLng, timeZone),
                match_time: this.formatTimeToHHmm(utcDate, curLng, timeZone),
                group: this.getPhase(match.stage, match.group),
                stage: cicle ? `TABLE.${match.stage}.${cicle}` : `TABLE.${match.stage}`,
                phase: this.getPhaseMap(false, cicle)[match.stage],
                id: match.myId,
                home_team: (isLngBg ? teamHome?.name_bg ?? match.homeTeam.name : teamHome?.name_en) || '',
                away_team: (isLngBg ? teamAway?.name_bg ?? match.awayTeam.name : teamAway?.name_en) || '',
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

    getProductResultRow(bet: Bet, index: number): string {
        if (index === 0) {
            return bet.score?.fullTime.home?.toString() || '';
        }
        if (index === 1) {
            return bet.score?.fullTime.away?.toString() || '';
        }
        if (index === 2) {
            return bet.score?.winner === null ? '' : this.returnTranslateFromWin(bet.score?.winner);
        }
        return '';
    }

    returnTranslateFromWin(winner: any): string {
        if (winner === undefined || winner === '') return '';
        return this.translate.instant('TABLE.' + (winner || '')).slice(0, 1);
    }

    getUserPredictionValue(user: User, bet: Bet, columnIndex: number, predictions: Prediction[], hidden: boolean): string {
        const selectedPredict = predictions.find(pred => pred.matches.id === bet.id && pred.users.id === user.id);
        if (selectedPredict === undefined) {
            return '';
        }

        if (columnIndex === 0) {
            let homeMatchPredictionValue = selectedPredict.home_ft === -1 ? '' : selectedPredict.home_ft.toString();
            if (hidden && bet.matchStatus === 'TIMED' && user.id !== 1) {
                homeMatchPredictionValue = '?';
            }
            return homeMatchPredictionValue;
        }
        if (columnIndex === 1) {
            let awayMatchPredictionValue = selectedPredict.away_ft === -1 ? '' : selectedPredict.away_ft.toString();
            if (hidden && bet.matchStatus === 'TIMED' && user.id !== 1) {
                awayMatchPredictionValue = '?';
            }

            return awayMatchPredictionValue;
        }
        if (columnIndex === 2) {
            let translatedWinner = this.returnTranslateFromWin(selectedPredict.winner);
            if (hidden && bet.matchStatus === 'TIMED' && user.id !== 1) {
                translatedWinner = '?';
            }
            return translatedWinner;
        }
        if (columnIndex === 3) {
            const result = selectedPredict.points?.toString() || '';
            let newResult = result === '-1' ? '' : result;

            if (hidden && bet.matchStatus === 'TIMED') {
                if (user.id === 1) {
                    newResult = result === '-1' ? '0' : result;
                } else {
                    newResult = "?";
                }
            }
            return newResult;
        }

        return '';
    }

    getNameFromUser(user: User): string {
        return this.getLng() === 'bg-BG' ? user.name_bg : user.name_en;
    }
}
