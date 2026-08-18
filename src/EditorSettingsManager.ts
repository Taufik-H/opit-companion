import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

export class EditorSettingsManager {
  public static async applyAllSettings(userPrompted: boolean = false): Promise<void> {
    await this.applyVSCodeFamilySettings();
    await this.syncZedSettings();
  }

  public static async setCursorVisibility(showCursor: boolean): Promise<void> {
    try {
      const workbenchConfig = vscode.workspace.getConfiguration("workbench");
      const colorCustomizations = workbenchConfig.get<Record<string, string>>("colorCustomizations") || {};
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
        vscode.ConfigurationTarget.Global
      );
    } catch (e) {
      console.warn("OPIT Companion: Could not update cursor visibility", e);
    }
  }

  private static async applyVSCodeFamilySettings(): Promise<void> {
    try {
      const opitConfig = vscode.workspace.getConfiguration("opit");
      const showCursor = opitConfig.get<boolean>("showCursor", false);

      const editorConfig = vscode.workspace.getConfiguration("editor");
      await editorConfig.update("cursorSmoothCaretAnimation", "off", vscode.ConfigurationTarget.Global);
      await editorConfig.update("cursorBlinking", "solid", vscode.ConfigurationTarget.Global);

      // Restore normal letter spacing and cursor width if previously set to custom wide values
      const letterSpacingInspect = editorConfig.inspect<number>("letterSpacing");
      if (letterSpacingInspect?.globalValue !== undefined && letterSpacingInspect.globalValue !== 0) {
        await editorConfig.update("letterSpacing", undefined, vscode.ConfigurationTarget.Global);
      }
      if (letterSpacingInspect?.workspaceValue !== undefined && letterSpacingInspect.workspaceValue !== 0) {
        await editorConfig.update("letterSpacing", undefined, vscode.ConfigurationTarget.Workspace);
      }
      const cursorWidthInspect = editorConfig.inspect<number>("cursorWidth");
      if (cursorWidthInspect?.globalValue !== undefined && cursorWidthInspect.globalValue > 5) {
        await editorConfig.update("cursorWidth", undefined, vscode.ConfigurationTarget.Global);
      }
      if (cursorWidthInspect?.workspaceValue !== undefined && cursorWidthInspect.workspaceValue > 5) {
        await editorConfig.update("cursorWidth", undefined, vscode.ConfigurationTarget.Workspace);
      }

      const workbenchConfig = vscode.workspace.getConfiguration("workbench");
      const colorCustomizations = workbenchConfig.get<Record<string, string>>("colorCustomizations") || {};
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
        vscode.ConfigurationTarget.Global
      );
    } catch (e) {
      console.warn("OPIT Companion: Could not apply VS Code family settings", e);
    }
  }

  private static async syncZedSettings(): Promise<void> {
    try {
      const homeDir = os.homedir();
      const zedConfigPath = path.join(homeDir, ".config", "zed", "settings.json");
      if (fs.existsSync(zedConfigPath)) {
        const raw = fs.readFileSync(zedConfigPath, "utf8");
        let config: Record<string, any> = {};
        try { config = JSON.parse(raw); } catch { return; }
        config.cursor_blink = false;
        config.cursor_shape = "bar";
        fs.writeFileSync(zedConfigPath, JSON.stringify(config, null, 2), "utf8");
      }
    } catch (e) {}
  }
}
