import SettingOptionDefinition from './setting-option-definition'
import ValueType from './option-value'

interface SettingDefinition {
  id: string
  label: string
  options: SettingOptionDefinition[]
  defaultOptionValue: ValueType
  contextKey: string
  source: string
}

export default SettingDefinition
