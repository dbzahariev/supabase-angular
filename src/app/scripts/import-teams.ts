/**
 * Скрипт за импортиране на отбори в таблицата teams
 * 
 * Извлича всички уникални имена на отбори от backup файловете
 * и ги вкарва в таблицата teams с английско и българско име
 */

import { SupabaseService } from '../supabase';

// Импортиране на backup файловете
import backup2016 from '../../../backup_2016.json';
import backup2018 from '../../../backup_2018.json';
import backup2020 from '../../../backup_2020.json';
import backup2022 from '../../../backup_2022.json';
import backup2024 from '../../../backup_2024.json';

// Речник за превод на имената на отборите от английски на български
const teamTranslations: Record<string, string> = {
  'Albania': 'Албания',
  'Algeria': 'Алжир',
  'Argentina': 'Аржентина',
  'Australia': 'Австралия',
  'Austria': 'Австрия',
  'Belgium': 'Белгия',
  'Brazil': 'Бразилия',
  'Cameroon': 'Камерун',
  'Canada': 'Канада',
  'Cape Verde Islands': 'Кабо Верде',
  'Chile': 'Чили',
  'Colombia': 'Колумбия',
  'Costa Rica': 'Коста Рика',
  'Croatia': 'Хърватия',
  'Curaçao': 'Кюрасао',
  'Czech Republic': 'Чехия',
  'Czechia': 'Чехия',
  'Denmark': 'Дания',
  'Ecuador': 'Еквадор',
  'Egypt': 'Египет',
  'England': 'Англия',
  'Finland': 'Финландия',
  'France': 'Франция',
  'Georgia': 'Грузия',
  'Germany': 'Германия',
  'Ghana': 'Гана',
  'Greece': 'Гърция',
  'Haiti': 'Хаити',
  'Hungary': 'Унгария',
  'Iceland': 'Исландия',
  'Iran': 'Иран',
  'Ireland': 'Ирландия',
  'Italy': 'Италия',
  'Japan': 'Япония',
  'Jordan': 'Йордания',
  'Mexico': 'Мексико',
  'Morocco': 'Мароко',
  'Netherlands': 'Холандия',
  'New Zealand': 'Нова Зеландия',
  'Nigeria': 'Нигерия',
  'North Macedonia': 'Северна Македония',
  'Northern Ireland': 'Северна Ирландия',
  'Norway': 'Норвегия',
  'Panama': 'Панама',
  'Paraguay': 'Парагвай',
  'Peru': 'Перу',
  'Poland': 'Полша',
  'Portugal': 'Португалия',
  'Qatar': 'Катар',
  'Republic of Ireland': 'Ирландия',
  'Romania': 'Румъния',
  'Russia': 'Русия',
  'Saudi Arabia': 'Саудитска Арабия',
  'Scotland': 'Шотландия',
  'Senegal': 'Сенегал',
  'Serbia': 'Сърбия',
  'Slovakia': 'Словакия',
  'Slovenia': 'Словения',
  'South Africa': 'Южна Африка',
  'South Korea': 'Южна Корея',
  'Spain': 'Испания',
  'Sweden': 'Швеция',
  'Switzerland': 'Швейцария',
  'Tunisia': 'Тунис',
  'Turkey': 'Турция',
  'Ukraine': 'Украйна',
  'United States': 'САЩ',
  'Uruguay': 'Уругвай',
  'Uzbekistan': 'Узбекистан',
  'Wales': 'Уелс',
  "Côte d'Ivoire": "Кот д'Ивоар"
};

interface Team {
  name_en: string;
  name_bg: string;
}

interface BackupMatch {
  homeTeam: string;
  awayTeam: string;
}

interface BackupFile {
  matches: BackupMatch[];
}

export async function importTeams(supabaseService: SupabaseService) {
  console.log('🚀 Стартиране на импортиране на отбори...\n');

  // Събиране на всички отбори от всички backup файлове
  const allBackups: BackupFile[] = [backup2016, backup2018, backup2020, backup2022, backup2024];
  const teamNamesSet = new Set<string>();

  allBackups.forEach(backup => {
    backup.matches.forEach((match) => {
      teamNamesSet.add(match.homeTeam);
      teamNamesSet.add(match.awayTeam);
    });
  });

  Object.keys(teamTranslations).forEach(team => {
    if (!teamNamesSet.has(team)) {
      teamNamesSet.add(team);
    }
  })

  // Създаване на масив с отборите с английско и българско име
  const teams: Team[] = Array.from(teamNamesSet).map(nameEn => ({
    name_en: nameEn,
    name_bg: teamTranslations[nameEn] || nameEn // Ако няма превод, използва се английското име
  }));

  console.log(`📋 Намерени ${teams.length} уникални отбора`);
  console.log('\nОтбори без превод:');
  teams.forEach(team => {
    if (!teamTranslations[team.name_en]) {
      console.log(`  ⚠️  ${team.name_en}`);
    }
  });

  // Проверка дали има вече отбори в таблицата
  const { data: existingTeams, error: checkError } = await supabaseService.client
    .from('teams')
    .select('name_en');

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = table doesn't exist
    console.error('❌ Грешка при проверка на съществуващи отбори:', checkError);
    return { success: false, error: checkError };
  }

  const existingTeamNames = new Set(existingTeams?.map(t => t.name_en) || []);
  const teamsToInsert = teams.filter(t => !existingTeamNames.has(t.name_en));

  if (teamsToInsert.length === 0) {
    console.log('✅ Всички отбори вече са в базата данни');
    return { success: true, inserted: 0, total: teams.length };
  }

  console.log(`\n📥 Импортиране на ${teamsToInsert.length} нови отбора...`);

  // Вкарване на отборите в базата данни
  const { data, error } = await supabaseService.client
    .from('teams')
    .insert(teamsToInsert)
    .select();

  if (error) {
    console.error('❌ Грешка при импортиране:', error);
    return { success: false, error };
  }

  console.log(`\n✅ Успешно импортирани ${data?.length || 0} отбора`);
  console.log('\n📊 Списък на импортираните отбори:');
  console.table(data);

  return {
    success: true,
    inserted: data?.length || 0,
    total: teams.length,
    teams: data
  };
}

// Функция за показване на всички отбори от базата данни
export async function listAllTeams(supabaseService: SupabaseService) {
  const { data, error } = await supabaseService.client
    .from('teams')
    .select('*')
    .order('name_en');

  if (error) {
    console.error('❌ Грешка при извличане на отбори:', error);
    return { success: false, error };
  }

  console.log(`\n📋 Всички отбори (${data?.length || 0}):`);
  console.table(data);

  return { success: true, teams: data };
}

// Функция за изтриване на всички отбори (за тестване)
export async function deleteAllTeams(supabaseService: SupabaseService) {
  console.log('⚠️  Изтриване на всички отбори...');

  const { error } = await supabaseService.client
    .from('teams')
    .delete()
    .neq('id', 0); // Изтрива всички записи

  if (error) {
    console.error('❌ Грешка при изтриване:', error);
    return { success: false, error };
  }

  console.log('✅ Всички отбори са изтрити');
  return { success: true };
}
