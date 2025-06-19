import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';

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

    constructor() {
        this.supabase = createClient(
            environment.supabaseUrl,
            environment.supabaseKey
        );
        this.fetchMessages();
        this.listenForNewMessages();
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
}
