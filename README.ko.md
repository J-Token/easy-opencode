# @j-token/easy-opencode

OpenCode 플러그인입니다.

- LSP 도구 11개 + AST-grep 도구 2개를 제공합니다.

## 설치

1. OpenCode 의존성에 추가

```bash
cd ~/.config/opencode
bun add @j-token/easy-opencode
```

2. `~/.config/opencode/opencode.json`에서 플러그인 활성화

```json
{
  "plugin": ["@j-token/easy-opencode"]
}
```

## 설정

아래 둘 중 하나를 생성하세요.

- 프로젝트: `.opencode/easy-opencode.jsonc`
- 유저 전역: `~/.config/opencode/easy-opencode.jsonc`

프로젝트 설정이 유저 전역 설정을 덮어씁니다.

### JSON 스키마(문서)

`easy-opencode.jsonc`는 아래 최상위 키를 가지는 단일 JSON 객체입니다.

- `limits` (선택)

  - `timeoutMs` (number, 기본 `300000`): tool 타임아웃(ms)
  - `maxReferences` (number, 기본 `200`): `lsp_find_references` 최대 결과 수
  - `maxSymbols` (number, 기본 `200`): 심볼 관련 tool 최대 결과 수
  - `maxDiagnostics` (number, 기본 `200`): 진단(diagnostics) 최대 개수
  - `maxOutputBytes` (number, 기본 `1048576`): tool 출력 최대 바이트

- `apply` (선택)

  - `allowCreate` (boolean, 기본 `true`): LSP WorkspaceEdit create 허용
  - `allowRename` (boolean, 기본 `true`): LSP WorkspaceEdit rename 허용
  - `allowDelete` (boolean, 기본 `true`): LSP WorkspaceEdit delete 허용
  - `allowOutsideWorkspace` (boolean, 기본 `true`): 워크스페이스 밖 경로 편집 허용

- `lsp` (선택)

  - `servers` (array)
    - 각 항목:
      - `id` (string): 서버 id
      - `extensions` (string[]): 처리할 확장자 목록(예: `.ts`, `.py`)
      - `command` (string): 실행 파일 이름/경로
      - `args` (string[], 선택): 실행 인자
      - `env` (object, 선택): 추가 환경변수

- `astGrep` (선택)
  - `preferNapi` (boolean, 기본 `true`)
  - `defaultDryRun` (boolean, 기본 `true`)
  - `timeoutMs` (number, 기본 `300000`)
  - `maxOutputBytes` (number, 기본 `1048576`)
  - `maxMatches` (number, 기본 `500`)

### 예시

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

### 설정 팁

- LSP tool을 쓰려면 언어 서버 바이너리가 설치되어 있고 `PATH`에서 실행 가능해야 합니다.
- `lsp_servers`가 서버가 없다고 나오면 `easy-opencode.jsonc` 파일 내의 `lsp.servers` 배열에 서버 설정을 추가하세요.

### LSP 서버 설치 예시

- TypeScript/JavaScript (`typescript-language-server`)
  - `npm install -g typescript typescript-language-server`

- Python (`pylsp`)
  - `python -m pip install "python-lsp-server[all]"`

- Go (`gopls`)
  - `go install golang.org/x/tools/gopls@latest`

- Rust (`rust-analyzer`)
  - `rustup component add rust-analyzer`

## 도구 목록

- LSP: `lsp_hover`, `lsp_goto_definition`, `lsp_find_references`, `lsp_document_symbols`, `lsp_workspace_symbols`, `lsp_diagnostics`, `lsp_servers`, `lsp_prepare_rename`, `lsp_rename`, `lsp_code_actions`, `lsp_code_action_resolve`
- AST-grep: `ast_grep_search`, `ast_grep_replace`

## CLI (provider 동기화)

`npx @j-token/easy-opencode`를 실행하면 `~/.config/opencode/opencode.jsonc`(우선) 또는 `~/.config/opencode/opencode.json`에 내장된 provider 프리셋을 병합합니다.

- 지원 providerId: `provider.openai`, `provider["google-ai"]`
- 충돌은 providerId 단위로 1회만 물어보고, 내부는 deep merge + 충돌 키만 overwrite/keep 합니다.

옵션:

- `--dry-run`: 파일을 수정하지 않고 요약만 출력
- `--on-conflict ask|overwrite|keep`: 기본 `ask`
- `--no-backup`: 백업 생성 생략(기본은 백업 생성)

## 확인 방법(Verify)

- 플러그인 로드 확인: OpenCode에서 `lsp_servers`를 호출해 서버 목록이 나오는지 확인
- CLI dry-run 확인: `npx @j-token/easy-opencode --dry-run --on-conflict keep`
- CLI 반영 확인: `npx @j-token/easy-opencode --on-conflict keep` 실행 후
  - `~/.config/opencode/opencode.jsonc`(우선) 또는 `~/.config/opencode/opencode.json`에서
  - `provider.openai` / `provider["google-ai"]`가 변경됐는지 확인

## 안전/주의

- `lsp_rename`, `lsp_code_action_resolve`는 편집을 즉시 적용합니다(실제 파일 변경).
- WorkspaceEdit의 `create/rename/delete`는 기본값이 허용(true)입니다. 제한하려면 `easy-opencode.jsonc`의 `apply` 설정을 사용하세요.
