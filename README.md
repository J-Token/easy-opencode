# @j-token/easy-opencode

OpenCode plugin providing **LSP (11 tools)** + **AST-grep (2 tools)**. No agent orchestration, no background tasks.

## Install

1) Add to OpenCode package dependencies:

```bash
cd ~/.config/opencode
bun add @j-token/easy-opencode
```

2) Enable plugin in `~/.config/opencode/opencode.json`:

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

### JSON Schema (document)

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

## Verify

- 플러그인 로드 확인: OpenCode에서 `lsp_servers`를 호출해 서버 목록이 나오는지 확인
- CLI dry-run 확인: `npx @j-token/easy-opencode --dry-run --on-conflict keep`
- CLI 반영 확인: `npx @j-token/easy-opencode --on-conflict keep` 실행 후 `~/.config/opencode/opencode.jsonc`(우선) 또는 `~/.config/opencode/opencode.json`의 `provider.openai` / `provider["google-ai"]`가 변경됐는지 확인

## CLI (provider sync)

`npx @j-token/easy-opencode`를 실행하면 `~/.config/opencode/opencode.jsonc`(우선) 또는 `~/.config/opencode/opencode.json`에 내장된 provider 프리셋을 병합합니다.

- 지원 providerId: `provider.openai`, `provider["google-ai"]`
- 충돌은 providerId 단위로 1회만 물어보고, 내부는 deep merge + 충돌 키만 overwrite/keep 합니다.

옵션:
- `--dry-run`: 파일을 수정하지 않고 요약만 출력
- `--on-conflict ask|overwrite|keep`: 기본 `ask`
- `--no-backup`: 백업 생성 생략(기본은 백업 생성)

## Safety

- `lsp_rename`과 `lsp_code_action_resolve`는 편집을 즉시 적용합니다(실제 파일 변경).
- WorkspaceEdit의 `create/rename/delete`는 기본값이 허용(true)이며, 필요하면 `easy-opencode.jsonc`의 `apply`로 제한할 수 있습니다.
