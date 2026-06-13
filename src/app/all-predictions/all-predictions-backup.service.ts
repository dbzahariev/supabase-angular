import { Injectable } from '@angular/core';
import { SupabaseService } from '../supabase';
import { PredictionBackupEntry } from './all-predictions.models';

@Injectable({ providedIn: 'root' })
export class AllPredictionsBackupService {
    private remoteBackupWarningShown = false;

    generateBackupEventId(): string {
        return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    }

    formatLocalDateTime(date: Date, mode: 'display' | 'filename' = 'display'): string {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return mode === 'filename'
            ? `${d}_${m}_${y}_${hh}_${mm}_${ss}`
            : `${d}:${m}:${y}, ${hh}:${mm}:${ss}`;
    }

    async getPredictionBackupEntries(supabaseService: SupabaseService): Promise<PredictionBackupEntry[]> {
        try {
            const { data, error } = await supabaseService.getPredictionBackupEvents();
            if (error || !data) {
                return [];
            }

            return data.map((row: any) => ({
                event_id: row.event_id,
                timestamp: this.formatLocalDateTime(new Date(row.event_timestamp)),
                action: row.action,
                user_id: row.user_id,
                match_id: row.match_id,
                prediction_id: row.prediction_id,
                column_index: row.column_index,
                input_value: row.input_value,
                payload: row.payload,
                error_message: row.error_message,
            })) as PredictionBackupEntry[];
        } catch {
            return [];
        }
    }

    async persistPredictionBackupRemotely(supabaseService: SupabaseService, entry: PredictionBackupEntry): Promise<{ warnOnce: boolean }> {
        try {
            const { error } = await supabaseService.addPredictionBackupEvent({
                event_id: entry.event_id,
                event_timestamp: entry.timestamp,
                action: entry.action,
                user_id: entry.user_id,
                match_id: entry.match_id,
                prediction_id: entry.prediction_id,
                column_index: entry.column_index,
                input_value: entry.input_value,
                payload: entry.payload,
                error_message: entry.error_message,
                source: 'all-predictions',
            });

            if (error && !this.remoteBackupWarningShown) {
                this.remoteBackupWarningShown = true;
                return { warnOnce: true };
            }

            return { warnOnce: false };
        } catch {
            if (!this.remoteBackupWarningShown) {
                this.remoteBackupWarningShown = true;
                return { warnOnce: true };
            }

            return { warnOnce: false };
        }
    }

    downloadEntriesAsJson(entries: PredictionBackupEntry[]): string {
        const exportPayload = {
            exported_at: new Date().toISOString(),
            total_entries: entries.length,
            entries,
        };

        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const fileName = `prediction-backup-${this.formatLocalDateTime(new Date(), 'filename')}.json`;

        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);

        return fileName;
    }
}
