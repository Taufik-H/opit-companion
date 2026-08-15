import { OpitState } from "./EditorObserver";

// ─── Sprite Frame Constants ───────────────────────────────────────────
export const FRAME_WIDTH = 42;
export const FRAME_HEIGHT = 42;

// ─── Sprite Info Interface ────────────────────────────────────────────
export interface SpriteInfo {
  filename: string;
  frames: number;
  duration: number; // Duration in seconds for 1 full loop
  frameWidth: number;
  frameHeight: number;
}

// ─── Animation Timing Constants ───────────────────────────────────────
// All durations in seconds — easy to tune in one place.
export const TIMING = {
  idle: 0.68,
  typing: 0.52,
  typingFast: 0.40,
  arrowHorizontal: 0.45,
  backspace: 0.38,
  backspaceBulk: 0.35,
  arrowDown: 0.44,
  arrowUp: 0.52,
  shortcutSave: 0.42,
  enter: 0.42,
  mouseTeleport: 0.35,
  teleportDepart: 0.30,
  error: 0.60,
  stuckDown: 0.50,
  stuckLeft: 0.40,
  idleCombo1: 0.40,
  idleCombo2: 0.40,
  idleCombo3: 0.44,
  idleCombo4: 0.50,
  idleCombo5: 0.52,
  idleCombo6: 0.42,
} as const;

// ─── State-to-Standard-Asset Mapping ─────────────────────────────────
interface SpriteEntry {
  filename: string;
  frames: number;
  duration: number;
}

export const SPRITE_MAP: Record<string, SpriteEntry> = {
  // Idle — character resting
  idle: { filename: "idle.png", frames: 4, duration: TIMING.idle },

  // Typing — standard keyboard typing action
  typing: { filename: "typing.png", frames: 6, duration: TIMING.typing },

  // Horizontal arrow navigation — walking / running horizontally
  arrow_horizontal: { filename: "arrow-horizontal.png", frames: 6, duration: TIMING.arrowHorizontal },
  arrow_left: { filename: "arrow-horizontal.png", frames: 6, duration: TIMING.arrowHorizontal },
  arrow_right: { filename: "arrow-horizontal.png", frames: 6, duration: TIMING.arrowHorizontal },

  // Delete / Backspace single char
  delete: { filename: "backspace.png", frames: 6, duration: TIMING.backspace },
  backspace: { filename: "backspace.png", frames: 6, duration: TIMING.backspace },

  // Bulk delete / select-delete
  bulk_delete: { filename: "backspace-bulk.png", frames: 6, duration: TIMING.backspaceBulk },
  backspace_bulk: { filename: "backspace-bulk.png", frames: 6, duration: TIMING.backspaceBulk },

  // Attack variants for extended combos
  slow_attack: { filename: "idle-combo-1.png", frames: 6, duration: TIMING.idleCombo1 },
  fast_attack: { filename: "backspace.png", frames: 6, duration: TIMING.backspace },

  // Arrow down / squat
  arrow_down: { filename: "arrow-down.png", frames: 4, duration: TIMING.arrowDown },
  climb: { filename: "arrow-down.png", frames: 4, duration: TIMING.arrowDown },

  // Arrow up — Jump
  arrow_up: { filename: "arrow-up.png", frames: 8, duration: TIMING.arrowUp },
  jump: { filename: "arrow-up.png", frames: 8, duration: TIMING.arrowUp },

  // Save / Shortcut action
  save: { filename: "shortcut-save.png", frames: 6, duration: TIMING.shortcutSave },
  shortcut_save: { filename: "shortcut-save.png", frames: 6, duration: TIMING.shortcutSave },

  // Enter action
  enter: { filename: "enter.png", frames: 6, duration: TIMING.enter },

  // Mouse Teleport arrival
  teleport: { filename: "mouse-teleport.png", frames: 8, duration: TIMING.mouseTeleport },
  mouse_teleport: { filename: "mouse-teleport.png", frames: 8, duration: TIMING.mouseTeleport },

  // Teleport depart
  teleport_depart: { filename: "mouse-teleport.png", frames: 8, duration: TIMING.teleportDepart },

  // Error / diagnostic — Hurt reaction
  error: { filename: "error.png", frames: 4, duration: TIMING.error },

  // Run / fast typing state
  run: { filename: "typing-fast.png", frames: 6, duration: TIMING.typingFast },
  typing_fast: { filename: "typing-fast.png", frames: 6, duration: TIMING.typingFast },

  // Death state
  death: { filename: "mouse-teleport.png", frames: 8, duration: TIMING.mouseTeleport },

  // Stuck at bottom — struggling animation
  stuck_down: { filename: "stuck-down.png", frames: 6, duration: TIMING.stuckDown },

  // Stuck at left wall — bumping animation
  stuck_left: { filename: "stuck-left.png", frames: 4, duration: TIMING.stuckLeft },
};

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Returns default sprite info for a given OpitState.
 * Falls back to idle if no mapping is found.
 */
export function getSpriteInfo(state: OpitState | "teleport_depart" | "stuck_down" | string): SpriteInfo {
  const entry = SPRITE_MAP[state] ?? SPRITE_MAP["idle"];
  return {
    filename: entry.filename,
    frames: entry.frames,
    duration: entry.duration,
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
  };
}
