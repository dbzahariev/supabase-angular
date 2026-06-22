import { inject, Injectable } from '@angular/core'
import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import {
  AuthSession,
  createClient,
  SupabaseClient,
} from '@supabase/supabase-js'
import { environment } from '../../environments/environment'
import { Observable, catchError, of, tap, throwError } from 'rxjs'
import {
  JsonObject,
  Match,
  Prediction,
  PredictionBackupEventInsert,
  PredictionBackupEventRow,
  PredictionWritePayload,
  SupabaseMatch,
  SupabaseResponse,
  Team,
  User
} from './all-predictions/all-predictions.models'

export interface Profile {
  id?: string
  username: string
  website: string
  avatar_url: string
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient
  _session: AuthSession | null = null
  private readonly proxyBaseUrl = 'https://simple-node-proxy.onrender.com'
  private readonly liveMatchesFullArchiveLegacyStorageKey = 'liveMatchesFullArchive'
  private readonly liveMatchesFullArchiveStorageKey = 'live-matches-full-archive'
  private readonly liveMatchesFullArchiveMaxEntries = 8
  private readonly liveMatchesFullArchiveTtlMs = 10 * 60 * 1000
  private readonly predictionsWithUsersSelect = `
    id,
    utc_date,
    home_ft,
    away_ft,
    home_pt,
    away_pt,
    winner,
    users (
      id,
      name_bg,
      name_en
    ),
    matches (
      id,
      home_team_id,
      away_team_id
    ),
    teams:matches (
      home_team:home_team_id (
        name_bg,
        name_en
      ),
      away_team:away_team_id (
        name_bg,
        name_en
      )
    )
  `

  private httpClient = inject(HttpClient);

  constructor() {
    this.supabase = createClient(environment.SUPABASE_URL, environment.SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'implicit'
      },
      realtime: {
        headers: {
          apikey: environment.SUPABASE_KEY
        },
        params: {
          apikey: environment.SUPABASE_KEY
        }
      }
    })

    this.migrateLiveMatchesFullArchiveStorageKey()
  }

  get client(): SupabaseClient {
    return this.supabase
  }

  signIn(email: string) {
    return this.supabase.auth.signInWithOtp({ email })
  }

  getLiveMatchesFromBE(): Observable<Match[]> {
    return this.httpClient.get<Match[]>(`${this.proxyBaseUrl}/api/matches/live`, {
      params: {
        t: Date.now().toString(),
      },
    })
  }

  getLiveMatchesFullFromBE(): Observable<Match[]> {
    return this.httpClient
      .get<Match[]>(`${this.proxyBaseUrl}/api/matches/live/full`, {
        params: {
          t: Date.now().toString(),
        },
      })
      .pipe(
        tap((matches) => {
          this.saveLiveMatchesFullArchive(matches)
        }),
        catchError((error: HttpErrorResponse) => {
          if (error.status === 429) {
            const archivedMatches = this.readLatestLiveMatchesFullArchive()
            if (archivedMatches && archivedMatches.length > 0) {
              console.warn('[matches/live/full] 429 received. Falling back to archived snapshot.')
              return of(archivedMatches)
            }
          }

          return throwError(() => error)
        })
      )
  }

  getMatchDetailsFromBE(matchId: number): Observable<Record<string, unknown>> {
    return this.httpClient.get<Record<string, unknown>>(`${this.proxyBaseUrl}/api/matches/${matchId}`)
  }

  private normalizeError(error: { message: string; details?: string | null } | null): SupabaseResponse<never>['error'] {
    if (!error) {
      return null
    }

    return {
      message: error.message,
      details: error.details ?? undefined,
    }
  }

  async getAllTeams(): Promise<SupabaseResponse<Team>> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('*')

    return {
      data: data as Team[] | null,
      error: this.normalizeError(error),
    }
  }

  async getPredictions(): Promise<SupabaseResponse<Prediction>> {
    const { data, error } = await this.supabase
      .from('predictions')
      .select('*')
      .order('utc_date', { ascending: false })

    return {
      data: data as Prediction[] | null,
      error: this.normalizeError(error),
    }
  }

  async getPredictionsWithUsers(): Promise<SupabaseResponse<Prediction>> {
    const { data, error } = await this.supabase
      .from('predictions')
      .select(this.predictionsWithUsersSelect)
      .order('utc_date', { ascending: false })

    return {
      data: data as Prediction[] | null,
      error: this.normalizeError(error),
    }
  }

  async addPrediction(prediction: PredictionWritePayload | PredictionWritePayload[]): Promise<SupabaseResponse<Prediction>> {
    const { data, error } = await this.supabase
      .from('predictions')
      .insert(prediction)
      .select()

    return {
      data: data as Prediction[] | null,
      error: this.normalizeError(error),
    }
  }

  async upsertPrediction(prediction: PredictionWritePayload | PredictionWritePayload[]): Promise<SupabaseResponse<Prediction>> {
    const { data, error } = await this.supabase
      .from('predictions')
      .upsert(prediction, { onConflict: 'user_id,match_id' })
      .select()

    return {
      data: data as Prediction[] | null,
      error: this.normalizeError(error),
    }
  }

  async updatePrediction(id: number, prediction: PredictionWritePayload): Promise<SupabaseResponse<Prediction>> {
    const { data, error } = await this.supabase
      .from('predictions')
      .update(prediction)
      .eq('id', id)
      .select()

    return {
      data: data as Prediction[] | null,
      error: this.normalizeError(error),
    }
  }

  async deletePrediction(id: number): Promise<SupabaseResponse<Prediction>> {
    const { data, error } = await this.supabase
      .from('predictions')
      .delete()
      .eq('id', id)

    return {
      data: data as Prediction[] | null,
      error: this.normalizeError(error),
    }
  }

  async addPredictionBackupEvent(backupEvent: PredictionBackupEventInsert): Promise<SupabaseResponse<PredictionBackupEventRow>> {
    const { data, error } = await this.supabase
      .from('prediction_backup_events')
      .insert(backupEvent)
      .select('*')
      .single()

    return {
      data: data ? [data as PredictionBackupEventRow] : null,
      error: this.normalizeError(error),
    }
  }

  async getPredictionBackupEvents(): Promise<SupabaseResponse<PredictionBackupEventRow>> {
    const { data, error } = await this.supabase
      .from('prediction_backup_events')
      .select('*')
      .order('event_timestamp', { ascending: true })

    return {
      data: data as PredictionBackupEventRow[] | null,
      error: this.normalizeError(error),
    }
  }

  subscribeToTable(table: string, callback: (payload: JsonObject) => void) {
    const channel = this.supabase
      .channel(`schema-db-changes:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          callback(payload as JsonObject)
        }
      )

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        channel.unsubscribe()
      }
    })

    return channel
  }

  async getMatches(): Promise<SupabaseResponse<SupabaseMatch>> {
    const { data, error } = await this.supabase
      .from('matches')
      .select('*')
      .order('utc_date', { ascending: true })

    return {
      data: data as SupabaseMatch[] | null,
      error: this.normalizeError(error),
    }
  }

  async getUsers(): Promise<SupabaseResponse<User>> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')

    return {
      data: data as User[] | null,
      error: this.normalizeError(error),
    }
  }

  async deleteMatch(id: number): Promise<SupabaseResponse<SupabaseMatch>> {
    const { data, error } = await this.supabase
      .from('matches')
      .delete()
      .eq('id', id)

    return {
      data: data as SupabaseMatch[] | null,
      error: this.normalizeError(error),
    }
  }

  private saveLiveMatchesFullArchive(matches: Match[]): void {
    if (!Array.isArray(matches) || matches.length === 0) {
      return
    }

    const storedEntries = this
      .getLiveMatchesFullArchiveEntries()
      .filter((entry) => this.isArchiveEntryFresh(entry.ts))
    const nextEntries = [...storedEntries, { ts: Date.now(), data: matches }]
      .slice(-this.liveMatchesFullArchiveMaxEntries)

    try {
      localStorage.setItem(this.liveMatchesFullArchiveStorageKey, JSON.stringify(nextEntries))
    } catch {
      // Ignore storage errors (quota/privacy mode) and keep network data path intact.
    }
  }

  private readLatestLiveMatchesFullArchive(): Match[] | null {
    const entries = this
      .getLiveMatchesFullArchiveEntries()
      .filter((entry) => this.isArchiveEntryFresh(entry.ts))
    if (entries.length === 0) {
      return null
    }

    return entries[entries.length - 1]?.data ?? null
  }

  private isArchiveEntryFresh(timestamp: number): boolean {
    return Date.now() - timestamp <= this.liveMatchesFullArchiveTtlMs
  }

  private getLiveMatchesFullArchiveEntries(): { ts: number; data: Match[] }[] {
    try {
      const raw = localStorage.getItem(this.liveMatchesFullArchiveStorageKey)
      if (!raw) {
        return []
      }

      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => {
          const safeEntry = entry as { ts?: unknown; data?: unknown }
          return {
            ts: typeof safeEntry.ts === 'number' ? safeEntry.ts : 0,
            data: Array.isArray(safeEntry.data) ? (safeEntry.data as Match[]) : [],
          }
        })
        .filter((entry) => entry.ts > 0 && entry.data.length > 0)
    } catch {
      return []
    }
  }

  private migrateLiveMatchesFullArchiveStorageKey(): void {
    try {
      const legacyValue = localStorage.getItem(this.liveMatchesFullArchiveLegacyStorageKey)
      if (legacyValue === null) {
        return
      }

      const currentValue = localStorage.getItem(this.liveMatchesFullArchiveStorageKey)
      if (currentValue === null) {
        localStorage.setItem(this.liveMatchesFullArchiveStorageKey, legacyValue)
      }

      localStorage.removeItem(this.liveMatchesFullArchiveLegacyStorageKey)
    } catch {
      // Ignore storage errors (quota/privacy mode).
    }
  }
}