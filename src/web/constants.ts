export const LINT_DELAY = 300;
export const DEFAULT_FRAMES = 300;
export const DEFAULT_GUARD = 100000;
export const HOVER_DELAY = 250;
export const STATUS_TIME = 3000;
export const FOLLOW_DELAY = 150;
export const FLASH_TIME = 2400;
export const HALF = 0.5;
export const BLUEPRINT_DRAW = Object.freeze({
  handleHit: 7, half: 0.5, wheelZoom: 0.0015, middleButton: 1, dragThreshold: 3, grid: 10, tipOffset: 14,
  font: '11px -apple-system, BlinkMacSystemFont, system-ui, sans-serif', dash: [4, 4], ghostAlpha: 0.7, hostFill: 0.08, hostStroke: 0.35, fill: 0.28,
  emphasisFill: 0.5, emphasisLine: 2, labelWidth: 40, labelHeight: 14, labelInset: 3, selectionLine: 2, handleSize: 4, double: 2, gridStep: 10, minGridPixels: 14,
  gridGrowth: 10, gridAlpha: 0.5,
});
export const BOTH_SIDES = 2;
export const BLUEPRINT_SIZE = Object.freeze({
  marker: Object.freeze({ x: -16, y: -16, w: 32, h: 32 }), defaultSide: 10, minScale: 0.02, maxScale: 8, fitPadding: 24, grid: 10,
});
export const LAYOUT_SAVE_DELAY = 300;
export const DOCK_SIZE = Object.freeze({ settingsWidth: 380, settingsHeight: 620, margin: 12, referenceWidth: 360, outputShare: 0.34, blueprintWidth: 560, blueprintHeight: 380, sides: 2 });
export const BLUEPRINT_REFRESH_DELAY = 350;
export const FIRST_COPY_NUMBER = 2;
