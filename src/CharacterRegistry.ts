import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface CharacterActionInfo {
  file: string;
  frames: number;
  duration: number;
  startFrame?: number;
  playFrames?: number;
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
  frameWidth: number;
  frameHeight: number;
  idleFrames: number;
}

export interface ResolvedSpriteAction {
  filename: string;
  frames: number;
  duration: number;
  frameWidth: number;
  frameHeight: number;
  startFrame?: number;
  playFrames?: number;
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

import * as zlib from "zlib";

// ─── PNG Header Helper ───────────────────────────────────────────────
function getPngDimensions(filePath: string): { width: number; height: number } | null {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(24);
    fs.readSync(fd, buf, 0, 24, 0);
    fs.closeSync(fd);
    if (buf.length >= 24 && buf.toString("ascii", 1, 4) === "PNG") {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      return { width, height };
    }
  } catch {
    // Fallback if read fails
  }
  return null;
}

function getPngAsymmetryX(filePath: string, frameWidth: number, frameHeight: number): number {
  try {
    const buf = fs.readFileSync(filePath);
    let pos = 8, width = 0, height = 0, colorType = 6;
    const idatChunks: Buffer[] = [];
    while (pos < buf.length) {
      const len = buf.readUInt32BE(pos);
      const type = buf.toString("ascii", pos + 4, pos + 8);
      if (type === "IHDR") {
        width = buf.readUInt32BE(pos + 8);
        height = buf.readUInt32BE(pos + 12);
        colorType = buf[pos + 17];
      } else if (type === "IDAT") {
        idatChunks.push(buf.slice(pos + 8, pos + 8 + len));
      }
      pos += 12 + len;
    }
    const idat = Buffer.concat(idatChunks);
    const raw = zlib.inflateSync(idat);
    const bytesPerPixel = colorType === 6 ? 4 : (colorType === 2 ? 3 : 1);
    const stride = 1 + width * bytesPerPixel;
    const pixels = Buffer.alloc(width * height * 4);
    let prevRow = Buffer.alloc(width * bytesPerPixel);
    for (let y = 0; y < height; y++) {
      const filter = raw[y * stride];
      const row = Buffer.alloc(width * bytesPerPixel);
      for (let x = 0; x < width * bytesPerPixel; x++) {
        const rawByte = raw[y * stride + 1 + x];
        const a = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
        const b = prevRow[x];
        const c = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0;
        let val = rawByte;
        if (filter === 1) val = (rawByte + a) & 0xff;
        else if (filter === 2) val = (rawByte + b) & 0xff;
        else if (filter === 3) val = (rawByte + Math.floor((a + b) / 2)) & 0xff;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          val = (rawByte + pr) & 0xff;
        }
        row[x] = val;
      }
      prevRow = row;
      for (let x = 0; x < width; x++) {
        const pIdx = (y * width + x) * 4;
        if (colorType === 6) {
          pixels[pIdx] = row[x * 4];
          pixels[pIdx + 1] = row[x * 4 + 1];
          pixels[pIdx + 2] = row[x * 4 + 2];
          pixels[pIdx + 3] = row[x * 4 + 3];
        }
      }
    }
    let minX = frameWidth, maxX = -1;
    for (let y = 0; y < frameHeight; y++) {
      for (let x = 0; x < frameWidth; x++) {
        const alpha = pixels[(y * width + x) * 4 + 3];
        if (alpha > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    if (maxX >= minX) {
      const leftMargin = minX;
      const rightMargin = frameWidth - 1 - maxX;
      return rightMargin - leftMargin;
    }
  } catch {}
  return 0;
}

const CLASS_ORDER: Record<string, number> = {
  retro: 1,
  werewolf: 2,
  ninja: 3,
  knight: 4,
  mage: 5,
  orc: 6,
  slime: 7,
  warrior: 8,
};

const CANONICAL_CHARACTER_ORDER: string[] = [
  // Retro Heroes
  "pink",
  "blue",
  "white",
  // Werewolves
  "werewolf_black",
  "werewolf_red",
  "werewolf_white",
  // Ninjas
  "ninja_monk",
  "ninja_peasant",
  "ninja_kunoichi",
  // Knights
  "knight_1",
  "knight_2",
  "knight_3",
  // Mages
  "mage_fire",
  "mage_lightning",
  "mage_wanderer",
  // Orcs
  "orc_berserk",
  "orc_shaman",
  "orc_warrior",
  // Slimes
  "slime_blue",
  "slime_green",
  "slime_red",
  // Warriors
  "warrior_1",
  "warrior_2",
  "warrior_3",
];

export class CharacterRegistry {
  private characters: Map<string, CharacterManifest> = new Map();
  private previewCache: Map<string, string> = new Map();
  private idleCombosCache: Map<string, ResolvedSpriteAction[]> = new Map();
  private asymmetryXCache: Map<string, number> = new Map();
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
    this.idleCombosCache.clear();
    this.asymmetryXCache.clear();

    const assetsDir = path.join(this.extensionUri.fsPath, "assets");
    if (!fs.existsSync(assetsDir)) {
      return;
    }

    const entries = fs.readdirSync(assetsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "common") continue;

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

    const frameWidth = manifest.frameWidth || 42;
    const frameHeight = manifest.frameHeight || 42;

    // Pre-cache idle.png base64 and compute asymmetryX for fast sidebar rendering & symmetrical margin compensation
    const idleFile = manifest.actions?.idle?.file || "idle.png";
    const idlePath = path.join(charDir, idleFile);
    if (fs.existsSync(idlePath)) {
      try {
        const buf = fs.readFileSync(idlePath);
        this.previewCache.set(manifest.id, `data:image/png;base64,${buf.toString("base64")}`);
        const asym = getPngAsymmetryX(idlePath, frameWidth, frameHeight);
        this.asymmetryXCache.set(manifest.id, asym);
      } catch (e) {
        console.error(`[CharacterRegistry] Failed to load preview for ${manifest.id}:`, e);
      }
    }

    // Discover and register all existing idle combos for this character
    const combos: ResolvedSpriteAction[] = [];

    if (fs.existsSync(charDir)) {
      const files = fs.readdirSync(charDir);
      const comboFileMap = new Map<number, string>();

      for (const f of files) {
        const match = f.match(/^idle[-_]combo[-_](\d+)\.png$/i);
        if (match) {
          const stepNum = parseInt(match[1], 10);
          comboFileMap.set(stepNum, f);
        }
      }

      // Sort step numbers in ascending order: 1, 2, 3...
      const sortedStepNums = Array.from(comboFileMap.keys()).sort((a, b) => a - b);

      for (const stepNum of sortedStepNums) {
        const filename = comboFileMap.get(stepNum)!;
        const filePath = path.join(charDir, filename);
        if (!fs.existsSync(filePath)) continue;

        const actionKeyHyphen = `idle-combo-${stepNum}`;
        const actionKeyUnderscore = `idle_combo_${stepNum}`;
        const manifestAction = manifest.actions?.[actionKeyHyphen] || manifest.actions?.[actionKeyUnderscore];

        const dim = getPngDimensions(filePath);
        const actualFrames = dim ? Math.max(1, Math.round(dim.width / frameWidth)) : (manifestAction?.frames || 6);
        const actualHeight = dim ? dim.height : frameHeight;
        const duration = manifestAction?.duration || Math.max(0.35, parseFloat((actualFrames * 0.08).toFixed(2)));

        combos.push({
          filename,
          frames: actualFrames,
          duration,
          frameWidth,
          frameHeight: actualHeight,
        });
      }
    }

    this.idleCombosCache.set(manifest.id, combos);
  }

  public getAllCharacters(): CharacterManifest[] {
    const canonicalMap = new Map(CANONICAL_CHARACTER_ORDER.map((id, index) => [id, index]));
    return Array.from(this.characters.values()).sort((a, b) => {
      const canonA = canonicalMap.get(a.id);
      const canonB = canonicalMap.get(b.id);
      if (canonA !== undefined && canonB !== undefined) {
        return canonA - canonB;
      }
      if (canonA !== undefined) return -1;
      if (canonB !== undefined) return 1;

      const classOrderA = CLASS_ORDER[(a.badge || "").toLowerCase()] ?? 99;
      const classOrderB = CLASS_ORDER[(b.badge || "").toLowerCase()] ?? 99;
      if (classOrderA !== classOrderB) {
        return classOrderA - classOrderB;
      }
      return a.name.localeCompare(b.name);
    });
  }

  public getCharacter(id: string): CharacterManifest | undefined {
    return this.characters.get(id) ?? this.characters.get(this.defaultCharacterId);
  }

  public getAvailableIds(): string[] {
    return this.getAllCharacters().map((c) => c.id);
  }

  public getAsymmetryX(variant: string): number {
    const char = this.getCharacter(variant);
    const variantId = char?.id ?? this.defaultCharacterId;
    return this.asymmetryXCache.get(variantId) ?? 0;
  }

  /**
   * Returns all available idle combos for a character variant.
   * If the character has no idle combo files on disk, returns an empty array [].
   */
  public getIdleCombos(variant: string): ResolvedSpriteAction[] {
    const char = this.getCharacter(variant);
    const variantId = char?.id ?? this.defaultCharacterId;
    return this.idleCombosCache.get(variantId) ?? [];
  }

  public getPreviewList(): CharacterPreviewData[] {
    const assetsDir = path.join(this.extensionUri.fsPath, "assets");
    return this.getAllCharacters().map((c) => {
      const idleAct = c.actions?.idle || { file: "idle.png", frames: 4 };
      const idleFile = idleAct.file || "idle.png";
      const idlePath = path.join(assetsDir, c.id, idleFile);
      const frameWidth = c.frameWidth || 42;
      let idleFrames = idleAct.frames || 4;
      let frameHeight = c.frameHeight || 42;
      if (fs.existsSync(idlePath)) {
        const dim = getPngDimensions(idlePath);
        if (dim) {
          idleFrames = Math.max(1, Math.round(dim.width / frameWidth));
          frameHeight = dim.height;
        }
      }

      return {
        id: c.id,
        name: c.name,
        badge: c.badge,
        color: c.themeColor,
        bgGlow: c.bgGlow,
        base64Idle: this.previewCache.get(c.id) || "",
        frameWidth,
        frameHeight,
        idleFrames,
      };
    });
  }

  public getBase64Preview(id: string): string {
    return this.previewCache.get(id) || "";
  }

  /**
   * Resolves a sprite action using tiered fallback hierarchy:
   * 1. Exact action in character manifest & file exists (auto-detecting real frame dimensions)
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
          const dim = getPngDimensions(filePath);
          const actualFrames = dim ? Math.max(1, Math.round(dim.width / frameWidth)) : (act.frames || 4);
          const actualHeight = dim ? dim.height : frameHeight;
          const startFrame = act.startFrame ?? 0;
          const playFrames = act.playFrames ?? (actualFrames - startFrame);
          return {
            filename: act.file,
            frames: actualFrames,
            duration: act.duration || parseFloat((playFrames * 0.08).toFixed(2)),
            frameWidth,
            frameHeight: actualHeight,
            startFrame,
            playFrames,
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
        const dim = getPngDimensions(filePath);
        const actualFrames = dim ? Math.max(1, Math.round(dim.width / frameWidth)) : def.frames;
        const actualHeight = dim ? dim.height : frameHeight;
        return {
          filename: def.file,
          frames: actualFrames,
          duration: def.duration,
          frameWidth,
          frameHeight: actualHeight,
        };
      }
    }

    // Tier 1 (Mandatory): Idle animation
    const idleAct = char?.actions?.idle ?? DEFAULT_ACTION_TIMINGS.idle;
    const idleFile = idleAct.file || "idle.png";
    const idlePath = path.join(assetsDir, variantId, idleFile);
    let idleFrames = idleAct.frames || 4;
    let actualIdleHeight = frameHeight;
    if (fs.existsSync(idlePath)) {
      const dim = getPngDimensions(idlePath);
      if (dim) {
        idleFrames = Math.max(1, Math.round(dim.width / frameWidth));
        actualIdleHeight = dim.height;
      }
    }
    return {
      filename: idleFile,
      frames: idleFrames,
      duration: idleAct.duration || 0.68,
      frameWidth,
      frameHeight: actualIdleHeight,
    };
  }
}
