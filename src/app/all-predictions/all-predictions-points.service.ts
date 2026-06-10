import { Injectable } from '@angular/core';
import { Match, Prediction, User } from './all-predictions.models';

@Injectable({ providedIn: 'root' })
export class AllPredictionsPointsService {
    calculatePredictionPoints(match: Match | undefined, prediction: Prediction): number {
        if (!match) {
            return -2;
        }
        if (match.score.fullTime.home === null || match.score.fullTime.away === null) {
            return -1;
        }

        const actualHome = match.score.fullTime.home;
        const actualAway = match.score.fullTime.away;
        const actualWinner = match.score.winner;
        const predictedHome = prediction.home_ft;
        const predictedAway = prediction.away_ft;
        const predictedWinner = prediction.winner;

        if (actualHome === predictedHome && actualAway === predictedAway) {
            return 3;
        }

        const actualAbs = Math.abs(actualHome - actualAway);
        const predictAbs = Math.abs(predictedHome - predictedAway);
        if (actualAbs === predictAbs && actualWinner === predictedWinner) {
            return 2;
        }

        if (actualWinner === predictedWinner) {
            return 1;
        }

        return 0;
    }

    applyPointsAndRankings(predictions: Prediction[], matches: Match[], usersFromDb: User[]): { predictions: Prediction[]; users: User[] } {
        const users = usersFromDb.map(u => ({ ...u, total_points: 0 }));

        const predictionsWithPoints = predictions.map((prediction: Prediction) => {
            const selectedMatch = matches.find(match => match.myId === prediction.matches.id);
            const points = this.calculatePredictionPoints(selectedMatch, prediction);
            const nextPrediction = { ...prediction, points };

            const userIndex = users.findIndex(user => user.id === prediction.users.id);
            if (userIndex !== -1 && points >= 0) {
                users[userIndex].total_points = (users[userIndex].total_points || 0) + points;
            }

            return nextPrediction;
        });

        users.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));

        return {
            predictions: predictionsWithPoints,
            users,
        };
    }
}
