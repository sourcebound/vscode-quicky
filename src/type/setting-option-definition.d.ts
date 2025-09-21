import ValueType from './option-value'

interface SettingOptionDefinition {
  label: string
  rawValue: ValueType
  contextValueKey: string
  description?: string
}

export default SettingOptionDefinition
