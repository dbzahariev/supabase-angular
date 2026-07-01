export type PopoverTriggerMode = 'auto' | 'hover' | 'click';

export const INFO_POPOVER_DEFAULTS = {
  hoverCloseDelayMs: 120,
  autoHideMs: 5000,
  showTransitionOptions: '180ms cubic-bezier(0.22, 0.61, 0.36, 1)',
  hideTransitionOptions: '160ms cubic-bezier(0.4, 0, 0.2, 1)',
  animationDurationMs: {
    show: 190,
    hide: 170,
  },
  viewportPaddingPx: 8,
  panelOffsetPx: 4,
} as const;
