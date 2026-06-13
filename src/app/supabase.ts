import { inject, Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import {
  AuthSession,
  createClient,
  SupabaseClient,
} from '@supabase/supabase-js'
import { environment } from '../../environments/environment'
import { Observable } from 'rxjs'
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
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'implicit'
      },
      realtime: {
        headers: {
          apikey: environment.supabaseKey
        },
        params: {
          apikey: environment.supabaseKey
        }
      }
    })
  }

  get client(): SupabaseClient {
    return this.supabase
  }

  signIn(email: string) {
    return this.supabase.auth.signInWithOtp({ email })
  }

  getAllMatchesFromBE(): Observable<Match[]> {
    return this.httpClient.get<Match[]>('https://simple-node-proxy.onrender.com/api/matches')
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
}