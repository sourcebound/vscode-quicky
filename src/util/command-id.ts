import { EXTENSION_ID } from '@lib/constants'

// Produces a unique command identifier by prefixing with the extension id.
export const makeCommandId = <T extends string>(commandName: T): T =>
  (EXTENSION_ID + '.' + commandName) as T
