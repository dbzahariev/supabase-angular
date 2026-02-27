import { Injectable } from '@angular/core'
import {
  AuthChangeEvent,
  AuthSession,
  createClient,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js'
import { environment } from '../../environments/environment'
import { PredictionWithUser } from './models/match.model'

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
      group_name,
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

  // get session() {
  //   this.supabase.auth.getSession().then(({ data }) => {
  //     this._session = data.session
  //   })
  //   return this._session
  // }

  profile(user: User) {
    // return this.supabase
    //   .from('profiles')
    //   .select(`username, website, avatar_url`)
    //   .eq('id', user.id)
    //   .single()
  }

  authChanges(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    // return this.supabase.auth.onAuthStateChange(callback)
  }

  signIn(email: string) {
    return this.supabase.auth.signInWithOtp({ email })
  }

  signOut() {
    // return this.supabase.auth.signOut()
  }

  updateProfile(profile: Profile) {
    const update = {
      ...profile,
      updated_at: new Date(),
    }

    // return this.supabase.from('profiles').upsert(update)
  }

  downLoadImage(path: string) {
    // return this.supabase.storage.from('avatars').download(path)
  }

  uploadAvatar(filePath: string, file: File) {
    // return this.supabase.storage.from('avatars').upload(filePath, file)
  }

  getAllTeams() {
    return this.supabase
      .from('teams')
      .select('*')
  }

  // Метод за четене на predictions
  getPredictions() {
    return this.supabase
      .from('predictions')
      .select('*')
      .order('utc_date', { ascending: false })
  }

  // Метод за четене на predictions с името на потребителя (join към users)
  getPredictionsWithUsers() {
    return this.supabase
      .from('predictions')
      .select(this.predictionsWithUsersSelect)
      .order('utc_date', { ascending: false })
  }

  // Метод за четене на predictions с името на потребителя за конкретен мач
  // getPredictionsByMatchId(matchId: number) {
  //   return this.supabase
  //     .from('predictions')
  //     .select(this.predictionsWithUsersSelect)
  //     .eq('match_id', matchId)
  //     .order('utc_date', { ascending: true }) as unknown as { data: PredictionWithUser[], error: any }
  // }

  // getSupaMatchesByYear(year: 2016 | 2018 | 2020 | 2022 | 2024) {
  //   return this.supabase
  //     .from('matches')
  //     .select('*')
  //     .gt('id', `${year}00`)
  //     .lt('id', `${year}99`)
  // }

  // Метод за четене на predictions на конкретен потребител
  getPredictionsByUserId(userId: number) {
    return this.supabase
      .from('predictions')
      .select(this.predictionsWithUsersSelect)
      .eq('user_id', userId)
      .order('utc_date', { ascending: false })
  }

  // Метод за добавяне на prediction
  addPrediction(prediction: any) {
    return this.supabase
      .from('predictions')
      .insert(prediction)
      .select()
  }

  updatePrediction(id: number, prediction: any) {
    return this.supabase
      .from('predictions')
      .update(prediction)
      .eq('id', id)
      .select()
  }

  // Метод за слушане на промени в таблица
  /**
   * Subscribes to real-time changes on a specified database table.
   * @param table - The name of the table to monitor for changes.
   * @param callback - A callback function that is invoked when changes occur on the table.
   * @returns The Supabase channel object that manages the subscription.
   * @example
   * subscribeToTable('users', (payload) => {
   *   console.log('Users table changed:', payload);
   * });
   */
  subscribeToTable(table: string, callback: (payload: any) => void) {
    const channel = this.supabase
      .channel(`schema-db-changes:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          callback(payload)
        }
      )

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        channel.unsubscribe()
      }
    })

    return channel
  }

  // Методи за работа с matches таблицата

  // Получаване на всички мачове
  getMatches() {
    return this.supabase
      .from('matches')
      .select('*')
      .order('utc_date', { ascending: true })
  }

  getUsers() {
    return this.supabase
      .from('users')
      .select('*')
  }

  // Получаване на мач по ID
  // getMatchById(id: number) {
  //   return this.supabase
  //     .from('matches')
  //     .select('*')
  //     .eq('id', id)
  //     .single()
  // }

  // Получаване на мачове по група
  // getMatchesByGroup(group: string) {
  //   return this.supabase
  //     .from('matches')
  //     .select('*')
  //     .eq('group_name', group)
  //     .order('utc_date', { ascending: true })
  // }

  // Изтриване на мач
  deleteMatch(id: number) {
    return this.supabase
      .from('matches')
      .delete()
      .eq('id', id)
  }
}