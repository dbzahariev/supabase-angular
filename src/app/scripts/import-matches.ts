/**
 * Скрипт за еднократно импортиране на мачове от backup файловете
 * 
 * Използване:
 * 1. Отворете browser console в приложението
 * 2. Копирайте и пуснете кода по-долу
 * 
 * Или използвайте компонента MatchImportComponent за UI импортиране
 */

import { MatchImportService } from '../services/match-import.service';
import { SupabaseService } from '../supabase';

// Импортиране на backup файловете
import backup2016 from '../../../backup_2016.json';
import backup2018 from '../../../backup_2018.json';
import backup2020 from '../../../backup_2020.json';
import backup2022 from '../../../backup_2022.json';
import backup2024 from '../../../backup_2024.json';

export async function importAllMatches(
  supabaseService: SupabaseService,
  importService: MatchImportService
) {
  console.log('🚀 Стартиране на импортиране на мачове...\n');

  const backups = [
    { year: '2016', data: backup2016 },
    { year: '2018', data: backup2018 },
    { year: '2020', data: backup2020 },
    { year: '2022', data: backup2022 },
    { year: '2024', data: backup2024 }
  ];

  const results = await importService.importAllBackups(backups);

  console.log('\n📊 Обобщение:');
  console.table(results);

  const stats = await importService.getImportStats();
  console.log('\n📈 Статистика:');
  console.log('Общо мачове:', stats.total);
  console.log('По години:', stats.byYear);
  console.log('По групи:', stats.byGroup);

  return { results, stats };
}

// Пример за използване само на една година
export async function importSingleYear(
  year: string,
  importService: MatchImportService
) {
  const backupMap: Record<string, typeof backup2016> = {
    '2016': backup2016,
    '2018': backup2018,
    '2020': backup2020,
    '2022': backup2022,
    '2024': backup2024
  };

  const backupData = backupMap[year];
  if (!backupData) {
    console.error(`❌ Няма backup файл за ${year}`);
    return;
  }

  console.log(`🚀 Импортиране на мачове от ${year}...`);
  const result = await importService.importMatchesFromBackup(backupData);
  
  console.log('✅ Резултат:', result);
  return result;
}
