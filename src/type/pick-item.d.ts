import { QuickPickItem } from 'vscode'
import SettingDefinition from './setting-definition'
import SettingOptionDefinition from './setting-option-definition'

/**
 * @abstract Represents an item that can be selected from a list.
 */
interface DefinitionQuickPickItem extends QuickPickItem {
  definition: SettingDefinition
}

interface OptionQuickPickItem extends QuickPickItem {
  option: SettingOptionDefinition
}

export { DefinitionQuickPickItem, OptionQuickPickItem }
