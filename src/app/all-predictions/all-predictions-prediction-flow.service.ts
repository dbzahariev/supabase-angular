import { Injectable } from '@angular/core';
import { SupabaseService } from '../supabase';
import { Bet, Match, Prediction, PredictionBackupEntry, User } from './all-predictions.models';

interface PredictionMutationPayload extends Record<string, unknown> {
    user_id: number;
    match_id: number;
    match_group: string | undefined;
    home_ft: number;
    away_ft: number;
    home_pt: number;
    away_pt: number;
    winner: string;
}

export interface PredictionChangeResult {
    backupEntry: PredictionBackupEntry;
    error: any;
    shouldRefresh: boolean;
    isDelete: boolean;
    isSkip: boolean;
}

@Injectable({ providedIn: 'root' })
export class AllPredictionsPredictionFlowService {
    async applyChange(params: {
        supabaseService: SupabaseService;
        user: User;
        bet: Bet;
        columnIndex: number;
        newValue: string;
        allMatches: Match[];
        allPredictions: Prediction[];
        eventId: string;
        timestamp: string;
    }): Promise<PredictionChangeResult> {
        const { supabaseService, user, bet, columnIndex, newValue, allMatches, allPredictions, eventId, timestamp } = params;

        const selectedMatch = allMatches.find(match => match.myId === bet.id);
        const prediction = allPredictions.find(p => p.matches.id === bet.id && p.users.id === user.id) as any;

        if (columnIndex > 1) {
            return {
                backupEntry: {
                    event_id: eventId,
                    timestamp,
                    action: 'skip',
                    user_id: user.id,
                    match_id: bet.id,
                    prediction_id: prediction?.id ?? null,
                    column_index: columnIndex,
                    input_value: newValue,
                    payload: {
                        home_ft: prediction ? prediction.home_ft : -1,
                        away_ft: prediction ? prediction.away_ft : -1,
                        home_pt: prediction ? prediction.home_pt : -1,
                        away_pt: prediction ? prediction.away_pt : -1,
                        winner: prediction ? prediction.winner : 'DRAW',
                        match_group: selectedMatch?.group,
                    },
                },
                error: undefined,
                shouldRefresh: false,
                isDelete: false,
                isSkip: true,
            };
        }

        const payload = this.buildMutationPayload(user, bet, selectedMatch, prediction, columnIndex, newValue);
        const isNew = !prediction;
        const hasInvalidScore = payload.home_ft < 0 && payload.away_ft < 0;
        const shouldDelete = hasInvalidScore && !isNew;
        const shouldUpsert = !hasInvalidScore;
        const shouldSkip = hasInvalidScore && isNew;

        let error: any;
        if (shouldDelete) {
            ({ error } = await supabaseService.deletePrediction(prediction.id));
        } else if (shouldUpsert) {
            ({ error } = isNew
                ? await supabaseService.addPrediction(payload as Record<string, unknown>)
                : await supabaseService.updatePrediction(prediction.id, payload as Record<string, unknown>));
        }

        return {
            backupEntry: {
                event_id: eventId,
                timestamp,
                action: error ? 'error' : shouldDelete ? 'delete' : shouldUpsert ? (isNew ? 'insert' : 'update') : 'skip',
                user_id: user.id,
                match_id: bet.id,
                prediction_id: prediction?.id ?? null,
                column_index: columnIndex,
                input_value: newValue,
                payload: {
                    home_ft: payload.home_ft,
                    away_ft: payload.away_ft,
                    home_pt: payload.home_pt,
                    away_pt: payload.away_pt,
                    winner: payload.winner,
                    match_group: payload.match_group,
                },
                error_message: error?.message,
            },
            error,
            shouldRefresh: !error && (shouldDelete || shouldUpsert),
            isDelete: !error && shouldDelete,
            isSkip: !error && shouldSkip,
        };
    }

    private buildMutationPayload(
        user: User,
        bet: Bet,
        selectedMatch: Match | undefined,
        prediction: Prediction | undefined,
        columnIndex: number,
        newValue: string,
    ): PredictionMutationPayload {
        let score = parseInt(newValue, 10);
        if (isNaN(score)) {
            score = -1;
        }

        const payload: PredictionMutationPayload = {
            user_id: user.id,
            match_id: bet.id,
            match_group: selectedMatch?.group,
            home_ft: prediction ? prediction.home_ft : -1,
            away_ft: prediction ? prediction.away_ft : -1,
            home_pt: prediction ? prediction.home_pt : -1,
            away_pt: prediction ? prediction.away_pt : -1,
            winner: prediction ? prediction.winner : 'DRAW',
        };

        if (columnIndex === 0) payload.home_ft = score;
        if (columnIndex === 1) payload.away_ft = score;

        if (payload.home_ft > payload.away_ft) payload.winner = 'HOME_TEAM';
        else if (payload.away_ft > payload.home_ft) payload.winner = 'AWAY_TEAM';
        else payload.winner = 'DRAW';

        if (payload.home_ft === -1 || payload.away_ft === -1) {
            payload.winner = '';
        }

        return payload;
    }
}
