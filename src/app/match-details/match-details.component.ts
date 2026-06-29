import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, NgZone, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { catchError, finalize, of, timeout } from 'rxjs';
import { SupabaseService } from '../supabase';
import { Match } from '../all-predictions/all-predictions.models';

interface MatchDetailPerson {
  id: number | null;
  name: string | null;
}

interface MatchDetailTeamRef {
  id: number | null;
  name: string | null;
}

interface MatchDetailGoal {
  minute: number | null;
  injuryTime: number | null;
  type: string | null;
  team: MatchDetailTeamRef | null;
  scorer: MatchDetailPerson | null;
  assist: MatchDetailPerson | null;
  score?: { home: number | null; away: number | null } | null;
}

interface MatchDetailBooking {
  minute: number | null;
  team: MatchDetailTeamRef | null;
  player: MatchDetailPerson | null;
  card: string | null;
}

interface MatchDetailSubstitution {
  minute: number | null;
  team: MatchDetailTeamRef | null;
  playerOut: MatchDetailPerson | null;
  playerIn: MatchDetailPerson | null;
}

interface MatchDetailReferee {
  id: number | null;
  name: string | null;
  type: string | null;
  nationality: string | null;
}

interface MatchDetailPlayer {
  id: number | null;
  name: string | null;
  position: string | null;
  shirtNumber: number | null;
}

interface MatchDetailCoach {
  id: number | null;
  name: string | null;
  nationality: string | null;
}

interface MatchDetailTeam {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
  coach?: MatchDetailCoach | null;
  lineup?: MatchDetailPlayer[];
  bench?: MatchDetailPlayer[];
  formation?: string | null;
  leagueRank?: number | null;
}

interface MatchDetailsApiResponse {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | null;
  injuryTime?: number | null;
  attendance?: number | null;
  venue?: string | null;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  lastUpdated?: string | null;
  homeTeam?: MatchDetailTeam | null;
  awayTeam?: MatchDetailTeam | null;
  score?: Match['score'] | null;
  goals?: MatchDetailGoal[];
  bookings?: MatchDetailBooking[];
  substitutions?: MatchDetailSubstitution[];
  referees?: MatchDetailReferee[];
  odds?: { homeWin: number | null; draw: number | null; awayWin: number | null } | null;
  competition?: { id: number; name: string; code?: string | null; type?: string | null; emblem?: string | null } | null;
  area?: { id: number; name: string; code?: string | null; flag?: string | null } | null;
  season?: { id: number; startDate?: string | null; endDate?: string | null; currentMatchday?: number | null } | null;
}

@Component({
  selector: 'app-match-details',
  imports: [CommonModule, FormsModule, TranslateModule, ButtonModule, CardModule],
  templateUrl: './match-details.component.html',
  styleUrls: ['./match-details.component.css']
})
export class MatchDetailsComponent implements AfterViewInit, OnDestroy {
  private static readonly CLICK_GUARD_SECONDS = 2;
  private static readonly RATE_LIMIT_GUARD_SECONDS = 30;
  private static readonly ERROR_42_MESSAGE = 'Грешка 42: Моля изчакай преди следващ опит.';
  private static readonly ERROR_42_RATE_LIMIT_MESSAGE = 'Грешка 42: Достигнат е лимит на заявки. Следващ опит след 30 сек.';

  matchId = 537398;
  loading = false;
  errorMessage = '';
  matchDetails: MatchDetailsApiResponse | null = null;
  isLoadDisabled = false;
  loadCooldownSec: number | null = null;
  private viewInitialized = false;
  private loadCooldownTimer: ReturnType<typeof setInterval> | null = null;
  private shouldAutoRetryAfterCooldown = false;

  private readonly route = inject(ActivatedRoute);
  private readonly supabaseService = inject(SupabaseService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const queryId = Number.parseInt(params.get('id') ?? '', 10);
      if (Number.isFinite(queryId) && queryId > 0) {
        this.matchId = queryId;
        this.loadMatch();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
  }

  ngOnDestroy(): void {
    this.clearLoadCooldown();
  }

  loadMatch(): void {
    if (this.loading || this.isLoadDisabled) {
      this.setError(MatchDetailsComponent.ERROR_42_MESSAGE);
      return;
    }

    if (!Number.isFinite(this.matchId) || this.matchId <= 0) {
      this.setError('Invalid match id.');
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.shouldAutoRetryAfterCooldown = false;
    this.setLoadCooldown(MatchDetailsComponent.CLICK_GUARD_SECONDS);
    this.detectIfReady();

    this.supabaseService
      .getMatchDetailsFromBE(this.matchId)
      .pipe(
        timeout(30000),
        catchError((error) => {
          this.ngZone.run(() => this.handleLoadError(error));
          return of(null);
        }),
        finalize(() => {
          this.ngZone.run(() => {
            this.loading = false;
            this.detectIfReady();
          });
        })
      )
      .subscribe((data) => {
        if (!data) {
          return;
        }

        this.ngZone.run(() => {
          this.matchDetails = data as unknown as MatchDetailsApiResponse;
          this.errorMessage = '';
          this.detectIfReady();
        });
      });
  }

  private handleLoadError(error: unknown): void {
    const status = (error as { status?: number } | null)?.status;
    const errorName = (error as { name?: string } | null)?.name;
    const backendMessage = (error as { error?: { error?: unknown } } | null)?.error?.error;

    if (status === 429) {
      this.shouldAutoRetryAfterCooldown = true;
      this.setError(MatchDetailsComponent.ERROR_42_RATE_LIMIT_MESSAGE);
      this.setLoadCooldown(MatchDetailsComponent.RATE_LIMIT_GUARD_SECONDS);
      return;
    }

    if (errorName === 'TimeoutError') {
      this.setError('Заявката изтече. Опитай отново след малко.');
      return;
    }

    if (typeof backendMessage === 'string' && backendMessage.toLowerCase() === 'fetch failed') {
      this.setError('Временен проблем с връзката към източника на данни. Опитай отново след малко.');
      return;
    }

    if (status === 0) {
      this.setError('Няма връзка към сървъра. Провери интернет и опитай отново.');
      return;
    }

    this.setError(typeof backendMessage === 'string' && backendMessage.length > 0
      ? backendMessage
      : 'Failed to load match details.');
  }

  private setError(message: string): void {
    this.errorMessage = message;
    this.matchDetails = null;
    this.detectIfReady();
  }

  private detectIfReady(): void {
    if (this.viewInitialized) {
      this.cdr.detectChanges();
    }
  }

  formatDate(dateValue: string | null | undefined): string {
    if (!dateValue) {
      return '-';
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString();
  }

  scoreLabel(score: { home: number | null; away: number | null } | null | undefined): string {
    if (!score) {
      return '- : -';
    }

    const home = score.home ?? '-';
    const away = score.away ?? '-';
    return `${home} : ${away}`;
  }

  personName(person: MatchDetailPerson | null | undefined): string {
    return person?.name ?? '-';
  }

  teamName(team: MatchDetailTeamRef | null | undefined): string {
    return team?.name ?? '-';
  }

  private setLoadCooldown(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      this.clearLoadCooldown();
      return;
    }

    if (this.loadCooldownTimer) {
      clearInterval(this.loadCooldownTimer);
      this.loadCooldownTimer = null;
    }

    this.isLoadDisabled = true;
    this.loadCooldownSec = seconds;

    this.loadCooldownTimer = setInterval(() => {
      this.ngZone.run(() => {
        if (this.loadCooldownSec === null) {
          this.clearLoadCooldown();
          return;
        }

        this.loadCooldownSec = this.loadCooldownSec - 1;
        if (this.loadCooldownSec <= 0) {
          this.clearLoadCooldown();
          return;
        }

        this.detectIfReady();
      });
    }, 1000);

    this.detectIfReady();
  }

  private clearLoadCooldown(): void {
    if (this.loadCooldownTimer) {
      clearInterval(this.loadCooldownTimer);
      this.loadCooldownTimer = null;
    }

    this.isLoadDisabled = false;
    this.loadCooldownSec = null;

    const shouldAutoRetry = this.shouldAutoRetryAfterCooldown;
    this.shouldAutoRetryAfterCooldown = false;

    this.detectIfReady();

    if (shouldAutoRetry) {
      setTimeout(() => {
        this.ngZone.run(() => {
          this.loadMatch();
        });
      }, 0);
    }
  }
}
