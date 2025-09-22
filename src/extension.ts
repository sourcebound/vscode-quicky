import { ExtensionContext, workspace as vscWorkspace } from 'vscode'
import ExtensionManager from './manager'

/**
 * Eklentinin giriş noktası.
 * Modüler yapıya ayrılmış sınıf ve yardımcıları
 * buradan içe aktarılır, komutlar kaydedilir.
 */
export async function activate(context: ExtensionContext): Promise<void> {
  const manager = new ExtensionManager(context)
  context.subscriptions.push(manager)

  await manager.init()

  /**
   * @summary `onDidChangeConfiguration` komutunu kaydeder.
   * @description `onDidChangeConfiguration` komutu, konfigürasyon değiştiğinde çağrılır.
   */
  const configurationListener = vscWorkspace.onDidChangeConfiguration(async (event) => {
    await manager.configurationDidChange(event)
  })

  context.subscriptions.push(configurationListener)
  /** Aktivasyon sonu */
}

/**
 * @summary `deactivate` komutunu kaydeder.
 * @description `deactivate` komutu, eklentiyi devre dışı bırakır. Bu fonksiyon çağrıldığında eklenti devre dışı bırakılır.
 */
export function deactivate() {
  // Eklenti devre dışı bırakıldığında yapılacak işlemler.
}
