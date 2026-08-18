# Change Log

All notable user-facing changes and improvements to the **OPIT Companion** extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.2] - 2026-08-18

### Fixed
- **Seamless Typing Flow**: Fixed an issue where typing quickly or inserting new lines could trigger unexpected hurt or crouch animations. Character locomotion and typing animations now remain smooth and uninterrupted.
- **Left Margin Interaction**: Navigating to the leftmost column of the editor now plays gentle walking reactions instead of injury responses.

### Performance
- **Ultra-Fast Input Handling**: Optimized typing engine to deliver sub-millisecond response times with zero perceived input lag, even during high-speed typing (>100 WPM).
- **Dashboard Efficiency**: Significantly reduced background CPU and memory usage when viewing the character selection panel by pausing idle animations on unselected cards.
- **Zero-Latency In-Memory Caching**: Asset data and animation metadata are now fully cached in memory upon extension startup for instant character state transitions.

### Changed
- **Streamlined Dashboard**: Removed the redundant "Apply Settings" button in favor of instant live updates when changing sliders and toggles.
- **Demo Reactions**: Renamed the interactive preview section in the sidebar to **Demo** for a cleaner, more intuitive interface.

---

## [0.3.1] - 2026-08-18

### Added
- **24 Playable Companions**: Expanded the companion roster to 24 unique pixel-art characters across 8 distinct fantasy classes:
  - **Retro**: Pink Monster, Blue Hero, White Chocobo
  - **Werewolf**: Shadow Werewolf, Blood Werewolf, Frost Werewolf
  - **Ninja**: Cyan Ninja Monk, Shadow Shinobi, Kunoichi Warrior
  - **Knight**: Silver Knight, Golden Knight, Dark Paladin
  - **Mage**: Fire Wizard, Lightning Mage, Emerald Wanderer
  - **Orc**: Berserker Orc, Mystic Shaman, Armored Warrior
  - **Slime**: Aquatic Blue Slime, Emerald Green Slime, Magma Red Slime
  - **Warrior**: Iron Warrior, Crimson Warrior, Golden Warrior
- **Universal Smoke Teleportation**: Added custom puff-of-smoke departure and heroic touchdown arrival visual effects whenever the cursor jumps across multiple lines or editors.
- **Interactive Sidebar Dashboard**: Full-featured activity bar panel with live character previews, category filter tabs, size and animation speed sliders, and reaction tests.

### Changed
- **Live Baseline Alignment**: Calibrated character foot placement to dynamically align with custom editor font sizes and line heights across different zoom levels.

---

## [0.2.0] - 2026-08-18

### Added
- **Multi-IDE Calibration**: Automatic cursor styling and calibration support across VS Code, Cursor, Windsurf, VSCodium, and Zed.
- **Native Cursor Toggle**: Added an option in settings and the sidebar to show or hide the default text cursor alongside your companion.
- **Idle Action Sequences**: Companions now perform delightful idle breathing and bored combo animations when paused between coding sessions.

### Fixed
- Fixed layout shifting and vertical line height expansion by implementing absolute baseline positioning.

---

## [0.1.0] - 2026-08-18

### Added
- **Initial Release**: Launched OPIT Companion with 60 FPS pixel-art cursor animations.
- Real-time reactive behaviors: typing sprint, backspace slashing attack, jump on arrow up, crouch on arrow down, and save celebrations.
- Initial character skins: Pink Monster, Blue Hero, and White Chocobo.
- Settings configuration for animation speed multiplier and sprite display size.
