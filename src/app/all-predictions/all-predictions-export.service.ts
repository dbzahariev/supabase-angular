import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Bet, User } from './all-predictions.models';

type WorksheetCell = string | number | boolean | null | undefined;
type WorksheetRow = WorksheetCell[];
type WorksheetData = WorksheetRow[];

export interface ExportWorksheetData {
    wsData: WorksheetData;
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
    includeDateTimeAndGroup?: boolean;
    includePhaseRows?: boolean;
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

    private buildWorksheetData(input: ExportPredictionsInput): WorksheetData {
        const visibleBets = input.betsToShow.filter(input.isShowRow);
        const includeDateTimeAndGroup = input.includeDateTimeAndGroup ?? true;
        const includePhaseRows = input.includePhaseRows ?? true;

        const baseHeaders = includeDateTimeAndGroup
            ? [
                '#',
                input.isLngBg ? 'Дата' : 'Date',
                input.isLngBg ? 'Час' : 'Time',
                input.isLngBg ? 'Група' : 'Group',
                input.isLngBg ? 'Домакин' : 'Home team',
                input.isLngBg ? 'Резултат' : 'Result',
                '',
                '',
                input.isLngBg ? 'Гост' : 'Away team',
            ]
            : [
                '#',
                input.isLngBg ? 'Домакин' : 'Home team',
                input.isLngBg ? 'Резултат' : 'Result',
                '',
                '',
                input.isLngBg ? 'Гост' : 'Away team',
            ];

        const mainHeaders = [
            ...baseHeaders,
            ...input.allUsersNames.flatMap(u => [
                `${input.getNameFromUser(u)} (${u.total_points ?? 0})`,
                '',
                '',
                '',
            ]),
        ];

        const baseSubHeaders = includeDateTimeAndGroup
            ? [
                '',
                '',
                '',
                '',
                '',
                input.isLngBg ? 'Д' : 'H',
                input.isLngBg ? 'Г' : 'A',
                input.isLngBg ? 'П' : 'W',
                '',
            ]
            : [
                '',
                '',
                input.isLngBg ? 'Д' : 'H',
                input.isLngBg ? 'Г' : 'A',
                input.isLngBg ? 'П' : 'W',
                '',
            ];

        const subHeaders = [
            ...baseSubHeaders,
            ...input.allUsersNames.flatMap(() => [
                input.isLngBg ? 'Д' : 'H',
                input.isLngBg ? 'Г' : 'A',
                input.isLngBg ? 'П' : 'W',
                input.isLngBg ? 'Т' : 'Pts',
            ]),
        ];

        const groupedRows: WorksheetData = [];
        let lastPhase: string | null = null;

        for (const bet of visibleBets) {
            if (includePhaseRows && bet.phase !== lastPhase) {
                lastPhase = bet.phase;
                const groupStageLabel = input.isLngBg ? 'Групова фаза' : 'Group Stage';
                const cycleLabel = input.getCycleLabelFromBet(bet);
                const phaseRow: WorksheetRow = new Array(mainHeaders.length).fill('');
                phaseRow[0] = cycleLabel ? `${groupStageLabel} - ${cycleLabel}` : groupStageLabel;
                groupedRows.push(phaseRow);
            }

            const row: WorksheetRow = includeDateTimeAndGroup
                ? [
                    bet.row_index,
                    bet.match_day,
                    bet.match_time,
                    input.translateGroup(bet.group),
                    bet.home_team,
                    bet.score?.fullTime.home ?? '',
                    bet.score?.fullTime.away ?? '',
                    bet.score?.winner ? input.translateWinnerShort(bet.score.winner) : '',
                    bet.away_team,
                ]
                : [
                    bet.row_index,
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

    private buildMerges(wsData: WorksheetData, usersCount: number): XLSX.Range[] {
        const hasDateColumn = wsData[0]?.[1] === 'Date' || wsData[0]?.[1] === 'Дата';
        const userStartCol = hasDateColumn ? 9 : 6;
        const resultStartCol = hasDateColumn ? 5 : 2;
        const awayTeamCol = hasDateColumn ? 8 : 5;
        const verticalMergeCols = hasDateColumn ? [0, 1, 2, 3, 4, awayTeamCol] : [0, 1, awayTeamCol];

        const merges: XLSX.Range[] = [
            ...verticalMergeCols.map((col) => ({ s: { r: 0, c: col }, e: { r: 1, c: col } })),
            { s: { r: 0, c: resultStartCol }, e: { r: 0, c: resultStartCol + 2 } },
        ];

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
