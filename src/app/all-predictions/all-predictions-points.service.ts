import { Injectable } from '@angular/core';
import { Match, Prediction, User } from './all-predictions.models';

@Injectable({ providedIn: 'root' })
export class AllPredictionsPointsService {
    calculatePredictionPoints(match: Match | undefined, prediction: Prediction): number {
        let result = -1

        if (!match) {
            return -2;
        }
        else {
            if (match.score.fullTime.home === null || match.score.fullTime.away === null) {
                result = -1;
            }

            const actualHome = match.score.fullTime.home;
            const actualAway = match.score.fullTime.away;
            const actualWinner = match.score.winner;
            const predictedHome = prediction.home_ft;
            const predictedAway = prediction.away_ft;
            const predictedWinner = prediction.winner;

            if (actualHome === null || actualAway === null || predictedHome === null || predictedAway === null) {
                return -1;
            }


            if (result === -1 && (actualHome === predictedHome && actualAway === predictedAway)) {
                result = 3;
            }

            const actualAbs = Math.abs(actualHome - actualAway);
            const predictAbs = Math.abs(predictedHome - predictedAway);
            if (result === -1 && (actualAbs === predictAbs && actualWinner === predictedWinner)) {
                result = 2;
            }

            if (result === -1 && (actualWinner === predictedWinner)) {
                result = 1;
            } else {
                if (result === -1) {
                    result = 0;
                }
            }

            // if (match.status === 'IN_PLAY') {
            //     result = 0;
            // }

            return result;
        }
    }

    applyPointsAndRankings(predictions: Prediction[], matches: Match[], usersFromDb: User[], selectedUserId: User['id'] | null): { predictions: Prediction[]; users: User[] } {
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

        const firstUser = users.find(u => u.id === selectedUserId);
        const restUsers = [...users.sort((a, b) => (b.total_points || 0) - (a.total_points || 0))].filter(u => u.id !== firstUser?.id);
        const sortedUsers = firstUser ? [firstUser, ...restUsers] : restUsers;

        return {
            predictions: predictionsWithPoints,
            users: sortedUsers,
        };
    }
}
