import RawSettingDefinition from '@type/raw-setting-definition'

export const EXTENSION_NAME: string = 'Quicky'
export const EXTENSION_ID: string = EXTENSION_NAME.toLowerCase()

export const CONFIG_SECTION: string = EXTENSION_ID.toLowerCase()

export const CONFIG_SETTING_DEFINITIONS: string = 'settingDefinitions'

export const CONFIGURATION_NAME: string = `${CONFIG_SECTION}.${CONFIG_SETTING_DEFINITIONS}`

export const DEFAULT_CONFIG_DEFINITIONS: RawSettingDefinition[] = [
  {
    id: 'workbench.experimental.share.enabled',
    label: 'Paylaş butonu görünürlüğü',
    options: [
      { value: true, label: 'Görünür' },
      { value: false, label: 'Gizli' },
    ],
    defaultOptionValue: true,
  },
]

export const RAW_BUILTIN_DEFINITIONS: RawSettingDefinition[] = [
  {
    id: 'typescript.referencesCodeLens.enabled',
    label: 'TypeScript Referans CodeLens',
    options: [
      { value: true, label: 'Açık' },
      { value: false, label: 'Kapalı' },
    ],
    defaultOptionValue: true,
  },
  {
    id: 'javascript.referencesCodeLens.enabled',
    label: 'JavaScript Referans CodeLens',
    options: [
      { value: true, label: 'Açık' },
      { value: false, label: 'Kapalı' },
    ],
    defaultOptionValue: true,
  },
]
