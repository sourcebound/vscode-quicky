import RawSettingDefinition from '@type/raw-setting-definition'

export const EXTENSION_NAME: string = 'Quicky'
export const EXTENSION_ID: string = EXTENSION_NAME.toLowerCase()

export const CONFIG_SECTION: string = EXTENSION_ID.toLowerCase()

export const CONFIG_SETTING_DEFINITIONS: string = 'settingDefinitions'

export const CONFIGURATION_NAME: string = `${CONFIG_SECTION}.${CONFIG_SETTING_DEFINITIONS}`

export const DEFAULT_CONFIG_DEFINITIONS: RawSettingDefinition[] = [
  {
    id: 'workbench.experimental.share.enabled',
    label: 'Share button visibility',
    options: [
      { value: true, label: 'Visible' },
      { value: false, label: 'Hidden' },
    ],
    defaultOptionValue: true,
  },
]

export const RAW_BUILTIN_DEFINITIONS: RawSettingDefinition[] = [
  {
    id: 'typescript.referencesCodeLens.enabled',
    label: 'TypeScript Reference CodeLens',
    options: [
      { value: true, label: 'On' },
      { value: false, label: 'Off' },
    ],
    defaultOptionValue: true,
  },
  {
    id: 'javascript.referencesCodeLens.enabled',
    label: 'JavaScript Reference CodeLens',
    options: [
      { value: true, label: 'On' },
      { value: false, label: 'Off' },
    ],
    defaultOptionValue: true,
  },
]
