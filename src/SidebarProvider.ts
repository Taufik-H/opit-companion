import * as vscode from "vscode";
import { OpitState } from "./EditorObserver";
import { InlineCompanion } from "./InlineCompanion";
import { CharacterRegistry, CharacterPreviewData } from "./CharacterRegistry";
import { EditorSettingsManager } from "./EditorSettingsManager";

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "opit.sidebarView";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly inlineCompanion: InlineCompanion,
    private readonly characterRegistry: CharacterRegistry,
    private readonly onApplySettings: () => Promise<void>
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview();

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.syncCurrentConfig();
      }
    });

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case "ready": {
          this.syncCurrentConfig();
          break;
        }
        case "setVariant": {
          // Instant direct render on active editor
          this.inlineCompanion.setVariant(data.variant);
          const config = vscode.workspace.getConfiguration("opit");
          await config.update("variant", data.variant, vscode.ConfigurationTarget.Global);
          break;
        }
        case "setDisplaySize": {
          const num = Number(data.value);
          if (!isNaN(num)) {
            // Instant direct render on active editor
            this.inlineCompanion.setDisplaySize(num);
            const config = vscode.workspace.getConfiguration("opit");
            await config.update("displaySize", num, vscode.ConfigurationTarget.Global);
          }
          break;
        }
        case "setAnimationSpeed": {
          const num = Number(data.value);
          if (!isNaN(num)) {
            // Instant direct render on active editor
            this.inlineCompanion.setAnimationSpeed(num);
            const config = vscode.workspace.getConfiguration("opit");
            await config.update("animationSpeed", num, vscode.ConfigurationTarget.Global);
          }
          break;
        }
        case "setShowCursor": {
          const showCursor = Boolean(data.value);
          const config = vscode.workspace.getConfiguration("opit");
          await config.update("showCursor", showCursor, vscode.ConfigurationTarget.Global);
          await EditorSettingsManager.setCursorVisibility(showCursor);
          break;
        }
        case "testReaction": {
          this.inlineCompanion.setState(data.state as OpitState, true);
          break;
        }
        case "applySettings": {
          await this.onApplySettings();
          vscode.window.showInformationMessage("OPIT Companion: Clean cursor settings applied across all IDE windows! 👾✨");
          break;
        }
        case "refresh": {
          this.characterRegistry.scan();
          if (this._view) {
            this._view.webview.html = this.getHtmlForWebview();
          }
          this.syncCurrentConfig();
          break;
        }
      }
    });

    // Send initial config
    this.syncCurrentConfig();
  }

  public syncCurrentConfig() {
    if (!this._view) return;
    const config = vscode.workspace.getConfiguration("opit");
    const variant = config.get<string>("variant", "pink");
    const displaySize = config.get<number>("displaySize", 22);
    const animationSpeed = config.get<number>("animationSpeed", 1.0);
    const showCursor = config.get<boolean>("showCursor", true);

    this._view.webview.postMessage({
      command: "syncSettings",
      variant,
      displaySize,
      animationSpeed,
      showCursor,
    });
  }

  private getHtmlForWebview(): string {
    const characters: CharacterPreviewData[] = this.characterRegistry.getPreviewList();
    const config = vscode.workspace.getConfiguration("opit");
    const currentVariant = config.get<string>("variant", "pink");
    const currentDisplaySize = config.get<number>("displaySize", 22);
    const currentAnimationSpeed = config.get<number>("animationSpeed", 1.0);
    const currentShowCursor = config.get<boolean>("showCursor", true);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OPIT Companion</title>
  <style>
    :root {
      --bg-card: var(--vscode-sideBar-background, #1e1e2e);
      --card-border: var(--vscode-panel-border, rgba(255, 255, 255, 0.1));
      --text-main: var(--vscode-foreground, #e2e8f0);
      --text-muted: var(--vscode-descriptionForeground, #94a3b8);
      --accent: var(--vscode-focusBorder, #6366f1);
      --button-bg: var(--vscode-button-background, #4f46e5);
      --button-fg: var(--vscode-button-foreground, #ffffff);
      --button-hover: var(--vscode-button-hoverBackground, #4338ca);
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }

    body {
      font-family: var(--font-family);
      color: var(--text-main);
      background: transparent;
      padding: 12px;
      line-height: 1.4;
      font-size: 12px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--card-border);
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.5px;
    }

    .header-tag {
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      border: 1px solid rgba(99, 102, 241, 0.4);
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* ─── Dynamic Scalable Horizontal Character Grid (Ke Kanan) ─── */
    .char-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
      gap: 8px;
      margin-bottom: 16px;
    }

    .char-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 8px 4px 6px 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      position: relative;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }

    .char-card:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.25);
      transform: translateY(-2px);
    }

    .char-card.active {
      border-color: var(--card-accent, #6366f1);
      background: var(--card-glow, rgba(99, 102, 241, 0.15));
      box-shadow: 0 0 12px var(--card-glow, rgba(99, 102, 241, 0.3));
    }

    .char-card.active::before {
      content: "✓";
      position: absolute;
      top: 4px;
      right: 4px;
      width: 14px;
      height: 14px;
      background: var(--card-accent, #6366f1);
      color: #fff;
      font-size: 9px;
      font-weight: bold;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .sprite-viewport {
      width: 42px;
      height: 42px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      margin-bottom: 6px;
      position: relative;
    }

    /* Continuous CSS Step Animation from idle.png (4 frames of 42px = 168px) */
    .sprite-anim {
      width: 42px;
      height: 42px;
      background-repeat: no-repeat;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      animation: play-idle 0.68s steps(4) infinite;
    }

    @keyframes play-idle {
      0% {
        background-position: 0px 0px;
      }
      100% {
        background-position: -168px 0px;
      }
    }

    .char-info {
      text-align: center;
      width: 100%;
    }

    .char-name {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .char-badge {
      font-size: 9px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    /* ─── Settings Controls ─── */
    .control-group {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 14px;
    }

    .control-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 10px;
    }

    .control-row:last-child {
      margin-bottom: 0;
    }

    .control-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .control-label {
      font-size: 11px;
      color: var(--text-main);
      font-weight: 500;
    }

    .control-val {
      font-size: 11px;
      color: var(--text-muted);
      font-family: monospace;
      background: rgba(255, 255, 255, 0.05);
      padding: 1px 5px;
      border-radius: 3px;
    }

    input[type="range"] {
      width: 100%;
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.15);
      outline: none;
      -webkit-appearance: none;
      cursor: pointer;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
    }

    /* ─── Sleek Modern Switch for Show/Hide Cursor ─── */
    .switch {
      position: relative;
      display: inline-block;
      width: 32px;
      height: 18px;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .switch-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.18);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 18px;
    }

    .switch-slider:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 2px;
      bottom: 2px;
      background-color: #ffffff;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .switch input:checked + .switch-slider {
      background-color: var(--accent);
    }

    .switch input:checked + .switch-slider:before {
      transform: translateX(14px);
    }

    /* ─── Action & Reaction Buttons ─── */
    .btn-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }

    .btn {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
      border: 1px solid var(--card-border);
      border-radius: 5px;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.15s ease;
    }

    .btn:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.25);
    }

    .btn:active {
      transform: scale(0.97);
    }

    .btn-primary {
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      width: 100%;
      padding: 8px;
      font-weight: 600;
      border-radius: 6px;
    }

    .btn-primary:hover {
      background: var(--button-hover);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">
      <span>👾</span>
      <span>OPIT Companion</span>
    </div>
    <span class="header-tag">Live 60 FPS</span>
  </div>

  <div class="section-title">
    <span>Choose Companion</span>
    <span style="font-size: 9px; opacity: 0.7;">Grid (→)</span>
  </div>

  <!-- Scalable Dynamic Grid of Character Cards with Animated idle.png -->
  <div class="char-grid" id="charGrid">
    ${characters
      .map(
        (c) => `
      <div 
        class="char-card ${c.id === currentVariant ? "active" : ""}" 
        data-variant="${c.id}"
        style="--card-accent: ${c.color}; --card-glow: ${c.bgGlow};"
        onclick="selectVariant('${c.id}')"
        title="Select ${c.name} (${c.badge})"
      >
        <div class="sprite-viewport">
          <div class="sprite-anim" style="background-image: url('${c.base64Idle}');"></div>
        </div>
        <div class="char-info">
          <div class="char-name">${c.name}</div>
          <div class="char-badge">${c.badge}</div>
        </div>
      </div>
    `
      )
      .join("")}
  </div>

  <div class="section-title">
    <span>Configuration</span>
  </div>

  <div class="control-group">
    <!-- Show/Hide Native Cursor Switch -->
    <div class="control-row">
      <div class="control-label-row">
        <span class="control-label">Show Native Cursor</span>
        <label class="switch" title="Toggle native editor cursor visibility">
          <input 
            type="checkbox" 
            id="cursorToggle" 
            ${currentShowCursor ? "checked" : ""} 
            onchange="toggleCursor(this.checked)"
          />
          <span class="switch-slider"></span>
        </label>
      </div>
    </div>

    <div class="control-row">
      <div class="control-label-row">
        <span class="control-label">Display Size</span>
        <span class="control-val" id="sizeVal">${currentDisplaySize}px</span>
      </div>
      <input 
        type="range" 
        id="sizeSlider" 
        min="16" 
        max="48" 
        step="1" 
        value="${currentDisplaySize}"
        oninput="updateDisplaySize(this.value)"
      />
    </div>

    <div class="control-row">
      <div class="control-label-row">
        <span class="control-label">Animation Speed</span>
        <span class="control-val" id="speedVal">${currentAnimationSpeed.toFixed(1)}x</span>
      </div>
      <input 
        type="range" 
        id="speedSlider" 
        min="0.5" 
        max="2.5" 
        step="0.1" 
        value="${currentAnimationSpeed}"
        oninput="updateSpeed(this.value)"
      />
    </div>
  </div>

  <div class="section-title">
    <span>Test Reactions</span>
  </div>

  <div class="btn-grid">
    <button class="btn" onclick="testReaction('save')">🎉 Save</button>
    <button class="btn" onclick="testReaction('error')">🤒 Error</button>
    <button class="btn" onclick="testReaction('delete')">⚔️ Slash</button>
    <button class="btn" onclick="testReaction('jump')">🦘 Jump</button>
    <button class="btn" onclick="testReaction('stuck_down')">⬇️ Squat</button>
    <button class="btn" onclick="testReaction('teleport')">💨 Poof</button>
  </div>

  <button class="btn btn-primary" onclick="applySettings()" style="margin-top: 4px;">
    ✨ Apply Clean Cursor Settings
  </button>

  <script>
    const vscode = acquireVsCodeApi();

    // Signal ready immediately to sync configuration
    vscode.postMessage({ command: 'ready' });

    function selectVariant(variant) {
      document.querySelectorAll('.char-card').forEach(card => {
        if (card.dataset.variant === variant) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
      vscode.postMessage({ command: 'setVariant', variant: variant });
    }

    function toggleCursor(checked) {
      vscode.postMessage({ command: 'setShowCursor', value: checked });
    }

    function updateDisplaySize(val) {
      document.getElementById('sizeVal').innerText = val + 'px';
      vscode.postMessage({ command: 'setDisplaySize', value: val });
    }

    function updateSpeed(val) {
      const num = parseFloat(val).toFixed(1);
      document.getElementById('speedVal').innerText = num + 'x';
      vscode.postMessage({ command: 'setAnimationSpeed', value: val });
    }

    function testReaction(state) {
      vscode.postMessage({ command: 'testReaction', state: state });
    }

    function applySettings() {
      vscode.postMessage({ command: 'applySettings' });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'syncSettings') {
        if (message.variant) {
          document.querySelectorAll('.char-card').forEach(card => {
            if (card.dataset.variant === message.variant) {
              card.classList.add('active');
            } else {
              card.classList.remove('active');
            }
          });
        }
        if (message.displaySize !== undefined) {
          const slider = document.getElementById('sizeSlider');
          const valDisplay = document.getElementById('sizeVal');
          if (slider) slider.value = message.displaySize;
          if (valDisplay) valDisplay.innerText = message.displaySize + 'px';
        }
        if (message.animationSpeed !== undefined) {
          const slider = document.getElementById('speedSlider');
          const valDisplay = document.getElementById('speedVal');
          if (slider) slider.value = message.animationSpeed;
          if (valDisplay) valDisplay.innerText = parseFloat(message.animationSpeed).toFixed(1) + 'x';
        }
        if (message.showCursor !== undefined) {
          const cursorToggle = document.getElementById('cursorToggle');
          if (cursorToggle) cursorToggle.checked = Boolean(message.showCursor);
        }
      }
    });
  </script>
</body>
</html>`;
  }
}
