import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, isDevMode } from '@angular/core';
import { Popover, PopoverModule } from 'primeng/popover';
import { INFO_POPOVER_DEFAULTS, PopoverTriggerMode } from './info-popover.config';

@Component({
  selector: 'app-info-popover',
  standalone: true,
  imports: [CommonModule, PopoverModule],
  template: `
    <p-popover
      #popover
      [appendTo]="appendTo"
      [dismissable]="dismissable"
      [styleClass]="computedPanelClass"
      [showTransitionOptions]="showTransitionOptions"
      [hideTransitionOptions]="hideTransitionOptions"
      (onShow)="onPopoverShow(popover)"
      (onHide)="onPopoverHide()"
    >
      <div class="app-info-popover-content">{{ message }}</div>
    </p-popover>

    <span
      class="app-info-popover-trigger"
      [ngClass]="triggerClass"
      role="button"
      tabindex="0"
      [attr.aria-label]="ariaLabel || null"
      (click)="onToggle($event, popover)"
      (mouseenter)="onMouseEnter($event, popover)"
      (mouseleave)="onMouseLeave(popover)"
      (keydown.enter)="onToggle($event, popover)"
      (keydown.space)="onToggle($event, popover)"
    >
      <ng-content select="[popover-trigger]"></ng-content>
    </span>
  `,
  styles: [
    `
      :host {
        display: inline;
      }

      .app-info-popover-trigger {
        display: inline-flex;
        align-items: center;
        cursor: default !important;
      }

      .app-info-popover-trigger * {
        cursor: inherit !important;
      }

      .app-info-popover-content {
        max-width: min(82vw, 22rem);
        line-height: 1.45;
      }

      :host ::ng-deep .app-info-popover-panel.p-popover {
        border-radius: 12px;
        box-shadow: 0 14px 34px rgba(2, 8, 23, 0.18), 0 6px 14px rgba(2, 8, 23, 0.1);
        backdrop-filter: blur(4px);
      }
    `,
  ],
})
export class InfoPopoverComponent implements OnDestroy {
  @Input() message = '';
  @Input() ariaLabel = '';
  @Input() appendTo: unknown = 'body';
  @Input() dismissable = true;
  @Input() triggerClass = '';
  @Input() panelClass = '';
  @Input() triggerMode: PopoverTriggerMode = 'auto';
  @Input() hoverCloseDelayMs = INFO_POPOVER_DEFAULTS.hoverCloseDelayMs;
  @Input() autoHideMs = INFO_POPOVER_DEFAULTS.autoHideMs;
  @Input() showTransitionOptions = INFO_POPOVER_DEFAULTS.showTransitionOptions;
  @Input() hideTransitionOptions = INFO_POPOVER_DEFAULTS.hideTransitionOptions;
  @Input() enableMotion = true;
  @Input() smartPositioning = true;
  @Input() pauseAutoHideOnPanelHover = true;
  @Input() panelHoverAutoHideMultiplier = 3;
  @Input() debug = false;

  private readonly supportsDesktopHover =
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  private hoverHideTimer: ReturnType<typeof setTimeout> | null = null;
  private autoHideTimer: ReturnType<typeof setTimeout> | null = null;
  private hideAnimationInProgress = false;
  private panelMouseEnterListener: ((event: Event) => void) | null = null;
  private panelMouseLeaveListener: ((event: Event) => void) | null = null;
  private activePanelElement: HTMLElement | null = null;

  get computedPanelClass(): string {
    return ['app-info-popover-panel', this.panelClass].filter(Boolean).join(' ');
  }

  ngOnDestroy(): void {
    this.clearHoverHideTimer();
    this.clearAutoHideTimer();
    this.detachPanelHoverListeners();
  }

  onToggle(event: Event, popover: Popover): void {
    if (event instanceof MouseEvent && !this.isClickEnabled()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!this.message?.trim()) {
      return;
    }

    this.clearHoverHideTimer();
    this.clearAutoHideTimer();

    if (this.isPanelVisible(popover)) {
      this.requestHide(popover);
      return;
    }

    popover.show(event);
  }

  onPopoverShow(popover: Popover): void {
    this.hideAnimationInProgress = false;
    this.playShowAnimation(popover);
    this.fitPanelWithinViewport(popover);
    this.attachPanelHoverListeners(popover);
    this.log('show', { triggerMode: this.triggerMode, autoHideMs: this.autoHideMs });
    this.armDefaultAutoHide(popover);
  }

  onPopoverHide(): void {
    this.clearAutoHideTimer();
    this.detachPanelHoverListeners();
    this.log('hide');
  }

  onMouseEnter(event: MouseEvent, popover: Popover): void {
    if (!this.isHoverEnabled() || !this.message?.trim()) {
      return;
    }

    this.clearHoverHideTimer();
    this.clearAutoHideTimer();
    popover.show(event);
  }

  onMouseLeave(popover: Popover): void {
    if (!this.isHoverEnabled()) {
      return;
    }

    this.clearHoverHideTimer();
    this.hoverHideTimer = setTimeout(() => {
      this.requestHide(popover);
    }, this.hoverCloseDelayMs);
  }

  private requestHide(popover: Popover): void {
    if (this.hideAnimationInProgress) {
      return;
    }

    const panel = this.getPanelElement(popover);
    if (!panel || !this.enableMotion) {
      popover.hide();
      return;
    }

    this.hideAnimationInProgress = true;
    const animation = panel.animate(
      [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: `translateY(-${INFO_POPOVER_DEFAULTS.panelOffsetPx}px) scale(0.98)` },
      ],
      {
        duration: INFO_POPOVER_DEFAULTS.animationDurationMs.hide,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards',
      }
    );

    const finalize = () => {
      this.hideAnimationInProgress = false;
      popover.hide();
    };

    animation.onfinish = finalize;
    animation.oncancel = finalize;
  }

  private playShowAnimation(popover: Popover): void {
    const panel = this.getPanelElement(popover);
    if (!panel || !this.enableMotion) {
      return;
    }

    panel.animate(
      [
        { opacity: 0, transform: `translateY(-${INFO_POPOVER_DEFAULTS.panelOffsetPx + 2}px) scale(0.98)` },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      {
        duration: INFO_POPOVER_DEFAULTS.animationDurationMs.show,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        fill: 'both',
      }
    );
  }

  private fitPanelWithinViewport(popover: Popover): void {
    if (!this.smartPositioning || typeof window === 'undefined') {
      return;
    }

    requestAnimationFrame(() => {
      const panel = this.getPanelElement(popover);
      if (!panel) {
        return;
      }

      const rect = panel.getBoundingClientRect();
      const viewportPadding = INFO_POPOVER_DEFAULTS.viewportPaddingPx;
      const maxRight = window.innerWidth - viewportPadding;
      const maxBottom = window.innerHeight - viewportPadding;

      let deltaX = 0;
      let deltaY = 0;

      if (rect.left < viewportPadding) {
        deltaX = viewportPadding - rect.left;
      } else if (rect.right > maxRight) {
        deltaX = maxRight - rect.right;
      }

      if (rect.top < viewportPadding) {
        deltaY = viewportPadding - rect.top;
      } else if (rect.bottom > maxBottom) {
        deltaY = maxBottom - rect.bottom;
      }

      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      const left = parseFloat(panel.style.left || '0');
      const top = parseFloat(panel.style.top || '0');
      panel.style.left = `${left + deltaX}px`;
      panel.style.top = `${top + deltaY}px`;
      this.log('smart-reposition', { deltaX, deltaY });
    });
  }

  private getPanelElement(popover: Popover): HTMLElement | null {
    return (popover as unknown as { container?: HTMLElement | null }).container ?? null;
  }

  private isPanelVisible(popover: Popover): boolean {
    const panel = this.getPanelElement(popover);
    if (!panel) {
      return false;
    }

    const style = window.getComputedStyle(panel);
    const rect = panel.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  private isHoverEnabled(): boolean {
    if (this.triggerMode === 'click') {
      return false;
    }

    return this.supportsDesktopHover;
  }

  private isClickEnabled(): boolean {
    if (this.triggerMode === 'hover') {
      return !this.supportsDesktopHover;
    }

    return true;
  }

  private clearHoverHideTimer(): void {
    if (this.hoverHideTimer) {
      clearTimeout(this.hoverHideTimer);
      this.hoverHideTimer = null;
    }
  }

  private clearAutoHideTimer(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  private armDefaultAutoHide(popover: Popover): void {
    if (this.autoHideMs <= 0) {
      return;
    }

    this.clearAutoHideTimer();
    this.autoHideTimer = setTimeout(() => this.requestHide(popover), this.autoHideMs);
  }

  private armExtendedAutoHide(popover: Popover): void {
    if (this.autoHideMs <= 0) {
      return;
    }

    const multiplier = Math.max(1, this.panelHoverAutoHideMultiplier);
    const extendedMs = this.autoHideMs * multiplier;

    this.clearAutoHideTimer();
    this.autoHideTimer = setTimeout(() => this.requestHide(popover), extendedMs);
    this.log('panel-hover-extended-autohide', { multiplier, extendedMs });
  }

  private attachPanelHoverListeners(popover: Popover): void {
    if (!this.pauseAutoHideOnPanelHover) {
      return;
    }

    this.detachPanelHoverListeners();
    const panel = this.getPanelElement(popover);
    if (!panel) {
      return;
    }

    this.panelMouseEnterListener = () => {
      this.clearHoverHideTimer();
      this.armExtendedAutoHide(popover);
      this.log('panel-hover-enter');
    };

    this.panelMouseLeaveListener = () => {
      if (this.isHoverEnabled()) {
        this.clearHoverHideTimer();
        this.hoverHideTimer = setTimeout(() => this.requestHide(popover), this.hoverCloseDelayMs);
      } else {
        this.armDefaultAutoHide(popover);
      }
      this.log('panel-hover-leave');
    };

    panel.addEventListener('mouseenter', this.panelMouseEnterListener);
    panel.addEventListener('mouseleave', this.panelMouseLeaveListener);
    this.activePanelElement = panel;
  }

  private detachPanelHoverListeners(): void {
    if (!this.panelMouseEnterListener && !this.panelMouseLeaveListener) {
      return;
    }

    const panel = this.activePanelElement;
    if (panel && this.panelMouseEnterListener) {
      panel.removeEventListener('mouseenter', this.panelMouseEnterListener);
    }
    if (panel && this.panelMouseLeaveListener) {
      panel.removeEventListener('mouseleave', this.panelMouseLeaveListener);
    }

    this.panelMouseEnterListener = null;
    this.panelMouseLeaveListener = null;
    this.activePanelElement = null;
  }

  private log(event: string, payload?: Record<string, unknown>): void {
    if (!this.debug || !isDevMode()) {
      return;
    }

    // Debug-only diagnostics for trigger behavior and timing.
    console.debug('[InfoPopover]', event, payload ?? {});
  }
}
