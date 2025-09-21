import { EXTENSION_NAME } from './constants'

export const INVALID_SETTING_DEFINITION_ID_MESSAGE = (id: string | undefined): string =>
  `[${EXTENSION_NAME}] Ayar tanımı geçersiz (id: ${id ?? 'undefined'}).`
