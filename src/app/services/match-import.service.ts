import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase';

export interface BackupUser {
  id?: number;
  name_bg?: string;
  name_en?: string;
}

export interface BackupData {
  matches: BackupMatch[];
  users: BackupUser[];
}

export interface BackupMatch {
  id: number;
  homeTeam: string;
  awayTeam: string;
  utcDate: string;
  group: string;
  score?: {
    homeFT?: number;
    awayFT?: number;
    homePT?: number;
    awayPT?: number;
    winner?: string;
  };
}

export interface ImportMatchResult {
  success: boolean;
  count: number;
  errors: Array<Error | { message?: string; details?: string; code?: string }>;
}

interface ImportStats {
  total: number;
  byGroup: Record<string, number>;
  byYear: Record<number, number>;
}

@Injectable({
  providedIn: 'root'
})
export class MatchImportService {
  private readonly supabase = inject(SupabaseService);
  private teamsMap = new Map<string, number>();

  /**
   * Зарежда отборите от базата данни и създава map от име към ID
   */
  private async loadTeamsMap(): Promise<void> {
    console.log('📋 Зареждане на отбори от базата данни...');

    const { data: teams, error } = await this.supabase.client
      .from('teams')
      .select('id, name_en');

    if (error) {
      console.error('❌ Грешка при зареждане на отбори:', error);
      throw new Error('Не могат да се заредят отборите. Моля първо импортирайте отборите.');
    }

    if (!teams || teams.length === 0) {
      throw new Error('Няма налични отбори в базата. Моля първо импортирайте отборите.');
    }

    this.teamsMap.clear();
    teams.forEach((team) => {
      this.teamsMap.set(team.name_en, team.id);
    });

    console.log(`✅ Заредени ${this.teamsMap.size} отбора`);
  }

  /**
   * Получава ID на отбор по име
   */
  private getTeamId(teamName: string): number {
    const teamId = this.teamsMap.get(teamName);
    if (!teamId) {
      throw new Error(`Отбор "${teamName}" не е намерен в базата данни!`);
    }
    return teamId;
  }

  /**
   * Импортира мачове от backup JSON файл
   */
  async importMatchesFromBackup(backupData: BackupData): Promise<ImportMatchResult> {
    try {
      // Първо зареждаме отборите
      await this.loadTeamsMap();

      // Преобразуваме мачовете използвайки team ID-та вместо имена
      const matchesData = backupData.matches.map((match: BackupMatch) => {
        const result = {
          id: match.id,
          home_team_id: this.getTeamId(match.homeTeam),
          away_team_id: this.getTeamId(match.awayTeam),
          utc_date: match.utcDate,
          group_name: match.group,
          home_ft: match.score?.homeFT,
          away_ft: match.score?.awayFT,
          home_pt: match.score?.homePT,
          away_pt: match.score?.awayPT,
          winner: match.score?.winner,
        };
        return result;
      });

      console.log(`🔄 Импортиране на ${matchesData.length} мача...`);
      console.log('Примерен мач от JSON:', backupData.matches[0]);
      console.log('Примерен мач преобразуван:', matchesData[0]);

      const { data, error } = await this.supabase.client
        .from('matches')
        .insert(matchesData)
        .select();

      if (error) {
        console.error('❌ Грешка при импортиране:', error);
        return { success: false, count: 0, errors: [error] };
      }

      console.log(`✅ Успешно импортирани ${data?.length || 0} мача`);
      return { success: true, count: data?.length || 0, errors: [] };
    } catch (err) {
      console.error('❌ Неочаквана грешка:', err);
      return { success: false, count: 0, errors: [err] };
    }
  }

  /**
   * Импортира мачове от всички backup файлове
   */
  async importAllBackups(backups: { year: string; data: BackupData }[]): Promise<({ year: string } & ImportMatchResult)[]> {
    const results: ({ year: string } & ImportMatchResult)[] = [];

    for (const backup of backups) {
      console.log(`\n📅 Импортиране на мачове от ${backup.year}...`);
      const result = await this.importMatchesFromBackup(backup.data);
      results.push({ year: backup.year, ...result });

      // Малка пауза между импортите
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  /**
   * Изтрива всички мачове (внимавайте!)
   */
  async clearAllMatches(): Promise<void> {
    const { data: matches } = await this.supabase.getMatches();

    if (matches && matches.length > 0) {
      console.log(`🗑️ Изтриване на ${matches.length} мача...`);

      for (const match of matches) {
        await this.supabase.deleteMatch(match.id);
      }

      console.log('✅ Всички мачове са изтрити');
    }
  }

  /**
   * Получава статистика за импортираните мачове
   */
  async getImportStats(): Promise<ImportStats> {
    const { data: matches } = await this.supabase.getMatches();

    if (!matches || matches.length === 0) {
      return { total: 0, byGroup: {}, byYear: {} };
    }

    const byGroup: Record<string, number> = {};
    const byYear: Record<number, number> = {};

    for (const match of matches) {
      // По група
      if (!byGroup[match.group_name]) {
        byGroup[match.group_name] = 0;
      }
      byGroup[match.group_name]++;

      // По година (от ID-то)
      const year = Math.floor(match.id / 100);
      if (!byYear[year]) {
        byYear[year] = 0;
      }
      byYear[year]++;
    }

    return {
      total: matches.length,
      byGroup,
      byYear
    };
  }
}
