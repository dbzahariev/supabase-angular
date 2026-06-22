import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Match } from './all-predictions.models';
import { SupabaseService } from '../supabase';

@Injectable({ providedIn: 'root' })
export class AllPredictionsRealtimeService {
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
