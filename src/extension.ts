import { ExtensionContext, window as vscWindow, workspace as vscWorkspace } from 'vscode'
import ExtensionManager from './manager'

/**
 * @summary Entry point of the extension. Imports the modular classes and helpers,
 * registers the commands, and wires the lifecycle.
 */
export async function activate(context: ExtensionContext): Promise<void> {
  const manager = new ExtensionManager(context)
  context.subscriptions.push(manager)

  await manager.init()

  /**
   * @summary Registers the `onDidChangeConfiguration` listener.
   * @description The listener fires whenever the VS Code configuration changes.
   */
  const configurationListener = vscWorkspace.onDidChangeConfiguration(async (event) => {
    await manager.configurationDidChange(event)
  })

  /**
   * @summary Registers the `onDidChangeActiveTextEditor` listener.
   * @description The listener runs whenever the active editor instance changes.
   */
  const editorListener = vscWindow.onDidChangeActiveTextEditor(() => {
    void manager.activeResourceDidChange()
  })

  context.subscriptions.push(configurationListener, editorListener)
  /** End of activation */
}

/**
 * @summary Registers the `deactivate` hook.
 * @description Invoked when the extension is being torn down. Use it to perform cleanup work.
 */
export function deactivate() {
  // Placeholder for extension shutdown logic.
}
