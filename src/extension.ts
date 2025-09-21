import * as vscode from 'vscode';

type SettingOptionValue = string | number | boolean | null;

interface SettingOptionDefinition {
  label: string;
  rawValue: SettingOptionValue;
  contextValueKey: string;
  description?: string;
}

interface SettingDefinition {
  id: string;
  label: string;
  options: SettingOptionDefinition[];
  defaultOptionValue: SettingOptionValue;
  contextKey: string;
  source: string;
}

interface RawSettingOption {
  label?: unknown;
  value?: unknown;
  description?: unknown;
}

interface RawSettingDefinition {
  id?: unknown;
  label?: unknown;
  options?: unknown;
  defaultOptionValue?: unknown;
}

interface DefinitionQuickPickItem extends vscode.QuickPickItem {
  definition: SettingDefinition;
}

interface OptionQuickPickItem extends vscode.QuickPickItem {
  option: SettingOptionDefinition;
}

type ConfigurationInspection<T> = {
  key: string;
  defaultValue?: T;
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
  defaultLanguageValue?: T;
  globalLanguageValue?: T;
  workspaceLanguageValue?: T;
  workspaceFolderLanguageValue?: T;
  languageIds?: string[];
};

const CONFIG_SECTION = 'quicky';
const CONFIG_SETTING_DEFINITIONS = 'settingDefinitions';

const DEFAULT_CONFIG_DEFINITIONS: RawSettingDefinition[] = [
  {
    id: 'workbench.experimental.share.enabled',
    label: 'Paylaş butonu görünürlüğü',
    options: [
      { value: true, label: 'Görünür' },
      { value: false, label: 'Gizli' },
    ],
    defaultOptionValue: true,
  },
];

const RAW_BUILTIN_DEFINITIONS: RawSettingDefinition[] = [
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
];

class DynamicSettingsManager implements vscode.Disposable {
  private definitions: SettingDefinition[] = [];
  private definitionIds = new Set<string>();
  private reloadPromise: Promise<void> | undefined;
  private needsReload = true;
  private disposed = false;
  private readonly output = vscode.window.createOutputChannel('VSCode Quicky');

  constructor(private readonly context: vscode.ExtensionContext) {
    this.context.subscriptions.push(this.output);
  }

  async initialize(): Promise<void> {
    await this.ensureInitialDefinitions();
    await this.reloadDefinitions(true);

    const commandDisposable = vscode.commands.registerCommand('quicky.showSettingsMenu', async () => {
      const resource = getActiveResource();
      await this.reloadDefinitions(false, resource);
      if (this.definitions.length === 0) {
        void vscode.window.showInformationMessage('Görüntülenecek ayar bulunmuyor.');
        return;
      }
      await this.showDefinitionPicker(resource);
    });

    this.context.subscriptions.push(commandDisposable);

    await this.refreshContextValues();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
  }

  async handleConfigurationChange(event: vscode.ConfigurationChangeEvent): Promise<void> {
    if (event.affectsConfiguration(`${CONFIG_SECTION}.${CONFIG_SETTING_DEFINITIONS}`)) {
      this.markDefinitionsDirty();
      await this.reloadDefinitions(true);
      await this.refreshContextValues();
      return;
    }

    if (this.definitionIds.size === 0) {
      return;
    }

    for (const id of this.definitionIds) {
      if (event.affectsConfiguration(id)) {
        await this.refreshContextValues();
        break;
      }
    }
  }

  async refreshContextValues(resource: vscode.Uri | undefined = getActiveResource()): Promise<void> {
    await this.reloadDefinitions(false, resource);

    const configuration = vscode.workspace.getConfiguration(undefined, resource);
    const promises: Promise<void>[] = [];

    for (const definition of this.definitions) {
      const inspect = configuration.inspect<unknown>(definition.id);
      const currentValue = this.getCurrentValue(definition, configuration, inspect);
      promises.push(setContextValue(definition.contextKey, currentValue));

      for (const option of definition.options) {
        const optionValue = this.coerceOptionValue(option.rawValue, inspect);
        const matches = areValuesEquivalent(currentValue, optionValue);
        promises.push(setContextValue(`${definition.contextKey}.is.${option.contextValueKey}`, matches));
      }
    }

    await Promise.all(promises);
  }

  async handleActiveResourceChange(): Promise<void> {
    await this.refreshContextValues();
  }

  private markDefinitionsDirty(): void {
    this.needsReload = true;
  }

  private async reloadDefinitions(
    force: boolean,
    resource: vscode.Uri | undefined = getActiveResource(),
  ): Promise<void> {
    if (!force && !this.needsReload) {
      return;
    }

    if (this.reloadPromise) {
      await this.reloadPromise;
      return;
    }

    this.reloadPromise = this.performReloadDefinitions(resource);
    try {
      await this.reloadPromise;
    } finally {
      this.reloadPromise = undefined;
    }
  }

  private async performReloadDefinitions(resource: vscode.Uri | undefined): Promise<void> {
    this.needsReload = false;

    const definitionsMap = new Map<string, SettingDefinition>();
    for (const rawDefinition of RAW_BUILTIN_DEFINITIONS) {
      const normalized = normalizeDefinition(rawDefinition, 'builtin');
      if (normalized) {
        definitionsMap.set(normalized.id, normalized);
      }
    }

    const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION, resource);
    const configuredDefinitions = configuration.get<unknown>(CONFIG_SETTING_DEFINITIONS, []);
    const rawDefinitions = extractRawDefinitions(configuredDefinitions);

    for (const rawDefinition of rawDefinitions) {
      const normalized = normalizeDefinition(rawDefinition, 'settings');
      if (normalized) {
        definitionsMap.set(normalized.id, normalized);
      } else {
        const id = typeof rawDefinition === 'object' && rawDefinition && 'id' in rawDefinition ? (rawDefinition as RawSettingDefinition).id : undefined;
        this.output.appendLine(`[Quicky] Ayar tanımı geçersiz (id: ${id ?? 'undefined'}).`);
      }
    }

    this.definitions = Array.from(definitionsMap.values());
    this.definitionIds = new Set(this.definitions.map((definition) => definition.id));
  }

  private async ensureInitialDefinitions(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
      await this.ensureDefaultForConfig(undefined, vscode.ConfigurationTarget.Global, 'Kullanıcı');
      return;
    }

    for (const folder of folders) {
      await this.ensureDefaultForConfig(folder.uri, vscode.ConfigurationTarget.WorkspaceFolder, folder.name);
    }
  }

  private async ensureDefaultForConfig(
    resource: vscode.Uri | undefined,
    target: vscode.ConfigurationTarget,
    label: string,
  ): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION, resource);
    const inspect = configuration.inspect<RawSettingDefinition[]>(CONFIG_SETTING_DEFINITIONS);
    if (hasAnyUserValue(inspect)) {
      return;
    }

    try {
      await configuration.update(CONFIG_SETTING_DEFINITIONS, DEFAULT_CONFIG_DEFINITIONS, target);
      this.markDefinitionsDirty();
      this.output.appendLine(`[Quicky] ${label} ayarlarına varsayılan tanımlar eklendi.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`[Quicky] Varsayılan tanımlar kaydedilemedi (${label}): ${message}`);
    }
  }

  private async showDefinitionPicker(resource: vscode.Uri | undefined): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(undefined, resource);

    const items: DefinitionQuickPickItem[] = this.definitions.map((definition) => {
      const inspect = configuration.inspect<unknown>(definition.id);
      const currentValue = this.getCurrentValue(definition, configuration, inspect);
      const option = this.findOptionByValue(definition, currentValue, inspect);
      return {
        label: definition.label,
        description: option ? `Aktif: ${option.label}` : undefined,
        detail: option ? undefined : 'Seçili değer tanımlı seçeneklerle eşleşmiyor',
        definition,
      };
    });

    if (items.length === 0) {
      void vscode.window.showInformationMessage('Görüntülenecek ayar bulunmuyor.');
      return;
    }

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Güncellemek istediğiniz ayarı seçin',
    });

    if (!picked) {
      return;
    }

    await this.showOptionPicker(picked.definition, resource);
  }

  private async showOptionPicker(definition: SettingDefinition, resource: vscode.Uri | undefined): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(undefined, resource);
    const inspect = configuration.inspect<unknown>(definition.id);
    const currentValue = this.getCurrentValue(definition, configuration, inspect);

    const items: OptionQuickPickItem[] = definition.options.map((option) => {
      const optionValue = this.coerceOptionValue(option.rawValue, inspect);
      const isCurrent = areValuesEquivalent(currentValue, optionValue);
      return {
        label: option.label,
        description: option.description,
        picked: isCurrent,
        detail: isCurrent ? 'Şu anda seçili' : undefined,
        option,
      };
    });

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: definition.label,
    });

    if (!selection) {
      return;
    }

    const selectedValue = this.coerceOptionValue(selection.option.rawValue, inspect);
    if (areValuesEquivalent(currentValue, selectedValue)) {
      return;
    }

    await this.applyOption(definition, selection.option, resource, inspect);
  }

  private async applyOption(
    definition: SettingDefinition,
    option: SettingOptionDefinition,
    resource: vscode.Uri | undefined,
    inspect: ConfigurationInspection<unknown> | undefined,
  ): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(undefined, resource);
    const resolvedInspect = inspect ?? configuration.inspect<unknown>(definition.id);
    const valueToWrite = this.coerceOptionValue(option.rawValue, resolvedInspect);
    const target = resolveUpdateTarget(definition.id, resource, resolvedInspect);

    await configuration.update(definition.id, valueToWrite, target);
    await this.refreshContextValues(resource);

    void vscode.window.showInformationMessage(`${definition.label}: ${option.label}`);
  }

  private findOptionByValue(
    definition: SettingDefinition,
    value: SettingOptionValue,
    inspect: ConfigurationInspection<unknown> | undefined,
  ): SettingOptionDefinition | undefined {
    for (const option of definition.options) {
      const optionValue = this.coerceOptionValue(option.rawValue, inspect);
      if (areValuesEquivalent(value, optionValue)) {
        return option;
      }
    }
    return undefined;
  }

  private getCurrentValue(
    definition: SettingDefinition,
    configuration: vscode.WorkspaceConfiguration,
    inspect: ConfigurationInspection<unknown> | undefined,
  ): SettingOptionValue {
    const current = configuration.get<unknown>(definition.id);
    const normalizedCurrent = normalizeOptionValue(current);
    if (normalizedCurrent !== undefined) {
      return normalizedCurrent;
    }

    const coercedDefault = this.coerceOptionValue(definition.defaultOptionValue, inspect);
    const normalizedDefault = normalizeOptionValue(coercedDefault);
    if (normalizedDefault !== undefined) {
      return normalizedDefault;
    }

    return definition.options[0]?.rawValue ?? null;
  }

  private coerceOptionValue(
    value: SettingOptionValue,
    inspect: ConfigurationInspection<unknown> | undefined,
  ): SettingOptionValue {
    const sample = extractSampleValue(inspect);
    return coerceToMatchSample(value, sample);
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const manager = new DynamicSettingsManager(context);
  context.subscriptions.push(manager);

  await manager.initialize();

  const configurationListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
    await manager.handleConfigurationChange(event);
  });

  const editorListener = vscode.window.onDidChangeActiveTextEditor(() => {
    void manager.handleActiveResourceChange();
  });

  context.subscriptions.push(configurationListener, editorListener);
}

export function deactivate(): void {
  // Nothing to clean up explicitly.
}

function getActiveResource(): vscode.Uri | undefined {
  return vscode.window.activeTextEditor?.document.uri;
}

async function setContextValue(contextKey: string, value: unknown): Promise<void> {
  await vscode.commands.executeCommand('setContext', contextKey, value);
}

function resolveUpdateTarget(
  settingKey: string,
  resource: vscode.Uri | undefined,
  inspectResult: ConfigurationInspection<unknown> | undefined,
): vscode.ConfigurationTarget {
  const configuration = vscode.workspace.getConfiguration(undefined, resource);
  const inspect = inspectResult ?? configuration.inspect<unknown>(settingKey);

  if (resource && inspect?.workspaceFolderValue !== undefined) {
    return vscode.ConfigurationTarget.WorkspaceFolder;
  }

  if (inspect?.workspaceValue !== undefined) {
    return vscode.ConfigurationTarget.Workspace;
  }

  if (inspect?.globalValue !== undefined) {
    return vscode.ConfigurationTarget.Global;
  }

  if (resource) {
    return vscode.ConfigurationTarget.WorkspaceFolder;
  }

  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    return vscode.ConfigurationTarget.Workspace;
  }

  return vscode.ConfigurationTarget.Global;
}

function normalizeDefinition(rawDefinition: RawSettingDefinition, source: string): SettingDefinition | undefined {
  if (!rawDefinition || typeof rawDefinition !== 'object') {
    return undefined;
  }

  const id = typeof rawDefinition.id === 'string' ? rawDefinition.id.trim() : undefined;
  if (!id) {
    return undefined;
  }

  const label = typeof rawDefinition.label === 'string' && rawDefinition.label.trim().length > 0
    ? rawDefinition.label.trim()
    : id;

  const optionsSource = Array.isArray(rawDefinition.options) ? rawDefinition.options : [];
  const options: SettingOptionDefinition[] = [];

  for (const rawOption of optionsSource) {
    if (!rawOption || typeof rawOption !== 'object') {
      continue;
    }
    const option = rawOption as RawSettingOption;
    const rawValue = normalizeOptionValue(option.value);
    if (rawValue === undefined) {
      continue;
    }
    const optionLabel = typeof option.label === 'string' && option.label.trim().length > 0
      ? option.label.trim()
      : valueToDisplayString(rawValue);
    const description = typeof option.description === 'string' ? option.description : undefined;

    options.push({
      label: optionLabel,
      rawValue,
      contextValueKey: serializeRawValueForContext(rawValue),
      description,
    });
  }

  if (options.length === 0) {
    return undefined;
  }

  let defaultOptionValue = normalizeOptionValue(rawDefinition.defaultOptionValue);
  if (defaultOptionValue === undefined) {
    defaultOptionValue = options[0].rawValue;
  } else {
    const matchingOption = options.find((option) => areValuesEquivalent(option.rawValue, defaultOptionValue!));
    if (matchingOption) {
      defaultOptionValue = matchingOption.rawValue;
    } else {
      defaultOptionValue = options[0].rawValue;
    }
  }

  return {
    id,
    label,
    options,
    defaultOptionValue,
    contextKey: buildContextKeyFromId(id),
    source,
  };
}

function extractRawDefinitions(value: unknown): RawSettingDefinition[] {
  if (Array.isArray(value)) {
    return value as RawSettingDefinition[];
  }

  if (value && typeof value === 'object') {
    const container = value as Record<string, unknown>;
    const possibleArrays = ['definitions', 'items', 'settings'];
    for (const key of possibleArrays) {
      const nested = container[key];
      if (Array.isArray(nested)) {
        return nested as RawSettingDefinition[];
      }
    }
    return [value as RawSettingDefinition];
  }

  return [];
}

function normalizeOptionValue(value: unknown): SettingOptionValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return undefined;
}

function buildContextKeyFromId(id: string): string {
  const sanitized = id.replace(/[^\w.-]/g, '_');
  return `quicky.setting.${sanitized}`;
}

function serializeRawValueForContext(value: SettingOptionValue): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'bool_true' : 'bool_false';
  }
  if (typeof value === 'number') {
    return `num_${value}`;
  }
  const sanitized = value.replace(/[^\w.-]/g, '_');
  return `str_${sanitized || 'empty'}`;
}

function valueToDisplayString(value: SettingOptionValue): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

function areValuesEquivalent(a: SettingOptionValue, b: SettingOptionValue): boolean {
  if (a === b) {
    return true;
  }

  if (a === null || b === null) {
    return a === b;
  }

  const boolA = toBooleanLike(a);
  const boolB = toBooleanLike(b);
  if (boolA !== undefined && boolB !== undefined) {
    return boolA === boolB;
  }

  const numA = toNumberLike(a);
  const numB = toNumberLike(b);
  if (numA !== undefined && numB !== undefined) {
    return numA === numB;
  }

  return normalizeComparisonValue(a) === normalizeComparisonValue(b);
}

function toBooleanLike(value: SettingOptionValue): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') {
      return true;
    }
    if (lowered === 'false') {
      return false;
    }
  }
  return undefined;
}

function toNumberLike(value: SettingOptionValue): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeComparisonValue(value: SettingOptionValue): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'bool:true' : 'bool:false';
  }
  if (typeof value === 'number') {
    return `num:${value}`;
  }
  return `str:${value}`;
}

function extractSampleValue(inspect: ConfigurationInspection<unknown> | undefined): unknown {
  if (!inspect) {
    return undefined;
  }
  if (inspect.workspaceFolderValue !== undefined) {
    return inspect.workspaceFolderValue;
  }
  if (inspect.workspaceValue !== undefined) {
    return inspect.workspaceValue;
  }
  if (inspect.globalValue !== undefined) {
    return inspect.globalValue;
  }
  return inspect.defaultValue;
}

function coerceToMatchSample(value: SettingOptionValue, sample: unknown): SettingOptionValue {
  if (sample === undefined || sample === null) {
    return convertStringToPrimitiveIfPossible(value);
  }

  if (typeof sample === 'boolean') {
    const bool = toBooleanLike(value);
    if (bool !== undefined) {
      return bool;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return sample;
  }

  if (typeof sample === 'number') {
    const numeric = toNumberLike(value);
    if (numeric !== undefined) {
      return numeric;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return typeof sample === 'number' ? sample : 0;
  }

  if (typeof sample === 'string') {
    if (typeof value === 'string') {
      return value;
    }
    if (value === null) {
      return '';
    }
    return String(value);
  }

  return convertStringToPrimitiveIfPossible(value);
}

function convertStringToPrimitiveIfPossible(value: SettingOptionValue): SettingOptionValue {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const lowered = trimmed.toLowerCase();
  if (lowered === 'true') {
    return true;
  }
  if (lowered === 'false') {
    return false;
  }
  if (lowered === 'null') {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return value;
}

function hasAnyUserValue(inspect: ConfigurationInspection<unknown[]> | undefined): boolean {
  if (!inspect) {
    return false;
  }
  return (
    inspect.workspaceFolderValue !== undefined ||
    inspect.workspaceFolderLanguageValue !== undefined ||
    inspect.workspaceValue !== undefined ||
    inspect.workspaceLanguageValue !== undefined ||
    inspect.globalValue !== undefined ||
    inspect.globalLanguageValue !== undefined
  );
}
