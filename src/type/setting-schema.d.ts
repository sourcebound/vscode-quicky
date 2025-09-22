// new api design

interface QuickyConfigurationItemSchema {
  /** VS Code configuration key, e.g., "typescript.referencesCodeLens.enabled" */
  key: string

  /** Label displayed in the menu (falls back to `key` when omitted) */
  label: string

  /** Value configuration */
  value: ValueConfiguration
}

interface ValueConfiguration {
  /** Value type, e.g., "toggle", "number", "string", "color", "file", "directory", "enum" */
  type: string

  /** Default value */
  default: unknown

  /** Value labels, e.g., { "on": "On", "off": "Off" } */
  labels: Record<string, string>

  /** Value mapping, e.g., { "on": true, "off": false } */
  mapping: Record<string, string>
}
