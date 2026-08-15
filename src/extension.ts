import * as vscode from "vscode";
import { EditorObserver } from "./EditorObserver";
import { InlineCompanion } from "./InlineCompanion";
import { SidebarProvider } from "./SidebarProvider";
import { CharacterRegistry } from "./CharacterRegistry";
import { EditorSettingsManager } from "./EditorSettingsManager";

export async function activate(context: vscode.ExtensionContext) {
  // Initialize Dynamic Character Registry
  const characterRegistry = new CharacterRegistry(context.extensionUri);

  const inlineCompanion = new InlineCompanion(context.extensionUri, characterRegistry);
  inlineCompanion.startAnimation(context);

  // Automatically apply editor & cursor calibration across all IDEs
  await EditorSettingsManager.applyAllSettings();

  // Register Sidebar Webview View Provider
  const sidebarProvider = new SidebarProvider(
    context.extensionUri,
    inlineCompanion,
    characterRegistry,
    async () => {
      await EditorSettingsManager.applyAllSettings(true);
    }
  );

  // Register Toggle Active / Inactive Command
  const toggleCommand = vscode.commands.registerCommand("opit.toggleEnabled", async () => {
    const isNowEnabled = inlineCompanion.toggleEnabled();
    const config = vscode.workspace.getConfiguration("opit");
    await config.update("enabled", isNowEnabled, vscode.ConfigurationTarget.Global);
    sidebarProvider.syncCurrentConfig();
    vscode.window.showInformationMessage(
      `OPIT Companion is now ${isNowEnabled ? "Active (Enabled) 👾" : "Inactive (Disabled) 💤"}`
    );
  });
  context.subscriptions.push(toggleCommand);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Register Editor Observer
  const observer = new EditorObserver((state, isEventTriggered, metadata) => {
    inlineCompanion.setState(state, isEventTriggered, metadata);
  }, inlineCompanion);
  observer.registerListeners(context);
  context.subscriptions.push({ dispose: () => observer.dispose() });

  // Configuration change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("opit")) {
        inlineCompanion.updateConfig();
        sidebarProvider.syncCurrentConfig();
      }
    })
  );

  // Check for extension update and notify user with friendly toast
  const currentVersion = context.extension?.packageJSON?.version;
  const lastVersion = context.globalState.get<string>("opit.lastVersion");

  if (currentVersion && lastVersion && lastVersion !== currentVersion) {
    vscode.window
      .showInformationMessage(
        `🎉 OPIT Companion updated to v${currentVersion}! Dynamic baseline tracking is now active.`,
        "Open Dashboard",
        "View Releases"
      )
      .then((selection) => {
        if (selection === "Open Dashboard") {
          vscode.commands.executeCommand("opit.sidebarView.focus");
        } else if (selection === "View Releases") {
          vscode.env.openExternal(
            vscode.Uri.parse("https://github.com/Taufik-H/opit-companion/releases")
          );
        }
      });
  }

  if (currentVersion) {
    context.globalState.update("opit.lastVersion", currentVersion);
  }

  // Register Commands
  const changeVariantHandler = async () => {
    const characters = characterRegistry.getAllCharacters();
    const items = characters.map((c) => ({
      label: c.name,
      description: `[${c.badge}]`,
      detail: c.author ? `by ${c.author}` : undefined,
      variantId: c.id,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a skin variant for your OPIT Companion 👾",
    });

    if (selected) {
      inlineCompanion.setVariant(selected.variantId);
      await vscode.workspace
        .getConfiguration("opit")
        .update("variant", selected.variantId, vscode.ConfigurationTarget.Global);
    }
  };

  const applySettingsHandler = async () => {
    await EditorSettingsManager.applyAllSettings(true);
    vscode.window.showInformationMessage("OPIT Companion: Applied editor settings across all IDE windows! 👾✨");
  };

  const testErrorHandler = () => {
    inlineCompanion.setState("error");
    vscode.window.showWarningMessage("OPIT Companion: Simulated error reaction (error.png)! 🤒");
  };

  const testSaveHandler = () => {
    inlineCompanion.setState("save");
    vscode.window.showInformationMessage("OPIT Companion: Simulated save reaction (shortcut-save.png)! 🎉");
  };

  const cursorDownHandler = async () => {
    const editor = vscode.window.activeTextEditor;
    const beforeLine = editor?.selection.active.line;
    const beforeChar = editor?.selection.active.character;

    // Execute the original built-in cursorDown
    await vscode.commands.executeCommand("cursorDown");

    if (editor) {
      const afterLine = editor.selection.active.line;
      const afterChar = editor.selection.active.character;

      if (beforeLine === afterLine && beforeChar === afterChar) {
        // Cursor didn't move — stuck at bottom! Show struggling animation
        inlineCompanion.setState("stuck_down", true);
      }
    }
  };

  const cursorLeftHandler = async () => {
    const editor = vscode.window.activeTextEditor;
    const wasAtLeftEdge = editor ? editor.selection.active.character === 0 : false;

    await vscode.commands.executeCommand("cursorLeft");

    if (wasAtLeftEdge) {
      // Character was at column 0 — bumping into left wall!
      inlineCompanion.setState("stuck_left", true);
    }
  };

  // Register OPIT commands
  context.subscriptions.push(
    vscode.commands.registerCommand("opit.changeVariant", changeVariantHandler),
    vscode.commands.registerCommand("opit.applySettings", applySettingsHandler),
    vscode.commands.registerCommand("opit.testError", testErrorHandler),
    vscode.commands.registerCommand("opit.testSave", testSaveHandler),
    vscode.commands.registerCommand("opit.cursorDown", cursorDownHandler),
    vscode.commands.registerCommand("opit.cursorLeft", cursorLeftHandler)
  );
}

export function deactivate() {}

