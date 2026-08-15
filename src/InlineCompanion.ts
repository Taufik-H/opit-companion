import * as vscode from "vscode";
import { OpitState } from "./EditorObserver";
import { SpriteInfo, FRAME_WIDTH, FRAME_HEIGHT } from "./SpriteConfig";
import { SpriteRenderer } from "./SpriteRenderer";
import { DirectionManager } from "./DirectionManager";
import { CharacterRegistry } from "./CharacterRegistry";

// ─── Idle Combo Sequence ──────────────────────────────────────────────
// After 3 seconds of idle, the character performs this "bored" combo,
// then returns to idle and waits 3 seconds again (infinite loop).
interface ComboStep {
  filename: string;
  frames: number;
  duration: number; // seconds for one full animation loop
}

const IDLE_COMBO_DELAY_MS = 3000;
const IDLE_COMBO_SEQUENCE: ComboStep[] = [
  { filename: "idle-combo-1.png", frames: 6, duration: 0.40 },
  { filename: "idle-combo-2.png", frames: 6, duration: 0.40 },
  { filename: "idle-combo-3.png", frames: 4, duration: 0.44 },
  { filename: "idle-combo-4.png", frames: 6, duration: 0.50 },
  { filename: "idle-combo-5.png", frames: 8, duration: 0.52 },
  { filename: "idle-combo-6.png", frames: 6, duration: 0.42 },
];

export class InlineCompanion {
  private decorationType: vscode.TextEditorDecorationType;
  private teleportDepartDecorationType: vscode.TextEditorDecorationType;

  // State
  private currentState: OpitState = "idle";
  private currentVariant: string = "pink";
  private animationSpeed: number = 1.0;

  // Teleport dual-animation tracking
  private isTeleporting: boolean = false;
  private teleportPreviousPos: vscode.Position | null = null;
  private teleportTimer: NodeJS.Timeout | null = null;

  // Idle combo tracking
  private idleDelayTimer: NodeJS.Timeout | null = null;
  private idleComboTimer: NodeJS.Timeout | null = null;
  private idleComboStepIndex: number = -1;
  private isPlayingIdleCombo: boolean = false;

  // Transient one-shot state timer (e.g. stuck_left, stuck_down)
  private transientTimer: NodeJS.Timeout | null = null;

  // Render deduplication cache
  private lastRenderKey: string = "";
  private lastActiveEditor: vscode.TextEditor | undefined;

  // Modular components
  private renderer: SpriteRenderer;
  private directionManager: DirectionManager;
  private characterRegistry: CharacterRegistry;

  constructor(
    private readonly extensionUri: vscode.Uri,
    characterRegistry?: CharacterRegistry
  ) {
    // Top Z-Index Layering: z-index 99999 ensures character renders ON TOP of text tokens!
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        textDecoration: "none; position: relative; z-index: 99999; pointer-events: none;",
      },
    });
    this.teleportDepartDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        textDecoration: "none; position: relative; z-index: 99999; pointer-events: none;",
      },
    });

    const config = vscode.workspace.getConfiguration("opit");
    this.currentVariant = config.get<string>("variant", "pink");
    this.animationSpeed = config.get<number>("animationSpeed", 1.0);
    const displaySize = config.get<number>("displaySize", 22);

    this.characterRegistry = characterRegistry ?? new CharacterRegistry(extensionUri);
    this.renderer = new SpriteRenderer(extensionUri, displaySize, this.animationSpeed);
    this.directionManager = new DirectionManager();

    if (vscode.window.activeTextEditor) {
      this.lastActiveEditor = vscode.window.activeTextEditor;
    } else if (vscode.window.visibleTextEditors.length > 0) {
      this.lastActiveEditor = vscode.window.visibleTextEditors[0];
    }

    this.renderCurrentFrame(true);
  }

  // ─── Configuration ──────────────────────────────────────────────────

  public setVariant(variant: string) {
    this.currentVariant = variant;
    this.renderer.clearCache();
    this.lastRenderKey = "";
    this.renderCurrentFrame(true);
  }

  public setDisplaySize(displaySize: number) {
    this.renderer.updateSettings(displaySize, this.animationSpeed);
    this.renderer.clearCache();
    this.lastRenderKey = "";
    this.renderCurrentFrame(true);
  }

  public setAnimationSpeed(speed: number) {
    this.animationSpeed = speed;
    this.renderer.updateSettings(this.renderer.getDisplaySize(), speed);
    this.renderer.clearCache();
    this.lastRenderKey = "";
    this.renderCurrentFrame(true);
  }

  public updateConfig() {
    const config = vscode.workspace.getConfiguration("opit");
    this.currentVariant = config.get<string>("variant", "pink");
    this.animationSpeed = config.get<number>("animationSpeed", 1.0);
    const displaySize = config.get<number>("displaySize", 22);

    this.renderer.updateSettings(displaySize, this.animationSpeed);
    this.renderer.clearCache();
    this.lastRenderKey = "";
    this.renderCurrentFrame(true);
  }

  // ─── State Management ──────────────────────────────────────────────

  public setState(state: OpitState, isEventTriggered: boolean = false, metadata?: any) {
    // Teleport with dual-animation (depart + arrive)
    if (state === "teleport" && metadata?.previousPos) {
      this.cancelIdleCombo();
      this.isTeleporting = true;
      this.teleportPreviousPos = metadata.previousPos;
      this.currentState = "teleport";
      this.lastRenderKey = ""; // Force fresh render for teleport
      this.renderCurrentFrame(true);

      if (this.teleportTimer) {
        clearTimeout(this.teleportTimer);
      }
      this.teleportTimer = setTimeout(() => {
        this.isTeleporting = false;
        this.teleportPreviousPos = null;
        this.clearDepartDecoration();
        this.currentState = "idle";
        this.renderCurrentFrame(true);
        this.startIdleDelay();
      }, 450);
      return;
    }

    // PROTECT teleport animation from being killed by follow-up events.
    if (this.isTeleporting) {
      this.onCursorPositionChanged();
      return;
    }

    // Any user action interrupts the idle combo
    if (this.isPlayingIdleCombo && state !== "idle") {
      this.cancelIdleCombo();
    }

    // Clear existing transient timer
    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
      this.transientTimer = null;
    }

    // Update facing direction
    this.directionManager.update(state);

    // Skip redundant state updates
    if (this.currentState === state && !isEventTriggered) {
      return;
    }

    if (isEventTriggered) {
      this.lastRenderKey = ""; // Force fresh render on explicit user events
    }

    this.currentState = state;
    this.renderCurrentFrame(false);

    // Transient one-shot actions (e.g. bumping left wall or stuck down)
    if (state === "stuck_left" || state === "stuck_down") {
      const info = this.characterRegistry.resolveAction(this.currentVariant, state);
      const durationMs = (info.duration * 1000) / this.animationSpeed;
      this.transientTimer = setTimeout(() => {
        if (this.currentState === state) {
          this.currentState = "idle";
          this.lastRenderKey = "";
          this.renderCurrentFrame(true);
          this.startIdleDelay();
        }
      }, durationMs);
    } else if (state === "idle") {
      // Start idle combo delay when entering idle
      this.startIdleDelay();
    } else {
      this.cancelIdleCombo();
    }
  }

  /**
   * Called immediately whenever cursor position changes.
   * Synchronizes character location instantly with 0ms lag.
   */
  public onCursorPositionChanged() {
    this.renderCurrentFrame(false);
  }

  public startAnimation(context: vscode.ExtensionContext) {
    context.subscriptions.push({
      dispose: () => this.dispose(),
    });
  }

  // ─── Idle Combo System ─────────────────────────────────────────────

  /**
   * Starts the 3-second delay before the idle combo begins.
   */
  private startIdleDelay() {
    this.cancelIdleCombo();
    this.idleDelayTimer = setTimeout(() => {
      this.startIdleCombo();
    }, IDLE_COMBO_DELAY_MS);
  }

  /**
   * Begins the idle combo sequence: Combo 1 -> 2 -> 3 -> 4 -> 5 -> 6
   */
  private startIdleCombo() {
    this.isPlayingIdleCombo = true;
    this.idleComboStepIndex = 0;
    this.renderCurrentFrame(true);
    this.scheduleNextComboStep();
  }

  /**
   * Schedules the transition to the next combo step after the current step's duration.
   */
  private scheduleNextComboStep() {
    if (!this.isPlayingIdleCombo || this.idleComboStepIndex < 0) return;

    const step = IDLE_COMBO_SEQUENCE[this.idleComboStepIndex];
    // Wait for the current animation to complete, then advance
    const durationMs = step.duration * 1000;

    this.idleComboTimer = setTimeout(() => {
      this.idleComboStepIndex++;

      if (this.idleComboStepIndex >= IDLE_COMBO_SEQUENCE.length) {
        // Combo finished — return to idle and restart the 3-second delay
        this.isPlayingIdleCombo = false;
        this.idleComboStepIndex = -1;
        this.currentState = "idle";
        this.lastRenderKey = "";
        this.renderCurrentFrame(true);
        this.startIdleDelay();
      } else {
        // Advance to next combo step
        this.lastRenderKey = "";
        this.renderCurrentFrame(true);
        this.scheduleNextComboStep();
      }
    }, durationMs);
  }

  /**
   * Cancels all idle combo timers and resets combo state.
   */
  private cancelIdleCombo() {
    if (this.idleDelayTimer) {
      clearTimeout(this.idleDelayTimer);
      this.idleDelayTimer = null;
    }
    if (this.idleComboTimer) {
      clearTimeout(this.idleComboTimer);
      this.idleComboTimer = null;
    }
    this.isPlayingIdleCombo = false;
    this.idleComboStepIndex = -1;
  }

  // ─── Rendering ─────────────────────────────────────────────────────

  /**
   * Returns the current sprite info, accounting for idle combo override.
   */
  private getCurrentSpriteState(): { info: SpriteInfo; oneShot: boolean; reverse: boolean } {
    // Idle combo override — use the combo step's sprite
    if (this.isPlayingIdleCombo && this.idleComboStepIndex >= 0) {
      const step = IDLE_COMBO_SEQUENCE[this.idleComboStepIndex];
      return {
        info: {
          filename: step.filename,
          frames: step.frames,
          duration: step.duration,
          frameWidth: FRAME_WIDTH,
          frameHeight: FRAME_HEIGHT,
        },
        oneShot: true,  // Each combo step plays exactly once
        reverse: false,
      };
    }

    // Normal state via CharacterRegistry with tiered fallback
    const isTeleport = this.currentState === "teleport";
    const isOneShot = isTeleport || this.currentState === "stuck_left" || this.currentState === "stuck_down";
    const resolved = this.characterRegistry.resolveAction(this.currentVariant, this.currentState);

    return {
      info: resolved,
      oneShot: isOneShot,
      reverse: isTeleport,
    };
  }

  public renderCurrentFrame(force: boolean = false) {
    if (vscode.window.activeTextEditor) {
      this.lastActiveEditor = vscode.window.activeTextEditor;
    }

    const editor =
      vscode.window.activeTextEditor ??
      (this.lastActiveEditor && !this.lastActiveEditor.document.isClosed
        ? this.lastActiveEditor
        : vscode.window.visibleTextEditors[0]);

    if (!editor || editor.document.isClosed) {
      if (vscode.window.visibleTextEditors.length === 0) {
        this.clearActiveDecoration();
      }
      return;
    }

    const { info, oneShot, reverse } = this.getCurrentSpriteState();

    const svgUri = this.renderer.getSpriteSvgUri(
      this.currentVariant,
      info.filename,
      info.frames,
      info.duration,
      info.frameWidth,
      info.frameHeight,
      this.directionManager.get(),
      oneShot,
      reverse
    );
    if (!svgUri) return;

    const activePosition = editor.selection.active;
    const { width: renderWidth, height: renderHeight } = this.renderer.getRenderDimensions(
      info.frameWidth,
      info.frameHeight
    );
    const marginStr = this.renderer.getMarginString(info.frameWidth, info.frameHeight);

    // Deduplication — skip identical renders (include combo step for uniqueness)
    const comboKey = this.isPlayingIdleCombo ? `combo:${this.idleComboStepIndex}` : "";
    const renderKey = `${editor.document.uri.toString()}:${activePosition.line}:${activePosition.character}:${this.currentState}:${this.directionManager.get()}:${renderWidth}:${comboKey}`;
    if (!force && renderKey === this.lastRenderKey) {
      return;
    }
    this.lastRenderKey = renderKey;

    // Teleport depart animation at previous position
    if (this.isTeleporting && this.teleportPreviousPos) {
      const departInfo = this.characterRegistry.resolveAction(this.currentVariant, "teleport_depart");
      const departSvgUri = this.renderer.getSpriteSvgUri(
        this.currentVariant,
        departInfo.filename,
        departInfo.frames,
        departInfo.duration,
        departInfo.frameWidth,
        departInfo.frameHeight,
        this.directionManager.get(),
        true // one-shot
      );
      if (departSvgUri) {
        const prevRange = new vscode.Range(this.teleportPreviousPos, this.teleportPreviousPos);
        editor.setDecorations(this.teleportDepartDecorationType, [
          {
            range: prevRange,
            hoverMessage: "OPIT Companion Teleport Depart 🌀",
            renderOptions: {
              after: {
                contentIconPath: departSvgUri,
                width: `${renderWidth}px`,
                height: `${renderHeight}px`,
                margin: marginStr,
              },
            },
          },
        ]);
      }
    }

    // Main character decoration at cursor position
    const range = new vscode.Range(activePosition, activePosition);
    editor.setDecorations(this.decorationType, [
      {
        range,
        hoverMessage: `OPIT Companion 👾 (${this.currentState})`,
        renderOptions: {
          after: {
            contentIconPath: svgUri,
            width: `${renderWidth}px`,
            height: `${renderHeight}px`,
            margin: marginStr,
          },
        },
      },
    ]);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────

  private clearDepartDecoration() {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.teleportDepartDecorationType, []);
    }
  }

  public clearActiveDecoration() {
    this.lastRenderKey = "";
    this.clearDepartDecoration();
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.decorationType, []);
    }
  }

  public dispose() {
    this.cancelIdleCombo();
    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
      this.transientTimer = null;
    }
    if (this.teleportTimer) {
      clearTimeout(this.teleportTimer);
      this.teleportTimer = null;
    }
    this.clearActiveDecoration();
    this.decorationType.dispose();
    this.teleportDepartDecorationType.dispose();
  }
}
