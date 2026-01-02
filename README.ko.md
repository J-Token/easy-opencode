# @j-token/easy-opencode

간단한게 최고입니다.

OpenCode 플러그인으로, **LSP 도구 11개** + **AST-grep 도구 2개** + **Open AI** + **google AI Studio** 세팅을 제공합니다.


에이전트 오케스트레이션이나 추가적인 백그라운드 작업은 제공하지 않습니다.

## 설치

### 1) `npx`로 바로 실행 (CLI: 프로바이더 프리셋 동기화)

플러그인을 설치하지 않아도, 아래 명령으로 OpenCode 설정 파일에 **내장 프로바이더 프리셋을 병합**할 수 있습니다.

```bash
# 변경 요약만 보고 싶을 때(파일 미수정)
npx @j-token/easy-opencode --dry-run --on-conflict keep

# 실제 반영
npx @j-token/easy-opencode --on-conflict keep
```

전역 설치로도 사용할 수 있습니다.

```bash
npm i -g @j-token/easy-opencode
easy-opencode --on-conflict keep
```

### 2) 플러그인 설치 (OpenCode 도구: LSP/AST-grep)

1. OpenCode 의존성에 추가:

```bash
cd ~/.config/opencode
bun add @j-token/easy-opencode
```

2. `~/.config/opencode/opencode.json`에서 플러그인 활성화:

```json
{
  "plugin": ["@j-token/easy-opencode"]
}
```

## 설정

아래 둘 중 하나를 생성하세요.

- 프로젝트: `.opencode/easy-opencode.jsonc`
- 사용자 전역: `~/.config/opencode/easy-opencode.jsonc`

프로젝트 설정이 사용자 전역 설정을 덮어씁니다.

### JSON 스키마(문서)

`easy-opencode.jsonc`는 아래 최상위 키를 가지는 단일 JSON 객체입니다.

- `limits` (선택)

  - `timeoutMs` (number, 기본 `300000`): 도구 타임아웃(ms)
  - `maxReferences` (number, 기본 `200`): `lsp_find_references` 최대 결과 수
  - `maxSymbols` (number, 기본 `200`): 심볼 관련 도구 최대 결과 수
  - `maxDiagnostics` (number, 기본 `200`): 진단(diagnostics) 최대 개수
  - `maxOutputBytes` (number, 기본 `1048576`): 도구 출력 최대 바이트

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

- LSP 도구를 사용하려면 언어 서버 바이너리가 설치되어 있고 `PATH`에서 실행 가능해야 합니다.
- `lsp_servers`가 서버가 없다고 나오면 `easy-opencode.jsonc` 파일 내의 `lsp.servers` 배열에 서버 설정을 추가하세요.
- opencode에서 /connect 명령을 통해 Other에 들어가 google ai studio를 사용할수있습니다.

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

## CLI(프로바이더 동기화)

`npx @j-token/easy-opencode`(또는 전역 설치 시 `easy-opencode`)를 실행하면 `~/.config/opencode/opencode.jsonc`(우선) 또는 `~/.config/opencode/opencode.json`에 내장된 프로바이더 프리셋을 병합합니다.

- 지원 `providerId`: `provider.openai`, `provider["google-ai"]`

### 내장 모델 프리셋

아래 모델 키/이름을 내장 프리셋으로 추가합니다(실제 사용 가능 여부는 계정/키/지역 정책에 따라 달라질 수 있습니다).

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

- 충돌은 `providerId` 단위로 한 번만 물어보고, 내부는 딥 머지로 처리한 뒤 충돌이 난 키만 `overwrite`/`keep`로 처리합니다.

옵션:

- `--dry-run`: 파일을 수정하지 않고 요약만 출력
- `--on-conflict ask|overwrite|keep`: 기본 `ask`
- `--no-backup`: 백업 생성 생략(기본은 백업 생성)

## 확인 방법

- 플러그인 로드 확인: OpenCode에서 `lsp_servers`를 호출해 서버 목록이 나오는지 확인
- CLI 드라이런 확인: `npx @j-token/easy-opencode --dry-run --on-conflict keep`
- CLI 반영 확인: `npx @j-token/easy-opencode --on-conflict keep` 실행 후 `~/.config/opencode/opencode.jsonc`(우선) 또는 `~/.config/opencode/opencode.json`에서 `provider.openai` / `provider["google-ai"]`가 변경됐는지 확인

## 안전/주의

- `lsp_rename`, `lsp_code_action_resolve`는 편집을 즉시 적용합니다(실제 파일 변경).
- WorkspaceEdit의 `create/rename/delete` 및 `allowOutsideWorkspace`는 기본값이 허용(`true`)입니다. 제한하려면 `easy-opencode.jsonc`의 `apply` 설정을 사용하세요.
