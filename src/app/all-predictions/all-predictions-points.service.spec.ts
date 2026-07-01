/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { AllPredictionsPointsService } from './all-predictions-points.service';
import { Match, Prediction } from './all-predictions.models';

describe('AllPredictionsPointsService', () => {
    let service: AllPredictionsPointsService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [AllPredictionsPointsService]
        });
        service = TestBed.inject(AllPredictionsPointsService);
    });

    // Helper function to create a mock Match object
    const createMockMatch = (home: number, away: number, winner: string, group?: string): Match => ({
        id: 1,
        myId: 1,
        utcDate: '2026-01-01T12:00:00Z',
        status: 'FINISHED', // Ensure status is a string
        myGroup: group || '', // Ensure myGroup is a string
        score: {
            fullTime: { home, away },
            halfTime: { home: 0, away: 0 }, // Added halfTime to satisfy the Match interface
            winner,
        },
        // Add other required properties for Match type
        matchday: 1,
        stage: 'GROUP_STAGE',
        group: 'GROUP_A',
        lastUpdated: '',
        homeTeam: { id: 1, name: 'Home', shortName: 'HOM', tla: 'HOM', crest: '' },
        awayTeam: { id: 2, name: 'Away', shortName: 'AWY', tla: 'AWY', crest: '' },
    });

    // Helper function to create a mock Prediction object
    const createMockPrediction = (home_ft: number, away_ft: number, winner: string): Prediction => ({
        id: 1,
        home_ft,
        away_ft,
        winner,
        // Add other required properties for Prediction type
        utc_date: '2026-01-01T12:00:00Z',
        home_pt: -1,
        away_pt: -1,
        points: 0,
        users: { id: 1, name_bg: 'User', name_en: 'User' },
        matches: { id: 1, home_team_id: 1, away_team_id: 2 },
        teams: {
            home_team: { name_bg: 'Home', name_en: 'Home' },
            away_team: { name_bg: 'Away', name_en: 'Away' },
        }
    });

    describe('Group Stage Matches', () => {

        it('should return 3 points for an exact score', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should return 2 points for the correct goal difference (home win)', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(1, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return 2 points', () => {
            const match = createMockMatch(2, 2, 'DRAW', 'FINAL');
            const prediction = createMockPrediction(1, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return 2 points for the correct goal difference (away win)', () => {
            const match = createMockMatch(1, 3, 'AWAY_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(0, 2, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return 1 point for the correct outcome (home win)', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(3, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should return 2 point for the correct outcome (away win)', () => {
            const match = createMockMatch(0, 2, 'AWAY_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(1, 3, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return 1 point for the correct draw outcome', () => {
            const match = createMockMatch(1, 1, 'DRAW', 'GROUP_A');
            const prediction = createMockPrediction(0, 0, 'DRAW');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should return 0 points for an incorrect prediction', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(1, 2, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(0);
        });

    });

    describe('Knockout Stage Matches', () => {

        it('should return 4 points for an exact score and correct winner', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(4);
        });

        it('should return 3 points for the correct goal difference and correct winner', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(1, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should return 2 points for the correct outcome and correct winner', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(3, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return 3 points for an exact draw score but wrong winner', () => {
            const match = createMockMatch(1, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(1, 1, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should return 4 points for an exact draw score and correct winner', () => {
            const match = createMockMatch(1, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(1, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(4);
        });


        it('Diff + incorect winner should return 2 points', () => {
            const match = createMockMatch(2, 2, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(1, 1, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('Diff + coorect winner should return 2 points', () => {
            const match = createMockMatch(2, 2, 'AWAY_TEAM', 'FINAL');
            const prediction = createMockPrediction(1, 1, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should return 3 points for an exact score but wrong winner', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(2, 1, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should return 1 point for only the correct winner', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(0, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should return 0 points when everything is incorrect', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(0, 1, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(0);
        });

    });

    describe('Edge Cases', () => {
        it('should return 2 points when goal difference is +2', () => {
            const match = createMockMatch(3, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return 2 points when goal difference is -2', () => {
            const match = createMockMatch(1, 3, 'AWAY_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(0, 2, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should handle zero scores correctly (exact match)', () => {
            const match = createMockMatch(0, 0, 'DRAW', 'GROUP_A');
            const prediction = createMockPrediction(0, 0, 'DRAW');
            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should handle zero scores correctly (correct outcome)', () => {
            const match = createMockMatch(0, 0, 'DRAW', 'GROUP_A');
            const prediction = createMockPrediction(1, 1, 'DRAW');
            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should return 0 for completely wrong prediction', () => {
            const match = createMockMatch(3, 0, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(0, 2, 'AWAY_TEAM');
            expect(service.calculatePredictionPoints(match, prediction)).toBe(0);
        });
    });

    describe('Edge Cases (AI)', () => {
        it('should return 2 points for a correct goal difference of +2', () => {
            const match = createMockMatch(4, 2, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(3, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return 2 points for a correct goal difference of -3', () => {
            const match = createMockMatch(1, 4, 'AWAY_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(0, 3, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return 1 point when only the outcome is correct', () => {
            const match = createMockMatch(4, 2, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should return 0 points when goal difference has opposite sign', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(1, 2, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(0);
        });

        it('should return 1 point for a non-exact draw', () => {
            const match = createMockMatch(3, 3, 'DRAW', 'GROUP_A');
            const prediction = createMockPrediction(1, 1, 'DRAW');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should return only 1 bonus point when only the winner is correct', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(0, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should not award bonus when winner is incorrect', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(1, 0, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should not add bonus points for group stage matches', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'GROUP_B');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should return 2 points for the same goal difference regardless of the score', () => {
            const match = createMockMatch(7, 5, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(3, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return -1 when home score is undefined', () => {
            const match = createMockMatch(undefined as any, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(1, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should return -1 when away score is undefined', () => {
            const match = createMockMatch(1, undefined as any, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(1, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should return -1 when home score is not a number', () => {
            const match = createMockMatch('2' as any, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should return -1 when away score is not a number', () => {
            const match = createMockMatch(2, '1' as any, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should return -1 when home score is NaN', () => {
            const match = createMockMatch(Number.NaN as any, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should return -1 when away score is Infinity', () => {
            const match = createMockMatch(2, Number.POSITIVE_INFINITY as any, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should return -1 when predicted home score is NaN', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(Number.NaN as any, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should return -1 when predicted away score is Infinity', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, Number.NEGATIVE_INFINITY as any, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should add bonus point for ROUND_OF_16', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'ROUND_OF_16');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(4);
        });

        it('should detect group stage regardless of casing', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'gRoUp_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should add bonus when winner values match after trimming', () => {
            const match = createMockMatch(2, 1, ' HOME_TEAM ', 'FINAL');
            const prediction = createMockPrediction(0, 3, 'HOME_TEAM  ');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should add bonus when winner values match case-insensitively', () => {
            const match = createMockMatch(2, 1, 'home_team', 'FINAL');
            const prediction = createMockPrediction(0, 3, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should not add bonus when actual winner is whitespace only', () => {
            const match = createMockMatch(2, 1, '   ', 'FINAL');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should not add bonus when predicted winner is whitespace only', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(2, 1, '   ');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should not treat whitespace-only myGroup as knockout', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', '   ');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should return 4 points for exact 0:0 draw and correct winner', () => {
            const match = createMockMatch(0, 0, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(0, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(4);
        });

        it('should return only bonus point when prediction is completely wrong but winner is correct', () => {
            const match = createMockMatch(4, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(0, 3, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should return 0 when neither score, difference nor outcome matches', () => {
            const match = createMockMatch(5, 0, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(0, 5, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(0);
        });

        it('should return 3 points for exact score regardless of winner in group stage', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should return 1 point for draw outcome when both are 0:0 style', () => {
            const match = createMockMatch(0, 0, 'DRAW', 'GROUP_A');
            const prediction = createMockPrediction(1, 1, 'DRAW');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should return -1 when away score is invalid type', () => {
            const match = createMockMatch(2, '1' as any, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should return -1 when home score is invalid type', () => {
            const match = createMockMatch('2' as any, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should NOT add bonus when myGroup is empty string', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', '');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should NOT add bonus when myGroup is undefined', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', undefined as any);
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should not add bonus when winner is incorrect in knockout', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(2, 1, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should add bonus even when score is not exact but outcome is correct', () => {
            const match = createMockMatch(3, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(2, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
            // 2 (diff) + 1 (bonus)
        });

        it('should return 1 point for correct draw outcome', () => {
            const match = createMockMatch(1, 1, 'DRAW', 'GROUP_A');
            const prediction = createMockPrediction(2, 2, 'DRAW');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });





        // -------------------------
        // CORE SCORING RULES
        // -------------------------

        it('EXACT SCORE should return 3 points', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('SAME GOAL DIFFERENCE should return 2 points', () => {
            const match = createMockMatch(4, 2, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(3, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return 1 point for correct outcome only (no exact, no diff match)', () => {
            const match = createMockMatch(4, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('should return 1 point when only outcome matches (no exact score, no diff match)', () => {
            const match = createMockMatch(4, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        it('COMPLETELY WRONG should return 0 points', () => {
            const match = createMockMatch(3, 0, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(0, 3, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(0);
        });

        // -------------------------
        // DRAW LOGIC
        // -------------------------

        it('DRAW exact match should return 3 points', () => {
            const match = createMockMatch(1, 1, 'DRAW', 'GROUP_A');
            const prediction = createMockPrediction(1, 1, 'DRAW');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('DRAW outcome only should return 1 point', () => {
            const match = createMockMatch(2, 2, 'DRAW', 'GROUP_A');
            const prediction = createMockPrediction(0, 0, 'DRAW');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
        });

        // -------------------------
        // SIGN EDGE CASES
        // -------------------------

        it('WIN vs DRAW should return 0 points', () => {
            const match = createMockMatch(2, 0, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(1, 1, 'DRAW');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(0);
        });

        it('LOSS vs WIN should return 0 points', () => {
            const match = createMockMatch(0, 2, 'AWAY_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(0);
        });

        // -------------------------
        // NULL / INVALID INPUT
        // -------------------------

        it('should return -2 when match is undefined', () => {
            const prediction = createMockPrediction(1, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(undefined, prediction)).toBe(-2);
        });

        it('should return -1 when score is invalid', () => {
            const match = createMockMatch(null as any, null as any, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(1, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should return -1 when home is invalid type', () => {
            const match = createMockMatch('2' as any, 1, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should return -1 when away is invalid type', () => {
            const match = createMockMatch(2, '1' as any, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        // -------------------------
        // KNOCKOUT BONUS LOGIC
        // -------------------------

        it('should add +1 bonus in knockout for correct winner', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(4);
        });

        it('should NOT add bonus in knockout for wrong winner', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(2, 1, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should NOT treat empty group as knockout', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', '');
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should NOT treat undefined group as knockout', () => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', undefined);
            const prediction = createMockPrediction(2, 1, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        // -------------------------
        // HIGH VARIANCE TESTS
        // -------------------------

        it('should correctly handle large score differences', () => {
            const match = createMockMatch(10, 2, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(8, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should correctly handle reversed large score differences', () => {
            const match = createMockMatch(1, 5, 'AWAY_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(0, 4, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });
    })

    describe('Group Stage - scoring matrix', () => {

        const cases = [
            {
                name: 'exact score = 3 points',
                match: [2, 1],
                pred: [2, 1],
                expected: 3
            },
            {
                name: 'same goal difference = 2 points',
                match: [4, 1],
                pred: [3, 0],
                expected: 2
            },
            {
                name: 'only outcome match = 1 point',
                match: [4, 1],
                pred: [2, 0],
                expected: 1
            },
            {
                name: 'completely wrong = 0 points',
                match: [3, 0],
                pred: [0, 3],
                expected: 0
            },
            {
                name: 'draw exact = 3 points',
                match: [1, 1],
                pred: [1, 1],
                expected: 3
            },
            {
                name: 'draw only outcome = 1 point',
                match: [2, 2],
                pred: [0, 0],
                expected: 1
            }
        ];

        cases.forEach(c => {
            it(c.name, () => {
                const match = createMockMatch(c.match[0], c.match[1], 'HOME_TEAM', 'GROUP_A');
                const prediction = createMockPrediction(c.pred[0], c.pred[1], 'HOME_TEAM');

                expect(service.calculatePredictionPoints(match, prediction))
                    .toBe(c.expected);
            });
        });

    });

    describe('Knockout scoring matrix', () => {
        const cases = [
            {
                name: 'exact score + correct winner = 4',
                match: [2, 1],
                pred: [2, 1],
                winner: 'HOME_TEAM',
                expected: 4
            },
            {
                name: 'diff + correct winner = 3',
                match: [3, 1],
                pred: [2, 0],
                winner: 'HOME_TEAM',
                expected: 3
            },
            {
                name: 'only bonus = 1',
                match: [3, 1],
                pred: [0, 2],
                winner: 'HOME_TEAM',
                expected: 1
            }
        ];

        cases.forEach(c => {
            it(c.name, () => {
                const match = createMockMatch(c.match[0], c.match[1], c.winner, 'FINAL');
                const prediction = createMockPrediction(c.pred[0], c.pred[1], c.winner);

                expect(service.calculatePredictionPoints(match, prediction))
                    .toBe(c.expected);
            });
        });

    });

    describe('Exhaustive scoring validation', () => {
        const knockoutPhaseKeys = new Set([
            'LAST_32',
            'LAST_16',
            'ROUND_OF_16',
            'QUARTER_FINALS',
            'SEMI_FINALS',
            'THIRD_PLACE',
            'FINAL',
        ]);

        const normalizeWinner = (value: string | null | undefined): string | null => {
            if (typeof value !== 'string') {
                return null;
            }

            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed.toUpperCase() : null;
        };

        const isKnockoutPhase = (groupOrPhase: string): boolean => {
            const normalized = groupOrPhase.trim().toUpperCase();
            if (!normalized) {
                return false;
            }

            const phaseKey = normalized.startsWith('TABLE.') ? normalized.slice('TABLE.'.length) : normalized;

            if (phaseKey === 'GROUP_STAGE' || phaseKey === 'GROUPS_PHASE' || phaseKey.startsWith('GROUP_')) {
                return false;
            }

            if (knockoutPhaseKeys.has(phaseKey)) {
                return true;
            }

            return !phaseKey.includes('GROUP');
        };

        const expectedPoints = (
            actualHome: number,
            actualAway: number,
            predictedHome: number,
            predictedAway: number,
            stageGroup: string,
            actualWinner: string,
            predictedWinner: string,
        ): number => {
            const actualDiff = actualHome - actualAway;
            const predictedDiff = predictedHome - predictedAway;

            let points = 0;

            if (actualHome === predictedHome && actualAway === predictedAway) {
                points = 3;
            } else if (actualHome !== actualAway && actualDiff === predictedDiff) {
                points = 2;
            } else if (Math.sign(actualDiff) === Math.sign(predictedDiff)) {
                points = 1;
            }

            const isKnockout = isKnockoutPhase(stageGroup);

            const normalizedActualWinner = normalizeWinner(actualWinner);
            const normalizedPredictedWinner = normalizeWinner(predictedWinner);

            if (
                isKnockout &&
                normalizedActualWinner &&
                normalizedPredictedWinner &&
                normalizedActualWinner === normalizedPredictedWinner
            ) {
                points += 1;
            }

            return points;
        };

        it('should match the scoring rules for a large deterministic matrix', () => {
            const groups = ['GROUP_A', 'FINAL'];
            const winnerModes = ['same', 'different', 'blank'] as const;

            for (const group of groups) {
                for (let actualHome = 0; actualHome <= 4; actualHome += 1) {
                    for (let actualAway = 0; actualAway <= 4; actualAway += 1) {
                        const actualWinner = actualHome >= actualAway ? 'HOME_TEAM' : 'AWAY_TEAM';

                        for (let predictedHome = 0; predictedHome <= 4; predictedHome += 1) {
                            for (let predictedAway = 0; predictedAway <= 4; predictedAway += 1) {
                                for (const mode of winnerModes) {
                                    const predictedWinner =
                                        mode === 'same'
                                            ? ' home_team '
                                            : mode === 'different'
                                                ? 'AWAY_TEAM'
                                                : '   ';

                                    const match = createMockMatch(actualHome, actualAway, actualWinner, group);
                                    const prediction = createMockPrediction(predictedHome, predictedAway, predictedWinner);

                                    const actual = service.calculatePredictionPoints(match, prediction);
                                    const expected = expectedPoints(
                                        actualHome,
                                        actualAway,
                                        predictedHome,
                                        predictedAway,
                                        group,
                                        actualWinner,
                                        predictedWinner,
                                    );

                                    expect(actual).withContext(
                                        `group=${group}, actual=${actualHome}:${actualAway}, predicted=${predictedHome}:${predictedAway}, mode=${mode}`,
                                    ).toBe(expected);
                                    expect(actual).toBeGreaterThanOrEqual(0);
                                    expect(actual).toBeLessThanOrEqual(4);
                                }
                            }
                        }
                    }
                }
            }
        });

        it('should classify all discovered groups and phases correctly', () => {
            const discoveredGroupStageKeys = [
                'GROUP_A',
                'GROUP_B',
                'GROUP_C',
                'GROUP_D',
                'GROUP_E',
                'GROUP_F',
                'GROUP_G',
                'GROUP_H',
                'GROUP_I',
                'GROUP_J',
                'GROUP_K',
                'GROUP_L',
            ];

            const discoveredKnockoutKeys = [
                'LAST_16',
                'QUARTER_FINALS',
                'SEMI_FINALS',
                'THIRD_PLACE',
                'FINAL',
            ];

            const knownButNotInBackup = ['LAST_32', 'ROUND_OF_16'];

            discoveredGroupStageKeys.forEach((groupKey) => {
                const match = createMockMatch(2, 1, 'HOME_TEAM', groupKey);
                const prediction = createMockPrediction(0, 3, 'HOME_TEAM');

                expect(service.calculatePredictionPoints(match, prediction)).withContext(groupKey).toBe(0);
            });

            [...discoveredKnockoutKeys, ...knownButNotInBackup].forEach((phaseKey) => {
                const match = createMockMatch(2, 1, 'HOME_TEAM', phaseKey);
                const prediction = createMockPrediction(0, 3, 'HOME_TEAM');

                expect(service.calculatePredictionPoints(match, prediction)).withContext(phaseKey).toBe(1);
            });

            const tableKeyMatch = createMockMatch(2, 1, 'HOME_TEAM', 'TABLE.FINAL');
            const tableKeyPrediction = createMockPrediction(0, 3, 'HOME_TEAM');
            expect(service.calculatePredictionPoints(tableKeyMatch, tableKeyPrediction)).toBe(1);
        });
    });

    describe('Edge cases', () => {
        it('should return -1 for invalid score types', () => {
            const m = createMockMatch('a' as any, 1, 'HOME_TEAM', 'GROUP_A');
            const p = createMockPrediction(1, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(m, p)).toBe(-1);
        });
    });

    describe('Phase coefficients in applyPointsAndRankings', () => {
        const createMatchForPhase = (id: number, myGroup: string): Match => {
            const match = createMockMatch(2, 1, 'HOME_TEAM', myGroup);
            return { ...match, myId: id };
        };

        const createPredictionForMatch = (matchId: number, winner = 'HOME_TEAM'): Prediction => {
            const prediction = createMockPrediction(2, 1, winner);
            return {
                ...prediction,
                id: matchId,
                matches: { ...prediction.matches, id: matchId },
            };
        };

        it('should apply the configured multiplier by phase key', () => {
            const phases: { myGroup: string; expected: number }[] = [
                { myGroup: 'GROUP_A', expected: 3 },
                { myGroup: 'LAST_32', expected: 4 },
                { myGroup: 'LAST_16', expected: 6 },
                { myGroup: 'ROUND_OF_16', expected: 6 },
                { myGroup: 'QUARTER_FINALS', expected: 8 },
                { myGroup: 'SEMI_FINALS', expected: 10 },
                { myGroup: 'THIRD_PLACE', expected: 10 },
                { myGroup: 'FINAL', expected: 12 },
                { myGroup: 'TABLE.FINAL', expected: 12 },
            ];

            phases.forEach((entry, index) => {
                const matchId = 1000 + index;
                const users = [{ id: 1, name_bg: 'User', name_en: 'User' }];
                const matches = [createMatchForPhase(matchId, entry.myGroup)];
                const predictions = [createPredictionForMatch(matchId)];

                const result = service.applyPointsAndRankings(predictions, matches, users, null);
                expect(result.predictions[0].points).withContext(entry.myGroup).toBe(entry.expected);
                expect(result.users[0].total_points).withContext(entry.myGroup).toBe(entry.expected);
            });
        });

        it('should support fractional phase coefficients (1.5)', () => {
            const users = [{ id: 1, name_bg: 'User', name_en: 'User' }];
            const matches = [createMatchForPhase(2001, 'LAST_16')];
            const predictions = [createPredictionForMatch(2001, 'AWAY_TEAM')];

            const result = service.applyPointsAndRankings(predictions, matches, users, null);

            // Base score is 3 (exact score, no winner bonus), multiplied by 1.5.
            expect(result.predictions[0].points).toBe(4.5);
            expect(result.users[0].total_points).toBe(4.5);
        });

        it('should keep negative scores unchanged (invalid/unmatched cases)', () => {
            const users = [{ id: 1, name_bg: 'User', name_en: 'User' }];
            const matches = [createMatchForPhase(3001, 'FINAL')];
            const invalidPrediction = createPredictionForMatch(9999);

            const result = service.applyPointsAndRankings([invalidPrediction], matches, users, null);

            expect(result.predictions[0].points).toBe(-2);
            expect(result.users[0].total_points).toBe(0);
        });
    });
});