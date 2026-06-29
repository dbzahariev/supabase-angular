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
  PredictionBackupEventRow,
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

export interface OneMatchToInsert {
  id: number
  home_team_id: number
  away_team_id: number
  utc_date: string
  group_name: string
  home_ft?: number | undefined
  away_ft?: number | undefined
  home_pt?: number | undefined
  away_pt?: number | undefined
  winner?: string | undefined
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

  private createCacheBustParams(): { t: string } {
    return {
      t: Date.now().toString(),
    }
  }

  private toSupabaseResponse<T>(
    data: unknown,
    error: { message: string; details?: string | null } | null
  ): SupabaseResponse<T> {
    return {
      data: data as T[] | null,
      error: this.normalizeError(error),
    }
  }

  private async selectRows<T>(
    table: string,
    options?: { select?: string; orderBy?: string; ascending?: boolean }
  ): Promise<SupabaseResponse<T>> {
    let query = this.supabase
      .from(table)
      .select(options?.select ?? '*')

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? true })
    }

    const { data, error } = await query
    return this.toSupabaseResponse<T>(data, error)
  }

  private async insertRows<T>(table: string, payload: unknown): Promise<SupabaseResponse<T>> {
    const { data, error } = await this.supabase
      .from(table)
      .insert(payload)
      .select()

    return this.toSupabaseResponse<T>(data, error)
  }

  private async upsertRows<T>(table: string, payload: unknown, onConflict: string): Promise<SupabaseResponse<T>> {
    const { data, error } = await this.supabase
      .from(table)
      .upsert(payload, { onConflict })
      .select()

    return this.toSupabaseResponse<T>(data, error)
  }

  private async updateRowsById<T>(table: string, id: number, payload: unknown): Promise<SupabaseResponse<T>> {
    const { data, error } = await this.supabase
      .from(table)
      .update(payload)
      .eq('id', id)
      .select()

    return this.toSupabaseResponse<T>(data, error)
  }

  private async deleteRowsById<T>(table: string, id: number): Promise<SupabaseResponse<T>> {
    const { data, error } = await this.supabase
      .from(table)
      .delete()
      .eq('id', id)

    return this.toSupabaseResponse<T>(data, error)
  }

  /**
   * Unified write API for Supabase tables.
   *
   * Supported actions:
   * - insert: requires `payload`
   * - upsert: requires `payload` and `onConflict`
   * - update: requires `id` and `payload`
   * - delete: requires `id`
   *
   * Optional options:
   * - select: override selected columns after mutation (default `*` for insert/upsert/update)
   * - single: when true, uses `.single()` and wraps result in a single-item array response
   *
   * Returns `SupabaseResponse<T>` with normalized `error` shape.
   */
  mutateRows<T>(mutation: {
    table: string
    action: 'insert' | 'upsert' | 'update' | 'delete'
    payload?: unknown
    id?: number
    onConflict?: string
    select?: string
    single?: boolean
  }): Promise<SupabaseResponse<T>> {
    const { table, action, payload, id, onConflict, select, single } = mutation

    if (action === 'insert') {
      return this.insertRowsWithOptions<T>(table, payload, { select, single })
    }

    if (action === 'upsert') {
      return this.upsertRowsWithOptions<T>(table, payload, onConflict ?? '', { select, single })
    }

    if (action === 'update') {
      if (typeof id !== 'number') {
        return Promise.resolve({
          data: null,
          error: { message: 'Mutation id is required for update action' },
        })
      }

      return this.updateRowsByIdWithOptions<T>(table, id, payload, { select, single })
    }

    if (typeof id !== 'number') {
      return Promise.resolve({
        data: null,
        error: { message: 'Mutation id is required for delete action' },
      })
    }

    return this.deleteRowsById<T>(table, id)
  }

  private async insertRowsWithOptions<T>(
    table: string,
    payload: unknown,
    options?: { select?: string; single?: boolean }
  ): Promise<SupabaseResponse<T>> {
    const query = this.supabase
      .from(table)
      .insert(payload)
      .select(options?.select ?? '*')

    if (options?.single) {
      const { data, error } = await query.single()
      return this.toSupabaseResponse<T>(data ? [data] : null, error)
    }

    const { data, error } = await query
    return this.toSupabaseResponse<T>(data, error)
  }

  private async upsertRowsWithOptions<T>(
    table: string,
    payload: unknown,
    onConflict: string,
    options?: { select?: string; single?: boolean }
  ): Promise<SupabaseResponse<T>> {
    const query = this.supabase
      .from(table)
      .upsert(payload, { onConflict })
      .select(options?.select ?? '*')

    if (options?.single) {
      const { data, error } = await query.single()
      return this.toSupabaseResponse<T>(data ? [data] : null, error)
    }

    const { data, error } = await query
    return this.toSupabaseResponse<T>(data, error)
  }

  private async updateRowsByIdWithOptions<T>(
    table: string,
    id: number,
    payload: unknown,
    options?: { select?: string; single?: boolean }
  ): Promise<SupabaseResponse<T>> {
    const query = this.supabase
      .from(table)
      .update(payload)
      .eq('id', id)
      .select(options?.select ?? '*')

    if (options?.single) {
      const { data, error } = await query.single()
      return this.toSupabaseResponse<T>(data ? [data] : null, error)
    }

    const { data, error } = await query
    return this.toSupabaseResponse<T>(data, error)
  }

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
      params: this.createCacheBustParams(),
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
      params: this.createCacheBustParams(),
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
      params: this.createCacheBustParams(),
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
    return this.selectRows<Team>('teams')
  }

  async getPredictions(): Promise<SupabaseResponse<Prediction>> {
    return this.selectRows<Prediction>('predictions', {
      orderBy: 'utc_date',
      ascending: false,
    })
  }

  async getPredictionsWithUsers(): Promise<SupabaseResponse<Prediction>> {
    return this.selectRows<Prediction>('predictions', {
      select: this.predictionsWithUsersSelect,
      orderBy: 'utc_date',
      ascending: false,
    })
  }

  async getPredictionBackupEvents(): Promise<SupabaseResponse<PredictionBackupEventRow>> {
    return this.selectRows<PredictionBackupEventRow>('prediction_backup_events', {
      orderBy: 'event_timestamp',
      ascending: true,
    })
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
    return this.selectRows<SupabaseMatch>('matches', {
      orderBy: 'utc_date',
      ascending: true,
    })
  }

  async getUsers(): Promise<SupabaseResponse<User>> {
    return this.selectRows<User>('users')
  }

  private saveLiveMatchesFullArchive(matches: Match[]): void {
    if (!Array.isArray(matches) || matches.length === 0) {
      return
    }

    const storedEntries = this.getFreshLiveMatchesFullArchiveEntries()
    const nextEntries = [...storedEntries, { ts: Date.now(), data: matches }]
      .slice(-this.liveMatchesFullArchiveMaxEntries)

    try {
      localStorage.setItem(this.liveMatchesFullArchiveStorageKey, JSON.stringify(nextEntries))
    } catch {
      // Ignore storage errors (quota/privacy mode) and keep network data path intact.
    }
  }

  private readLatestLiveMatchesFullArchive(): MatchesApiResponse | null {
    const entries = this.getFreshLiveMatchesFullArchiveEntries()
    if (entries.length === 0) {
      return null
    }

    return entries[entries.length - 1]?.data ?? null
  }

  private isArchiveEntryFresh(timestamp: number): boolean {
    return Date.now() - timestamp <= this.liveMatchesFullArchiveTtlMs
  }

  private getFreshLiveMatchesFullArchiveEntries(): { ts: number; data: MatchesApiResponse }[] {
    return this
      .getLiveMatchesFullArchiveEntries()
      .filter((entry) => this.isArchiveEntryFresh(entry.ts))
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
            data: (Array.isArray(safeEntry.data) ? (safeEntry.data as Match[]) : []) as MatchesApiResponse,
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