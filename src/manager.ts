import {
  ConfigurationChangeEvent,
  ConfigurationTarget,
  Disposable,
  ExtensionContext,
  l10n,
  commands as vscCmds,
  window as vscWindow,
  workspace as vscWorkspace,
  WorkspaceConfiguration,
} from 'vscode'

import { makeCommandId } from '@util/command-id'
import ValueType from '@type/option-value'
import SettingDefinition from '@type/setting-definition'
import RawSettingDefinition from '@type/raw-setting-definition'
import ConfigurationInspection from '@type/configuration-inspection'
import SettingOptionDefinition from '@type/setting-option-definition'
import {
  CONFIG_SECTION,
  CONFIG_SETTING_DEFINITIONS,
  CONFIGURATION_NAME,
  EXTENSION_NAME,
} from '@lib/constants'
import { DefinitionQuickPickItem, OptionQuickPickItem } from '@type/pick-item'
import {
  areValuesEquivalent,
  coerceToMatchSample,
  extractRawDefinitions,
  extractSampleValue,
  hasAnyUserValue,
  normalizeDefinition,
  normalizeOptionValue,
  resolveUpdateTarget,
  setContextValue,
} from '@util/helper'

import { DEFAULT_CONFIG_DEFINITIONS, RAW_BUILTIN_DEFINITIONS } from '@lib/constants'

/**
 * ExtensionManager sınıfı, VSCode uzantısının ana yönetici sınıfıdır.
 * @description Bu sınıf, uzantının temel işlevlerini yönetir ve VSCode'un yapılandırma değişikliklerini izler.
 * @implements {Disposable} Olay dinleme veya bir zamanlayıcı gibi kaynakları serbest bırakabilen bir türü temsil eder.
 */
export default class ExtensionManager implements Disposable {
  /**
   * Ayar tanımları.
   */
  private definitions: SettingDefinition[] = []
  /**
   * Ayar tanımlarının `ID`leri.
   */
  private definitionIds = new Set<string>()
  private reloadPromise: Promise<void> | undefined

  /**
   * Ayar tanımlarının yeniden yüklenip yüklenmeme kararını kontrol eder.
   */
  private needsReload = true

  /**
   * ExtensionManager'ın serbest bırakılıp bırakılmadığını kontrol eder.
   */
  private disposed = false

  /**
   * Çıktı kanalı.
   */
  private readonly output = vscWindow.createOutputChannel(EXTENSION_NAME)

  constructor(private readonly context: ExtensionContext) {
    this.context.subscriptions.push(this.output)
  }

  async init(): Promise<void> {
    await this.ensureInitialDefinitions()
    await this.reloadDefinitions(true)

    const commandDisposable = vscCmds.registerCommand(
      ExtensionManager.SHOW_SETTINGS_MENU_COMMAND_ID,
      async () => {
        await this.reloadDefinitions(false)
        if (this.definitions.length === 0) {
          void vscWindow.showInformationMessage(l10n.t('Görüntülenecek ayar bulunmuyor.'))
          return
        }
        await this.showDefinitionPicker()
      },
    )

    this.context.subscriptions.push(commandDisposable)

    await this.refreshContextValues()
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
  }

  /**
   * @summary Yapılandırmadaki değişikliği tanımlayan eventi ele alır.
   * @param event Yapılandırmadaki değişikliği tanımlayan event.
   * @returns
   */
  async handleConfigurationChange(event: ConfigurationChangeEvent): Promise<void> {
    if (event.affectsConfiguration(CONFIGURATION_NAME)) {
      this.markDefinitionsDirty()
      await this.reloadDefinitions(true)
      await this.refreshContextValues()
      return
    }

    if (this.definitionIds.size === 0) {
      return
    }

    for (const id of this.definitionIds) {
      if (event.affectsConfiguration(id)) {
        await this.refreshContextValues()
        break
      }
    }
  }

  async refreshContextValues(): Promise<void> {
    await this.reloadDefinitions(false)

    const configuration = vscWorkspace.getConfiguration()
    const promises: Promise<void>[] = []

    for (const definition of this.definitions) {
      const inspect = configuration.inspect<unknown>(definition.id)
      const currentValue = this.getCurrentValue(definition, configuration, inspect)
      promises.push(setContextValue(definition.contextKey, currentValue))

      for (const option of definition.options) {
        const optionValue = this.coerceOptionValue(option.rawValue, inspect)
        const matches = areValuesEquivalent(currentValue, optionValue)
        promises.push(
          setContextValue(definition.contextKey + '.is.' + option.contextValueKey, matches),
        )
      }
    }

    await Promise.all(promises)
  }

  async handleActiveResourceChange(): Promise<void> {
    await this.refreshContextValues()
  }

  /**
   * Tanımların değiştiğini `needsReload` flag'ini `true` yaparak işaretler.
   */
  private markDefinitionsDirty(): void {
    this.needsReload = true
  }

  private async reloadDefinitions(force: boolean): Promise<void> {
    if (!force && !this.needsReload) {
      return
    }

    if (this.reloadPromise) {
      await this.reloadPromise
      return
    }

    this.reloadPromise = this.performReloadDefinitions()
    try {
      await this.reloadPromise
    } finally {
      this.reloadPromise = undefined
    }
  }

  private async performReloadDefinitions(): Promise<void> {
    this.needsReload = false

    const definitionsMap = new Map<string, SettingDefinition>()
    for (const rawDefinition of RAW_BUILTIN_DEFINITIONS) {
      const normalized = normalizeDefinition(rawDefinition, 'builtin')
      if (normalized) {
        definitionsMap.set(normalized.id, normalized)
      }
    }

    const configuration = vscWorkspace.getConfiguration(CONFIG_SECTION)
    const configuredDefinitions = configuration.get<unknown>(CONFIG_SETTING_DEFINITIONS, [])
    const rawDefinitions = extractRawDefinitions(configuredDefinitions)

    for (const rawDefinition of rawDefinitions) {
      const normalized = normalizeDefinition(rawDefinition, 'settings')
      if (normalized) {
        definitionsMap.set(normalized.id, normalized)
      } else {
        const id =
          typeof rawDefinition === 'object' && rawDefinition && 'id' in rawDefinition
            ? (rawDefinition as RawSettingDefinition).id
            : undefined
        this.output.appendLine(
          l10n.t('[{0}] Ayar tanımı geçersiz (id: {1}).', EXTENSION_NAME, id as string),
        )
      }
    }

    this.definitions = Array.from(definitionsMap.values())
    this.definitionIds = new Set(this.definitions.map((definition) => definition.id))
  }

  private async ensureInitialDefinitions(): Promise<void> {
    await this.ensureDefaultForConfig()
  }

  private async ensureDefaultForConfig(): Promise<void> {
    const configuration = vscWorkspace.getConfiguration(CONFIG_SECTION)
    const inspect = configuration.inspect<RawSettingDefinition[]>(CONFIG_SETTING_DEFINITIONS)
    if (hasAnyUserValue(inspect)) {
      return
    }

    try {
      await configuration.update(
        CONFIG_SETTING_DEFINITIONS,
        DEFAULT_CONFIG_DEFINITIONS,
        ConfigurationTarget.Global,
      )
      this.markDefinitionsDirty()
      this.output.appendLine(
        l10n.t('[{0}] Kullanıcı ayarlarına varsayılan tanımlar eklendi.', EXTENSION_NAME),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.output.appendLine(
        l10n.t(
          '[{0}] Kullanıcı ayarlarına varsayılan tanımlar kaydedilemedi: {1}',
          EXTENSION_NAME,
          message,
        ),
      )
    }
  }

  private async showDefinitionPicker(): Promise<void> {
    const configuration = vscWorkspace.getConfiguration()

    const items: DefinitionQuickPickItem[] = this.definitions.map((definition) => {
      const inspect = configuration.inspect<unknown>(definition.id)
      const currentValue = this.getCurrentValue(definition, configuration, inspect)
      const option = this.findOptionByValue(definition, currentValue, inspect)
      return {
        label: definition.label,
        description: option ? l10n.t('Aktif: {0}', option.label) : undefined,
        detail: option ? undefined : l10n.t('Seçili değer tanımlı seçeneklerle eşleşmiyor'),
        definition,
      }
    })

    if (items.length === 0) {
      void vscWindow.showInformationMessage(l10n.t('Görüntülenecek ayar bulunmuyor.'))
      return
    }

    const picked = await vscWindow.showQuickPick(items, {
      placeHolder: l10n.t('Güncellemek istediğiniz ayarı seçin'),
    })

    if (!picked) {
      return
    }

    await this.showOptionPicker(picked.definition)
  }

  private async showOptionPicker(definition: SettingDefinition): Promise<void> {
    const configuration = vscWorkspace.getConfiguration()
    const inspect = configuration.inspect<unknown>(definition.id)
    const currentValue = this.getCurrentValue(definition, configuration, inspect)

    const items: OptionQuickPickItem[] = definition.options.map((option) => {
      const optionValue = this.coerceOptionValue(option.rawValue, inspect)
      const isCurrent = areValuesEquivalent(currentValue, optionValue)
      return {
        label: option.label,
        description: option.description,
        picked: isCurrent,
        detail: isCurrent ? 'Şu anda seçili' : undefined,
        option,
      }
    })

    const selection = await vscWindow.showQuickPick(items, {
      placeHolder: definition.label,
    })

    if (!selection) {
      return
    }

    const selectedValue = this.coerceOptionValue(selection.option.rawValue, inspect)
    if (areValuesEquivalent(currentValue, selectedValue)) {
      return
    }

    await this.applyOption(definition, selection.option, inspect)
  }

  private async applyOption(
    definition: SettingDefinition,
    option: SettingOptionDefinition,
    inspect: ConfigurationInspection<unknown> | undefined,
  ): Promise<void> {
    const configuration = vscWorkspace.getConfiguration()
    const resolvedInspect = inspect ?? configuration.inspect<unknown>(definition.id)
    const valueToWrite = this.coerceOptionValue(option.rawValue, resolvedInspect)
    const target = resolveUpdateTarget(definition.id, resolvedInspect)

    await configuration.update(definition.id, valueToWrite, target)
    await this.refreshContextValues()

    void vscWindow.showInformationMessage(l10n.t('{0}: {1}', definition.label, option.label))
  }

  private findOptionByValue(
    definition: SettingDefinition,
    value: ValueType,
    inspect: ConfigurationInspection<unknown> | undefined,
  ): SettingOptionDefinition | undefined {
    for (const option of definition.options) {
      const optionValue = this.coerceOptionValue(option.rawValue, inspect)
      if (areValuesEquivalent(value, optionValue)) {
        return option
      }
    }
    return undefined
  }

  private getCurrentValue(
    definition: SettingDefinition,
    configuration: WorkspaceConfiguration,
    inspect: ConfigurationInspection<unknown> | undefined,
  ): ValueType {
    const current = configuration.get<unknown>(definition.id)
    const normalizedCurrent = normalizeOptionValue(current)
    if (normalizedCurrent !== undefined) {
      return normalizedCurrent
    }

    const coercedDefault = this.coerceOptionValue(definition.defaultOptionValue, inspect)
    const normalizedDefault = normalizeOptionValue(coercedDefault)
    if (normalizedDefault !== undefined) {
      return normalizedDefault
    }

    return definition.options[0]?.rawValue ?? null
  }

  private coerceOptionValue(
    value: ValueType,
    inspect: ConfigurationInspection<unknown> | undefined,
  ): ValueType {
    const sample = extractSampleValue(inspect)
    return coerceToMatchSample(value, sample)
  }

  /**
   * Konfigürasyon anahtarı: `quicky.showSettingsMenu`
   */
  public static SHOW_SETTINGS_MENU_COMMAND_ID = makeCommandId('showSettingsMenu')
}
