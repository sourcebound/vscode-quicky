import { QuickPickItem } from 'vscode'
import SettingDefinition from './setting-definition'
import SettingOptionDefinition from './setting-option-definition'

/**
 * @abstract Bir liste içerisinden seçilebilen bir öğeyi temsil eder.
 */
interface DefinitionQuickPickItem extends QuickPickItem {
  definition: SettingDefinition
}

interface OptionQuickPickItem extends QuickPickItem {
  option: SettingOptionDefinition
}

export { DefinitionQuickPickItem, OptionQuickPickItem }
