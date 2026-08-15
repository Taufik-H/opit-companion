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
    reverse: boolean = false
  ): vscode.Uri | null {
    const adjustedDuration = (durationSeconds / this.animationSpeed).toFixed(2);
    const animCount = oneShot ? "1 forwards" : "infinite";
    const animDirection = reverse ? "reverse" : "normal";

    // CRITICAL: One-shot animations (teleport) must NEVER be cached.
    // Cached SVGs reuse the same data URI → VS Code's webview won't restart
    // the CSS animation, causing the teleport to appear frozen/invisible.
    // Only cache looping (infinite) animations.
    if (!oneShot) {
      const key = `gpu-60fps/${variant}/${filename}/${this.displaySize}/${dir}/${adjustedDuration}/${animDirection}`;
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

    const animName = `anim_${Math.random().toString(36).substring(2, 7)}`;

    // Self-animating 60 FPS GPU Composite Thread SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidth}" height="${renderHeight}" viewBox="0 0 ${frameWidth} ${frameHeight}">
      <style>
        @keyframes ${animName} {
          0% { transform: translate(0px, 0); }
          100% { transform: translate(-${totalWidth}px, 0); }
        }
        .gpu-sprite {
          animation: ${animName} ${adjustedDuration}s steps(${totalFrames}) ${animCount};
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

    // Only cache looping animations; one-shot must be fresh each time
    if (!oneShot) {
      const key = `gpu-60fps/${variant}/${filename}/${this.displaySize}/${dir}/${adjustedDuration}/${animDirection}`;
      this.svgUriCache.set(key, uri);
    }

    return uri;
  }

  // ─── PNG Loading ────────────────────────────────────────────────────

  /**
   * Loads a PNG sprite sheet as base64 data URI.
   * Searches multiple asset directories with fallback paths.
   */
  private loadPngBase64(variant: string, filename: string): string | null {
    const cacheKey = `${variant}/${filename}`;
    if (this.pngBase64Cache.has(cacheKey)) {
      return this.pngBase64Cache.get(cacheKey)!;
    }

    const pathsToTry = [
      path.join(this.extensionUri.fsPath, "assets", variant, filename),
      path.join(this.extensionUri.fsPath, "assets", "pink", filename),
    ];

    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        const buffer = fs.readFileSync(p);
        const base64 = `data:image/png;base64,${buffer.toString("base64")}`;
        this.pngBase64Cache.set(cacheKey, base64);
        return base64;
      }
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
   * Calculates the CSS margin string for zero-layout-footprint positioning.
   */
  public getMarginString(frameWidth: number, frameHeight: number): string {
    const scale = this.displaySize / frameHeight;
    const renderWidth = Math.round(frameWidth * scale);
    const topOffset = -Math.round(2 * scale);
    return `${topOffset}px ${-renderWidth}px 0 0px`;
  }
}
