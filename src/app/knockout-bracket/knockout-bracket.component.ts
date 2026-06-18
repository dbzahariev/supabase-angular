import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, of, timeout } from 'rxjs';
import { SupabaseService } from '../supabase';
import { Match } from '../all-predictions/all-predictions.models';
import { ThemeService } from '../services/theme.service';

interface KnockoutMatchView {
  id: number;
  stage: string;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeTeamCrest: string | null;
  awayTeamCrest: string | null;
  homeScore: string;
  awayScore: string;
  dateLabel: string;
  timeLabel: string;
  utcDate: string;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED';
  statusLabel: string;
}

interface StageColumn {
  stage: string;
  left: KnockoutMatchView[];
  right: KnockoutMatchView[];
}

@Component({
  selector: 'app-knockout-bracket',
  imports: [CommonModule, TranslateModule],
  templateUrl: './knockout-bracket.component.html',
  styleUrls: ['./knockout-bracket.component.css'],
})
export class KnockoutBracketComponent implements OnInit, OnDestroy {
  private readonly supabaseService = inject(SupabaseService);
  private readonly translateService = inject(TranslateService);
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly stageOrder = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS'];

  loading = true;
  themeColorHex = '#22c55e';
  themeTextColor = '#0f1d38';
  zoomLevel = 1;
  isPanning = false;
  private panPointerId: number | null = null;
  private panStartX = 0;
  private panStartY = 0;
  private panScrollLeft = 0;
  private panScrollTop = 0;
  stageColumns: StageColumn[] = [];
  rightStageColumns: StageColumn[] = [];
  finalMatch: KnockoutMatchView | null = null;
  thirdPlaceMatch: KnockoutMatchView | null = null;
  private loadingFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.syncThemeVariables();
    this.loadKnockoutMatches();
  }

  ngOnDestroy(): void {
    this.clearLoadingFallbackTimer();
  }

  trackByStage(_: number, column: StageColumn): string {
    return column.stage;
  }

  trackByMatch(_: number, match: KnockoutMatchView): number {
    return match.id;
  }

  getGridRow(stage: string, index: number): string {
    const start = this.getGridRowStart(stage, index);
    return `${start} / span 3`;
  }

  getStageRoundLabel(stage: string): string {
    if (stage === 'LAST_32') {
      return '1/16';
    }

    if (stage === 'LAST_16') {
      return '1/8';
    }

    if (stage === 'QUARTER_FINALS') {
      return '1/4';
    }

    if (stage === 'SEMI_FINALS') {
      return '1/2';
    }

    return '';
  }

  zoomIn(): void {
    this.zoomLevel = Math.min(1.45, Number((this.zoomLevel + 0.1).toFixed(2)));
  }

  zoomOut(): void {
    this.zoomLevel = Math.max(0.75, Number((this.zoomLevel - 0.1).toFixed(2)));
  }

  resetZoom(): void {
    this.zoomLevel = 1;
  }

  onPanStart(event: PointerEvent): void {
    if (event.button !== 0 || this.isInteractiveTarget(event.target)) {
      return;
    }

    const container = event.currentTarget as HTMLElement | null;
    if (!container) {
      return;
    }

    this.isPanning = true;
    this.panPointerId = event.pointerId;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panScrollLeft = container.scrollLeft;
    this.panScrollTop = container.scrollTop;
    container.setPointerCapture(event.pointerId);
  }

  onPanMove(event: PointerEvent): void {
    if (!this.isPanning || this.panPointerId !== event.pointerId) {
      return;
    }

    const container = event.currentTarget as HTMLElement | null;
    if (!container) {
      return;
    }

    const deltaX = event.clientX - this.panStartX;
    const deltaY = event.clientY - this.panStartY;

    container.scrollLeft = this.panScrollLeft - deltaX;
    container.scrollTop = this.panScrollTop - deltaY;
  }

  onPanEnd(event: PointerEvent): void {
    if (!this.isPanning || this.panPointerId !== event.pointerId) {
      return;
    }

    const container = event.currentTarget as HTMLElement | null;
    if (container && container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }

    this.isPanning = false;
    this.panPointerId = null;
  }

  private syncThemeVariables(): void {
    this.themeColorHex = this.resolveThemeColor(this.themeService.getThemeColor());
    this.themeTextColor = this.getContrastTextColor(this.themeColorHex);

    this.themeService.themeColor$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((colorCode) => {
        this.themeColorHex = this.resolveThemeColor(colorCode);
        this.themeTextColor = this.getContrastTextColor(this.themeColorHex);
        this.cdr.markForCheck();
      });
  }

  private loadKnockoutMatches(): void {
    this.loading = true;
    this.startLoadingFallbackTimer();

    this.supabaseService
      .getLiveMatchesFullFromBE()
      .pipe(
        timeout({ first: 12000 }),
        catchError(() => of([] as Match[])),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (matches) => {
          try {
            this.buildBracket(matches ?? []);
          } catch {
            this.stageColumns = [];
            this.rightStageColumns = [];
            this.finalMatch = null;
            this.thirdPlaceMatch = null;
          } finally {
            this.loading = false;
            this.clearLoadingFallbackTimer();
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.stageColumns = [];
          this.rightStageColumns = [];
          this.finalMatch = null;
          this.thirdPlaceMatch = null;
          this.loading = false;
          this.clearLoadingFallbackTimer();
          this.cdr.markForCheck();
        },
      });
  }

  private startLoadingFallbackTimer(): void {
    this.clearLoadingFallbackTimer();
    this.loadingFallbackTimer = setTimeout(() => {
      if (!this.loading) {
        return;
      }

      this.stageColumns = [];
      this.rightStageColumns = [];
      this.finalMatch = null;
      this.thirdPlaceMatch = null;
      this.loading = false;
      this.cdr.markForCheck();
    }, 13000);
  }

  private clearLoadingFallbackTimer(): void {
    if (!this.loadingFallbackTimer) {
      return;
    }

    clearTimeout(this.loadingFallbackTimer);
    this.loadingFallbackTimer = null;
  }

  private buildBracket(matches: Match[]): void {
    const knockoutMatches = matches
      .filter((match) => this.isKnockoutStage(match.stage))
      .sort((a, b) => this.sortByUtcDate(a, b));

    this.stageColumns = this.stageOrder
      .map((stage) => {
        const stageMatches = knockoutMatches
          .filter((match) => match.stage === stage)
          .sort((a, b) => this.sortWithinStage(stage, a, b))
          .map((match) => this.toViewModel(match));

        if (stageMatches.length === 0) {
          return null;
        }

        const midpoint = Math.ceil(stageMatches.length / 2);

        return {
          stage,
          left: stageMatches.slice(0, midpoint),
          right: stageMatches.slice(midpoint),
        } as StageColumn;
      })
      .filter((column): column is StageColumn => column !== null);

    this.rightStageColumns = [...this.stageColumns];

    const finals = knockoutMatches
      .filter((match) => match.stage === 'FINAL')
      .map((match) => this.toViewModel(match));

    const thirdPlace = knockoutMatches
      .filter((match) => match.stage === 'THIRD_PLACE')
      .map((match) => this.toViewModel(match));

    this.finalMatch = finals[0] ?? null;
    this.thirdPlaceMatch = thirdPlace[0] ?? null;
  }

  private isKnockoutStage(stage: string | null | undefined): boolean {
    if (!stage) {
      return false;
    }

    return this.stageOrder.includes(stage) || stage === 'FINAL' || stage === 'THIRD_PLACE';
  }

  private sortByUtcDate(a: Match, b: Match): number {
    const aTime = a.utcDate ? Date.parse(a.utcDate) : Number.MAX_SAFE_INTEGER;
    const bTime = b.utcDate ? Date.parse(b.utcDate) : Number.MAX_SAFE_INTEGER;

    if (aTime === bTime) {
      return a.id - b.id;
    }

    return aTime - bTime;
  }

  private sortWithinStage(stage: string, a: Match, b: Match): number {
    if (stage === 'LAST_16') {
      return a.id - b.id;
    }

    return this.sortByUtcDate(a, b);
  }

  private getGridRowStart(stage: string, index: number): number {
    if (stage === 'LAST_32') {
      return index * 4 + 1;
    }

    if (stage === 'LAST_16') {
      return index * 8 + 3;
    }

    if (stage === 'QUARTER_FINALS') {
      return index * 16 + 7;
    }

    if (stage === 'SEMI_FINALS') {
      return 15;
    }

    return index + 1;
  }

  private toViewModel(match: Match): KnockoutMatchView {
    const utcDate = match.utcDate ?? '';
    const dateObj = utcDate ? new Date(utcDate) : null;
    const isBg = this.getLocale() === 'bg-BG';
    const locale = isBg ? 'bg-BG' : 'en-GB';
    const timeZone = isBg ? 'Europe/Sofia' : 'Europe/Brussels';

    const dateLabel = dateObj
      ? dateObj.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone })
      : '--/--';
    const timeLabel = dateObj
      ? dateObj.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone })
      : '--:--';

    const homeScore = match.score?.fullTime?.home;
    const awayScore = match.score?.fullTime?.away;
    const status = this.getMatchStatus(dateObj, homeScore, awayScore, match.status);
    const statusLabel = this.getMatchStatusLabel(status, isBg);

    return {
      id: match.id,
      stage: match.stage,
      homeTeamName: match.homeTeam?.name ?? null,
      awayTeamName: match.awayTeam?.name ?? null,
      homeTeamCrest: match.homeTeam?.crest ?? null,
      awayTeamCrest: match.awayTeam?.crest ?? null,
      homeScore: homeScore !== null && homeScore !== undefined ? String(homeScore) : '-',
      awayScore: awayScore !== null && awayScore !== undefined ? String(awayScore) : '-',
      dateLabel,
      timeLabel,
      utcDate,
      status,
      statusLabel,
    };
  }

  private getMatchStatus(
    dateObj: Date | null,
    homeScore: number | null | undefined,
    awayScore: number | null | undefined,
    apiStatus?: string | null
  ): 'UPCOMING' | 'LIVE' | 'FINISHED' {
    const normalizedStatus = (apiStatus || '').toUpperCase();

    if (normalizedStatus === 'FINISHED' || normalizedStatus === 'FULL_TIME') {
      return 'FINISHED';
    }

    if (normalizedStatus === 'IN_PLAY' || normalizedStatus === 'PAUSED') {
      return 'LIVE';
    }

    if (homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined) {
      return 'FINISHED';
    }

    if (!dateObj) {
      return 'UPCOMING';
    }

    const now = Date.now();
    const kickoff = dateObj.getTime();
    const liveWindowEnd = kickoff + 2 * 60 * 60 * 1000;

    if (now >= kickoff && now <= liveWindowEnd) {
      return 'LIVE';
    }

    return 'UPCOMING';
  }

  private getMatchStatusLabel(status: 'UPCOMING' | 'LIVE' | 'FINISHED', isBg: boolean): string {
    if (isBg) {
      if (status === 'LIVE') {
        return 'На живо';
      }

      if (status === 'FINISHED') {
        return 'Край';
      }

      return 'Предстои';
    }

    if (status === 'LIVE') {
      return 'Live';
    }

    if (status === 'FINISHED') {
      return 'Finished';
    }

    return 'Upcoming';
  }

  private getLocale(): 'bg-BG' | 'en-US' {
    const lang = this.translateService.currentLang || localStorage.getItem('lang') || 'bg';
    return lang === 'bg' ? 'bg-BG' : 'en-US';
  }

  private isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return !!target.closest('button, a, input, textarea, select, [role="button"]');
  }

  private resolveThemeColor(colorCode: string | null | undefined): string {
    const key = (colorCode || '').toLowerCase();
    const map: Record<string, string> = {
      green: '#22c55e',
      red: '#ef4444',
      blue: '#3b82f6',
      yellow: '#eab308',
    };

    if (map[key]) {
      return map[key];
    }

    if (key.startsWith('#')) {
      return key;
    }

    return '#22c55e';
  }

  private getContrastTextColor(colorHex: string): string {
    const normalized = colorHex.replace('#', '');
    if (normalized.length !== 6) {
      return '#0f1d38';
    }

    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    return yiq >= 140 ? '#0f1d38' : '#f8fbff';
  }
}
