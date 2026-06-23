import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { catchError, finalize, of, timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { SupabaseService } from '../supabase';
import { Team } from '../all-predictions/all-predictions.models';
import { ThemeService } from '../services/theme.service';

interface StandingTeam {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}

interface StandingRow {
  position: number;
  team: StandingTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface StandingGroup {
  stage?: string;
  type?: string;
  group?: string;
  table?: StandingRow[];
}

interface CompetitionStandingsResponse {
  competition?: {
    name?: string;
    code?: string;
  };
  season?: {
    id?: number;
  };
  lastUpdated?: string;
  standings?: StandingGroup[];
}

@Component({
  selector: 'app-group-standings',
  imports: [CommonModule, FormsModule, TranslateModule, ButtonModule],
  templateUrl: './group-standings.component.html',
  styleUrls: ['./group-standings.component.css']
})
export class GroupStandingsComponent implements OnInit {
  loading = false;
  errorMessage = '';
  groupedStandings: { group: string; rows: StandingRow[] }[] = [];
  lastUpdated = '';
  allTeams: Team[] = [];
  themeColor = 'green';

  private translate = inject(TranslateService);
  private readonly themeService = inject(ThemeService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.themeColor = this.themeService.getThemeColor();
    this.themeService.themeColor$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((color) => {
        this.themeColor = color;
        this.cdr.markForCheck();
      });

    this.fixTeams();
    this.loadStandings();
  }

  fixTeams(): void {
    this.supabaseService.getAllTeams().then((response) => {
      this.allTeams = response.data || [];
      this.cdr.markForCheck();
    })
  }

  loadStandings(): void {
    this.loading = true;
    this.errorMessage = '';

    this.supabaseService
      .getCompetitionStandingsFromBE()
      .pipe(
        timeout(30000),
        catchError((error) => {
          if (error?.name === 'TimeoutError') {
            this.errorMessage = 'Заявката изтече. Опитай отново след малко.';
          } else if (error?.status === 0) {
            this.errorMessage = 'Няма връзка към сървъра. Провери интернет и опитай отново.';
          } else {
            this.errorMessage = error?.error?.error || 'Неуспешно зареждане на класирането.';
          }

          return of(null);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((response) => {
        if (!response) {
          return;
        }

        const data = response as CompetitionStandingsResponse;
        const standings = Array.isArray(data.standings) ? data.standings : [];

        this.groupedStandings = standings
          .filter((standing) => (standing.group ?? '').length > 0)
          .map((standing) => ({
            group: standing.group ?? '',
            rows: standing.table ?? [],
          }))
          .sort((left, right) => left.group.localeCompare(right.group));

        this.lastUpdated = data.lastUpdated ?? '';
      });
  }

  getDisplayTeamName(team: StandingTeam): string {
    const isLngBg = this.getLng() === 'bg-BG';
    const matchedTeam = this.allTeams.find((item: Team) => item.id === team.id || item.name_en === team.name);

    if (!matchedTeam) {
      return team.name;
    }

    return isLngBg ? matchedTeam.name_bg : matchedTeam.name_en;
  }

  getLng(): 'bg-BG' | 'en-US' {
    const lang = this.translate.currentLang || localStorage.getItem('lang') || 'bg';
    return lang === 'bg' ? 'bg-BG' : 'en-US';
  }

  getGroupName(group: string): string {
    return 'TABLE.GROUP_' + group.split(' ')[1];
  }

  formatDate(dateValue: string): string {
    if (!dateValue) {
      return '-';
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString();
  }

  isGuaranteedQualified(rows: StandingRow[], row: StandingRow): boolean {
    const totalMatchesPerTeam = this.getTotalMatchesPerTeam(rows);
    const contendersCount = rows.filter((item) => this.getMaxPossiblePoints(item, totalMatchesPerTeam) >= row.points).length;
    return contendersCount <= 2;
  }

  isNearlyQualified(rows: StandingRow[], row: StandingRow): boolean {
    if (row.position > 2 || this.isGuaranteedQualified(rows, row)) {
      return false;
    }

    const totalMatchesPerTeam = this.getTotalMatchesPerTeam(rows);
    const contendersCount = rows.filter((item) => this.getMaxPossiblePoints(item, totalMatchesPerTeam) >= row.points).length;

    if (contendersCount > 3) {
      return false;
    }

    const thirdPlace = [...rows]
      .sort((left, right) => left.position - right.position)
      .find((item) => item.position === 3);

    if (!thirdPlace) {
      return false;
    }

    const pointsGap = row.points - thirdPlace.points;
    const goalDiffGap = row.goalDifference - thirdPlace.goalDifference;

    return pointsGap >= 3 || (pointsGap >= 2 && goalDiffGap >= 4);
  }

  getNearQualificationTooltip(rows: StandingRow[], row: StandingRow): string {
    if (!this.isNearlyQualified(rows, row)) {
      return '';
    }

    const thirdPlace = [...rows]
      .sort((left, right) => left.position - right.position)
      .find((item) => item.position === 3);

    if (!thirdPlace) {
      return '';
    }

    const pointsGap = row.points - thirdPlace.points;
    const goalDiffGap = row.goalDifference - thirdPlace.goalDifference;
    const isBg = this.getLng() === 'bg-BG';

    if (isBg) {
      return `Почти сигурен: +${pointsGap} т. и +${goalDiffGap} голова разлика спрямо 3-тия (${this.getDisplayTeamName(thirdPlace.team)}), но все още не е математически гарантиран.`;
    }

    return `Nearly qualified: +${pointsGap} pts and +${goalDiffGap} goal-difference vs 3rd place (${this.getDisplayTeamName(thirdPlace.team)}), but not mathematically guaranteed yet.`;
  }

  private getTotalMatchesPerTeam(rows: StandingRow[]): number {
    const inferredRoundRobinMatches = Math.max(rows.length - 1, 0);
    const maxPlayed = rows.reduce((max, row) => Math.max(max, row.playedGames), 0);
    return Math.max(inferredRoundRobinMatches, maxPlayed);
  }

  private getMaxPossiblePoints(row: StandingRow, totalMatchesPerTeam: number): number {
    const remaining = Math.max(totalMatchesPerTeam - row.playedGames, 0);
    return row.points + remaining * 3;
  }
}