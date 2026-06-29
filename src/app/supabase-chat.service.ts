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
}
