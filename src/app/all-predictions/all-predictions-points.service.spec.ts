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
    const createMockMatch = (home: number, away: number, winner: string, group: string): Match => ({
        id: 1,
        myId: 1,
        utcDate: '2026-01-01T12:00:00Z',
        status: 'FINISHED',
        myGroup: group,
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

        it('should return 2 points for the correct draw outcome and correct winner', () => {
            const match = createMockMatch(1, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(0, 0, 'HOME_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(2);
        });

        it('should return 1 point for the correct draw outcome but wrong winner', () => {
            const match = createMockMatch(1, 1, 'HOME_TEAM', 'FINAL');
            const prediction = createMockPrediction(0, 0, 'AWAY_TEAM');

            expect(service.calculatePredictionPoints(match, prediction)).toBe(1);
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

        it('should return -2 if match is undefined', () => {
            const prediction = createMockPrediction(1, 0, 'HOME_TEAM');
            expect(service.calculatePredictionPoints(undefined, prediction)).toBe(-2);
        });

        it('should return -1 if match score is null', () => {
            const match = createMockMatch(null as any, null as any, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(1, 0, 'HOME_TEAM');
            expect(service.calculatePredictionPoints(match, prediction)).toBe(-1);
        });

        it('should handle zero scores correctly (exact match)', () => {
            const match = createMockMatch(0, 0, 'DRAW', 'GROUP_A');
            const prediction = createMockPrediction(0, 0, 'DRAW');
            expect(service.calculatePredictionPoints(match, prediction)).toBe(3);
        });

        it('should handle zero scores correctly (correct outcome)', () => {
            const match = createMockMatch(0, 0, 'DRAW', 'GROUP_A');
            const prediction = createMockPrediction(1, 1, 'DRAW');
            expect(service.calculatePredictionPoints(match, prediction)).toBe(1); // Was 2, now correctly 1
        });

        it('should return 0 for completely wrong prediction', () => {
            const match = createMockMatch(3, 0, 'HOME_TEAM', 'GROUP_A');
            const prediction = createMockPrediction(0, 2, 'AWAY_TEAM');
            expect(service.calculatePredictionPoints(match, prediction)).toBe(0);
        });
    });
});