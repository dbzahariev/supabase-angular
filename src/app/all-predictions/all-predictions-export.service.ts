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
    allUsersNames: User[];
    betsToShow: Bet[];
    isShowRow: (bet: Bet) => boolean;
    getNameFromUser: (user: User) => string;
    getUserPredictionValue: (user: User, bet: Bet, columnIndex: number) => string;
    translate: (key: string) => string;
    translateGroup: (groupKey: string) => string;
    translateWinnerShort: (winner: string) => string;
    getCycleLabelFromBet: (bet: Bet) => string;
    formatLocalDateTime: (date: Date, mode: 'display' | 'filename') => string;
    getSheetName: () => string;
    includeDateTimeAndGroup?: boolean;
    includePhaseRows?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AllPredictionsExportService {
    exportToExcel(input: ExportPredictionsInput): ExportWorksheetData {
        const includeDateTimeAndGroup = input.includeDateTimeAndGroup ?? true;
        const wsData = this.buildWorksheetData(input);
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!merges'] = this.buildMerges(wsData, input.allUsersNames.length, includeDateTimeAndGroup, input.translate('TABLE.GROUPS_PHASE'));
        ws['!cols'] = this.calculateColumnWidths(wsData);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, input.getSheetName());

        const fileName = `${input.translate('TABLE.EXPORT_FILE_PREFIX')}-${input.formatLocalDateTime(new Date(), 'filename')}.xlsx`;
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
        const rowIndexLabel = input.translate('TABLE.ROW_INDEX');
        const dateLabel = input.translate('TABLE.DATE');
        const timeLabel = input.translate('TABLE.TIME');
        const groupLabel = input.translate('TABLE.GROUP');
        const homeTeamLabel = input.translate('TABLE.HOME_TEAM');
        const awayTeamLabel = input.translate('TABLE.AWAY_TEAM');
        const resultLabel = input.translate('TABLE.RESULT');
        const homeShortLabel = input.translate('TABLE.HOME_TEAM_SHORT');
        const awayShortLabel = input.translate('TABLE.AWAY_TEAM_SHORT');
        const winnerShortLabel = input.translate('TABLE.WINNER_SHORT');
        const pointsShortLabel = input.translate('TABLE.POINTS_SHORT');
        const groupsPhaseLabel = input.translate('TABLE.GROUPS_PHASE');

        const baseHeaders = includeDateTimeAndGroup
            ? [
                rowIndexLabel,
                dateLabel,
                timeLabel,
                groupLabel,
                homeTeamLabel,
                awayTeamLabel,
                resultLabel,
                '',
                '',
            ]
            : [
                rowIndexLabel,
                homeTeamLabel,
                awayTeamLabel,
                resultLabel,
                '',
                '',
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
                '',
                homeShortLabel,
                awayShortLabel,
                winnerShortLabel,
            ]
            : [
                '',
                '',
                '',
                homeShortLabel,
                awayShortLabel,
                winnerShortLabel,
            ];

        const subHeaders = [
            ...baseSubHeaders,
            ...input.allUsersNames.flatMap(() => [
                homeShortLabel,
                awayShortLabel,
                winnerShortLabel,
                pointsShortLabel,
            ]),
        ];

        const groupedRows: WorksheetData = [];
        let lastPhase: string | null = null;

        for (const bet of visibleBets) {
            if (includePhaseRows && bet.phase !== lastPhase) {
                lastPhase = bet.phase;
                const cycleLabel = input.getCycleLabelFromBet(bet);
                const phaseRow: WorksheetRow = new Array(mainHeaders.length).fill('');
                phaseRow[0] = cycleLabel ? `${groupsPhaseLabel} - ${cycleLabel}` : groupsPhaseLabel;
                groupedRows.push(phaseRow);
            }

            const row: WorksheetRow = includeDateTimeAndGroup
                ? [
                    bet.row_index,
                    bet.match_day,
                    bet.match_time,
                    input.translateGroup(bet.group),
                    bet.home_team,
                    bet.away_team,
                    bet.score?.fullTime.home ?? '',
                    bet.score?.fullTime.away ?? '',
                    bet.score?.winner ? input.translateWinnerShort(bet.score.winner) : '',
                ]
                : [
                    bet.row_index,
                    bet.home_team,
                    bet.away_team,
                    bet.score?.fullTime.home ?? '',
                    bet.score?.fullTime.away ?? '',
                    bet.score?.winner ? input.translateWinnerShort(bet.score.winner) : '',
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

    private buildMerges(wsData: WorksheetData, usersCount: number, hasDateColumn: boolean, groupsPhaseLabel: string): XLSX.Range[] {
        const userStartCol = hasDateColumn ? 9 : 6;
        const resultStartCol = hasDateColumn ? 6 : 3;
        const verticalMergeCols = hasDateColumn ? [0, 1, 2, 3, 4, 5] : [0, 1, 2];

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
            if (firstCell.startsWith(groupsPhaseLabel)) {
                merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: row.length - 1 } });
            }
        }

        return merges;
    }

    private calculateColumnWidths(wsData: WorksheetData): XLSX.ColInfo[] {
        const cols: XLSX.ColInfo[] = [];

        // Get max columns
        const maxCols = Math.max(...wsData.map(row => row.length));

        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
            let maxLength = 0;

            // Skip first row (mainHeaders) as it's merged and doesn't affect actual width
            for (let rowIdx = 1; rowIdx < wsData.length; rowIdx++) {
                const cell = wsData[rowIdx][colIdx];
                const cellStr = cell !== null && cell !== undefined ? cell.toString() : '';
                maxLength = Math.max(maxLength, cellStr.length);
            }

            // Add some padding and apply minimum/maximum widths
            const width = Math.max(2, Math.min(15, maxLength + 1));
            cols.push({ wch: width });
        }

        return cols;
    }
}
