import * as vscode from 'vscode';

type SettingOption = {
  key: string;
  label: string;
  commandId: string;
  contextKey: string;
  defaultValue: boolean;
};

const settingOptions: SettingOption[] = [
  {
    key: 'typescript.referencesCodeLens.enabled',
    label: 'TypeScript Referans CodeLens',
    commandId: 'quicky.toggleTypeScriptLens',
    contextKey: 'quicky.typescriptLensEnabled',
    defaultValue: true,
  },
  {
    key: 'javascript.referencesCodeLens.enabled',
    label: 'JavaScript Referans CodeLens',
    commandId: 'quicky.toggleJavaScriptLens',
    contextKey: 'quicky.javascriptLensEnabled',
    defaultValue: true,
  },
];

export function activate(context: vscode.ExtensionContext) {
  for (const option of settingOptions) {
    const disposable = vscode.commands.registerCommand(option.commandId, async () => {
      await toggleSetting(option);
    });
    context.subscriptions.push(disposable);
  }

  const configurationListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (settingOptions.some((option) => event.affectsConfiguration(option.key))) {
      void refreshAllContexts();
    }
  });

  const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(() => {
    void refreshAllContexts();
  });

  context.subscriptions.push(configurationListener, editorChangeListener);

  void refreshAllContexts();
}

async function toggleSetting(option: SettingOption): Promise<void> {
  const resource = getActiveResource();
  const configuration = vscode.workspace.getConfiguration(undefined, resource);
  const currentValue = configuration.get<boolean>(option.key, option.defaultValue);
  const target = resolveUpdateTarget(option.key, resource);
  const newValue = !currentValue;

  await configuration.update(option.key, newValue, target);
  await setContextValue(option.contextKey, newValue);

  void vscode.window.showInformationMessage(`${option.label}: ${newValue ? 'Açık' : 'Kapalı'}`);
}

async function refreshAllContexts(resource: vscode.Uri | undefined = getActiveResource()): Promise<void> {
  const configuration = vscode.workspace.getConfiguration(undefined, resource);
  await Promise.all(
    settingOptions.map(async (option) => {
      const value = configuration.get<boolean>(option.key, option.defaultValue);
      await setContextValue(option.contextKey, value);
    }),
  );
}

async function setContextValue(contextKey: string, value: boolean): Promise<void> {
  await vscode.commands.executeCommand('setContext', contextKey, value);
}

function resolveUpdateTarget(settingKey: string, resource: vscode.Uri | undefined): vscode.ConfigurationTarget {
  const inspectResult = vscode.workspace.getConfiguration(undefined, resource).inspect<boolean>(settingKey);

  if (resource && inspectResult?.workspaceFolderValue !== undefined) {
    return vscode.ConfigurationTarget.WorkspaceFolder;
  }

  if (inspectResult?.workspaceValue !== undefined) {
    return vscode.ConfigurationTarget.Workspace;
  }

  if (inspectResult?.globalValue !== undefined) {
    return vscode.ConfigurationTarget.Global;
  }

  if (resource) {
    return vscode.ConfigurationTarget.WorkspaceFolder;
  }

  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    return vscode.ConfigurationTarget.Workspace;
  }

  return vscode.ConfigurationTarget.Global;
}

function getActiveResource(): vscode.Uri | undefined {
  return vscode.window.activeTextEditor?.document.uri;
}

export function deactivate() {
  // Nothing to clean up yet.
}
