import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';
import { SupabaseService } from '../supabase';

@Injectable({ providedIn: 'root' })
export class AllPredictionsRealtimeService {
    createMatchesSocket(onUpdate: (data: any) => void): Socket {
        const socket = io('https://simple-node-proxy.onrender.com');

        if (!socket.hasListeners('matchesUpdate')) {
            socket.on('matchesUpdate', (data) => {
                onUpdate(data);
            });
        }

        return socket;
    }

    subscribeToPredictions(supabaseService: SupabaseService, onChange: () => void): RealtimeChannel {
        return supabaseService.subscribeToTable('predictions', () => {
            onChange();
        });
    }

    stopPredictionsSubscription(channel: RealtimeChannel | null): void {
        if (channel) {
            channel.unsubscribe();
        }
    }

    hasMatchesDataChanged(data: any, lastHash: string): { changed: boolean; hash: string } {
        const matchesCount = data?.matches?.length ?? 0;
        const currentHash = JSON.stringify(data);

        if (matchesCount === 0 || currentHash === lastHash) {
            return { changed: false, hash: lastHash };
        }

        return { changed: true, hash: currentHash };
    }
}
