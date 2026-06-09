import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../supabase';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { importTeams, listAllTeams, deleteAllTeams } from '../../scripts/import-teams';

interface TeamRow {
  id: number;
  name_en: string;
  name_bg: string;
}

interface ImportTeamResult {
  success: boolean;
  inserted?: number;
  total?: number;
  error?: unknown;
}

@Component({
  selector: 'app-team-import',
  imports: [CommonModule, ButtonModule, CardModule, ProgressBarModule, MessageModule, TableModule],
  templateUrl: './team-import.component.html',
  styleUrls: ['./team-import.component.css']
})
export class TeamImportComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);
  importing = false;
  teams: TeamRow[] = [];
  importResult: ImportTeamResult | null = null;
  loading = false;
  ngOnInit(): void {
    void this.loadTeams();
  }

  async importAllTeams() {
    this.importing = true;
    this.importResult = null;

    try {
      const result = await importTeams(this.supabaseService);
      this.importResult = result;

      if (result.success) {
        await this.loadTeams();
      }
    } catch (error) {
      console.error('Грешка при импортиране:', error);
      this.importResult = { success: false, error };
    } finally {
      this.importing = false;
    }
  }

  async loadTeams() {
    this.loading = true;

    try {
      const result = await listAllTeams(this.supabaseService);

      if (result.success) {
        this.teams = result.teams || [];
      }
    } catch (error) {
      console.error('Грешка при зареждане на отбори:', error);
    } finally {
      this.loading = false;
    }
  }

  async clearAllTeams() {
    if (confirm('Сигурни ли сте, че искате да изтриете всички отбори?')) {
      this.importing = true;

      try {
        const result = await deleteAllTeams(this.supabaseService);
        if (result.success) {
          this.teams = [];
          this.importResult = null;
        }
      } catch (error) {
        console.error('Грешка при изтриване:', error);
      } finally {
        this.importing = false;
      }
    }
  }
}
