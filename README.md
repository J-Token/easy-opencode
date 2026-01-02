# @j-token/easy-opencode

Simple is best.

OpenCode plugin providing **11 LSP tools** + **2 AST-grep tools**+ **Open AI** + **google AI Studio**.

No agent orchestration, no additional background tasks.

## Install

### 1) Run via `npx` (CLI: provider preset sync)

You can merge the built-in provider presets into your OpenCode config **without installing the plugin**.

```bash
# Preview only (no file changes)
npx @j-token/easy-opencode@latest --dry-run --on-conflict keep

# Apply changes
npx @j-token/easy-opencode@latest --on-conflict keep
```

You can also install it globally and run the binary directly.

```bash
npm i -g @j-token/easy-opencode@latest
easy-opencode --on-conflict keep
```

### 2) Install the plugin (OpenCode tools: LSP/AST-grep)

1. Add to OpenCode package dependencies:

```bash
cd ~/.config/opencode
bun add @j-token/easy-opencode@latest
```

2. Enable the plugin in `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@j-token/easy-opencode"]
}
```

## Configure

Create one of:

- Project: `.opencode/easy-opencode.jsonc`
- User: `~/.config/opencode/easy-opencode.jsonc`

Project config overrides user config.

### JSON Schema (reference)

`easy-opencode.jsonc` is a single JSON object with these top-level keys.

- `limits` (optional)
  - `timeoutMs` (number, default `300000`): tool timeout in ms
  - `maxReferences` (number, default `200`): max results for `lsp_find_references`
  - `maxSymbols` (number, default `200`): max results for symbol tools
  - `maxDiagnostics` (number, default `200`): max diagnostics returned
  - `maxOutputBytes` (number, default `1048576`): output cap per tool

- `apply` (optional)
  - `allowCreate` (boolean, default `true`): allow LSP WorkspaceEdit create
  - `allowRename` (boolean, default `true`): allow LSP WorkspaceEdit rename
  - `allowDelete` (boolean, default `true`): allow LSP WorkspaceEdit delete
  - `allowOutsideWorkspace` (boolean, default `true`): allow edits outside workspace

- `lsp` (optional)
  - `servers` (array)
    - each item:
      - `id` (string): server id
      - `extensions` (string[]): file extensions this server handles (ex: `.ts`, `.py`)
      - `command` (string): executable name/path
      - `args` (string[], optional): command args
      - `env` (object, optional): extra environment variables

- `astGrep` (optional)
  - `preferNapi` (boolean, default `true`)
  - `defaultDryRun` (boolean, default `true`)
  - `timeoutMs` (number, default `300000`)
  - `maxOutputBytes` (number, default `1048576`)
  - `maxMatches` (number, default `500`)

### Example

```jsonc
{
  "limits": {
    "timeoutMs": 300000,
    "maxReferences": 200,
    "maxSymbols": 200,
    "maxDiagnostics": 200,
    "maxOutputBytes": 1048576
  },
  "apply": {
    "allowCreate": true,
    "allowRename": true,
    "allowDelete": true,
    "allowOutsideWorkspace": true
  },
  "lsp": {
    "servers": [
      {
        "id": "typescript",
        "extensions": [".ts", ".tsx", ".js", ".jsx"],
        "command": "typescript-language-server",
        "args": ["--stdio"]
      },
      {
        "id": "python",
        "extensions": [".py"],
        "command": "pylsp",
        "args": []
      },
      {
        "id": "go",
        "extensions": [".go"],
        "command": "gopls",
        "args": []
      },
      {
        "id": "rust",
        "extensions": [".rs"],
        "command": "rust-analyzer",
        "args": []
      }
    ]
  },
  "astGrep": {
    "preferNapi": true,
    "defaultDryRun": true,
    "timeoutMs": 300000,
    "maxOutputBytes": 1048576,
    "maxMatches": 500
  }
}
```

### Setup Notes

- LSP tools require the language server binaries to be installed and available in your `PATH`.
- If `lsp_servers` says no servers are configured, add entries to the `lsp.servers` array in your `easy-opencode.jsonc` file.

### LSP Server Install Examples

- TypeScript/JavaScript (`typescript-language-server`)
  - `npm install -g typescript typescript-language-server`

- Python (`pylsp`)
  - `python -m pip install "python-lsp-server[all]"`

- Go (`gopls`)
  - `go install golang.org/x/tools/gopls@latest`

- Rust (`rust-analyzer`)
  - `rustup component add rust-analyzer`

## Tools

- LSP: `lsp_hover`, `lsp_goto_definition`, `lsp_find_references`, `lsp_document_symbols`, `lsp_workspace_symbols`, `lsp_diagnostics`, `lsp_servers`, `lsp_prepare_rename`, `lsp_rename`, `lsp_code_actions`, `lsp_code_action_resolve`
- AST-grep: `ast_grep_search`, `ast_grep_replace`

## CLI (provider sync)

Running `npx @j-token/easy-opencode` (or `easy-opencode` if installed globally) merges built-in provider presets into `~/.config/opencode/opencode.jsonc` (preferred) or `~/.config/opencode/opencode.json`.

- Supported providerId: `provider.openai`, `provider["google-ai"]`

### Built-in model presets

The CLI also injects the following model keys/names via built-in presets (actual availability depends on your account, keys, and regional policies).

- OpenAI (`provider.openai`)
  - `gpt-5.2-none`: GPT 5.2 None (OAuth)
  - `gpt-5.2-low`: GPT 5.2 Low (OAuth)
  - `gpt-5.2-medium`: GPT 5.2 Medium (OAuth)
  - `gpt-5.2-high`: GPT 5.2 High (OAuth)
  - `gpt-5.2-xhigh`: GPT 5.2 Extra High (OAuth)
  - `gpt-5.2-codex-low`: GPT 5.2 Codex Low (OAuth)
  - `gpt-5.2-codex-medium`: GPT 5.2 Codex Medium (OAuth)
  - `gpt-5.2-codex-high`: GPT 5.2 Codex High (OAuth)
  - `gpt-5.2-codex-xhigh`: GPT 5.2 Codex Extra High (OAuth)
  - `gpt-5.1-codex-max-low`: GPT 5.1 Codex Max Low (OAuth)
  - `gpt-5.1-codex-max-medium`: GPT 5.1 Codex Max Medium (OAuth)
  - `gpt-5.1-codex-max-high`: GPT 5.1 Codex Max High (OAuth)
  - `gpt-5.1-codex-max-xhigh`: GPT 5.1 Codex Max Extra High (OAuth)
  - `gpt-5.1-codex-low`: GPT 5.1 Codex Low (OAuth)
  - `gpt-5.1-codex-medium`: GPT 5.1 Codex Medium (OAuth)
  - `gpt-5.1-codex-high`: GPT 5.1 Codex High (OAuth)
  - `gpt-5.1-codex-mini-medium`: GPT 5.1 Codex Mini Medium (OAuth)
  - `gpt-5.1-codex-mini-high`: GPT 5.1 Codex Mini High (OAuth)
  - `gpt-5.1-none`: GPT 5.1 None (OAuth)
  - `gpt-5.1-low`: GPT 5.1 Low (OAuth)
  - `gpt-5.1-medium`: GPT 5.1 Medium (OAuth)
  - `gpt-5.1-high`: GPT 5.1 High (OAuth)

- Google AI Studio (`provider["google-ai"]`)
  - `gemini-3-pro-high`: Gemini 3 Pro High (`models/gemini-3-pro-preview`)
  - `gemini-3-pro-medium`: Gemini 3 Pro Medium (`models/gemini-3-pro-preview`)
  - `gemini-3-pro-low`: Gemini 3 Pro Low (`models/gemini-3-pro-preview`)
  - `gemini-3-flash-high`: Gemini 3 Flash High (`models/gemini-3-flash-preview`)
  - `gemini-3-flash-medium`: Gemini 3 Flash Medium (`models/gemini-3-flash-preview`)
  - `gemini-3-flash-low`: Gemini 3 Flash Low (`models/gemini-3-flash-preview`)

- On conflicts, it asks once per providerId, then deep-merges and only overwrites/keeps the conflicting keys.

Options:
- `--dry-run`: print a summary without modifying files
- `--on-conflict ask|overwrite|keep`: default `ask`
- `--no-backup`: skip creating a backup (default is to create a backup)

## Verify

- Plugin load: in OpenCode, call `lsp_servers` and confirm a server list is shown
- CLI dry-run: `npx @j-token/easy-opencode --dry-run --on-conflict keep`
- CLI apply: run `npx @j-token/easy-opencode --on-conflict keep`, then confirm `provider.openai` / `provider["google-ai"]` changed in `~/.config/opencode/opencode.jsonc` (preferred) or `~/.config/opencode/opencode.json`

## Safety

- `lsp_rename` and `lsp_code_action_resolve` apply edits immediately (files are modified).
- WorkspaceEdit `create/rename/delete` and `allowOutsideWorkspace` are allowed by default (`true`); restrict them via `apply` in `easy-opencode.jsonc`.

## Known Issues

### Bun + @ast-grep/napi Segmentation Fault

When running in Bun runtime, loading `@ast-grep/napi` (a native NAPI module written in Rust) may cause a **Segmentation Fault** crash:

```
panic: Segmentation fault at address 0x4EAEC1E0180
oh no: Bun has crashed. This indicates a bug in Bun, not your code.
```

**Cause**: Bun's NAPI compatibility is not 100% complete, and native modules can trigger memory access errors.

**Solution**: The plugin automatically detects Bun runtime and skips NAPI loading, falling back to CLI mode instead. If you still encounter issues:

1. Ensure `sg` (ast-grep CLI) is installed and available in your `PATH`:
   ```bash
   # Install ast-grep CLI
   npm install -g @ast-grep/cli
   # or
   cargo install ast-grep
   ```

2. Optionally disable NAPI explicitly in your config:
   ```jsonc
   {
     "astGrep": {
       "preferNapi": false
     }
   }
   ```
