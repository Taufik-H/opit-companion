import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

export class EditorSettingsManager {
  /**
   * Applies complete editor settings across VS Code-family IDEs (VS Code, Cursor, Windsurf, VSCodium)
   * and syncs with other supported editors (Zed, EditorConfig).
   */
  public static async applyAllSettings(userPrompted: boolean = false): Promise<void> {
    await this.applyVSCodeFamilySettings();
    await this.ensureWorkspaceEditorConfig();
    await this.syncZedSettings();
  }

  /**
   * Toggles native text cursor visibility across all open IDE windows
   */
  public static async setCursorVisibility(showCursor: boolean): Promise<void> {
    try {
      const targets = [vscode.ConfigurationTarget.Global];
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        targets.push(vscode.ConfigurationTarget.Workspace);
      }

      for (const target of targets) {
        const workbenchConfig = vscode.workspace.getConfiguration("workbench");
        const colorCustomizations =
          workbenchConfig.get<Record<string, string>>("colorCustomizations") || {};
        const updatedColors = { ...colorCustomizations };

        if (showCursor) {
          delete updatedColors["editorCursor.foreground"];
          delete updatedColors["editorCursor.background"];
        } else {
          updatedColors["editorCursor.foreground"] = "#00000000";
          updatedColors["editorCursor.background"] = "#00000000";
        }

        await workbenchConfig.update(
          "colorCustomizations",
          Object.keys(updatedColors).length > 0 ? updatedColors : undefined,
          target
        );
      }
    } catch (e) {
      console.warn("OPIT Companion: Could not update cursor visibility", e);
    }
  }

  /**
   * Applies settings directly to VS Code / Cursor / Windsurf / VSCodium configuration API
   */
  private static async applyVSCodeFamilySettings(): Promise<void> {
    try {
      const opitConfig = vscode.workspace.getConfiguration("opit");
      const showCursor = opitConfig.get<boolean>("showCursor", true);

      const targets = [vscode.ConfigurationTarget.Global];
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        targets.push(vscode.ConfigurationTarget.Workspace);
      }

      for (const target of targets) {
        const editorConfig = vscode.workspace.getConfiguration("editor");
        await editorConfig.update("cursorStyle", "line", target);
        await editorConfig.update("cursorBlinking", "solid", target);
        await editorConfig.update("cursorSmoothCaretAnimation", "off", target);
        await editorConfig.update("cursorWidth", 2, target);
        await editorConfig.update("fontSize", 14, target);
        await editorConfig.update("lineHeight", 24, target);
        await editorConfig.update("letterSpacing", 2, target);
        await editorConfig.update("smoothScrolling", true, target);

        const workbenchConfig = vscode.workspace.getConfiguration("workbench");
        await workbenchConfig.update("list.smoothScrolling", true, target);

        const colorCustomizations =
          workbenchConfig.get<Record<string, string>>("colorCustomizations") || {};
        const updatedColors = { ...colorCustomizations };

        if (showCursor) {
          delete updatedColors["editorCursor.foreground"];
          delete updatedColors["editorCursor.background"];
        } else {
          updatedColors["editorCursor.foreground"] = "#00000000";
          updatedColors["editorCursor.background"] = "#00000000";
        }

        await workbenchConfig.update(
          "colorCustomizations",
          Object.keys(updatedColors).length > 0 ? updatedColors : undefined,
          target
        );
      }
    } catch (e) {
      console.warn("OPIT Companion: Could not apply VS Code family settings", e);
    }
  }

  /**
   * Ensures .editorconfig is present in workspace root for universal editor support
   */
  private static async ensureWorkspaceEditorConfig(): Promise<void> {
    try {
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
      }

      const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const editorConfigPath = path.join(rootPath, ".editorconfig");

      if (!fs.existsSync(editorConfigPath)) {
        const content = [
          "# EditorConfig is awesome: https://EditorConfig.org",
          "root = true",
          "",
          "[*]",
          "indent_style = space",
          "indent_size = 2",
          "end_of_line = lf",
          "charset = utf-8",
          "trim_trailing_whitespace = true",
          "insert_final_newline = true",
          "",
          "[*.md]",
          "trim_trailing_whitespace = false",
          "",
        ].join("\n");

        fs.writeFileSync(editorConfigPath, content, "utf8");
      }
    } catch (e) {
      console.warn("OPIT Companion: Could not ensure .editorconfig file", e);
    }
  }

  /**
   * Syncs matching settings to Zed editor (~/.config/zed/settings.json) if Zed is installed
   */
  private static async syncZedSettings(): Promise<void> {
    try {
      const homeDir = os.homedir();
      const zedConfigPath = path.join(homeDir, ".config", "zed", "settings.json");

      if (fs.existsSync(zedConfigPath)) {
        const raw = fs.readFileSync(zedConfigPath, "utf8");
        let config: Record<string, any> = {};
        try {
          config = JSON.parse(raw);
        } catch {
          // If JSON parse fails (e.g. comments in JSONC), skip modifying to be safe
          return;
        }

        config.buffer_font_size = 14;
        config.line_height = { custom: 1.71 };
        config.cursor_blink = false;
        config.cursor_shape = "bar";

        fs.writeFileSync(zedConfigPath, JSON.stringify(config, null, 2), "utf8");
        console.log("OPIT Companion: Synced settings with Zed editor.");
      }
    } catch (e) {
      // Non-critical, ignore if user doesn't use Zed
    }
  }
}
