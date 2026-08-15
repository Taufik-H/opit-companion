import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * SpriteRenderer handles SVG data URI generation and caching
 * for animated sprite sheets. Produces GPU-accelerated 60 FPS
 * self-animating SVG images from PNG sprite strips.
 */
export class SpriteRenderer {
  private svgUriCache: Map<string, vscode.Uri> = new Map();
  private pngBase64Cache: Map<string, string> = new Map();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private displaySize: number,
    private animationSpeed: number
  ) {}

  // ─── Configuration ──────────────────────────────────────────────────

  public updateSettings(displaySize: number, animationSpeed: number) {
    this.displaySize = displaySize;
    this.animationSpeed = animationSpeed;
  }

  public getDisplaySize(): number {
    return this.displaySize;
  }

  public getAnimationSpeed(): number {
    return this.animationSpeed;
  }

  public clearCache() {
    this.svgUriCache.clear();
    this.pngBase64Cache.clear();
  }

  // ─── SVG Generation ─────────────────────────────────────────────────

  /**
   * Generates a GPU-accelerated SVG Data URI with fluid continuous keyframes.
   * Returns null if the PNG sprite sheet cannot be found.
   */
  public getSpriteSvgUri(
    variant: string,
    filename: string,
    totalFrames: number,
    durationSeconds: number,
    frameWidth: number,
    frameHeight: number,
    dir: 1 | -1,
    oneShot: boolean = false,
    reverse: boolean = false,
    startFrame: number = 0,
    playFrames?: number
  ): vscode.Uri | null {
    const adjustedDuration = (durationSeconds / this.animationSpeed).toFixed(2);
    const animCount = oneShot ? "1 forwards" : "infinite";
    const animDirection = reverse ? "reverse" : "normal";

    // CRITICAL: One-shot animations must NEVER be cached to ensure
    // VS Code restarts the CSS animation fresh on every trigger.
    if (!oneShot) {
      const key = `gpu-60fps/${variant}/${filename}/${this.displaySize}/${dir}/${adjustedDuration}/${animDirection}/${startFrame}/${playFrames ?? ""}`;
      if (this.svgUriCache.has(key)) {
        return this.svgUriCache.get(key)!;
      }
    }

    const base64Png = this.loadPngBase64(variant, filename);
    if (!base64Png) {
      return null;
    }

    const totalWidth = frameWidth * totalFrames;
    const scale = this.displaySize / frameHeight;
    const renderWidth = Math.round(frameWidth * scale);
    const renderHeight = Math.round(frameHeight * scale);

    const transform =
      dir === -1 ? `translate(${frameWidth}, 0) scale(-1, 1)` : ``;

    const count = playFrames ?? (totalFrames - startFrame);
    const animSteps = oneShot && count > 1 ? count - 1 : count;
    const startTranslate = startFrame * frameWidth;
    const animEndTranslate = oneShot && count > 1 ? (startFrame + count - 1) * frameWidth : (startFrame + count) * frameWidth;

    const animName = `anim_${Math.random().toString(36).substring(2, 7)}`;

    // Self-animating 60 FPS GPU Composite Thread SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidth}" height="${renderHeight}" viewBox="0 0 ${frameWidth} ${frameHeight}">
      <style>
        @keyframes ${animName} {
          0% { transform: translate(-${startTranslate}px, 0); }
          100% { transform: translate(-${animEndTranslate}px, 0); }
        }
        .gpu-sprite {
          animation: ${animName} ${adjustedDuration}s steps(${animSteps}) ${animCount};
          animation-direction: ${animDirection};
          image-rendering: pixelated;
        }
      </style>
      <g transform="${transform}">
        <g class="gpu-sprite">
          <image href="${base64Png}" width="${totalWidth}" height="${frameHeight}"/>
        </g>
      </g>
    </svg>`;

    const encoded = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    const uri = vscode.Uri.parse(encoded);

    if (!oneShot) {
      const key = `gpu-60fps/${variant}/${filename}/${this.displaySize}/${dir}/${adjustedDuration}/${animDirection}/${startFrame}/${playFrames ?? ""}`;
      this.svgUriCache.set(key, uri);
    }

    return uri;
  }

  // ─── Universal Smoke Poof Teleportation FX ─────────────────────────

  /**
   * Generates a Big Smoke Poof SVG for the Depart (previous) cursor position.
   * Full-sized smoke cloud explosion at the old cursor position.
   */
  public getTeleportDepartCompositeSvgUri(
    variant: string,
    charFilename: string,
    charFrames: number,
    charFrameWidth: number,
    charFrameHeight: number,
    dir: 1 | -1,
    durationSeconds: number = 0.30
  ): vscode.Uri | null {
    const poofBase64 = this.loadCommonPngBase64("poof.png");
    if (!poofBase64) return null;

    const scale = this.displaySize / charFrameHeight;
    const renderWidth = Math.round(charFrameWidth * scale);
    const renderHeight = Math.round(charFrameHeight * scale);

    const totalPoofWidth = 72 * 8; // 576px
    const poofScaleX = (charFrameWidth / 72.0).toFixed(4);
    const poofScaleY = (charFrameHeight / 72.0).toFixed(4);

    const animId = Math.random().toString(36).substring(2, 7);
    const poofAnimName = `poof_depart_${animId}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidth}" height="${renderHeight}" viewBox="0 0 ${charFrameWidth} ${charFrameHeight}">
      <style>
        @keyframes ${poofAnimName} {
          from { transform: translate(0px, 0); }
          to { transform: translate(-${totalPoofWidth}px, 0); }
        }
        .layer-poof-depart {
          animation: ${poofAnimName} ${durationSeconds}s steps(8, end) 1 forwards;
          image-rendering: pixelated;
        }
      </style>
      <g transform="scale(${poofScaleX}, ${poofScaleY})">
        <g class="layer-poof-depart">
          <image href="${poofBase64}" width="${totalPoofWidth}" height="72"/>
        </g>
      </g>
    </svg>`;

    return vscode.Uri.parse("data:image/svg+xml;utf8," + encodeURIComponent(svg));
  }

  /**
   * Generates a Big Smoke Poof & Heroic Arrival Landing SVG for the new cursor position.
   * - Layer 1 (Background / Big Smoke Cloud): Full-size smoke burst expanding and dissipating in background.
   * - Layer 2 (Foreground / Character): Plays mouse-teleport.png (Heroic touchdown / arrival stance).
   */
  public getTeleportArrivalCompositeSvgUri(
    variant: string,
    charFilename: string,
    charFrames: number,
    charFrameWidth: number,
    charFrameHeight: number,
    dir: 1 | -1,
    durationSeconds: number = 0.32,
    startFrame: number = 0,
    playFrames?: number
  ): vscode.Uri | null {
    const charBase64 = this.loadPngBase64(variant, charFilename);
    const poofBase64 = this.loadCommonPngBase64("poof.png");
    if (!charBase64) return null;

    const scale = this.displaySize / charFrameHeight;
    const renderWidth = Math.round(charFrameWidth * scale);
    const renderHeight = Math.round(charFrameHeight * scale);

    const totalCharWidth = charFrameWidth * charFrames;
    const totalPoofWidth = 72 * 8; // 576px

    const poofScaleX = (charFrameWidth / 72.0).toFixed(4);
    const poofScaleY = (charFrameHeight / 72.0).toFixed(4);

    const charTransform = dir === -1 ? `translate(${charFrameWidth}, 0) scale(-1, 1)` : ``;
    const animId = Math.random().toString(36).substring(2, 7);
    const poofAnimName = `poof_back_${animId}`;
    const charArriveAnimName = `char_arrive_${animId}`;

    const count = playFrames ?? (charFrames - startFrame);
    const charSteps = count > 1 ? count - 1 : 1;
    const startTranslate = startFrame * charFrameWidth;
    const charEndTranslate = (startFrame + count - 1) * charFrameWidth;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidth}" height="${renderHeight}" viewBox="0 0 ${charFrameWidth} ${charFrameHeight}">
      <style>
        @keyframes ${poofAnimName} {
          from { transform: translate(0px, 0); }
          to { transform: translate(-${totalPoofWidth}px, 0); }
        }
        @keyframes ${charArriveAnimName} {
          from { transform: translate(-${startTranslate}px, 0); }
          to { transform: translate(-${charEndTranslate}px, 0); }
        }
        .layer-smoke-back {
          animation: ${poofAnimName} ${durationSeconds}s steps(8, end) 1 forwards;
          image-rendering: pixelated;
        }
        .layer-character-landing {
          animation: ${charArriveAnimName} ${durationSeconds}s steps(${charSteps}) 1 forwards;
          image-rendering: pixelated;
        }
      </style>
      
      <!-- Layer 1 (Background): Big Smoke Cloud Burst & Dissipation -->
      ${poofBase64 ? `
      <g transform="scale(${poofScaleX}, ${poofScaleY})">
        <g class="layer-smoke-back">
          <image href="${poofBase64}" width="${totalPoofWidth}" height="72"/>
        </g>
      </g>` : ''}

      <!-- Layer 2 (Foreground): Character Touchdown Landing (mouse-teleport.png) -->
      <g transform="${charTransform}">
        <g class="layer-character-landing">
          <image href="${charBase64}" width="${totalCharWidth}" height="${charFrameHeight}"/>
        </g>
      </g>
    </svg>`;

    return vscode.Uri.parse("data:image/svg+xml;utf8," + encodeURIComponent(svg));
  }

  // ─── PNG Loading ────────────────────────────────────────────────────

  /**
   * Loads a PNG sprite sheet as base64 data URI.
   */
  public loadPngBase64(variant: string, filename: string): string | null {
    const cacheKey = `${variant}/${filename}`;
    if (this.pngBase64Cache.has(cacheKey)) {
      return this.pngBase64Cache.get(cacheKey)!;
    }

    const targetPath = path.join(this.extensionUri.fsPath, "assets", variant, filename);
    if (fs.existsSync(targetPath)) {
      const buffer = fs.readFileSync(targetPath);
      const base64 = `data:image/png;base64,${buffer.toString("base64")}`;
      this.pngBase64Cache.set(cacheKey, base64);
      return base64;
    }

    return null;
  }

  /**
   * Loads a common PNG asset (e.g. assets/common/poof.png).
   */
  public loadCommonPngBase64(filename: string): string | null {
    const cacheKey = `common/${filename}`;
    if (this.pngBase64Cache.has(cacheKey)) {
      return this.pngBase64Cache.get(cacheKey)!;
    }

    const commonPath = path.join(this.extensionUri.fsPath, "assets", "common", filename);
    if (fs.existsSync(commonPath)) {
      const buffer = fs.readFileSync(commonPath);
      const base64 = `data:image/png;base64,${buffer.toString("base64")}`;
      this.pngBase64Cache.set(cacheKey, base64);
      return base64;
    }

    return null;
  }

  // ─── Layout Helpers ─────────────────────────────────────────────────

  /**
   * Calculates the render dimensions for a sprite frame.
   */
  public getRenderDimensions(frameWidth: number, frameHeight: number): { width: number; height: number } {
    const scale = this.displaySize / frameHeight;
    return {
      width: Math.round(frameWidth * scale),
      height: Math.round(frameHeight * scale),
    };
  }

  /**
   * Calculates the CSS margin string for zero-layout-footprint positioning,
   * dynamically compensating for body asymmetry when facing left.
   */
  public getMarginString(
    frameWidth: number,
    frameHeight: number,
    editorLineHeight: number = 20,
    dir: 1 | -1 = 1,
    asymmetryX: number = 0
  ): string {
    const scale = this.displaySize / frameHeight;
    const renderWidth = Math.round(frameWidth * scale);
    const renderHeight = Math.round(frameHeight * scale);

    // Dynamic Baseline Compensation:
    // When renderHeight > editorLineHeight, offset upwards by the difference
    // so the character expands upwards and feet remain anchored to the text baseline.
    const baselineOverflow = Math.max(0, renderHeight - editorLineHeight);
    const topOffset = -baselineOverflow - Math.round(2 * scale);

    if (dir === -1 && asymmetryX !== 0) {
      const shiftX = Math.round(asymmetryX * scale);
      const marginLeft = -shiftX;
      const marginRight = -(renderWidth - shiftX);
      return `${topOffset}px ${marginRight}px 0 ${marginLeft}px`;
    }

    return `${topOffset}px ${-renderWidth}px 0 0px`;
  }
}

