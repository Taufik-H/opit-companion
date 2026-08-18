import * as vscode from "vscode";
import { InlineCompanion } from "./InlineCompanion";

export type OpitState =
  | "idle"
  | "typing"
  | "delete"
  | "bulk_delete"
  | "slow_attack"
  | "fast_attack"
  | "climb"
  | "jump"
  | "teleport"
  | "teleport_end"
  | "enter"
  | "arrow_up"
  | "arrow_down"
  | "arrow_left"
  | "arrow_right"
  | "arrow_horizontal"
  | "save"
  | "error"
  | "run"
  | "death"
  | "stuck_down"
  | "stuck_left";

export type StateChangeCallback = (
  state: OpitState,
  isEventTriggered?: boolean,
  metadata?: any
) => void;

export class EditorObserver {
  private idleTimer: NodeJS.Timeout | null = null;
  private lastTypeTime: number = 0;
  private lastDeleteTime: number = 0;
  private lastEnterTime: number = 0;
  private previousLine: number = 0;
  private previousChar: number = 0;
  private onStateChangeCallback: StateChangeCallback;

  constructor(
    onStateChange: StateChangeCallback,
    private readonly inlineCompanion?: InlineCompanion
  ) {
    this.onStateChangeCallback = onStateChange;
  }

  public registerListeners(context: vscode.ExtensionContext) {
    // 1. Text Document Change (Typing, Deleting, Enter)
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (!e.contentChanges.length) return;

        const now = Date.now();

        let isEnter = false;
        let hasDeletion = false;
        let totalDeleted = 0;
        let totalInserted = 0;

        for (const change of e.contentChanges) {
          if (change.text.includes("\n") || change.text.includes("\r")) {
            isEnter = true;
          } else if (change.rangeLength > 0 && change.text === "") {
            hasDeletion = true;
            totalDeleted += change.rangeLength;
          } else if (change.text.length > 0) {
            totalInserted += change.text.length;
          }
        }

        if (isEnter) {
          this.lastEnterTime = now;
          this.lastTypeTime = now;
          this.emitState("enter", true);
          this.resetIdleTimer(300);
        } else if (hasDeletion) {
          // Deleting uses attack.png
          this.lastDeleteTime = now;
          this.emitState("delete", true);
          this.resetIdleTimer(350);
        } else if (totalInserted > 0) {
          // Typing uses walk.png
          this.lastTypeTime = now;
          this.emitState("typing", true);
          this.resetIdleTimer(150);
        }
      })
    );

    // 2. Selection Navigation & Instant Realtime Cursor Synchronization
    context.subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        const now = Date.now();
        const activePos = e.selections[0]?.active;
        if (!activePos) return;

        const lineDelta = activePos.line - this.previousLine;
        const charDelta = activePos.character - this.previousChar;
        const isMouseClick = e.kind === vscode.TextEditorSelectionChangeKind.Mouse;
        const isTeleportJump = isMouseClick || (Math.abs(lineDelta) > 2 || Math.abs(charDelta) > 10);

        if (isTeleportJump && (Math.abs(lineDelta) > 0 || Math.abs(charDelta) > 1)) {
          const previousPos = new vscode.Position(this.previousLine, this.previousChar);
          this.emitState("teleport", true, { previousPos, newPos: activePos });
          this.resetIdleTimer(500);
        } else if (lineDelta !== 0 || charDelta !== 0) {
          // Guard: if typing, deleting, or enter occurred recently, preserve action animation instead of overwriting with arrow keys
          const isRecentDelete = now - this.lastDeleteTime < 250;
          const isRecentType = now - this.lastTypeTime < 250;
          const isRecentEnter = now - this.lastEnterTime < 350;

          if (!isRecentDelete && !isRecentType && !isRecentEnter) {
            if (lineDelta < 0) {
              this.emitState("arrow_up", true);
              this.resetIdleTimer(540);
            } else if (lineDelta > 0) {
              this.emitState("arrow_down", true);
              this.resetIdleTimer(280);
            } else if (charDelta < 0) {
              this.emitState("arrow_left", true);
              this.resetIdleTimer(160);
            } else if (charDelta > 0) {
              this.emitState("arrow_right", true);
              this.resetIdleTimer(160);
            }
          } else {
            this.inlineCompanion?.onCursorPositionChanged();
          }
        } else {
          this.inlineCompanion?.onCursorPositionChanged();
        }

        this.previousLine = activePos.line;
        this.previousChar = activePos.character;
      })
    );

    // 3. File Save Event
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(() => {
        this.emitState("save", true);
        this.resetIdleTimer(1500);
      })
    );

    // 4. Active Tab / Editor Change
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.previousLine = editor.selection.active.line;
          this.previousChar = editor.selection.active.character;
          this.evaluateCurrentState();
          this.inlineCompanion?.onCursorPositionChanged();
        } else {
          // If focus shifted to sidebar webview, only clear if there are truly no visible editors left
          if (vscode.window.visibleTextEditors.length === 0) {
            this.inlineCompanion?.clearActiveDecoration();
          }
        }
      })
    );

    // 5. Diagnostic / Linter Error Event
    context.subscriptions.push(
      vscode.languages.onDidChangeDiagnostics(() => {
        const now = Date.now();
        // Do not interrupt active typing, deleting, or navigation with error reactions
        if (now - this.lastTypeTime < 1500 || now - this.lastDeleteTime < 1500) {
          return;
        }

        if (this.hasActiveError()) {
          this.emitState("error");
          this.resetIdleTimer(2500);
        }
      })
    );

    // Initial evaluation
    const initialEditor = vscode.window.activeTextEditor;
    if (initialEditor) {
      this.previousLine = initialEditor.selection.active.line;
      this.previousChar = initialEditor.selection.active.character;
    }
    this.evaluateCurrentState();
  }

  public evaluateCurrentState() {
    this.emitState("idle");
  }

  public hasActiveError(): boolean {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return false;

    const diagnostics = vscode.languages.getDiagnostics(activeEditor.document.uri);
    return diagnostics.some(
      (d) => d.severity === vscode.DiagnosticSeverity.Error
    );
  }

  private resetIdleTimer(delayMs: number = 150) {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.evaluateCurrentState();
    }, delayMs);
  }

  private emitState(state: OpitState, isEventTriggered: boolean = false, metadata?: any) {
    this.onStateChangeCallback(state, isEventTriggered, metadata);
  }

  public dispose() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
  }
}
