<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="OPIT Companion Logo" />
</p>

<h1 align="center">👾 OPIT Companion</h1>

> **Your Tiny Coding Companion**  
> A lively pixel-art companion that lives inside your code editor, reacting dynamically to every keystroke, shortcut, and error right beside your cursor.

---

## 📖 About OPIT Companion

Coding can be intense and solitary. **OPIT Companion** transforms your daily coding routine by placing an expressive, animated companion directly into your text editor. 

As you write code, OPIT stays by your cursor—sprinting when you type fast, celebrating when you save, slashing when you delete, and reacting when errors appear. It is designed to be lightweight, fluid, and delightful without getting in the way of your productivity.

---

## 🌟 Key Functions & Reactions

### 🎮 Keystroke & Editor Reactions
OPIT actively observes your editor actions and reacts in real time:

| Action | OPIT Reaction | What Happens |
| :--- | :--- | :--- |
| **Typing** | 🏃 **Sprint / Dash** | Runs alongside your cursor as you type |
| **Fast Typing** | ⚡ **Speed Sprint** | Accelerates into high-speed momentum when typing rapidly |
| **Backspace / Delete** | ⚔️ **Slash Attack** | Swings weapon and slashes away deleted characters |
| **Enter / Newline** | 💥 **Jump & Drop** | Leaps into the air and lands gracefully on the new line |
| **Save (`Cmd+S` / `Ctrl+S`)** | 🎉 **Celebration** | Jumps in joy with celebratory stars when files are saved |
| **Code Errors / Linter** | 🤒 **Sick / Dizzy** | Shows a dizzy, sick reaction when syntax errors are detected |
| **Mouse Click / Jump** | 💨 **Poof Teleport** | Disappears with smoke and materializes at the clicked position |
| **Bumping Boundaries** | 🧱 **Wall Bump & Squat** | Bumps into the left wall or squats when reaching the bottom |

---

### 🎨 Character Skins & Variety
Choose from distinct hero characters, each with their own color theme and personality:
- 🌸 **Pink Monster**: Energetic and playful companion.
- 🔷 **Blue Hero**: Sleek and focused warrior.
- 🤍 **White Hero**: Minimalist and calm paladin.

---

### 🎛️ Interactive Control Dashboard
Access the companion control center from the **Activity Bar** (left sidebar):
- **Live Character Selector**: Browse skins with continuous step-animated previews.
- **Display Size Slider**: Scale your companion from subtle (16px) to bold (48px) to fit your font and line height.
- **Animation Speed Slider**: Adjust animation tempo from chill (0.5x) to hyperactive (2.5x).
- **Show / Hide Native Cursor Switch**: Choose whether to keep the standard text cursor or let OPIT be your main cursor guide.
- **Test Reactions Panel**: One-click preview buttons to trigger save, error, slash, jump, and poof animations anytime.

---

---

## 🎬 Video Showcase & Demos

Watch OPIT Companion in action across different coding workflows:

| Demo Video | Action / Feature | Highlights |
| :--- | :--- | :--- |
| 📺 [**01-full-walkthrough-demo.mov**](demo/01-full-walkthrough-demo.mov) | **Full Walkthrough** | Complete overview: live coding, cursor following, and sidebar panel |
| 📺 [**02-typing-reaction-preview.mov**](demo/02-typing-reaction-preview.mov) | **Keystroke Reactions** | Real-time sprint, slash delete attack, and line-jump reactions |
| 📺 [**03-character-selection-and-actions.mov**](demo/03-character-selection-and-actions.mov) | **Character Selection** | Live switching across **Blue Hero**, **Pink Monster**, and **White Chocobo** |
| 📺 [**04-reaction-test-actions.mov**](demo/04-reaction-test-actions.mov) | **Test Actions Deck** | Instant manual triggers for Save, Error, Slash, Jump, Squat, and Poof |
| 📺 [**05-sidebar-settings-customization.mov**](demo/05-sidebar-settings-customization.mov) | **Sidebar Customization** | Live sprite scaling (`16px`-`40px`), speed multiplier, and cursor switch |
| 📺 [**06-cursor-companion-closeup.mov**](demo/06-cursor-companion-closeup.mov) | **Cursor Tracking Close-up** | 60 FPS ultra-smooth momentum physics and idle breathing loop |

## 🚀 How to Use

### 1. Opening the OPIT Dashboard
1. Look at the **Activity Bar** on the left side of your editor.
2. Click on the **OPIT Companion** icon (👾).
3. The dashboard will open, showing your active character and customizable controls.

### 2. Changing Companion Skin
- **Via Dashboard**: Simply click on any character card in the sidebar grid.
- **Via Command Palette**:
  1. Press `Cmd + Shift + P` (Mac) or `Ctrl + Shift + P` (Windows/Linux).
  2. Type and select `OPIT: Change Character Skin`.
  3. Pick your preferred companion from the list.

### 3. Adjusting Cursor & Sizing
- In the sidebar dashboard, adjust the **Display Size** slider to align the sprite with your editor's line height.
- Toggle the **Show Native Cursor** switch to customize your cursor visibility.
- Click **Apply settings** to optimize your editor typography and cursor alignment.

---

## ⌨️ Available Commands

| Command | Action |
| :--- | :--- |
| `OPIT: Change Character Skin` | Open quick selector to switch companion skin |
| `OPIT: Apply Cursor Settings` | Calibrate cursor styling across your editor windows |
| `OPIT: Trigger Test Save Reaction` | Trigger celebratory save jump animation |
| `OPIT: Trigger Test Error Reaction` | Trigger diagnostic error reaction |

---

## ⚙️ Configuration Options

You can adjust settings via the Sidebar Dashboard or directly in your `settings.json`:

```json
{
  // Chosen character skin: "pink", "blue", or "white"
  "opit.variant": "pink",

  // Sprite display size in pixels (default: 22)
  "opit.displaySize": 22,

  // Speed multiplier for animations (default: 1.0)
  "opit.animationSpeed": 1.0,

  // Show or hide native text cursor alongside OPIT
  "opit.showCursor": true
}
```

---

## 🖥️ Supported Editors & IDEs

OPIT Companion is engineered to deliver a consistent, delightful experience across modern development environments:

| Editor / IDE | Compatibility | Supported Features |
| :--- | :---: | :--- |
| **Visual Studio Code** | 🟢 **Full Native** | Animated Sprite, 60 FPS Physics Engine, Sidebar Dashboard, Settings Sync |
| **Cursor** | 🟢 **Full Native** | Seamless companion in your AI-assisted coding environment |
| **Windsurf** | 🟢 **Full Native** | Full animation pipeline, keystroke reactions & sidebar control panel |
| **VSCodium** | 🟢 **Full Native** | Full compatibility for 100% open-source editor setups |
| **Trae** | 🟢 **Full Native** | Full inline sprite reactions and command support |
| **GitHub Codespaces & Gitpod** | 🟢 **Full Web** | Live inline companion in cloud and browser workspaces |
| **Zed Editor** | 🟡 **Settings Sync** | Automatic font size, line height, and cursor style synchronization |
| **JetBrains (WebStorm, IntelliJ)** | 🟡 **Standards Sync** | Universal `.editorconfig` formatting and indentation standards |
| **Neovim / Vim / Sublime Text** | 🟡 **Standards Sync** | Project-level indentation, LF newlines, and charset compliance |

---

## 🏷️ Versioning & Releases

This project follows **Semantic Versioning (SemVer 2.0)**. Updates and releases are categorized as:
- **Patch (`v0.1.X`)**: Bug fixes, sprite offset calibrations, and stability tweaks.
- **Minor (`v0.X.0`)**: New companion skins, animations, and dashboard features.
- **Major (`vX.0.0`)**: Large-scale evolutions and architectural updates.

---

## 📄 License

MIT License © 2026 OPIT Companion. Built for coders who love a little companionship in their editor! 👾✨
