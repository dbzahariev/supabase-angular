import { Injectable } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class SupabaseChatService {
    private supabase: SupabaseClient;
    private messagesSubject = new BehaviorSubject<Message[]>([]);
    messages$ = this.messagesSubject.asObservable();

    constructor(private supabaseService: SupabaseService) {
        this.supabase = this.supabaseService.client;
        // this.fetchMessages();
        // this.listenForNewMessages();
    }

    async fetchMessages() {
        const { data, error } = await this.supabase
            .from('messages')
            .select('id, user_id, content, created_at, users(name)')
            .order('created_at', { ascending: true });
        if (!error && data) {
            const messages = data.map((msg: any) => ({
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
                (payload) => {
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
    getPointFromMatch(bet: any, prediction: any): number {
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
