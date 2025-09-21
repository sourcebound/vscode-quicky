/// rename it instead of ConfigurationInspection.
// new name should be:  ConfigurationScopes + value =
type ConfigurationInspection<T> = {
  key: string
  defaultValue?: T
  globalValue?: T
  workspaceValue?: T
  workspaceFolderValue?: T
  defaultLanguageValue?: T
  globalLanguageValue?: T
  workspaceLanguageValue?: T
  workspaceFolderLanguageValue?: T
  languageIds?: string[]
}

export default ConfigurationInspection
