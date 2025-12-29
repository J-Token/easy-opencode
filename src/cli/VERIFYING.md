# easy-opencode CLI 검증 체크리스트

## 1) 도움말
- `npx @j-token/easy-opencode --help`

## 2) dry-run
- `npx @j-token/easy-opencode --dry-run`
  - added/conflicts 요약이 출력되는지 확인

## 3) 충돌 처리(대화형)
- 타겟 `~/.config/opencode/opencode.jsonc` 또는 `opencode.json`에서
  - `provider.openai` 또는 `provider["google-ai"]`의 일부 값을 임의로 변경
- `npx @j-token/easy-opencode`
  - providerId 단위로 1회 프롬프트가 뜨는지 확인

## 4) 자동 충돌 정책
- `npx @j-token/easy-opencode --on-conflict overwrite`
- `npx @j-token/easy-opencode --on-conflict keep`

## 5) 백업
- 기본 실행 시 `.bak.YYYYMMDD-HHMMSS` 파일이 생성되는지 확인
- `--no-backup` 실행 시 백업이 생성되지 않는지 확인

## 6) jsonc 우선순위
- `opencode.jsonc`가 존재하면 jsonc가 수정되는지 확인
- jsonc가 없으면 json이 수정되는지 확인
