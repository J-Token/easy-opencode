# LSP Client 문서 동기화 스펙 (didOpen/didChange)

## 1. 문제
현 구현은 파일 기반 LSP 요청마다 `textDocument/didOpen(version=1)`을 다시 전송한다.
- 코드 근거: `ensureDidOpen()`은 매번 `readFile` 후 didOpen 전송(`src/tools/lsp/lsp-client.ts:317`)
- LSP 3.17 근거:
  - `textDocument/didOpen`: close 없이 같은 문서에 대해 2번 보내면 안 됨(“must not be sent more than once without a corresponding close”)
  - `textDocument/didChange`: 서버에 요청하기 전에 문서 상태가 동기화되어야 신뢰 가능한 결과를 얻음(“must ensure synchronized before requesting information”)

## 2. 요구사항
- R1. 동일 URI에 대해 `didOpen`은 1회만 전송한다(예외적으로 close 후 재-open은 허용).
- R2. 요청 직전에 문서 내용이 서버와 동기화되어야 한다.
- R3. `version`은 문서 단위로 단조 증가한다.
- R4. `InitializeResult.capabilities.textDocumentSync`를 엄격히 준수한다.
- R5. 문서는 프로세스 종료까지 open 유지(정책 1.A), 단 아래 예외는 close를 허용한다.
  - languageId 변경
  - 파일 삭제/읽기 불가(ENOENT 등)

## 3. 적용 범위(요청)
`src/tools/lsp/lsp-client.ts`에서 “textDocument 기반” 요청들에만 동기화가 필요:
- 적용: hover/definition/references/documentSymbols/diagnostics/prepareRename/rename/codeActions
- 미적용: workspaceSymbols, codeActionResolve

## 4. Capability 해석(엄격 모드)
### 4.1 입력
- `InitializeResult.capabilities.textDocumentSync` (옵션 또는 숫자)

### 4.2 정규화 규칙
- `textDocumentSync`가 `TextDocumentSyncOptions`인 경우:
  - `openClose`: boolean (없으면 false로 취급)
  - `change`: None | Full | Incremental (없으면 None로 취급)
- `textDocumentSync`가 `TextDocumentSyncKind(number)`인 경우(호환 규칙):
  - `change = 해당 kind`
  - `openClose = true` (서버가 “sync를 한다”고 표현한 것으로 간주; open/close/change는 1세트여야 함)
- `textDocumentSync`가 `undefined`인 경우:
  - `openClose = false`, `change = None`

## 5. 내부 상태 모델(개념)
- 문서 상태 캐시: `docs: Map<uri, DocState>`
- DocState가 가져야 하는 최소 정보
  - `uri`, `filePath`
  - `languageId`(didOpen 시점)
  - `version`(didOpen=1부터 시작, didChange마다 +1)
  - `lastText`(incremental diff용; 정책 2.B + Incremental 대응에 필요)
  - `lastUsedAt`(추후 LRU를 넣을 여지; 이번 정책에서는 close 없음)

동시성:
- 동일 URI에 대한 “read/compare/send/version++/cache update”는 직렬화되어야 한다(per-URI lock/queue).

## 6. 동작 스펙
### 6.1 공통 흐름
```text
┌───────────────┐
│ public API     │  (hover/definition/...)
└───────┬───────┘
        ▼
┌───────────────┐
│ ensureStarted  │
└───────┬───────┘
        ▼
┌──────────────────────┐
│ ensureDocumentSynced  │  (필요 시 didOpen/didChange)
└───────┬──────────────┘
        ▼
┌───────────────┐
│ sendRequest    │
└───────────────┘
```

### 6.2 ensureDocumentSynced(filePath)
- 입력: `filePath`
- 출력: void(동기화 알림 전송 후 반환)
- 처리:
  1) `uri = toFileUri(filePath)`, `languageId = detectLanguageId(filePath)`
  2) (정책 2.B) 항상 `readFile(filePath, "utf-8")` 수행하여 `textNow` 확보
  3) capability에 따라 분기
     - `openClose=false` AND `change=None`:
       - 어떤 문서 알림도 보내지 않음(요청은 그대로 수행)
     - `openClose=true`:
       - `docs[uri]`가 없으면: `didOpen(version=1, text=textNow, languageId)` 전송 후 캐시 생성
       - `docs[uri]`가 있으면:
         - `languageId`가 바뀌었으면: `didClose` → `didOpen(version=1, text=textNow, languageId)`로 재동기화
         - 아니면 텍스트 비교 후 변경 시 `didChange` 전송
     - `openClose=true` + `change=None`:
       - `didOpen`은 할 수 있지만 변경 동기화는 하지 않음(스펙 준수)

### 6.3 didOpen
- 전송 조건: `openClose=true` AND `docs[uri]` 없음(최초 1회)
- payload:
  - `TextDocumentItem { uri, languageId, version: 1, text }`

### 6.4 didChange
- 전송 조건: `docs[uri]` 존재 AND `textNow !== lastText` AND `change != None`
- 공통:
  - `version = lastVersion + 1`
  - 전송 후 캐시의 `lastText`, `version` 갱신

모드:
- `change=Full`
  - `contentChanges: [{ text: textNow }]` (range 없는 전체 교체)
- `change=Incremental`
  - `contentChanges`는 1개 이벤트로 보낸다.
  - diff 규칙(개념):
    - oldText/nowText의 공통 prefix/suffix를 찾아 “치환 구간”을 1개로 계산
    - `range`는 oldText 기준으로 계산한 start/end (line, character)
    - `text`는 nowText의 치환 구간 문자열
  - 주의:
    - 현재 클라이언트는 `positionEncodings` 협상을 하지 않으므로, range 계산은 UTF-16(기본값)을 전제로 한다.

### 6.5 didClose
- 전송 조건: `openClose=true` AND (languageId 변경으로 재-open 필요 OR 파일이 사라짐/읽기 불가)
- payload:
  - `textDocument: { uri }`
- 기본 정책(1.A): 위 예외가 아니면 didClose를 보내지 않는다(프로세스 종료까지 open 유지).

### 6.6 서버 프로세스 종료/재시작
- 프로세스 exit 이벤트에서 `docs`/락/상태를 전부 폐기해야 한다.
- 이유: 서버는 재시작 후 열린 문서를 모르므로, 클라이언트가 “open된 상태”라고 가정하고 didChange만 보내면 프로토콜이 깨진다.

## 7. 수용 기준(Acceptance Criteria)
- AC1. 동일 파일을 연속으로 조회해도 `didOpen`이 1회만 전송된다.
- AC2. 파일 내용이 바뀐 뒤 다시 조회하면, 조회 전에 `didChange(version++)`가 전송되어 결과가 최신 내용과 일치한다.
- AC3. `textDocumentSync`가 `None`인 서버에는 `didChange`를 보내지 않는다.
- AC4. 서버 재시작 후 첫 요청에서 필요 시 `didOpen`부터 다시 정상 시퀀스로 진행된다.
