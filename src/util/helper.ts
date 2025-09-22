import ValueType from '@/type/option-value'
import ConfigurationInspection from '../type/configuration-inspection'
import RawSettingDefinition from '@/type/raw-setting-definition'
import SettingDefinition from '@/type/setting-definition'
import SettingOptionDefinition from '@/type/setting-option-definition'
import RawSettingOption from '@/type/raw-setting-option'
import { commands as vscCmds } from 'vscode'
import { ConfigurationTarget } from 'vscode'

export function hasAnyUserValue(inspect: ConfigurationInspection<unknown[]> | undefined): boolean {
  if (!inspect) {
    return false
  }
  return (
    inspect.workspaceFolderValue !== undefined ||
    inspect.workspaceFolderLanguageValue !== undefined ||
    inspect.workspaceValue !== undefined ||
    inspect.workspaceLanguageValue !== undefined ||
    inspect.globalValue !== undefined ||
    inspect.globalLanguageValue !== undefined
  )
}

export function convertStringToPrimitiveIfPossible(value: ValueType): ValueType {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  const lowered = trimmed.toLowerCase()
  if (lowered === 'true') {
    return true
  }
  if (lowered === 'false') {
    return false
  }
  if (lowered === 'null') {
    return null
  }

  const numeric = Number(trimmed)
  if (!Number.isNaN(numeric)) {
    return numeric
  }

  return value
}

export function extractRawDefinitions(value: unknown): RawSettingDefinition[] {
  if (Array.isArray(value)) {
    return value as RawSettingDefinition[]
  }

  if (value && typeof value === 'object') {
    const container = value as Record<string, unknown>
    const possibleArrays = ['definitions', 'items', 'settings']
    for (const key of possibleArrays) {
      const nested = container[key]
      if (Array.isArray(nested)) {
        return nested as RawSettingDefinition[]
      }
    }
    return [value as RawSettingDefinition]
  }

  return []
}

export function normalizeOptionValue(value: unknown): ValueType | undefined {
  if (value === null) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return undefined
}

export function buildContextKeyFromId(id: string): string {
  const sanitized = id.replace(/[^\w.-]/g, '_')
  return `quicky.setting.${sanitized}`
}

export function serializeRawValueForContext(value: ValueType): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'boolean') {
    return value ? 'bool_true' : 'bool_false'
  }
  if (typeof value === 'number') {
    return `num_${value}`
  }
  const sanitized = value.replace(/[^\w.-]/g, '_')
  return `str_${sanitized || 'empty'}`
}

export function valueToDisplayString(value: ValueType): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

export function areValuesEquivalent(a: ValueType, b: ValueType): boolean {
  if (a === b) {
    return true
  }

  if (a === null || b === null) {
    return a === b
  }

  const boolA = toBooleanLike(a)
  const boolB = toBooleanLike(b)
  if (boolA !== undefined && boolB !== undefined) {
    return boolA === boolB
  }

  const numA = toNumberLike(a)
  const numB = toNumberLike(b)
  if (numA !== undefined && numB !== undefined) {
    return numA === numB
  }

  return normalizeComparisonValue(a) === normalizeComparisonValue(b)
}

export function toBooleanLike(value: ValueType): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase()
    if (lowered === 'true') {
      return true
    }
    if (lowered === 'false') {
      return false
    }
  }
  return undefined
}

export function toNumberLike(value: ValueType): number | undefined {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return undefined
}

export function normalizeComparisonValue(value: ValueType): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'boolean') {
    return value ? 'bool:true' : 'bool:false'
  }
  if (typeof value === 'number') {
    return `num:${value}`
  }
  return `str:${value}`
}

export function extractSampleValue(inspect: ConfigurationInspection<unknown> | undefined): unknown {
  if (!inspect) {
    return undefined
  }
  if (inspect.workspaceFolderValue !== undefined) {
    return inspect.workspaceFolderValue
  }
  if (inspect.workspaceValue !== undefined) {
    return inspect.workspaceValue
  }
  if (inspect.globalValue !== undefined) {
    return inspect.globalValue
  }
  return inspect.defaultValue
}

/**
 * Örnek değere uygun değeri döndürür.
 * @param value Değer. Boolean, number, string veya null/undefined değerleri olabilir.
 * @param sample Örnek değer. Boolean, number veya string değerleri olabilir.
 * @returns Örnek değere uygun değer. Undefined veya null ise, string değerini döndürür.
 */
export function coerceToMatchSample(value: ValueType, sample: unknown): ValueType {
  if (sample === undefined || sample === null) {
    return convertStringToPrimitiveIfPossible(value)
  }

  if (typeof sample === 'boolean') {
    const bool = toBooleanLike(value)
    if (bool !== undefined) {
      return bool
    }
    if (typeof value === 'number') {
      return value !== 0
    }
    return sample
  }

  if (typeof sample === 'number') {
    const numeric = toNumberLike(value)
    if (numeric !== undefined) {
      return numeric
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0
    }
    return typeof sample === 'number' ? sample : 0
  }

  if (typeof sample === 'string') {
    if (typeof value === 'string') {
      return value
    }
    if (value === null) {
      return ''
    }
    return String(value)
  }

  return convertStringToPrimitiveIfPossible(value)
}

export async function setContextValue(contextKey: string, value: unknown): Promise<void> {
  await vscCmds.executeCommand('setContext', contextKey, value)
}

export function resolveUpdateTarget(
  _settingKey: string,
  _inspectResult: ConfigurationInspection<unknown> | undefined,
): ConfigurationTarget {
  return ConfigurationTarget.Global
}

export function normalizeDefinition(
  rawDefinition: RawSettingDefinition,
  source: string,
): SettingDefinition | undefined {
  if (!rawDefinition || typeof rawDefinition !== 'object') {
    return undefined
  }

  const id = typeof rawDefinition.id === 'string' ? rawDefinition.id.trim() : undefined
  if (!id) {
    return undefined
  }

  const label =
    typeof rawDefinition.label === 'string' && rawDefinition.label.trim().length > 0
      ? rawDefinition.label.trim()
      : id

  const optionsSource = Array.isArray(rawDefinition.options) ? rawDefinition.options : []
  const options: SettingOptionDefinition[] = []

  for (const rawOption of optionsSource) {
    if (!rawOption || typeof rawOption !== 'object') {
      continue
    }
    const option = rawOption as RawSettingOption
    const rawValue = normalizeOptionValue(option.value)
    if (rawValue === undefined) {
      continue
    }
    const optionLabel =
      typeof option.label === 'string' && option.label.trim().length > 0
        ? option.label.trim()
        : valueToDisplayString(rawValue)
    const description = typeof option.description === 'string' ? option.description : undefined

    options.push({
      label: optionLabel,
      rawValue,
      contextValueKey: serializeRawValueForContext(rawValue),
      description,
    })
  }

  if (options.length === 0) {
    return undefined
  }

  let defaultOptionValue = normalizeOptionValue(rawDefinition.defaultOptionValue)
  if (defaultOptionValue === undefined) {
    defaultOptionValue = options[0].rawValue
  } else {
    const matchingOption = options.find((option) =>
      areValuesEquivalent(option.rawValue, defaultOptionValue!),
    )
    if (matchingOption) {
      defaultOptionValue = matchingOption.rawValue
    } else {
      defaultOptionValue = options[0].rawValue
    }
  }

  return {
    id,
    label,
    options,
    defaultOptionValue,
    contextKey: buildContextKeyFromId(id),
    source,
  }
}
