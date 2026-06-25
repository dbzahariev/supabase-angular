import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../supabase';
import { Match, Team } from '../all-predictions/all-predictions.models';

interface EditableMatch {
  id: number;
  mId: number;
  side: 'left' | 'right' | 'center';
  round: number;
  order: number;
  dateTime: string;
  homeTeam: string;
  awayTeam: string;
  parentId: number | null;
}

interface PositionedMatch extends EditableMatch {
  x: number;
  y: number;
}

interface RenderNode extends EditableMatch {
  left: number;
  top: number;
}

interface RenderPath {
  key: string;
  d: string;
}

interface GroupLabel {
  key: string;
  left: number;
  top: number;
  round: number;
  sideLabelKey: string;
}

interface GroupToggleItem {
  key: string;
  row1: string;
  row2?: string;
  labelKeys: string[];
}

@Component({
  selector: 'app-eliminations',
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './eliminations.component.html',
  styleUrls: ['./eliminations.component.css']
})
export class EliminationsComponent implements AfterViewInit {
  @ViewChild('zoomViewport', { static: true }) private readonly zoomViewport!: ElementRef<HTMLDivElement>;
  @ViewChild('zoomContent', { static: true }) private readonly zoomContent!: ElementRef<HTMLDivElement>;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly translateService = inject(TranslateService);

  canvasWidth = 1400;
  canvasHeight = 760;
  zoomScale = 1;
  panX = 0;
  panY = 0;
  isPanning = false;
  isPinching = false;
  editableMatches: EditableMatch[] = [];
  nodes: RenderNode[] = [];
  paths: RenderPath[] = [];

  allTeams: Team[] = [];
  allMatches: Match[] = [];

  private panPointerId: number | null = null;
  private panLastX = 0;
  private panLastY = 0;
  private pinchLastDistance: number | null = null;
  private zoomAnimationFrameId: number | null = null;
  private readonly activePointers = new Map<number, { x: number; y: number }>();
  groupLabels: GroupLabel[] = [];
  private readonly collapsedLabelKeys = new Set<string>();
  private readonly collapsedLabelsStorageKey = 'eliminations-collapsed-labels';

  private readonly desktopNodeWidth = 220;
  private readonly desktopNodeHeight = 92;
  private readonly mobileNodeWidth = 200;
  private readonly mobileNodeHeight = 88;
  private readonly mobileBreakpoint = 900;
  private readonly canvasPadding = 90;
  private readonly roundGap = 280;
  private readonly yGap = 160;
  private readonly minScale = 0.35;
  private readonly maxScale = 2.8;
  private readonly zoomStep = 0.03;
  private readonly zoomAnimationDurationMs = 140;
  private readonly desktopDefaultScale = 1.07;
  private readonly desktopFirstMatchLeftPadding = 3;
  private readonly desktopViewportPaddingTop = 90;
  private readonly mobileDefaultScale = 0.91;
  private readonly mobileViewportPaddingLeft = 26;
  private readonly mobileViewportPaddingTop = 118;
  private readonly groupLabelOffsetFromFirstRow = 34;


  private supabaseService = inject(SupabaseService);
  ngAfterViewInit(): void {
    this.syncAvailableHeight();
    this.loadCollapsedGroups();
    this.supabaseService.getAllTeams().then((response) => {
      this.allTeams = response.data || [];
      this.supabaseService.getLiveMatchesFullFromBE().subscribe((data) => {
        this.allMatches = data as Match[]

        this.allMatches.map((dbMatch, index) => {
          let newMatch = dbMatch
          const myId = Number("2026" + (index < 9 ? "0" + (index + 1) : (index + 1).toString()));
          newMatch.myId = myId
          return newMatch
        })
        this.loadDummyMatches();
      });
    })
  }

  trackByEditable(_: number, match: EditableMatch): number {
    return match.id;
  }

  trackByNode(_: number, node: RenderNode): number {
    return node.id;
  }

  trackByPath(_: number, path: RenderPath): string {
    return path.key;
  }

  trackByGroupLabel(_: number, label: GroupLabel): string {
    return label.key;
  }

  onGroupLabelClick(label: GroupLabel): void {
    this.toggleGroupVisibility(this.getLinkedLabelKeys(label.key));
  }

  isGroupLabelCollapsed(label: GroupLabel): boolean {
    return this.collapsedLabelKeys.has(label.key);
  }

  get groupToggleItems(): GroupToggleItem[] {
    const byKey = new Map<string, GroupToggleItem>();

    this.groupLabels.forEach((label) => {
      const side = label.key.split('-')[0] as 'left' | 'right' | 'center';
      const full = this.getLabelFullName(label);
      const groupKey = side === 'center' ? label.key : `round-${label.round}`;

      if (!byKey.has(groupKey)) {
        byKey.set(groupKey, {
          key: groupKey,
          row1: full.row1,
          row2: full.row2,
          labelKeys: [],
        });
      }

      byKey.get(groupKey)?.labelKeys.push(label.key);
    });

    return Array.from(byKey.values()).sort((a, b) => {
      const aRound = Number(a.key.replace('round-', ''));
      const bRound = Number(b.key.replace('round-', ''));
      const aIsRound = Number.isFinite(aRound);
      const bIsRound = Number.isFinite(bRound);

      if (aIsRound && bIsRound) {
        return aRound - bRound;
      }

      if (aIsRound) {
        return -1;
      }

      if (bIsRound) {
        return 1;
      }

      return a.key.localeCompare(b.key);
    });
  }

  onToggleItemClick(item: GroupToggleItem): void {
    this.toggleGroupVisibility(item.labelKeys);
  }

  isToggleItemCollapsed(item: GroupToggleItem): boolean {
    return item.labelKeys.every((key) => this.collapsedLabelKeys.has(key));
  }

  get isAnyGroupCollapsed(): boolean {
    return this.collapsedLabelKeys.size > 0;
  }

  clearCollapsedGroups(): void {
    if (!this.isAnyGroupCollapsed) {
      return;
    }

    this.collapsedLabelKeys.clear();
    this.persistCollapsedGroups();
    this.rebuildBracket();
  }

  addMatch(): void {
    const nextId = this.getNextId();

    this.editableMatches.push({
      id: nextId,
      mId: nextId,
      side: 'left',
      round: 1,
      order: this.getNextOrder('left', 1),
      dateTime: '--.-- - --:--',
      homeTeam: 'РќРѕРІ РѕС‚Р±РѕСЂ A',
      awayTeam: 'РќРѕРІ РѕС‚Р±РѕСЂ B',
      parentId: null,
    });

    this.rebuildBracket();
  }

  removeMatch(matchId: number): void {
    this.editableMatches = this.editableMatches.filter((item) => item.id !== matchId);
    this.editableMatches = this.editableMatches.map((item) => ({
      ...item,
      parentId: item.parentId === matchId ? null : item.parentId,
    }));

    this.rebuildBracket();
  }

  loadDummyMatches(): void {
    this.editableMatches = [
      { id: 101, mId: 74, side: 'left', round: 1, order: 1, dateTime: '06/29/2026 23:30', homeTeam: '1E', awayTeam: '3ABCDF', parentId: 201 },
      { id: 102, mId: 77, side: 'left', round: 1, order: 2, dateTime: '07/01/2026 00:00', homeTeam: '1I', awayTeam: '3CDFGH', parentId: 201 },
      { id: 103, mId: 73, side: 'left', round: 1, order: 3, dateTime: '06/28/2026 22:00', homeTeam: '2A', awayTeam: '2B', parentId: 202 },
      { id: 104, mId: 75, side: 'left', round: 1, order: 4, dateTime: '06/30/2026 04:00', homeTeam: '1F', awayTeam: '2C', parentId: 202 },
      { id: 105, mId: 83, side: 'left', round: 1, order: 5, dateTime: '07/03/2026 02:00', homeTeam: '2K', awayTeam: '2L', parentId: 203 },
      { id: 106, mId: 84, side: 'left', round: 1, order: 6, dateTime: '07/02/2026 22:00', homeTeam: '1H', awayTeam: '2J', parentId: 203 },
      { id: 107, mId: 81, side: 'left', round: 1, order: 7, dateTime: '07/02/2026 03:00', homeTeam: '1D', awayTeam: '3BEFIJ', parentId: 204 },
      { id: 108, mId: 82, side: 'left', round: 1, order: 8, dateTime: '07/01/2026 23:00', homeTeam: '1G', awayTeam: '3AEHIJ', parentId: 204 },

      { id: 201, mId: 89, side: 'left', round: 2, order: 1, dateTime: '07/05/2026 00:00', homeTeam: 'W74', awayTeam: 'W77', parentId: 301 },
      { id: 202, mId: 90, side: 'left', round: 2, order: 2, dateTime: '07/04/2026 20:00', homeTeam: 'W73', awayTeam: 'W75', parentId: 301 },
      { id: 203, mId: 93, side: 'left', round: 2, order: 3, dateTime: '07/06/2026 22:00', homeTeam: 'W83', awayTeam: 'W84', parentId: 302 },
      { id: 204, mId: 94, side: 'left', round: 2, order: 4, dateTime: '07/07/2026 03:00', homeTeam: 'W81', awayTeam: 'W82', parentId: 302 },

      { id: 301, mId: 97, side: 'left', round: 3, order: 1, dateTime: '07/09/2026 23:00', homeTeam: 'W89', awayTeam: 'W90', parentId: 401 },
      { id: 302, mId: 98, side: 'left', round: 3, order: 2, dateTime: '07/10/2026 22:00', homeTeam: 'W93', awayTeam: 'W94', parentId: 401 },

      { id: 401, mId: 101, side: 'left', round: 4, order: 1, dateTime: '07/14/2026 22:00', homeTeam: 'W97', awayTeam: 'W98', parentId: 901 },

      { id: 501, mId: 76, side: 'right', round: 1, order: 1, dateTime: '06/29/2026 20:00', homeTeam: '1C', awayTeam: '2F', parentId: 601 },
      { id: 502, mId: 78, side: 'right', round: 1, order: 2, dateTime: '06/30/2026 20:00', homeTeam: '2E', awayTeam: '2I', parentId: 601 },
      { id: 503, mId: 79, side: 'right', round: 1, order: 3, dateTime: '07/01/2026 04:00', homeTeam: '1A', awayTeam: '3CEFH', parentId: 602 },
      { id: 504, mId: 80, side: 'right', round: 1, order: 4, dateTime: '07/01/2026 19:00', homeTeam: '1L', awayTeam: '3EHIJK', parentId: 602 },
      { id: 505, mId: 86, side: 'right', round: 1, order: 5, dateTime: '07/04/2026 01:00', homeTeam: '1J', awayTeam: '2H', parentId: 603 },
      { id: 506, mId: 88, side: 'right', round: 1, order: 6, dateTime: '07/03/2026 21:00', homeTeam: '2D', awayTeam: '2G', parentId: 603 },
      { id: 507, mId: 85, side: 'right', round: 1, order: 7, dateTime: '07/03/2026 06:00', homeTeam: '1B', awayTeam: '3EFGIJ', parentId: 604 },
      { id: 508, mId: 87, side: 'right', round: 1, order: 8, dateTime: '07/04/2026 04:30', homeTeam: '1K', awayTeam: '3DEIJL', parentId: 604 },

      { id: 601, mId: 91, side: 'right', round: 2, order: 1, dateTime: '07/05/2026 23:00', homeTeam: 'W76', awayTeam: 'W78', parentId: 701 },
      { id: 602, mId: 92, side: 'right', round: 2, order: 2, dateTime: '07/06/2026 03:00', homeTeam: 'W79', awayTeam: 'W80', parentId: 701 },
      { id: 603, mId: 95, side: 'right', round: 2, order: 3, dateTime: '07/07/2026 19:00', homeTeam: 'W86', awayTeam: 'W88', parentId: 702 },
      { id: 604, mId: 96, side: 'right', round: 2, order: 4, dateTime: '07/07/2026 23:00', homeTeam: 'W85', awayTeam: 'W87', parentId: 702 },

      { id: 701, mId: 99, side: 'right', round: 3, order: 1, dateTime: '07/12/2026 00:00', homeTeam: 'W91', awayTeam: 'W92', parentId: 801 },
      { id: 702, mId: 100, side: 'right', round: 3, order: 2, dateTime: '07/12/2026 04:00', homeTeam: 'W95', awayTeam: 'W96', parentId: 801 },

      { id: 801, mId: 102, side: 'right', round: 4, order: 1, dateTime: '07/15/2026 22:00', homeTeam: 'W99', awayTeam: 'W100', parentId: 901 },

      { id: 901, mId: 104, side: 'center', round: 1, order: 1, dateTime: '07/19/2026 22:00', homeTeam: 'W101', awayTeam: 'W102', parentId: null },
      { id: 902, mId: 103, side: 'center', round: 1, order: 2, dateTime: '07/19/2026 00:00', homeTeam: 'RU101', awayTeam: 'RU102', parentId: null },
    ]
      .map(match => {
        let newMatch = { ...match } as EditableMatch

        let matchId = Number("2026" + (newMatch.mId < 9 ? "0" + (newMatch.mId + 1) : (newMatch.mId + 1).toString()));

        let matchFromDb = this.allMatches.find(dbMatch => dbMatch.myId === matchId)
        if (matchFromDb?.homeTeam.name) {
          newMatch.homeTeam = matchFromDb?.homeTeam.name
        }

        if (matchFromDb?.awayTeam.name) {
          newMatch.awayTeam = matchFromDb?.awayTeam.name
        }

        return newMatch
      })
      .map((match) => {
        const newMatch: EditableMatch = { ...match } as EditableMatch;
        newMatch.dateTime = this.formatDateTime(newMatch.dateTime);

        newMatch.homeTeam = this.getTeamName(newMatch).home;
        newMatch.awayTeam = this.getTeamName(newMatch).away;

        return newMatch;
      });


    this.rebuildBracket();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTeamName(match: any): { home: string; away: string } {
    const teamHome = this.allTeams.find((team: Team) => team.name_en === match?.homeTeam)
    const teamAway = this.allTeams.find((team: Team) => team.name_en === match?.awayTeam)

    const isLngBg = (this.translateService.currentLang || localStorage.getItem('lang') || 'bg') === 'bg';
    const teamHomeName = (isLngBg ? teamHome?.name_bg ?? match.homeTeam : teamHome?.name_en) || ''
    const teamAwayName = (isLngBg ? teamAway?.name_bg ?? match.awayTeam : teamAway?.name_en) || ''
    return { home: teamHomeName, away: teamAwayName };
  }

  private formatDateTime(value: string): string {
    if (!value || value.trim().length === 0) {
      return '--.-- - --:--';
    }

    const lang = this.translateService.currentLang || localStorage.getItem('lang') || 'bg';
    const isBg = lang === 'bg';
    const locale = isBg ? 'bg-BG' : 'en-GB';
    const timeZone = isBg ? 'Europe/Sofia' : 'Europe/Brussels';

    const parsed = this.parseDateTime(value);
    if (!parsed) {
      return value;
    }

    const dateLabel = parsed.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      timeZone,
    });
    const timeLabel = parsed.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    });

    return `${dateLabel} - ${timeLabel}`;
  }

  private parseDateTime(value: string): Date | null {
    const trimmed = value.trim();
    const usFormat = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/;
    const usMatch = trimmed.match(usFormat);

    if (usMatch) {
      const month = Number(usMatch[1]);
      const day = Number(usMatch[2]);
      const year = Number(usMatch[3]);
      const hours = Number(usMatch[4]);
      const minutes = Number(usMatch[5]);
      const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
      return Number.isNaN(utcDate.getTime()) ? null : utcDate;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  onMatchChange(match: EditableMatch): void {
    match.round = Math.max(1, Number(match.round) || 1);
    match.order = Math.max(1, Number(match.order) || 1);

    if (match.parentId === match.id || this.isDescendant(match.parentId, match.id)) {
      match.parentId = null;
    }

    this.rebuildBracket();
  }

  getParentOptions(currentId: number): EditableMatch[] {
    return this.editableMatches
      .filter((item) => item.id !== currentId)
      .sort((a, b) => a.id - b.id);
  }

  zoomIn(): void {
    this.setZoom(this.zoomScale + this.zoomStep);
  }

  zoomOut(): void {
    this.setZoom(this.zoomScale - this.zoomStep);
  }

  resetZoom(): void {
    this.fitToViewport();
  }

  get boardTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomScale})`;
  }

  get zoomPercent(): number {
    return Math.round(this.zoomScale * 100);
  }

  onViewportWheel(event: WheelEvent): void {
    event.preventDefault();

    const delta = event.deltaY > 0 ? -this.zoomStep : this.zoomStep;
    this.setZoom(this.zoomScale + delta, true);
  }

  onViewportPointerDown(event: PointerEvent): void {
    if ((event.pointerType === 'mouse' && event.button !== 0) || this.isInteractiveTarget(event.target)) {
      return;
    }

    const viewport = this.zoomViewport.nativeElement;
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 1) {
      this.isPanning = true;
      this.panPointerId = event.pointerId;
      this.panLastX = event.clientX;
      this.panLastY = event.clientY;
    }

    if (this.activePointers.size >= 2) {
      this.isPinching = true;
      this.isPanning = false;
      this.panPointerId = null;
      this.pinchLastDistance = this.getPointerDistance();
    }

    viewport.setPointerCapture(event.pointerId);
    this.cdr.markForCheck();
  }

  onViewportPointerMove(event: PointerEvent): void {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (this.isPinching && this.activePointers.size >= 2) {
      const distance = this.getPointerDistance();
      const midpoint = this.getPointerMidpoint();

      if (distance && midpoint && this.pinchLastDistance) {
        const ratio = distance / this.pinchLastDistance;
        this.setZoomAt(this.zoomScale * ratio, midpoint.x, midpoint.y);
      }

      this.pinchLastDistance = distance;
      return;
    }

    if (!this.isPanning || this.panPointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.panLastX;
    const deltaY = event.clientY - this.panLastY;

    this.panX += deltaX;
    this.panY += deltaY;
    this.panLastX = event.clientX;
    this.panLastY = event.clientY;
    this.cdr.markForCheck();
  }

  onViewportPointerUp(event: PointerEvent): void {
    const viewport = this.zoomViewport.nativeElement;
    this.activePointers.delete(event.pointerId);

    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    if (this.activePointers.size < 2) {
      this.isPinching = false;
      this.pinchLastDistance = null;
    }

    if (this.isPanning && this.panPointerId === event.pointerId) {
      this.isPanning = false;
      this.panPointerId = null;
    }

    if (!this.isPanning && !this.isPinching && this.activePointers.size === 1) {
      const [id, point] = this.activePointers.entries().next().value as [number, { x: number; y: number }];
      this.isPanning = true;
      this.panPointerId = id;
      this.panLastX = point.x;
      this.panLastY = point.y;
    }

    this.cdr.markForCheck();
  }

  private rebuildBracket(): void {
    const positioned = this.layoutMatches(this.editableMatches);
    this.projectRenderData(positioned);
  }

  private layoutMatches(matches: EditableMatch[]): PositionedMatch[] {
    const positioned = new Map<number, PositionedMatch>();
    const byId = new Map<number, EditableMatch>(matches.map((item) => [item.id, item]));

    const leftRounds = this.collectRounds(matches, 'left');
    const rightRounds = this.collectRounds(matches, 'right');
    const centerMatches = matches
      .filter((item) => item.side === 'center')
      .sort((a, b) => (a.round - b.round) || (a.order - b.order) || (a.id - b.id));

    const leftMaxRound = leftRounds.length > 0 ? Math.max(...leftRounds.map((r) => r.round)) : 0;
    const rightMaxRound = rightRounds.length > 0 ? Math.max(...rightRounds.map((r) => r.round)) : 0;

    this.placeSideRounds(leftRounds, 'left', leftMaxRound, positioned);
    this.placeSideRounds(rightRounds, 'right', rightMaxRound, positioned);

    if (centerMatches.length > 0) {
      const fallback = this.spreadY(centerMatches.length);
      centerMatches.forEach((match, index) => {
        const childYs = matches
          .filter((child) => child.parentId === match.id)
          .map((child) => positioned.get(child.id)?.y)
          .filter((value): value is number => value !== undefined);

        positioned.set(match.id, {
          ...match,
          x: (match.round - 1) * Math.floor(this.roundGap * 0.6),
          y: childYs.length > 0 ? this.avg(childYs) : fallback[index],
        });
      });
    }

    // Any disconnected node still gets a deterministic place.
    const orphaned = matches.filter((item) => !positioned.has(item.id));
    const orphanY = this.spreadY(orphaned.length);
    orphaned.forEach((match, index) => {
      positioned.set(match.id, {
        ...match,
        x: match.side === 'left' ? -this.roundGap : match.side === 'right' ? this.roundGap : 0,
        y: orphanY[index],
      });
    });

    // Remove invalid parent references that do not exist anymore.
    this.editableMatches = this.editableMatches.map((item) => ({
      ...item,
      parentId: item.parentId !== null && !byId.has(item.parentId) ? null : item.parentId,
    }));

    return Array.from(positioned.values());
  }

  private placeSideRounds(
    rounds: { round: number; matches: EditableMatch[] }[],
    side: 'left' | 'right',
    maxRound: number,
    positioned: Map<number, PositionedMatch>
  ): void {
    rounds.forEach(({ round, matches }) => {
      const fallback = this.spreadY(matches.length);

      matches.forEach((match, index) => {
        const childYs = this.editableMatches
          .filter((child) => child.parentId === match.id)
          .map((child) => positioned.get(child.id)?.y)
          .filter((value): value is number => value !== undefined);

        const distance = maxRound - round + 1;
        const x = side === 'left' ? -distance * this.roundGap : distance * this.roundGap;

        positioned.set(match.id, {
          ...match,
          x,
          y: childYs.length > 0 ? this.avg(childYs) : fallback[index],
        });
      });
    });
  }

  private collectRounds(matches: EditableMatch[], side: 'left' | 'right'): { round: number; matches: EditableMatch[] }[] {
    const roundsMap = new Map<number, EditableMatch[]>();

    matches
      .filter((item) => item.side === side)
      .forEach((item) => {
        if (!roundsMap.has(item.round)) {
          roundsMap.set(item.round, []);
        }

        roundsMap.get(item.round)?.push(item);
      });

    return Array.from(roundsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, roundMatches]) => ({
        round,
        matches: [...roundMatches].sort((a, b) => (a.order - b.order) || (a.id - b.id)),
      }));
  }

  private projectRenderData(positionedNodes: PositionedMatch[]): void {
    if (positionedNodes.length === 0) {
      this.nodes = [];
      this.paths = [];
      this.groupLabels = [];
      return;
    }

    const hiddenMatchIds = this.getHiddenMatchIds();
    const visiblePositionedNodes = positionedNodes.filter((node) => !hiddenMatchIds.has(node.id));

    if (visiblePositionedNodes.length === 0) {
      this.nodes = [];
      this.paths = [];
      this.groupLabels = this.buildGroupLabels(positionedNodes, this.canvasPadding);
      this.cdr.detectChanges();
      requestAnimationFrame(() => this.fitToViewport());
      return;
    }

    const nodeWidth = this.getNodeWidth();
    const nodeHeight = this.getNodeHeight();

    const minX = Math.min(...visiblePositionedNodes.map((node) => node.x - nodeWidth / 2));
    const maxX = Math.max(...visiblePositionedNodes.map((node) => node.x + nodeWidth / 2));
    const minY = Math.min(...visiblePositionedNodes.map((node) => node.y - nodeHeight / 2));
    const maxY = Math.max(...visiblePositionedNodes.map((node) => node.y + nodeHeight / 2));

    const width = maxX - minX + this.canvasPadding * 2;
    const height = maxY - minY + this.canvasPadding * 2;

    this.canvasWidth = Math.max(980, Math.ceil(width));
    this.canvasHeight = Math.max(560, Math.ceil(height));

    const offsetX = this.canvasPadding - minX;
    const offsetY = this.canvasPadding - minY;

    const centerMap = new Map<number, { x: number; y: number }>();

    this.nodes = visiblePositionedNodes
      .map((node) => {
        const cx = node.x + offsetX;
        const cy = node.y + offsetY;
        centerMap.set(node.id, { x: cx, y: cy });

        return {
          ...node,
          left: cx - nodeWidth / 2,
          top: cy - nodeHeight / 2,
        };
      });

    this.groupLabels = this.buildGroupLabels(positionedNodes, offsetX);

    this.paths = this.editableMatches
      .filter((match) => match.parentId !== null && !hiddenMatchIds.has(match.id) && !hiddenMatchIds.has(match.parentId as number))
      .map((match, index) => {
        const from = centerMap.get(match.id);
        const to = centerMap.get(match.parentId as number);

        if (!from || !to) {
          return null;
        }

        const fromRight = from.x < to.x;
        const fromX = fromRight ? from.x + nodeWidth / 2 : from.x - nodeWidth / 2;
        const toX = fromRight ? to.x - nodeWidth / 2 : to.x + nodeWidth / 2;

        return {
          key: `path-${match.id}-${match.parentId}-${index}`,
          d: this.buildOrthogonalPath(fromX, from.y, toX, to.y),
        } as RenderPath;
      })
      .filter((item): item is RenderPath => item !== null);

    this.cdr.detectChanges();
    requestAnimationFrame(() => this.fitToViewport());
  }

  private getHiddenMatchIds(): Set<number> {
    const hiddenIds = new Set<number>();

    this.editableMatches.forEach((match) => {
      if (this.collapsedLabelKeys.has(`${match.side}-${match.round}`)) {
        hiddenIds.add(match.id);
      }
    });

    return hiddenIds;
  }

  private toggleGroupVisibility(labelKeys: string[]): void {
    const shouldCollapse = labelKeys.some((key) => !this.collapsedLabelKeys.has(key));

    labelKeys.forEach((key) => {
      if (shouldCollapse) {
        this.collapsedLabelKeys.add(key);
      } else {
        this.collapsedLabelKeys.delete(key);
      }
    });

    this.persistCollapsedGroups();
    this.rebuildBracket();
  }

  private getLinkedLabelKeys(labelKey: string): string[] {
    const [side, round] = labelKey.split('-');

    if (side === 'center') {
      return [labelKey];
    }

    return this.groupLabels
      .filter((label) => {
        const [labelSide, labelRound] = label.key.split('-');
        return labelRound === round && (labelSide === 'left' || labelSide === 'right');
      })
      .map((label) => label.key);
  }

  private loadCollapsedGroups(): void {
    try {
      const raw = localStorage.getItem(this.collapsedLabelsStorageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }

      this.collapsedLabelKeys.clear();
      parsed
        .filter((item): item is string => typeof item === 'string')
        .forEach((item) => this.collapsedLabelKeys.add(item));
    } catch {
      this.collapsedLabelKeys.clear();
    }
  }

  private persistCollapsedGroups(): void {
    localStorage.setItem(this.collapsedLabelsStorageKey, JSON.stringify(Array.from(this.collapsedLabelKeys)));
  }

  private buildGroupLabels(positionedNodes: PositionedMatch[], offsetX: number): GroupLabel[] {
    const groups = new Map<string, { x: number; round: number; side: EditableMatch['side'] }>();
    const labelTop = this.canvasPadding - this.groupLabelOffsetFromFirstRow;

    positionedNodes.forEach((node) => {
      const key = `${node.side}-${node.round}`;
      if (!groups.has(key)) {
        groups.set(key, { x: node.x + offsetX, round: node.round, side: node.side });
      }
    });

    return Array.from(groups.entries())
      .map(([key, value]) => ({
        key,
        left: value.x,
        top: labelTop,
        round: value.round,
        sideLabelKey: this.getSideLabelKey(value.side),
      }))
      .sort((a, b) => a.left - b.left);
  }

  getLabelFullName(label: GroupLabel): { row1: string; row2?: string; } {
    const side: 'left' | 'right' | 'center' = label.key.split('-')[0] as 'left' | 'right' | 'center';
    const round = Number(label.key.split('-')[1]);

    if (side === 'center') {
      return {
        row1: 'TABLE.FINAL_TITLE',
        row2: 'TABLE.THIRD_PLACE_TITLE',
      };
    }

    switch (round) {
      case 1:
        return { row1: 'TABLE.LAST_32_TITLE' };
      case 2:
        return { row1: 'TABLE.LAST_16_TITLE' };
      case 3:
        return { row1: 'TABLE.QUARTER_FINALS_TITLE' };
      case 4:
        return { row1: 'TABLE.SEMI_FINALS_TITLE' };
      default:
        return { row1: label.sideLabelKey };
    }
  }

  private getSideLabelKey(side: EditableMatch['side']): string {
    if (side === 'left') {
      return 'ELIMINATIONS.GROUP_SIDE_LEFT';
    }

    if (side === 'right') {
      return 'ELIMINATIONS.GROUP_SIDE_RIGHT';
    }

    return 'ELIMINATIONS.GROUP_SIDE_CENTER';
  }

  private buildOrthogonalPath(fromX: number, fromY: number, toX: number, toY: number): string {
    const snap = (value: number): number => Math.round(value) + 0.5;

    const x1 = snap(fromX);
    const y1 = snap(fromY);
    const x2 = snap(toX);
    const y2 = snap(toY);

    if (x1 === x2) {
      const midY = snap((y1 + y2) / 2);
      return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    }

    const midX = snap((x1 + x2) / 2);
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }

  private getNodeWidth(): number {
    return window.innerWidth <= this.mobileBreakpoint ? this.mobileNodeWidth : this.desktopNodeWidth;
  }

  private getNodeHeight(): number {
    return window.innerWidth <= this.mobileBreakpoint ? this.mobileNodeHeight : this.desktopNodeHeight;
  }

  private spreadY(count: number): number[] {
    return Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * this.yGap);
  }

  private avg(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private getNextId(): number {
    if (this.editableMatches.length === 0) {
      return 1;
    }

    return Math.max(...this.editableMatches.map((item) => item.id)) + 1;
  }

  private getNextOrder(side: EditableMatch['side'], round: number): number {
    const sameBucket = this.editableMatches.filter((item) => item.side === side && item.round === round);
    if (sameBucket.length === 0) {
      return 1;
    }

    return Math.max(...sameBucket.map((item) => item.order)) + 1;
  }

  private isDescendant(parentCandidateId: number | null, childId: number): boolean {
    if (parentCandidateId === null) {
      return false;
    }

    let currentParentId: number | null = parentCandidateId;
    const guard = new Set<number>();

    while (currentParentId !== null) {
      if (currentParentId === childId) {
        return true;
      }

      if (guard.has(currentParentId)) {
        return true;
      }

      guard.add(currentParentId);
      const parent = this.editableMatches.find((item) => item.id === currentParentId);
      currentParentId = parent?.parentId ?? null;
    }

    return false;
  }

  private isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return !!target.closest('button, a, input, textarea, select, [role="button"]');
  }

  private fitToViewport(): void {
    const viewport = this.zoomViewport.nativeElement;
    const availableWidth = viewport.clientWidth;
    const availableHeight = viewport.clientHeight;

    if (!availableWidth || !availableHeight) {
      return;
    }

    const isMobileViewport = window.innerWidth <= this.mobileBreakpoint;

    if (isMobileViewport && this.nodes.length > 0) {
      const minNodeLeft = Math.min(...this.nodes.map((node) => node.left));
      const minNodeTop = Math.min(...this.nodes.map((node) => node.top));
      const mobileScale = Math.max(this.minScale, Math.min(this.maxScale, this.mobileDefaultScale));

      this.zoomScale = mobileScale;
      this.panX = Math.round(this.mobileViewportPaddingLeft - minNodeLeft * mobileScale);
      this.panY = Math.round(this.mobileViewportPaddingTop - minNodeTop * mobileScale);
      this.cdr.markForCheck();
      return;
    }

    const scale = Math.max(this.minScale, Math.min(this.maxScale, this.desktopDefaultScale));
    const minNodeTop = this.nodes.length > 0 ? Math.min(...this.nodes.map((node) => node.top)) : 0;
    const minNodeLeft = this.nodes.length > 0 ? Math.min(...this.nodes.map((node) => node.left)) : 0;

    this.zoomScale = scale;
    this.panX = Math.round(this.desktopFirstMatchLeftPadding - minNodeLeft * scale);
    this.panY = Math.round(this.desktopViewportPaddingTop - minNodeTop * scale);
    this.cdr.markForCheck();
  }

  private setZoom(next: number, smooth = true): void {
    const viewport = this.zoomViewport.nativeElement;
    const anchorX = viewport.clientWidth / 2;
    const anchorY = viewport.clientHeight / 2;

    if (smooth) {
      this.animateZoomAt(next, anchorX, anchorY);
      return;
    }

    this.setZoomAt(next, anchorX, anchorY);
  }

  private animateZoomAt(targetScale: number, anchorX: number, anchorY: number): void {
    const startScale = this.zoomScale;
    const clampedTarget = Math.max(this.minScale, Math.min(this.maxScale, Number(targetScale.toFixed(3))));

    if (Math.abs(clampedTarget - startScale) < 0.001) {
      return;
    }

    if (this.zoomAnimationFrameId !== null) {
      cancelAnimationFrame(this.zoomAnimationFrameId);
      this.zoomAnimationFrameId = null;
    }

    const startedAt = performance.now();

    const tick = (now: number): void => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / this.zoomAnimationDurationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startScale + (clampedTarget - startScale) * eased;

      this.setZoomAt(current, anchorX, anchorY);

      if (progress < 1) {
        this.zoomAnimationFrameId = requestAnimationFrame(tick);
      } else {
        this.zoomAnimationFrameId = null;
      }
    };

    this.zoomAnimationFrameId = requestAnimationFrame(tick);
  }

  private setZoomAt(next: number, anchorX: number, anchorY: number): void {
    const clamped = Math.max(this.minScale, Math.min(this.maxScale, Number(next.toFixed(3))));

    const worldX = (anchorX - this.panX) / this.zoomScale;
    const worldY = (anchorY - this.panY) / this.zoomScale;

    this.zoomScale = clamped;
    this.panX = anchorX - worldX * clamped;
    this.panY = anchorY - worldY * clamped;
    this.cdr.markForCheck();
  }

  private getPointerDistance(): number | null {
    const points = Array.from(this.activePointers.values());
    if (points.length < 2) {
      return null;
    }

    const dx = points[0].x - points[1].x;
    const dy = points[0].y - points[1].y;
    return Math.hypot(dx, dy);
  }

  private getPointerMidpoint(): { x: number; y: number } | null {
    const points = Array.from(this.activePointers.values());
    if (points.length < 2) {
      return null;
    }

    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncAvailableHeight();
    this.fitToViewport();
  }

  private syncAvailableHeight(): void {
    const host = this.hostRef.nativeElement;
    const top = host.getBoundingClientRect().top;
    const safeBottomOffset = 8;
    const available = Math.max(320, Math.floor(window.innerHeight - top - safeBottomOffset));
    host.style.setProperty('--eliminations-available-height', `${available}px`);
  }
}

