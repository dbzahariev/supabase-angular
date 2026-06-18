import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';
import { Match } from './all-predictions.models';
import { SupabaseService } from '../supabase';

@Injectable({ providedIn: 'root' })
export class AllPredictionsRealtimeService {
    private static socket: Socket | null = null;
    private lastUpdateTime = 0;
    private readonly THROTTLE_MS = 30000; // 30 seconds throttle on client side

    createMatchesSocket(onUpdate: (data: Match[]) => void): Socket {
        // Return singleton socket; avoid creating multiple connections
        if (AllPredictionsRealtimeService.socket) {
            return AllPredictionsRealtimeService.socket;
        }
        const socket = io('https://simple-node-proxy.onrender.com', {
            transports: ['websocket'],
            upgrade: false,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 30000, // 30 seconds
            timeout: 60000, // 60 seconds
            autoConnect: true,
        });
        
        AllPredictionsRealtimeService.socket = socket;

        socket.on('connect', () => { /* EMPTY */ });

        socket.on('connect_error', (err: Error) => {
            console.error('[socket] Connect error:', err.message);
        });

        socket.on('disconnect', (reason: string) => {
            console.log('[socket] Disconnected:', reason);
        });

        // Винаги регистрирай listener (премахни hasListeners проверката)
        // Apply throttle to avoid burst updates on client side
        socket.on('matchesUpdate', (data) => {
            const now = Date.now();
            if (now - this.lastUpdateTime >= this.THROTTLE_MS) {
                try {
                    onUpdate(data);
                    this.lastUpdateTime = now;
                } catch (err) {
                    console.error('[socket] Error in onUpdate callback:', err);
                }
            } else {
                console.log(`[socket] Throttled matchesUpdate (${Math.round((this.THROTTLE_MS - (now - this.lastUpdateTime)) / 1000)}s remaining)`);
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

    disconnectMatchesSocket(): void {
        if (AllPredictionsRealtimeService.socket) {
            AllPredictionsRealtimeService.socket.disconnect();
            AllPredictionsRealtimeService.socket = null;
            console.log('[socket] Socket disconnected and cleared');
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
