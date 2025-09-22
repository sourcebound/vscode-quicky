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

import ValueType from '@type/option-value'
import { makeCommandId } from '@util/command-id'
import SettingDefinition from '@type/setting-definition'
import RawSettingDefinition from '@type/raw-setting-definition'
import ConfigurationInspection from '@type/configuration-inspection'
import SettingOptionDefinition from '@type/setting-option-definition'
import { DefinitionQuickPickItem, OptionQuickPickItem } from '@type/pick-item'
import { DEFAULT_CONFIG_DEFINITIONS, RAW_BUILTIN_DEFINITIONS } from '@lib/constants'
import {
  CONFIG_SECTION,
  CONFIG_SETTING_DEFINITIONS,
  CONFIGURATION_NAME,
  EXTENSION_NAME,
} from '@lib/constants'
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

/**
 * ExtensionManager sınıfı, VSCode uzantısının ana yönetici sınıfıdır.
 * @description Bu sınıf, uzantının temel işlevlerini yönetir ve VSCode'un yapılandırma değişikliklerini izler.
 * @implements {Disposable} Olay dinleme veya bir zamanlayıcı gibi kaynakları serbest bırakabilen bir türü temsil eder.
 */
export default class ExtensionManager implements Disposable {
  // #region Properties
  /**
   * Ayar tanımları.
   */
  private definitions: SettingDefinition[] = []
  /**
   * Ayar tanımlarının `ID`leri.
   */
  private configurationKeys: Set<string> = new Set<string>()

  /**
   * Ayar tanımlarının yeniden yüklenmesi için Promise.
   */
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
  private readonly outputChannel = vscWindow.createOutputChannel(EXTENSION_NAME)

  // #endregion

  // #region Lifecycle

  constructor(private readonly extensionContext: ExtensionContext) {
    this.extensionContext.subscriptions.push(this.outputChannel)
  }

  async init(): Promise<void> {
    await this.installInitialDefaults()
    await this.reload(true)

    const commandDisposable = vscCmds.registerCommand(
      ExtensionManager.SHOW_SETTINGS_MENU_COMMAND_ID,
      async () => {
        await this.reload(false)
        if (this.definitions.length === 0) {
          void vscWindow.showInformationMessage(l10n.t('No settings available to display.'))
          return
        }
        await this.showPicker()
      },
    )

    this.extensionContext.subscriptions.push(commandDisposable)

    await this.updateContext()
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
  }

  // #endregion Lifecycle

  // #region Methods

  /**
   * @summary Yapılandırmadaki değişikliği tanımlayan eventi ele alır.
   * @param event Yapılandırmadaki değişikliği tanımlayan event.
   * @returns
   */
  public async configurationDidChange(event: ConfigurationChangeEvent): Promise<void> {
    if (event.affectsConfiguration(CONFIGURATION_NAME)) {
      this.needsReload = true
      await this.reload(true)
      await this.updateContext()
      return
    }

    if (this.configurationKeys.size === 0) {
      return
    }

    for (const id of this.configurationKeys) {
      if (event.affectsConfiguration(id)) {
        await this.updateContext()
        break
      }
    }
  }

  public async updateContext(): Promise<void> {
    await this.reload(false)

    const configuration = vscWorkspace.getConfiguration()
    const promises: Promise<void>[] = []

    for (const definition of this.definitions) {
      const inspect = configuration.inspect<unknown>(definition.id)
      const currentValue = this.currentValueFor(definition, configuration, inspect)
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

  public async activeResourceDidChange(): Promise<void> {
    await this.updateContext()
  }

  private async reload(force: boolean): Promise<void> {
    if (!force && !this.needsReload) {
      return
    }

    if (this.reloadPromise) {
      await this.reloadPromise
      return
    }

    this.reloadPromise = this.reloadNow()
    try {
      await this.reloadPromise
    } finally {
      this.reloadPromise = undefined
    }
  }

  private async reloadNow(): Promise<void> {
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
        this.outputChannel.appendLine(
          l10n.t('[{0}] Setting definition is invalid (id: {1}).', EXTENSION_NAME, id as string),
        )
      }
    }

    this.definitions = Array.from(definitionsMap.values())
    this.configurationKeys = new Set(this.definitions.map((definition) => definition.id))
  }

  private async installInitialDefaults(): Promise<void> {
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
      this.needsReload = true
      this.outputChannel.appendLine(
        l10n.t('[{0}] Default definitions added to user settings.', EXTENSION_NAME),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.outputChannel.appendLine(
        l10n.t(
          '[{0}] Failed to save default definitions to user settings: {1}',
          EXTENSION_NAME,
          message,
        ),
      )
    }
  }

  private async showPicker(): Promise<void> {
    const configuration = vscWorkspace.getConfiguration()

    const items: DefinitionQuickPickItem[] = this.definitions.map((definition) => {
      const inspect = configuration.inspect<unknown>(definition.id)
      const currentValue = this.currentValueFor(definition, configuration, inspect)
      const option = this.optionMatching(definition, currentValue, inspect)
      return {
        label: definition.label,
        description: option ? l10n.t('Active: {0}', option.label) : undefined,
        detail: option
          ? undefined
          : l10n.t('Selected value does not match any defined option'),
        definition,
      }
    })

    if (items.length === 0) {
      void vscWindow.showInformationMessage(l10n.t('No settings available to display.'))
      return
    }

    const picked = await vscWindow.showQuickPick(items, {
      placeHolder: l10n.t('Select the setting you want to update'),
    })

    if (!picked) {
      return
    }

    await this.showSubPicker(picked.definition)
  }

  private async showSubPicker(definition: SettingDefinition): Promise<void> {
    const configuration = vscWorkspace.getConfiguration()
    const inspect = configuration.inspect<unknown>(definition.id)
    const currentValue = this.currentValueFor(definition, configuration, inspect)

    const items: OptionQuickPickItem[] = definition.options.map((option) => {
      const optionValue = this.coerceOptionValue(option.rawValue, inspect)
      const isCurrent = areValuesEquivalent(currentValue, optionValue)
      return {
        label: option.label,
        description: option.description,
        picked: isCurrent,
        detail: isCurrent ? l10n.t('Currently selected') : undefined,
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

    await this.applyOptionSelection(definition, selection.option, inspect)
  }

  private async applyOptionSelection(
    definition: SettingDefinition,
    option: SettingOptionDefinition,
    inspect: ConfigurationInspection<unknown> | undefined,
  ): Promise<void> {
    const configuration = vscWorkspace.getConfiguration()
    const resolvedInspect = inspect ?? configuration.inspect<unknown>(definition.id)
    const valueToWrite = this.coerceOptionValue(option.rawValue, resolvedInspect)
    const target = resolveUpdateTarget(definition.id, resolvedInspect)

    await configuration.update(definition.id, valueToWrite, target)
    await this.updateContext()

    void vscWindow.showInformationMessage(l10n.t('{0}: {1}', definition.label, option.label))
  }

  private optionMatching(
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

  private currentValueFor(
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

  // #endregion Methods

  // #region CommandIDs
  /**
   * Konfigürasyon anahtarı: `quicky.showSettingsMenu`
   */
  public static SHOW_SETTINGS_MENU_COMMAND_ID = makeCommandId('showSettingsMenu')
  // #endregion CommandIDs
}
