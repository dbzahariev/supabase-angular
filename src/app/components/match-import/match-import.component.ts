import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchImportService } from '../../services/match-import.service';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-match-import',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, ProgressBarModule, MessageModule],
  templateUrl: './match-import.component.html',
  styleUrls: ['./match-import.component.css']
})
export class MatchImportComponent {
  importing = false;
  importResults: any[] = [];
  stats: any = null;

  backups: any[] = [];

  constructor(private importService: MatchImportService) {
    // Ще заредим данните динамично
    this.loadBackupFiles();
  }

  async loadBackupFiles() {
    try {
      // Динамично зареждане на JSON файловете
      const [backup2016, backup2018, backup2020, backup2022, backup2024] = await Promise.all([
        import('../../../../backup_2016.json'),
        import('../../../../backup_2018.json'),
        import('../../../../backup_2020.json'),
        import('../../../../backup_2022.json'),
        import('../../../../backup_2024.json')
      ]);

      this.backups = [
        { year: '2016', data: backup2016.default || backup2016 },
        { year: '2018', data: backup2018.default || backup2018 },
        { year: '2020', data: backup2020.default || backup2020 },
        { year: '2022', data: backup2022.default || backup2022 },
        { year: '2024', data: backup2024.default || backup2024 }
      ];
    } catch (error) {
      console.error('Грешка при зареждане на backup файлове:', error);
    }
  }

  async importAll() {
    this.importing = true;
    this.importResults = [];

    try {
      const results = await this.importService.importAllBackups(this.backups);
      this.importResults = results;
      await this.loadStats();
    } catch (error) {
      console.error('Грешка при импортиране:', error);
    } finally {
      this.importing = false;
    }
  }

  async importYear(year: string) {
    this.importing = true;
    
    const backup = this.backups.find(b => b.year === year);
    
    if (backup) {
      const result = await this.importService.importMatchesFromBackup(backup.data);
      this.importResults = [{ year, ...result }];
      await this.loadStats();
    }
    
    this.importing = false;
  }

  async clearAll() {
    if (confirm('Сигурни ли сте, че искате да изтриете всички мачове?')) {
      this.importing = true;
      await this.importService.clearAllMatches();
      this.importResults = [];
      this.stats = null;
      this.importing = false;
      await this.loadStats();
    }
  }

  async loadStats() {
    this.stats = await this.importService.getImportStats();
  }

  ngOnInit() {
    this.loadStats();
  }
}
