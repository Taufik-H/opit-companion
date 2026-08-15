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
        case "setEnabled": {
          const enabled = Boolean(data.value);
          this.inlineCompanion.setEnabled(enabled);
          const config = vscode.workspace.getConfiguration("opit");
          await config.update("enabled", enabled, vscode.ConfigurationTarget.Global);
          break;
        }
        case "setVariant": {
          this.inlineCompanion.setVariant(data.variant);
          const config = vscode.workspace.getConfiguration("opit");
          await config.update("variant", data.variant, vscode.ConfigurationTarget.Global);
          break;
        }
        case "setDisplaySize": {
          const num = Number(data.value);
          if (!isNaN(num)) {
            this.inlineCompanion.setDisplaySize(num);
            const config = vscode.workspace.getConfiguration("opit");
            await config.update("displaySize", num, vscode.ConfigurationTarget.Global);
          }
          break;
        }
        case "setAnimationSpeed": {
          const num = Number(data.value);
          if (!isNaN(num)) {
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
          vscode.window.showInformationMessage("OPIT Companion: Settings applied.");
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

    this.syncCurrentConfig();
  }

  public syncCurrentConfig() {
    if (!this._view) return;
    const config = vscode.workspace.getConfiguration("opit");
    const enabled = config.get<boolean>("enabled", true);
    const variant = config.get<string>("variant", "pink");
    const displaySize = config.get<number>("displaySize", 22);
    const animationSpeed = config.get<number>("animationSpeed", 1.0);
    const showCursor = config.get<boolean>("showCursor", false);

    this._view.webview.postMessage({
      command: "syncSettings",
      enabled,
      variant,
      displaySize,
      animationSpeed,
      showCursor,
    });
  }

  private getHtmlForWebview(): string {
    const characters: CharacterPreviewData[] = this.characterRegistry.getPreviewList();
    const config = vscode.workspace.getConfiguration("opit");
    const currentEnabled = config.get<boolean>("enabled", true);
    const currentVariant = config.get<string>("variant", "pink");
    const currentDisplaySize = config.get<number>("displaySize", 22);
    const currentAnimationSpeed = config.get<number>("animationSpeed", 1.0);
    const currentShowCursor = config.get<boolean>("showCursor", false);

    // Build dynamic CSS animation rules for each character
    const dynamicKeyframes = characters
      .map((c) => {
        const scale = 36 / (c.frameHeight || 42);
        const scaledFrameWidth = Math.round((c.frameWidth || 42) * scale);
        const scaledFrameHeight = Math.round((c.frameHeight || 42) * scale);
        const totalScaledWidth = scaledFrameWidth * (c.idleFrames || 4);
        return `@keyframes play-idle-${c.id} {
          from { background-position: 0px 0px; }
          to { background-position: -${totalScaledWidth}px 0px; }
        }`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OPIT Companion</title>
  <style>
    :root {
      --bg: var(--vscode-sideBar-background, #18181b);
      --surface: rgba(255, 255, 255, 0.04);
      --surface-hover: rgba(255, 255, 255, 0.08);
      --border: var(--vscode-panel-border, rgba(255, 255, 255, 0.08));
      --border-focus: var(--vscode-focusBorder, #6366f1);
      --text: var(--vscode-foreground, #f4f4f5);
      --text-muted: var(--vscode-descriptionForeground, #a1a1aa);
      --btn-bg: var(--vscode-button-background, #4f46e5);
      --btn-fg: var(--vscode-button-foreground, #ffffff);
      --btn-hover: var(--vscode-button-hoverBackground, #4338ca);
      --font-mono: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      color: var(--text);
      background: transparent;
      padding: 12px 10px;
      line-height: 1.4;
      font-size: 11px;
    }

    /* ─── Header ─── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .header-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: var(--text);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9.5px;
      font-family: var(--font-mono);
      padding: 1px 5px;
      border-radius: 3px;
      transition: all 0.2s ease;
    }

    .header-status.active {
      color: #34d399;
      background: rgba(52, 211, 153, 0.08);
      border: 1px solid rgba(52, 211, 153, 0.15);
    }

    .header-status.inactive {
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .header-status-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #34d399;
      transition: background 0.2s ease;
    }

    .header-status.inactive .header-status-dot {
      background: #71717a;
    }

    /* ─── Filter Tabs ─── */
    .filter-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .filter-tab {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 2px 7px;
      font-size: 9.5px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.12s ease;
    }

    .filter-tab:hover {
      background: var(--surface-hover);
      color: var(--text);
    }

    .filter-tab.active {
      background: var(--border-focus);
      color: #ffffff;
      border-color: var(--border-focus);
    }

    /* ─── Section Label ─── */
    .section-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .section-count {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--text-muted);
    }

    /* ─── Character Grid ─── */
    .char-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 14px;
      max-height: 220px;
      overflow-y: auto;
      padding-right: 2px;
    }

    .char-grid::-webkit-scrollbar {
      width: 4px;
    }
    .char-grid::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 2px;
    }

    .char-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 6px 3px;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      position: relative;
      transition: all 0.15s ease;
    }

    .char-card:hover {
      background: var(--surface-hover);
      border-color: rgba(255, 255, 255, 0.18);
    }

    .char-card.active {
      border-color: var(--card-accent, var(--border-focus));
      background: rgba(255, 255, 255, 0.06);
    }

    .char-indicator {
      display: none;
      position: absolute;
      top: 3px;
      right: 3px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--card-accent, var(--border-focus));
    }

    .char-card.active .char-indicator {
      display: block;
    }

    .sprite-viewport {
      width: 36px;
      height: 36px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
    }

    .sprite-anim {
      background-repeat: no-repeat;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }

    .char-name {
      font-size: 9.5px;
      font-weight: 500;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      text-align: center;
    }

    .char-badge {
      font-size: 8px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-top: 1px;
    }

    /* ─── Configuration Deck ─── */
    .config-deck {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 8px 10px;
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .config-row {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .config-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .config-title {
      font-size: 10.5px;
      font-weight: 500;
      color: var(--text);
    }

    .config-badge {
      font-size: 9.5px;
      font-family: var(--font-mono);
      color: var(--text-muted);
    }

    input[type="range"] {
      width: 100%;
      height: 3px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.12);
      outline: none;
      -webkit-appearance: none;
      cursor: pointer;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--text);
      cursor: pointer;
    }

    /* ─── Switch ─── */
    .switch {
      position: relative;
      display: inline-block;
      width: 26px;
      height: 14px;
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
      background-color: rgba(255, 255, 255, 0.15);
      transition: background-color 0.15s ease;
      border-radius: 14px;
    }

    .switch-slider:before {
      position: absolute;
      content: "";
      height: 10px;
      width: 10px;
      left: 2px;
      bottom: 2px;
      background-color: #ffffff;
      transition: transform 0.15s ease;
      border-radius: 50%;
    }

    .switch input:checked + .switch-slider {
      background-color: var(--btn-bg);
    }

    .switch input:checked + .switch-slider:before {
      transform: translateX(12px);
    }

    /* ─── Actions Grid ─── */
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5px;
      margin-bottom: 12px;
    }

    .action-btn {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 6px 0;
      font-size: 10px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      text-align: center;
      transition: all 0.12s ease;
    }

    .action-btn:hover {
      background: var(--surface-hover);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .action-btn:active {
      transform: translateY(1px);
    }

    /* ─── Apply Button ─── */
    .apply-btn {
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: 1px solid transparent;
      border-radius: 4px;
      width: 100%;
      padding: 7px 10px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background-color 0.15s ease;
    }

    .apply-btn:hover {
      background: var(--btn-hover);
    }

    .apply-btn:active {
      transform: translateY(1px);
    }

    ${dynamicKeyframes}
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <span class="header-title">OPIT Companion</span>
      <span class="header-status ${currentEnabled ? "active" : "inactive"}" id="headerStatusPill">
        <span class="header-status-dot" id="headerStatusDot"></span>
        <span id="headerStatusText">${currentEnabled ? "Active" : "Inactive"}</span>
      </span>
    </div>
    <label class="switch" title="Toggle OPIT Companion Active / Inactive">
      <input 
        type="checkbox" 
        id="enabledToggle" 
        ${currentEnabled ? "checked" : ""} 
        onchange="toggleEnabled(this.checked)"
      />
      <span class="switch-slider"></span>
    </label>
  </div>

  <div class="section-label">
    <span>Choose Companion</span>
    <span class="section-count">${characters.length} Available</span>
  </div>

  <div class="filter-tabs">
    <button class="filter-tab active" onclick="filterClass('all')">All</button>
    <button class="filter-tab" onclick="filterClass('Retro')">Retro</button>
    <button class="filter-tab" onclick="filterClass('Werewolf')">Werewolf</button>
    <button class="filter-tab" onclick="filterClass('Ninja')">Ninja</button>
    <button class="filter-tab" onclick="filterClass('Knight')">Knight</button>
    <button class="filter-tab" onclick="filterClass('Mage')">Mage</button>
    <button class="filter-tab" onclick="filterClass('Orc')">Orc</button>
    <button class="filter-tab" onclick="filterClass('Slime')">Slime</button>
    <button class="filter-tab" onclick="filterClass('Warrior')">Warrior</button>
  </div>

  <div class="char-grid" id="charGrid">
    ${characters
      .map((c) => {
        const scale = 36 / (c.frameHeight || 42);
        const scaledFrameWidth = Math.round((c.frameWidth || 42) * scale);
        const scaledFrameHeight = Math.round((c.frameHeight || 42) * scale);
        const totalScaledWidth = scaledFrameWidth * (c.idleFrames || 4);
        const animDuration = ((c.idleFrames || 4) * 0.11).toFixed(2);

        return `
      <div 
        class="char-card ${c.id === currentVariant ? "active" : ""}" 
        data-variant="${c.id}"
        data-badge="${c.badge}"
        style="--card-accent: ${c.color};"
        onclick="selectVariant('${c.id}')"
        title="${c.name} (${c.badge})"
      >
        <span class="char-indicator"></span>
        <div class="sprite-viewport">
          <div 
            class="sprite-anim" 
            style="
              width: ${scaledFrameWidth}px; 
              height: ${scaledFrameHeight}px; 
              background-image: url('${c.base64Idle}'); 
              background-size: ${totalScaledWidth}px ${scaledFrameHeight}px; 
              animation: play-idle-${c.id} ${animDuration}s steps(${c.idleFrames || 4}, end) infinite;
            "
          ></div>
        </div>
        <div class="char-name">${c.name}</div>
        <div class="char-badge">${c.badge}</div>
      </div>
    `;
      })
      .join("")}
  </div>

  <div class="section-label">
    <span>Configuration</span>
  </div>

  <div class="config-deck">
    <div class="config-row">
      <div class="config-header-row">
        <span class="config-title">Native Cursor</span>
        <label class="switch" title="Toggle native editor text cursor">
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

    <div class="config-row">
      <div class="config-header-row">
        <span class="config-title">Display Size</span>
        <span class="config-badge" id="sizeVal">${currentDisplaySize}px</span>
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

    <div class="config-row">
      <div class="config-header-row">
        <span class="config-title">Animation Speed</span>
        <span class="config-badge" id="speedVal">${currentAnimationSpeed.toFixed(1)}x</span>
      </div>
      <input 
        type="range" 
        id="speedSlider" 
        min="0.5" 
        max="2.0" 
        step="0.1" 
        value="${currentAnimationSpeed}"
        oninput="updateSpeed(this.value)"
      />
    </div>
  </div>

  <div class="section-label">
    <span>Test Actions</span>
  </div>

  <div class="actions-grid">
    <button class="action-btn" onclick="testReaction('save')">Save</button>
    <button class="action-btn" onclick="testReaction('error')">Error</button>
    <button class="action-btn" onclick="testReaction('delete')">Slash</button>
    <button class="action-btn" onclick="testReaction('jump')">Jump</button>
    <button class="action-btn" onclick="testReaction('stuck_down')">Squat</button>
    <button class="action-btn" onclick="testReaction('teleport')">Poof</button>
  </div>

  <button class="apply-btn" onclick="applySettings()">
    Apply settings
  </button>

  <script>
    const vscode = acquireVsCodeApi();
    vscode.postMessage({ command: 'ready' });

    function filterClass(cls) {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');

      document.querySelectorAll('.char-card').forEach(card => {
        const badge = (card.dataset.badge || '').toLowerCase();
        const target = cls.toLowerCase();
        const isRetro = ['monster', 'hero', 'chocobo', 'retro'].includes(badge);

        if (target === 'all') {
          card.style.display = 'flex';
        } else if (target === 'retro') {
          card.style.display = isRetro ? 'flex' : 'none';
        } else if (badge === target) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function toggleEnabled(checked) {
      updateStatusUI(checked);
      vscode.postMessage({ command: 'setEnabled', value: checked });
    }

    function updateStatusUI(enabled) {
      const pill = document.getElementById('headerStatusPill');
      const text = document.getElementById('headerStatusText');
      const toggle = document.getElementById('enabledToggle');
      if (pill && text) {
        if (enabled) {
          pill.className = 'header-status active';
          text.innerText = 'Active';
        } else {
          pill.className = 'header-status inactive';
          text.innerText = 'Inactive';
        }
      }
      if (toggle) {
        toggle.checked = enabled;
      }
    }

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
        if (message.enabled !== undefined) {
          updateStatusUI(Boolean(message.enabled));
        }
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
