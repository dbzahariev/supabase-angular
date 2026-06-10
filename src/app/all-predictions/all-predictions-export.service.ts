/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Bet, User } from './all-predictions.models';

export interface ExportWorksheetData {
    wsData: any[][];
    fileName: string;
}

export interface ExportPredictionsInput {
    isLngBg: boolean;
    allUsersNames: User[];
    betsToShow: Bet[];
    isShowRow: (bet: Bet) => boolean;
    getNameFromUser: (user: User) => string;
    getUserPredictionValue: (user: User, bet: Bet, columnIndex: number) => string;
    translateGroup: (groupKey: string) => string;
    translateWinnerShort: (winner: string) => string;
    getCycleLabelFromBet: (bet: Bet) => string;
    formatLocalDateTime: (date: Date, mode: 'display' | 'filename') => string;
}

@Injectable({ providedIn: 'root' })
export class AllPredictionsExportService {
    exportToExcel(input: ExportPredictionsInput): ExportWorksheetData {
        const wsData = this.buildWorksheetData(input);
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!merges'] = this.buildMerges(wsData, input.allUsersNames.length);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, input.isLngBg ? 'Прогнози' : 'Predictions');

        const fileName = `predictions-${input.formatLocalDateTime(new Date(), 'filename')}.xlsx`;
        XLSX.writeFile(wb, fileName);

        return {
            wsData,
            fileName,
        };
    }

    private buildWorksheetData(input: ExportPredictionsInput): any[][] {
        const visibleBets = input.betsToShow.filter(input.isShowRow);

        const mainHeaders = [
            '#',
            input.isLngBg ? 'Дата' : 'Date',
            input.isLngBg ? 'Час' : 'Time',
            input.isLngBg ? 'Група' : 'Group',
            input.isLngBg ? 'Домакин' : 'Home team',
            input.isLngBg ? 'Резултат' : 'Result',
            '',
            '',
            input.isLngBg ? 'Гост' : 'Away team',
            ...input.allUsersNames.flatMap(u => [
                `${input.getNameFromUser(u)} (${u.total_points ?? 0})`,
                '',
                '',
                '',
            ]),
        ];

        const subHeaders = [
            '',
            '',
            '',
            '',
            '',
            input.isLngBg ? 'Д' : 'H',
            input.isLngBg ? 'Г' : 'A',
            input.isLngBg ? 'П' : 'W',
            '',
            ...input.allUsersNames.flatMap(() => [
                input.isLngBg ? 'Д' : 'H',
                input.isLngBg ? 'Г' : 'A',
                input.isLngBg ? 'П' : 'W',
                input.isLngBg ? 'Т' : 'Pts',
            ]),
        ];

        const groupedRows: any[][] = [];
        let lastPhase: string | null = null;

        for (const bet of visibleBets) {
            if (bet.phase !== lastPhase) {
                lastPhase = bet.phase;
                const groupStageLabel = input.isLngBg ? 'Групова фаза' : 'Group Stage';
                const cycleLabel = input.getCycleLabelFromBet(bet);
                const phaseRow = new Array(mainHeaders.length).fill('');
                phaseRow[0] = cycleLabel ? `${groupStageLabel} - ${cycleLabel}` : groupStageLabel;
                groupedRows.push(phaseRow);
            }

            const row: any[] = [
                bet.row_index,
                bet.match_day,
                bet.match_time,
                input.translateGroup(bet.group),
                bet.home_team,
                bet.score?.fullTime.home ?? '',
                bet.score?.fullTime.away ?? '',
                bet.score?.winner ? input.translateWinnerShort(bet.score.winner) : '',
                bet.away_team,
            ];

            for (const user of input.allUsersNames) {
                row.push(
                    input.getUserPredictionValue(user, bet, 0),
                    input.getUserPredictionValue(user, bet, 1),
                    input.getUserPredictionValue(user, bet, 2),
                    input.getUserPredictionValue(user, bet, 3),
                );
            }

            groupedRows.push(row);
        }

        return [mainHeaders, subHeaders, ...groupedRows];
    }

    private buildMerges(wsData: any[][], usersCount: number): any[] {
        const merges: any[] = [
            { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
            { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
            { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
            { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
            { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
            { s: { r: 0, c: 5 }, e: { r: 0, c: 7 } },
            { s: { r: 0, c: 8 }, e: { r: 1, c: 8 } },
        ];

        const userStartCol = 9;
        for (let i = 0; i < usersCount; i++) {
            const colStart = userStartCol + (i * 4);
            merges.push({ s: { r: 0, c: colStart }, e: { r: 0, c: colStart + 3 } });
        }

        for (let rowIdx = 2; rowIdx < wsData.length; rowIdx++) {
            const row = wsData[rowIdx];
            const firstCell = row?.[0]?.toString?.() || '';
            if (firstCell.includes('Групова фаза') || firstCell.includes('Group Stage')) {
                merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: row.length - 1 } });
            }
        }

        return merges;
    }
}
