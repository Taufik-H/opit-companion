# 👾 OPIT Companion

> **Your tiny coding companion.**  
> A lively, reactive inline sprite character living right beside your text cursor in VS Code, Cursor, Windsurf, VSCodium, and more.

---

## ✨ Features

- **🐾 Real-time Cursor Following**: Smooth 60 FPS physics momentum engine that dashes, walks, and follows your cursor wherever you code.
- **🎭 Multi-Character Skins**: Includes **Pink Monster**, **Blue Hero**, and **White Hero** with extensible custom character JSON manifests.
- **⚡ 20+ Interactive Keyboard Reactions**:
  - 🏃 Fast typing sprints & steady typing strides
  - ⚔️ Backspace attacks & bulk-deletion slashes
  - 💥 Enter jumps & newline drops
  - 🎉 Command-S / Save leap celebration
  - ⬇️ Stuck at bottom squat & Left edge wall bump
  - 💨 Mouse teleportation poof
  - 🤒 Real-time linter error diagnostics reaction
- **🎛️ Interactive Sidebar Panel**:
  - Horizontal character selector cards with live step-animated previews
  - Instant display size & animation speed sliders
  - **Show / Hide Native Cursor** live toggle switch
  - One-click clean cursor calibration
- **🌐 Universal Multi-IDE Support**:
  - Automatically calibrates across VS Code, Cursor, Windsurf, VSCodium, and Zed.
  - Generates and synchronizes `.editorconfig` and `.prettierrc` for universal formatting standards.

---

## 🚀 Quickstart

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Taufik-H/opit-companion.git
   cd opit-companion
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile & build:
   ```bash
   npm run build
   ```
4. Press `F5` in VS Code to launch the Extension Development Host.

---

## 🎮 Commands & Shortcuts

| Command | Title | Description |
| :--- | :--- | :--- |
| `opit.changeVariant` | **OPIT: Change Character Skin** | Opens quick-pick to select companion skin |
| `opit.applySettings` | **OPIT: Apply Cursor Settings** | Applies global cursor & editor calibration |
| `opit.testSave` | **OPIT: Trigger Test Save** | Simulates celebration save reaction |
| `opit.testError` | **OPIT: Trigger Test Error** | Simulates sick/error diagnostic reaction |

---

## ⚙️ Configuration Settings

Customize your companion in **Settings (`settings.json`)** or via the **OPIT Dashboard** in the Activity Bar:

```json
{
  "opit.variant": "pink",
  "opit.displaySize": 22,
  "opit.animationSpeed": 1.0,
  "opit.showCursor": true
}
```

---

## 📦 Automated Versioning (SemVer 2.0)

This repository uses automated **Semantic Versioning** via GitHub Actions on every push to `main`. Version increments are determined automatically based on **Conventional Commits**:

| Commit Prefix | SemVer Release Type | Example Transition |
| :--- | :--- | :--- |
| `fix:` or `fix(...):` | **PATCH** (Bug fixes & minor patches) | `v0.1.0` $\rightarrow$ `v0.1.1` |
| `feat:` or `feat(...):` | **MINOR** (New features & enhancements) | `v0.1.0` $\rightarrow$ `v0.2.0` |
| `feat!:` or `BREAKING CHANGE:` | **MAJOR** (Breaking structural changes) | `v0.1.0` $\rightarrow$ `v1.0.0` |
| `docs:`, `chore:`, `style:` | **SKIP / NO BUMP** | Version stays unchanged |

### Automated Workflow Pipeline
1. When you push a commit with a Conventional Commit message to `main`:
2. GitHub Actions analyzes the commit history since the last tag.
3. Automatically computes the next version, updates `package.json`, creates a Git tag (`vX.Y.Z`), and generates a GitHub Release with an automated changelog.

---

## 🛠️ Tech Stack & Architecture

- **Runtime**: TypeScript & VS Code Extension API
- **Bundler**: `esbuild` for lightning-fast sub-millisecond builds
- **Rendering**: SVG ViewBox Data-URI Dynamic Sprite Viewport & Text Editor Decorations
- **State Management**: Reactive Observer with 60 FPS Exponential Friction Decay

---

## 📄 License

MIT License © 2026 OPIT Companion Team.
