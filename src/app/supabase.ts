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

  getAllTeams(): Promise<SupabaseResponse<Team>> {
    return this.supabase
      .from('teams')
      .select('*') as Promise<SupabaseResponse<Team>>
  }

  getPredictions(): Promise<SupabaseResponse<Prediction>> {
    return this.supabase
      .from('predictions')
      .select('*')
      .order('utc_date', { ascending: false }) as Promise<SupabaseResponse<Prediction>>
  }

  getPredictionsWithUsers(): Promise<SupabaseResponse<Prediction>> {
    return this.supabase
      .from('predictions')
      .select(this.predictionsWithUsersSelect)
      .order('utc_date', { ascending: false }) as Promise<SupabaseResponse<Prediction>>
  }

  addPrediction(prediction: PredictionWritePayload | PredictionWritePayload[]): Promise<SupabaseResponse<Prediction>> {
    return this.supabase
      .from('predictions')
      .insert(prediction)
      .select() as Promise<SupabaseResponse<Prediction>>
  }

  updatePrediction(id: number, prediction: PredictionWritePayload): Promise<SupabaseResponse<Prediction>> {
    return this.supabase
      .from('predictions')
      .update(prediction)
      .eq('id', id)
      .select() as Promise<SupabaseResponse<Prediction>>
  }

  deletePrediction(id: number): Promise<SupabaseResponse<Prediction>> {
    return this.supabase
      .from('predictions')
      .delete()
      .eq('id', id) as Promise<SupabaseResponse<Prediction>>
  }

  addPredictionBackupEvent(backupEvent: PredictionBackupEventInsert): Promise<SupabaseResponse<PredictionBackupEventRow>> {
    return this.supabase
      .from('prediction_backup_events')
      .insert(backupEvent)
      .select('id')
      .single() as Promise<SupabaseResponse<PredictionBackupEventRow>>
  }

  getPredictionBackupEvents(): Promise<SupabaseResponse<PredictionBackupEventRow>> {
    return this.supabase
      .from('prediction_backup_events')
      .select('*')
      .order('event_timestamp', { ascending: true }) as Promise<SupabaseResponse<PredictionBackupEventRow>>
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

  getMatches(): Promise<SupabaseResponse<SupabaseMatch>> {
    return this.supabase
      .from('matches')
      .select('*')
      .order('utc_date', { ascending: true }) as Promise<SupabaseResponse<SupabaseMatch>>
  }

  getUsers(): Promise<SupabaseResponse<User>> {
    return this.supabase
      .from('users')
      .select('*') as Promise<SupabaseResponse<User>>
  }

  deleteMatch(id: number): Promise<SupabaseResponse<SupabaseMatch>> {
    return this.supabase
      .from('matches')
      .delete()
      .eq('id', id) as Promise<SupabaseResponse<SupabaseMatch>>
  }
}