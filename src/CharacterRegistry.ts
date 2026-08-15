import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface CharacterActionInfo {
  file: string;
  frames: number;
  duration: number;
}

export interface CharacterManifest {
  id: string;
  name: string;
  badge: string;
  themeColor: string;
  bgGlow: string;
  frameWidth: number;
  frameHeight: number;
  author?: string;
  actions: Record<string, CharacterActionInfo>;
}

export interface CharacterPreviewData {
  id: string;
  name: string;
  badge: string;
  color: string;
  bgGlow: string;
  base64Idle: string;
}

export interface ResolvedSpriteAction {
  filename: string;
  frames: number;
  duration: number;
  frameWidth: number;
  frameHeight: number;
}

// ─── Default Fallback Action Timing ──────────────────────────────────
const DEFAULT_ACTION_TIMINGS: Record<string, { file: string; frames: number; duration: number }> = {
  idle: { file: "idle.png", frames: 4, duration: 0.68 },
  typing: { file: "typing.png", frames: 6, duration: 0.52 },
  typing_fast: { file: "typing-fast.png", frames: 6, duration: 0.40 },
  backspace: { file: "backspace.png", frames: 6, duration: 0.38 },
  backspace_bulk: { file: "backspace-bulk.png", frames: 6, duration: 0.35 },
  enter: { file: "enter.png", frames: 6, duration: 0.42 },
  shortcut_save: { file: "shortcut-save.png", frames: 6, duration: 0.42 },
  arrow_up: { file: "arrow-up.png", frames: 8, duration: 0.52 },
  arrow_down: { file: "arrow-down.png", frames: 4, duration: 0.44 },
  arrow_horizontal: { file: "arrow-horizontal.png", frames: 6, duration: 0.45 },
  stuck_down: { file: "stuck-down.png", frames: 6, duration: 0.50 },
  stuck_left: { file: "stuck-left.png", frames: 4, duration: 0.40 },
  mouse_teleport: { file: "mouse-teleport.png", frames: 8, duration: 0.35 },
  error: { file: "error.png", frames: 4, duration: 0.60 },
};

// ─── Action Fallback Hierarchy ───────────────────────────────────────
const ACTION_FALLBACK_MAP: Record<string, string> = {
  typing_fast: "typing",
  backspace: "typing",
  backspace_bulk: "typing",
  enter: "typing",
  arrow_horizontal: "typing",
  arrow_left: "arrow_horizontal",
  arrow_right: "arrow_horizontal",
  save: "shortcut_save",
  shortcut_save: "arrow_up",
  jump: "arrow_up",
  climb: "arrow_down",
  stuck_down: "arrow_down",
  stuck_left: "error",
  teleport: "mouse_teleport",
  teleport_depart: "mouse_teleport",
  delete: "backspace",
  bulk_delete: "backspace_bulk",
};

export class CharacterRegistry {
  private characters: Map<string, CharacterManifest> = new Map();
  private previewCache: Map<string, string> = new Map();
  private defaultCharacterId: string = "pink";

  constructor(private readonly extensionUri: vscode.Uri) {
    this.scan();
  }

  /**
   * Automatically scans the `assets/` directory and registers all character packs.
   */
  public scan() {
    this.characters.clear();
    this.previewCache.clear();

    const assetsDir = path.join(this.extensionUri.fsPath, "assets");
    if (!fs.existsSync(assetsDir)) {
      return;
    }

    const entries = fs.readdirSync(assetsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const charId = entry.name;
      const charDir = path.join(assetsDir, charId);
      const manifestPath = path.join(charDir, "character.json");

      if (fs.existsSync(manifestPath)) {
        try {
          const raw = fs.readFileSync(manifestPath, "utf8");
          const manifest: CharacterManifest = JSON.parse(raw);
          this.registerCharacter(manifest, charDir);
        } catch (e) {
          console.error(`[CharacterRegistry] Failed to parse character.json for ${charId}:`, e);
        }
      } else {
        // Auto-generate fallback manifest if idle.png exists in the folder
        const idlePath = path.join(charDir, "idle.png");
        if (fs.existsSync(idlePath)) {
          const fallbackManifest: CharacterManifest = {
            id: charId,
            name: charId.charAt(0).toUpperCase() + charId.slice(1),
            badge: "Custom",
            themeColor: "#6366f1",
            bgGlow: "rgba(99, 102, 241, 0.25)",
            frameWidth: 42,
            frameHeight: 42,
            author: "Community",
            actions: { ...DEFAULT_ACTION_TIMINGS },
          };
          this.registerCharacter(fallbackManifest, charDir);
        }
      }
    }

    if (!this.characters.has(this.defaultCharacterId) && this.characters.size > 0) {
      this.defaultCharacterId = Array.from(this.characters.keys())[0];
    }
  }

  private registerCharacter(manifest: CharacterManifest, charDir: string) {
    this.characters.set(manifest.id, manifest);

    // Pre-cache idle.png base64 for fast sidebar rendering
    const idleFile = manifest.actions?.idle?.file || "idle.png";
    const idlePath = path.join(charDir, idleFile);
    if (fs.existsSync(idlePath)) {
      try {
        const buf = fs.readFileSync(idlePath);
        this.previewCache.set(manifest.id, `data:image/png;base64,${buf.toString("base64")}`);
      } catch (e) {
        console.error(`[CharacterRegistry] Failed to load preview for ${manifest.id}:`, e);
      }
    }
  }

  public getAllCharacters(): CharacterManifest[] {
    return Array.from(this.characters.values());
  }

  public getCharacter(id: string): CharacterManifest | undefined {
    return this.characters.get(id) ?? this.characters.get(this.defaultCharacterId);
  }

  public getAvailableIds(): string[] {
    return Array.from(this.characters.keys());
  }

  public getPreviewList(): CharacterPreviewData[] {
    return this.getAllCharacters().map((c) => ({
      id: c.id,
      name: c.name,
      badge: c.badge,
      color: c.themeColor,
      bgGlow: c.bgGlow,
      base64Idle: this.previewCache.get(c.id) || "",
    }));
  }

  public getBase64Preview(id: string): string {
    return this.previewCache.get(id) || "";
  }

  /**
   * Resolves a sprite action using tiered fallback hierarchy:
   * 1. Exact action in character manifest & file exists
   * 2. Mapped fallback action (e.g. typing_fast -> typing)
   * 3. Tier 1 root fallback: 'idle'
   */
  public resolveAction(variant: string, actionName: string): ResolvedSpriteAction {
    const char = this.getCharacter(variant);
    const frameWidth = char?.frameWidth ?? 42;
    const frameHeight = char?.frameHeight ?? 42;
    const assetsDir = path.join(this.extensionUri.fsPath, "assets");
    const variantId = char?.id ?? this.defaultCharacterId;

    // Helper to check if an action exists in character definition and on disk
    const checkAction = (actKey: string): ResolvedSpriteAction | null => {
      const act = char?.actions?.[actKey];
      if (act) {
        const filePath = path.join(assetsDir, variantId, act.file);
        if (fs.existsSync(filePath)) {
          return {
            filename: act.file,
            frames: act.frames,
            duration: act.duration,
            frameWidth,
            frameHeight,
          };
        }
      }
      return null;
    };

    // Tier 3: Specific action requested
    let resolved = checkAction(actionName);
    if (resolved) return resolved;

    // Normalize action alias if needed (e.g. delete -> backspace, save -> shortcut_save)
    let currentKey = actionName;
    while (ACTION_FALLBACK_MAP[currentKey]) {
      currentKey = ACTION_FALLBACK_MAP[currentKey];
      resolved = checkAction(currentKey);
      if (resolved) return resolved;
    }

    // Default fallback values if not in manifest actions map
    if (DEFAULT_ACTION_TIMINGS[actionName]) {
      const def = DEFAULT_ACTION_TIMINGS[actionName];
      const filePath = path.join(assetsDir, variantId, def.file);
      if (fs.existsSync(filePath)) {
        return {
          filename: def.file,
          frames: def.frames,
          duration: def.duration,
          frameWidth,
          frameHeight,
        };
      }
    }

    // Tier 1 (Mandatory): Idle animation
    const idleAct = char?.actions?.idle ?? DEFAULT_ACTION_TIMINGS.idle;
    return {
      filename: idleAct.file,
      frames: idleAct.frames,
      duration: idleAct.duration,
      frameWidth,
      frameHeight,
    };
  }
}
