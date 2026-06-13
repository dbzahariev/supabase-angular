import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';
import { Match } from './all-predictions.models';
import { SupabaseService } from '../supabase';

@Injectable({ providedIn: 'root' })
export class AllPredictionsRealtimeService {
    // В RealtimeService (или каквото е service-а)
    private matchesPollingInterval: ReturnType<typeof setInterval> | null = null;
    createMatchesSocket(onUpdate: (data: Match[]) => void): Socket {
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
            // Спираме HTTP polling - WebSocket го замества
            if (this.matchesPollingInterval) {
                clearInterval(this.matchesPollingInterval);
                this.matchesPollingInterval = null;
                console.log('[socket] HTTP polling stopped');
            }
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

    hasMatchesDataChanged(data: Match[], lastHash: string): { changed: boolean; hash: string } {
        const matchesCount = data?.length ?? 0;
        const currentHash = JSON.stringify(data);

        if (matchesCount === 0 || currentHash === lastHash) {
            return { changed: false, hash: lastHash };
        }

        return { changed: true, hash: currentHash };
    }
}
