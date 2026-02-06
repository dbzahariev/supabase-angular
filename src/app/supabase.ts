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
import { Match, Prediction, PredictionWithUser } from './models/match.model'

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

  // Метод за четене на predictions с името на потребителя (от view)
  getPredictionsWithUsers() {
    return this.supabase
      .from('predictions_with_users')
      .select('*')
      .order('utc_date', { ascending: false })
  }

  // Метод за четене на predictions с името на потребителя за конкретен мач
  getPredictionsByMatchId(matchId: number) {
    return this.supabase
      .from('predictions_with_users')
      .select('*')
      .eq('match_id', matchId)
      .order('name_bg', { ascending: true })
  }

  getSupaMatchesByYear(year: 2016 | 2018 | 2020 | 2022 | 2024) {
    return this.supabase
      .from('matches')
      .select('*')
      .gt('id', `${year}00`)
      .lt('id', `${year}99`)
  }

  // Метод за четене на predictions на конкретен потребител
  getPredictionsByUserId(userId: number) {
    return this.supabase
      .from('predictions_with_users')
      .select('*')
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

  // Метод за слушане на промени в таблица
  subscribeToTable(table: string, callback: (payload: any) => void) {
    const channel = this.supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        (payload) => {
          console.log('🔔 Change received!', payload)
          callback(payload)
        }
      )
      .subscribe()

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

  // Получаване на мач по ID
  getMatchById(id: number) {
    return this.supabase
      .from('matches')
      .select('*')
      .eq('id', id)
      .single()
  }

  // Получаване на мачове по група
  getMatchesByGroup(group: string) {
    return this.supabase
      .from('matches')
      .select('*')
      .eq('group_name', group)
      .order('utc_date', { ascending: true })
  }

  // Добавяне на нов мач
  addMatch(match: Match) {
    const matchData = {
      id: match.id,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      utc_date: match.utcDate,
      group_name: match.group,
      home_ft: match.score.homeFT,
      away_ft: match.score.awayFT,
      home_pt: match.score.homePT,
      away_pt: match.score.awayPT,
      winner: match.score.winner
    }

    return this.supabase
      .from('matches')
      .insert(matchData)
      .select()
  }

  // Добавяне на множество мачове наведнъж
  addMatches(matches: Match[]) {
    const matchesData = matches.map(match => ({
      id: match.id,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      utc_date: match.utcDate,
      group_name: match.group,
      home_ft: match.score.homeFT,
      away_ft: match.score.awayFT,
      home_pt: match.score.homePT,
      away_pt: match.score.awayPT,
      winner: match.score.winner
    }))

    return this.supabase
      .from('matches')
      .insert(matchesData)
      .select()
  }

  // Актуализиране на мач
  updateMatch(id: number, match: Partial<Match>) {
    const updateData: any = {}

    if (match.homeTeam) updateData.home_team = match.homeTeam
    if (match.awayTeam) updateData.away_team = match.awayTeam
    if (match.utcDate) updateData.utc_date = match.utcDate
    if (match.group) updateData.group_name = match.group
    if (match.score) {
      if (match.score.homeFT !== undefined) updateData.home_ft = match.score.homeFT
      if (match.score.awayFT !== undefined) updateData.away_ft = match.score.awayFT
      if (match.score.homePT !== undefined) updateData.home_pt = match.score.homePT
      if (match.score.awayPT !== undefined) updateData.away_pt = match.score.awayPT
      if (match.score.winner) updateData.winner = match.score.winner
    }

    return this.supabase
      .from('matches')
      .update(updateData)
      .eq('id', id)
      .select()
  }

  // Изтриване на мач
  deleteMatch(id: number) {
    return this.supabase
      .from('matches')
      .delete()
      .eq('id', id)
  }
}