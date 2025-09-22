// new api design

interface QuickyConfigurationItemSchema {
  /** VS Code configuration anahtarı, örn: "typescript.referencesCodeLens.enabled" */
  key: string

  /** Menüde gösterilecek `label` başlık (boş bırakılırsa `key` kullanılır) */
  label: string

  /** Değer yapılandırması */
  value: ValueConfiguration
}

interface ValueConfiguration {
  /** Değer türü, örn: "toggle", "number", "string", "color", "file", "directory", "enum" */
  type: string

  /** Varsayılan değer */
  default: unknown

  /** Değer etiketleri, örn: { "on": "Açık", "off": "Kapalı" } */
  labels: Record<string, string>

  /** Değer eşleştirmesi, örn: { "on": true, "off": false } */
  mapping: Record<string, string>
}
