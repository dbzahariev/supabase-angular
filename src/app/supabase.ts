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
  MatchesApiResponse,
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
  private readonly remoteProxyBaseUrl = 'https://simple-node-proxy.onrender.com'
  private readonly isLocalHost = this.resolveIsLocalHost()
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

  getLiveMatchesFromBE(): Observable<MatchesApiResponse> {
    return this.getWithRemoteFallback<MatchesApiResponse>('/api/matches/live', {
        params: {
          t: Date.now().toString(),
        },
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const archivedMatches = this.readLatestLiveMatchesFullArchive()
          if (archivedMatches && archivedMatches.length > 0) {
            console.warn('[matches/live] Request failed. Falling back to archived snapshot.')
            return of(archivedMatches)
          }

          return throwError(() => error)
        })
      )
  }

  getLiveMatchesFullFromBE(): Observable<MatchesApiResponse> {
    return this.getWithRemoteFallback<MatchesApiResponse>('/api/matches/live/full', {
        params: {
          t: Date.now().toString(),
        },
      })
      .pipe(
        tap((matches) => {
          this.saveLiveMatchesFullArchive(matches)
        }),
        catchError((error: HttpErrorResponse) => {
          const archivedMatches = this.readLatestLiveMatchesFullArchive()
          if (archivedMatches && archivedMatches.length > 0) {
            console.warn(`[matches/live/full] Request failed (status=${error.status}). Falling back to archived snapshot.`)
            return of(archivedMatches)
          }

          return throwError(() => error)
        })
      )
  }

  getMatchDetailsFromBE(matchId: number): Observable<Record<string, unknown>> {
    return this.getWithRemoteFallback<Record<string, unknown>>(`/api/matches/${matchId}`)
  }

  getCompetitionStandingsFromBE(): Observable<Record<string, unknown>> {
    return this.getWithRemoteFallback<Record<string, unknown>>('/api/standings', {
      params: {
        t: Date.now().toString(),
      },
    })
  }

  private getWithRemoteFallback<T>(path: string, options?: { params?: Record<string, string> }): Observable<T> {
    const primaryRequest = this.httpClient.get<T>(`${this.remoteProxyBaseUrl}${path}`, options)

    if (!this.isLocalHost) {
      return primaryRequest
    }

    return primaryRequest.pipe(
      catchError((localError: HttpErrorResponse) => {
        const remoteUrl = `${this.remoteProxyBaseUrl}${path}`
        console.warn(`[API Fallback] Local proxy failed for ${path} (status=${localError.status}). Retrying via remote proxy.`)

        return this.httpClient.get<T>(remoteUrl, options).pipe(
          catchError(() => throwError(() => localError))
        )
      })
    )
  }

  private resolveIsLocalHost(): boolean {
    const hostname = globalThis.location?.hostname?.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1'
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

  private readLatestLiveMatchesFullArchive(): MatchesApiResponse | null {
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

  private getLiveMatchesFullArchiveEntries(): { ts: number; data: MatchesApiResponse }[] {
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
            data:( Array.isArray(safeEntry.data) ? (safeEntry.data as Match[]) : []) as MatchesApiResponse,
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