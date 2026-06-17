import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, NgZone, OnDestroy, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { catchError, finalize, of, Subscription, timeout } from 'rxjs';
import { Match } from '../all-predictions/all-predictions.models';
import { SupabaseService } from '../supabase';

@Component({
  selector: 'app-live-monitor',
  imports: [CommonModule, TranslateModule, ButtonModule],
  templateUrl: './live-monitor.component.html',
  styleUrls: ['./live-monitor.component.css']
})
export class LiveMonitorComponent implements OnDestroy, AfterViewInit {
  private static readonly DEFAULT_REFRESH_MS = 15000;
  private static readonly RATE_LIMIT_REFRESH_MS = 60000;

  private readonly supabaseService = inject(SupabaseService);
  private readonly translateService = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  liveMatches: Match[] = [];
  lastRefreshAt: Date | null = null;
  nextRefreshInSec: number | null = null;
  loading = false;
  errorMessage = '';
  autoRefresh = true;
  private refreshIntervalMs = LiveMonitorComponent.DEFAULT_REFRESH_MS;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private nextRefreshAtTs: number | null = null;
  private liveMatchesSubscription: Subscription | null = null;
  private viewInitialized = false;

  constructor() {
    this.loadLiveMatches();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    this.liveMatchesSubscription?.unsubscribe();
    this.liveMatchesSubscription = null;
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
  }

  loadLiveMatches(): void {
    this.liveMatchesSubscription?.unsubscribe();

    this.loading = true;
    this.errorMessage = '';
    if (this.viewInitialized) {
      this.cdr.detectChanges();
    }

    this.liveMatchesSubscription = this.supabaseService
      .getLiveMatchesFromBE()
      .pipe(
        timeout(15000),
        catchError((error) => {
          if (error?.status === 429) {
            const translatedMessage = this.translateService.instant('LIVE_MONITOR.RATE_LIMITED');
            this.errorMessage = translatedMessage && translatedMessage !== 'LIVE_MONITOR.RATE_LIMITED'
              ? translatedMessage
              : 'Live refresh is rate-limited. Retrying automatically in 60s.';
            this.setRefreshInterval(LiveMonitorComponent.RATE_LIMIT_REFRESH_MS);
            return of([] as Match[]);
          }

          const backendMessage = error?.error?.error;
          this.errorMessage = typeof backendMessage === 'string' && backendMessage.length > 0
            ? backendMessage
            : 'Failed to load live matches.';
          return of([] as Match[]);
        }),
        finalize(() => {
          this.loading = false;
          if (this.viewInitialized) {
            this.cdr.detectChanges();
          }
        })
      )
      .subscribe((matches) => {
        const normalizedMatches = Array.isArray(matches)
          ? matches
              .filter((match): match is Match => Boolean(match && typeof match === 'object'))
              .map((match) => ({
                ...match,
                homeTeam: match.homeTeam ?? { id: 0, name: '-' },
                awayTeam: match.awayTeam ?? { id: 0, name: '-' },
              }))
          : [];

        this.ngZone.run(() => {
          this.setRefreshInterval(LiveMonitorComponent.DEFAULT_REFRESH_MS);
          this.liveMatches = [...normalizedMatches].sort((a, b) => (a.utcDate || '').localeCompare(b.utcDate || ''));
          this.lastRefreshAt = new Date();
        });
      });
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.startAutoRefresh();
      this.loadLiveMatches();
      return;
    }

    this.stopAutoRefresh();
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

  scoreLabel(match: Match): string {
    const home = match.score?.fullTime?.home;
    const away = match.score?.fullTime?.away;
    return `${home ?? '-'} : ${away ?? '-'}`;
  }

  formatTime(dateValue: Date | null): string {
    if (!dateValue) {
      return '-';
    }

    return dateValue.toLocaleTimeString();
  }

  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      return;
    }

    this.nextRefreshAtTs = Date.now() + this.refreshIntervalMs;
    this.updateNextRefreshCountdown();
    this.startCountdownTimer();

    this.refreshTimer = setInterval(() => {
      this.ngZone.run(() => {
        this.nextRefreshAtTs = Date.now() + this.refreshIntervalMs;
        this.updateNextRefreshCountdown();
        this.loadLiveMatches();
      });
    }, this.refreshIntervalMs);
  }

  private stopAutoRefresh(): void {
    if (!this.refreshTimer) {
      return;
    }

    clearInterval(this.refreshTimer);
    this.refreshTimer = null;

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.nextRefreshAtTs = null;
    this.nextRefreshInSec = null;
  }

  private setRefreshInterval(nextIntervalMs: number): void {
    if (this.refreshIntervalMs === nextIntervalMs) {
      return;
    }

    this.refreshIntervalMs = nextIntervalMs;
    if (this.autoRefresh) {
      this.stopAutoRefresh();
      this.startAutoRefresh();
    }
  }

  private startCountdownTimer(): void {
    if (this.countdownTimer) {
      return;
    }

    this.countdownTimer = setInterval(() => {
      this.ngZone.run(() => {
        this.updateNextRefreshCountdown();
      });
    }, 1000);
  }

  private updateNextRefreshCountdown(): void {
    if (!this.autoRefresh || !this.nextRefreshAtTs) {
      this.nextRefreshInSec = null;
      if (this.viewInitialized) {
        this.cdr.detectChanges();
      }
      return;
    }

    const remainingMs = this.nextRefreshAtTs - Date.now();
    this.nextRefreshInSec = Math.max(0, Math.ceil(remainingMs / 1000));
    if (this.viewInitialized) {
      this.cdr.detectChanges();
    }
  }
}
