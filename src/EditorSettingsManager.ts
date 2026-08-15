import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

export class EditorSettingsManager {
  public static async applyAllSettings(userPrompted: boolean = false): Promise<void> {
    await this.applyVSCodeFamilySettings();
    await this.ensureWorkspaceEditorConfig();
    await this.syncZedSettings();
  }

  public static async setCursorVisibility(showCursor: boolean): Promise<void> {
    try {
      const targets = [vscode.ConfigurationTarget.Global];
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        targets.push(vscode.ConfigurationTarget.Workspace);
      }

      for (const target of targets) {
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

        await workbenchConfig.update("colorCustomizations", Object.keys(updatedColors).length > 0 ? updatedColors : undefined, target);
      }
    } catch (e) {
      console.warn("OPIT Companion: Could not update cursor visibility", e);
    }
  }

  private static async applyVSCodeFamilySettings(): Promise<void> {
    try {
      const opitConfig = vscode.workspace.getConfiguration("opit");
      const showCursor = opitConfig.get<boolean>("showCursor", false);

      const targets = [vscode.ConfigurationTarget.Global];
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        targets.push(vscode.ConfigurationTarget.Workspace);
      }

      for (const target of targets) {
        const editorConfig = vscode.workspace.getConfiguration("editor");
        await editorConfig.update("cursorSmoothCaretAnimation", "off", target);
        await editorConfig.update("cursorBlinking", "solid", target);

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

        await workbenchConfig.update("colorCustomizations", Object.keys(updatedColors).length > 0 ? updatedColors : undefined, target);
      }
    } catch (e) {
      console.warn("OPIT Companion: Could not apply VS Code family settings", e);
    }
  }

  private static async ensureWorkspaceEditorConfig(): Promise<void> {
    try {
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) return;
      const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const editorConfigPath = path.join(rootPath, ".editorconfig");
      if (!fs.existsSync(editorConfigPath)) {
        const content = "root = true\n\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\ncharset = utf-8\n";
        fs.writeFileSync(editorConfigPath, content, "utf8");
      }
    } catch (e) {
      console.warn("OPIT Companion: Could not ensure .editorconfig file", e);
    }
  }

  private static async syncZedSettings(): Promise<void> {
    try {
      const homeDir = os.homedir();
      const zedConfigPath = path.join(homeDir, ".config", "zed", "settings.json");
      if (fs.existsSync(zedConfigPath)) {
        const raw = fs.readFileSync(zedConfigPath, "utf8");
        let config = {};
        try { config = JSON.parse(raw); } catch { return; }
        config.cursor_blink = false;
        config.cursor_shape = "bar";
        fs.writeFileSync(zedConfigPath, JSON.stringify(config, null, 2), "utf8");
      }
    } catch (e) {}
  }
}
