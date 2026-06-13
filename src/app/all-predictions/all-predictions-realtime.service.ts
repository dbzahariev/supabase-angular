import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';
import { SupabaseService } from '../supabase';

@Injectable({ providedIn: 'root' })
export class AllPredictionsRealtimeService {
    createMatchesSocket(onUpdate: (data: any) => void): Socket {
    console.log('[socket] Creating new socket...');
    
    const socket = io('https://simple-node-proxy.onrender.com', {
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 10000,
    });

    socket.on('connect', () => {
        console.log('[socket] Connected:', socket.id);
    });

    socket.on('connect_error', (err: Error) => {
        console.error('[socket] Connect error:', err.message);
    });

    socket.on('disconnect', (reason: string) => {
        console.log('[socket] Disconnected:', reason);
    });

    // Винаги регистрирай listener (премахни hasListeners проверката)
    socket.on('matchesUpdate', (data) => {
        console.log('[socket] matchesUpdate received', {
            timestamp: new Date().toISOString(),
            dataType: typeof data,
            isArray: Array.isArray(data),
        });
        try {
            onUpdate(data);
        } catch (err) {
            console.error('[socket] Error in onUpdate callback:', err);
        }
    });

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
