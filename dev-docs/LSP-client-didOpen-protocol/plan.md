# LSP 문서 동기화 개선 계획 (didOpen/didChange)

## 목표
- 동일 문서(URI)에 대해 `textDocument/didOpen`을 1회만 보내고, 이후 변경은 `textDocument/didChange`로 동기화한다.
- 요청(hover/definition/diagnostics 등) 직전에 서버가 최신 문서 내용을 보도록 보장한다.
- 서버 `InitializeResult.capabilities.textDocumentSync`를 엄격히 준수한다.

## 확정된 결정
- 문서 close 정책: A) 프로세스 종료까지 open 유지(단, 예외 상황은 close)
- 변경 감지: B) 매 요청마다 파일을 `readFile`로 읽고 비교
- capability 준수: A) `textDocumentSync`를 엄격하게 해석/적용

## 범위
- 대상 요청(모두 `src/tools/lsp/lsp-client.ts`에서 파일 기반):
  - hover/definition/references/documentSymbols/diagnostics/prepareRename/rename/codeActions
- 비대상:
  - workspaceSymbols, codeActionResolve(현재도 파일 open 없이 동작)

## 작업 단계
1. initialize 결과에서 `capabilities.textDocumentSync`를 저장하고, 내부 “sync 정책”으로 정규화한다.
2. `uri` 단위 문서 상태 캐시를 추가한다(열림 여부, languageId, version, 마지막 텍스트 등).
3. 기존 `ensureDidOpen()` 호출부를 `ensureDocumentSynced()`로 교체한다.
4. `ensureDocumentSynced()`에서 매번 `readFile`로 최신 텍스트를 읽고, 캐시와 비교한다.
5. 변경이 감지되면 서버 syncKind에 따라 `didChange`를 보낸다.
   - `None`: 아무것도 보내지 않음
   - `Full`: 전체 텍스트 동기화
   - `Incremental`: “이전 텍스트 → 새 텍스트”를 만드는 1개 change 이벤트(범위+텍스트)로 동기화
6. 예외 처리
   - 서버 프로세스 exit/restart 시 캐시 전부 폐기(서버가 문서를 모르는 상태로 되돌아감)
   - languageId 변경 시: close+open으로 재동기화
   - 파일 삭제/읽기 실패(ENOENT 등) 시: 필요 시 close 후 캐시 제거
7. 검증
   - 동일 파일에 대해 연속 2회 hover/definition 호출 시 중복 `didOpen`이 발생하지 않음
   - 파일 내용 변경 후 재조회 시 hover/diagnostics가 변경 내용을 반영
   - `bun run typecheck`, `bun run build` 통과

## 리스크/완화
- 리스크: strict capability로 인해 `textDocumentSync`를 제대로 광고하지 않는 서버와 호환성 문제가 날 수 있음.
- 완화: (추후 옵션) “호환성 모드(강제 didOpen/Full didChange)”를 도입할지 검토(이번 범위 밖).
