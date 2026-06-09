import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase';

export interface Message {
    id: number;
    user_id: number;
    content: string;
    created_at: string;
    user_name?: string;
}

interface MessageRow extends Message {
    users?: { name?: string };
}

interface MatchPointInput {
    score: {
        fullTime: {
            home: number;
            away: number;
        };
        winner: string;
    };
}

interface PredictionPointInput {
    home_ft: number;
    away_ft: number;
    winner: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseChatService {
    private readonly supabaseService = inject(SupabaseService);
    private readonly supabase: SupabaseClient = this.supabaseService.client;
    private messagesSubject = new BehaviorSubject<Message[]>([]);
    messages$ = this.messagesSubject.asObservable();

    async fetchMessages() {
        const { data, error } = await this.supabase
            .from('messages')
            .select('id, user_id, content, created_at, users(name)')
            .order('created_at', { ascending: true });
        if (!error && data) {
            const messages = (data as MessageRow[]).map((msg) => ({
                ...msg,
                user_name: msg.users?.name || 'Unknown',
            }));
            this.messagesSubject.next(messages);
        }
    }

    async sendMessage(user_id: number, content: string) {
        const { error } = await this.supabase.from('messages').insert([
            { user_id, content },
        ]);
        return !error;
    }

    listenForNewMessages() {
        this.supabase
            .channel('public:messages')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                () => {
                    this.fetchMessages();
                }
            )
            .subscribe();
    }

    getWinner(score: { away: number, home: number }): "HOME_TEAM" | "AWAY_TEAM" | "DRAW" {
        let result: "HOME_TEAM" | "AWAY_TEAM" | "DRAW";
        if (score.away > score.home) {
            result = "AWAY_TEAM";
        } else if (score.home > score.away) {
            result = "HOME_TEAM";
        } else if (score.home < score.away) {
            result = "AWAY_TEAM";
        } else {
            result = "DRAW";
        }
        return result;
    }

    /**
     * Calculate points from match and prediction
     */
    getPointFromMatch(bet: MatchPointInput, prediction: PredictionPointInput): number {
        const actualHome = bet.score.fullTime.home;
        const actualAway = bet.score.fullTime.away;
        const actualWinner = bet.score.winner;
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
}
