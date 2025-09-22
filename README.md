# VSCode Quicky

VSCode Quicky is a lightweight and fast Visual Studio Code extension that lets you toggle CodeLens references and any other setting you add to the menu from the editor title bar with a single click. While you manage reference CodeLens rows in JavaScript and TypeScript projects, you can also surface your own custom settings alongside them.

## Key Features

- Toggle `typescript.referencesCodeLens.enabled` and `javascript.referencesCodeLens.enabled` with one click.
- Add any VS Code setting to the dynamic menu together with its custom options.
- Persist updates in the correct scope (workspace, folder, user) based on the active file or workspace.
- Track the history of your selections through the built-in output channel.

## Installation

### VS Code Marketplace

Once the extension is published you can search for "VSCode Quicky" on the Marketplace and click **Install**.

### Manual Installation

```bash
npm install
npm run compile
```

Then open the project folder in VS Code and run the **Launch Extension** target from the **Run and Debug** panel.

## Quick Start

1. Open any file and click the Quicky icon in the top-right corner of the editor tab.
2. From the **Quicky Settings** menu choose the **Manage Settings** command.
3. Pick the setting you want to update from the first list and select the value to apply from the second list.
4. Your choice takes effect immediately, is saved with the appropriate scope, and remains available from the command palette.

## Dynamic Setting Definitions

You can add as many definitions as you like through the `quicky.settingDefinitions` setting. When the extension launches for the first time it writes a sample entry to the workspace settings file if the list is empty.

Sample content (`.vscode/settings.json`):

```json
[
  {
    "id": "workbench.experimental.share.enabled",
    "label": "Share button visibility",
    "options": [
      { "value": true, "label": "Visible" },
      { "value": false, "label": "Hidden" }
    ],
    "defaultOptionValue": true
  }
]
```

- `id`: The exact key of the setting that will be updated.
- `label`: The title displayed in the menu (falls back to `id` if omitted).
- `options`: The options presented to users; the `value` can be a `string`, `number`, `boolean`, or `null`.
- `defaultOptionValue`: The value to use when a setting definition has not been saved yet (optional).

You can add multiple definitions; the latest entry with the same `id` overrides the previous one.

## Tips

- Remove entries from `quicky.settingDefinitions` if you do not want them to appear in the menu.
- Trigger the command from the keyboard by searching for `Quicky: Manage Settings` in the command palette.
- Prefer the user scope for combinations you do not plan to share with the workspace.

## Contributing

Use [GitHub Issues](https://github.com/yildirim/vscode-quicky/issues) for bug reports, suggestions, and pull requests. If you would like to share a new definition example or improve the docs, please open an issue.

## License

This project is licensed under the [GNU Affero General Public License v3.0](https://github.com/sourcebound/vscode-quicky/blob/HEAD/LICENSE).
Remember to review the license terms before using the code in your own projects.
