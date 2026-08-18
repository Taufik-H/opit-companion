import { EditorSettingsManager } from "./EditorSettingsManager";
import * as vscode from "vscode";
import { OpitState } from "./EditorObserver";
import { SpriteInfo } from "./SpriteConfig";
import { SpriteRenderer } from "./SpriteRenderer";
import { DirectionManager } from "./DirectionManager";
import { CharacterRegistry } from "./CharacterRegistry";

// ─── Idle Combo Timing ────────────────────────────────────────────────
// After 3 seconds of idle, the character performs its available idle combos,
// then returns to idle and waits 3 seconds again (if idle combos exist).
const IDLE_COMBO_DELAY_MS = 3000;

export class InlineCompanion {
  private decorationType: vscode.TextEditorDecorationType;
  private teleportDepartDecorationType: vscode.TextEditorDecorationType;

  // State
  private currentState: OpitState = "idle";
  private currentVariant: string = "pink";
  private isEnabled: boolean = true;
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
    // Absolute Baseline Anchoring: position absolute out-of-flow ensures line height NEVER stretches!
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        textDecoration: "none; position: absolute; bottom: 0; z-index: 99999; pointer-events: none;",
      },
    });
    this.teleportDepartDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        textDecoration: "none; position: absolute; bottom: 0; z-index: 99999; pointer-events: none;",
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

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearActiveDecoration();
      this.clearDepartDecoration();
      this.cancelIdleCombo();
      EditorSettingsManager.setCursorVisibility(true);
    } else {
      const config = vscode.workspace.getConfiguration("opit");
      const showCursor = config.get<boolean>("showCursor", false);
      EditorSettingsManager.setCursorVisibility(showCursor);
      this.startIdleDelay();
      this.renderCurrentFrame(true);
    }
  }

  public toggleEnabled(): boolean {
    const next = !this.isEnabled;
    this.setEnabled(next);
    return next;
  }

  public setVariant(variant: string) {
    this.currentVariant = variant;
    this.cancelIdleCombo();
    this.renderer.clearCache();
    this.lastRenderKey = "";
    this.renderCurrentFrame(true);
    if (this.currentState === "idle") {
      this.startIdleDelay();
    }
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

    this.cancelIdleCombo();
    this.renderer.updateSettings(displaySize, this.animationSpeed);
    this.renderer.clearCache();
    this.lastRenderKey = "";
    this.renderCurrentFrame(true);
    if (this.currentState === "idle") {
      this.startIdleDelay();
    }
  }

  // ─── State Management ──────────────────────────────────────────────

  public setState(state: OpitState, isEventTriggered: boolean = false, metadata?: any) {
    // Teleport with instant reactivity (cancel existing teleport timer and start fresh immediately)
    if (state === "teleport") {
      this.cancelIdleCombo();
      if (this.teleportTimer) {
        clearTimeout(this.teleportTimer);
        this.teleportTimer = null;
      }
      this.clearDepartDecoration();

      this.isTeleporting = true;
      const editor = vscode.window.activeTextEditor ?? this.lastActiveEditor;
      this.teleportPreviousPos = metadata?.previousPos ?? (editor ? editor.selection.active : null);
      this.currentState = "teleport";
      this.lastRenderKey = ""; // Force fresh render for teleport
      this.renderCurrentFrame(true);

      // Clean up previous position smoke poof after 240ms
      setTimeout(() => {
        this.clearDepartDecoration();
      }, 240);

      this.teleportTimer = setTimeout(() => {
        this.isTeleporting = false;
        this.teleportPreviousPos = null;
        this.clearDepartDecoration();
        this.currentState = "idle";
        this.renderCurrentFrame(true);
        this.startIdleDelay();
      }, 480);
      return;
    }

    // If an explicit user interaction occurs while teleporting, instantly cancel teleport and yield to user action
    if (this.isTeleporting) {
      if (isEventTriggered) {
        this.isTeleporting = false;
        if (this.teleportTimer) {
          clearTimeout(this.teleportTimer);
          this.teleportTimer = null;
        }
        this.clearDepartDecoration();
      } else {
        this.onCursorPositionChanged();
        return;
      }
    }

    // Any non-idle state immediately cancels pending delay timers and active idle combos
    if (state !== "idle") {
      this.cancelIdleCombo();
    }

    // Clear existing transient timer
    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
      this.transientTimer = null;
    }

    // Update facing direction
    this.directionManager.update(state);

    // If already in a stuck state and a repeat trigger arrives (user holding down/left arrow)
    if ((state === "stuck_left" || state === "stuck_down") && this.currentState === state) {
      if (this.transientTimer) {
        clearTimeout(this.transientTimer);
      }
      this.transientTimer = setTimeout(() => {
        if (this.currentState === state) {
          this.currentState = "idle";
          this.lastRenderKey = "";
          this.renderCurrentFrame(true);
          this.startIdleDelay();
        }
      }, 250);
      return;
    }

    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
      this.transientTimer = null;
    }

    // Skip redundant state updates
    if (this.currentState === state && !isEventTriggered) {
      return;
    }

    if (isEventTriggered) {
      this.lastRenderKey = ""; // Force fresh render on explicit user events
    }

    this.currentState = state;
    this.renderCurrentFrame(isEventTriggered);

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
      }, Math.max(300, durationMs));
    } else if (state === "idle") {
      // Start idle combo delay when entering idle
      this.startIdleDelay();
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
   * If the character has no idle combo files on disk, no timer is set.
   */
  private startIdleDelay() {
    this.cancelIdleCombo();
    const idleCombos = this.characterRegistry.getIdleCombos(this.currentVariant);
    if (idleCombos.length === 0) {
      return; // No idle combos exist for this character; stays in normal idle permanently
    }

    this.idleDelayTimer = setTimeout(() => {
      this.startIdleCombo();
    }, IDLE_COMBO_DELAY_MS);
  }

  /**
   * Begins the idle combo sequence for the current character:
   * Plays each available combo step (1..N) sequentially.
   */
  private startIdleCombo() {
    const idleCombos = this.characterRegistry.getIdleCombos(this.currentVariant);
    if (idleCombos.length === 0) {
      this.cancelIdleCombo();
      return;
    }

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

    const idleCombos = this.characterRegistry.getIdleCombos(this.currentVariant);
    if (this.idleComboStepIndex >= idleCombos.length) {
      this.cancelIdleCombo();
      this.currentState = "idle";
      this.lastRenderKey = "";
      this.renderCurrentFrame(true);
      this.startIdleDelay();
      return;
    }

    const step = idleCombos[this.idleComboStepIndex];
    const durationMs = (step.duration * 1000) / this.animationSpeed;

    this.idleComboTimer = setTimeout(() => {
      this.idleComboStepIndex++;

      const currentCombos = this.characterRegistry.getIdleCombos(this.currentVariant);
      if (this.idleComboStepIndex >= currentCombos.length) {
        // Combo sequence finished — return to idle and restart the 3-second delay
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
    // Idle combo override — use the current character's resolved combo step
    if (this.isPlayingIdleCombo && this.idleComboStepIndex >= 0) {
      const idleCombos = this.characterRegistry.getIdleCombos(this.currentVariant);
      if (this.idleComboStepIndex < idleCombos.length) {
        const step = idleCombos[this.idleComboStepIndex];
        return {
          info: step,
          oneShot: true, // Each combo step plays exactly once
          reverse: false,
        };
      }
    }

    // Normal state via CharacterRegistry with tiered fallback
    const isTeleport = this.currentState === "teleport";
    const isOneShot =
      isTeleport ||
      this.currentState === "stuck_left" ||
      this.currentState === "stuck_down" ||
      this.currentState === "arrow_up" ||
      this.currentState === "arrow_down" ||
      this.currentState === "jump" ||
      this.currentState === "save" ||
      this.currentState === "enter";
    const resolved = this.characterRegistry.resolveAction(this.currentVariant, this.currentState);

    return {
      info: resolved,
      oneShot: isOneShot,
      reverse: false,
    };
  }

  public renderCurrentFrame(force: boolean = false) {
    if (!this.isEnabled) {
      this.clearActiveDecoration();
      this.clearDepartDecoration();
      return;
    }
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
    const currentDir = this.directionManager.get();

    const svgUri = this.renderer.getSpriteSvgUri(
      this.currentVariant,
      info.filename,
      info.frames,
      info.duration,
      info.frameWidth,
      info.frameHeight,
      currentDir,
      oneShot,
      reverse,
      info.startFrame ?? 0,
      info.playFrames
    );
    if (!svgUri) return;

    const activePosition = editor.selection.active;
    const { width: renderWidth, height: renderHeight } = this.renderer.getRenderDimensions(
      info.frameWidth,
      info.frameHeight
    );

    // Dynamically detect editor line height & font size for pixel-perfect baseline tracking
    const editorConfig = vscode.workspace.getConfiguration("editor", editor.document.uri);
    const fontSize = editorConfig.get<number>("fontSize", 14);
    const rawLineHeight = editorConfig.get<number>("lineHeight", 0);
    const effectiveLineHeight = rawLineHeight > 0 ? rawLineHeight : Math.round(fontSize * 1.4);

    const asymmetryX = this.characterRegistry.getAsymmetryX(this.currentVariant);
    const marginStr = this.renderer.getMarginString(
      info.frameWidth,
      info.frameHeight,
      effectiveLineHeight,
      currentDir,
      asymmetryX
    );

    // Deduplication — skip identical renders (include combo step for uniqueness)
    const comboKey = this.isPlayingIdleCombo ? `combo:${this.idleComboStepIndex}` : "";
    const renderKey = `${editor.document.uri.toString()}:${activePosition.line}:${activePosition.character}:${this.currentState}:${this.directionManager.get()}:${renderWidth}:${comboKey}`;
    if (!force && renderKey === this.lastRenderKey) {
      return;
    }
    this.lastRenderKey = renderKey;

    // Universal Smoke Poof: Depart animation at previous position
    if (this.isTeleporting && this.teleportPreviousPos) {
      const departSvgUri = this.renderer.getTeleportDepartCompositeSvgUri(
        this.currentVariant,
        info.filename,
        info.frames,
        info.frameWidth,
        info.frameHeight,
        currentDir,
        0.26
      );
      if (departSvgUri) {
        const prevRange = new vscode.Range(this.teleportPreviousPos, this.teleportPreviousPos);
        editor.setDecorations(this.teleportDepartDecorationType, [
          {
            range: prevRange,
            hoverMessage: "OPIT Companion Smoke Vanish 💨",
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

    // Determine active SVG URI (use composite arrival smoke if teleporting)
    let activeSvgUri = svgUri;
    if (this.isTeleporting) {
      const compositeArriveSvg = this.renderer.getTeleportArrivalCompositeSvgUri(
        this.currentVariant,
        info.filename,
        info.frames,
        info.frameWidth,
        info.frameHeight,
        this.directionManager.get(),
        info.duration,
        info.startFrame ?? 0,
        info.playFrames
      );
      if (compositeArriveSvg) {
        activeSvgUri = compositeArriveSvg;
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
            contentIconPath: activeSvgUri,
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
