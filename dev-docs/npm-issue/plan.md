# Plan: GitHub Release -> npm 자동 배포 (v0.2.0 대응)

## 1. 개요
- **배경**: GitHub에는 `0.2.0` 릴리즈가 존재하나, npm에는 `0.1.0`만 배포된 상태 (자동 배포 파이프라인 부재).
- **목표**: GitHub Release 발행 시 npm에 `@j-token/easy-opencode` 패키지를 퍼블릭(`public`)으로 자동 배포하는 환경 구축 및 기존 `0.2.0` 누락분 배포 처리.

## 2. 현재 상태 분석
- **npm**: `@j-token/easy-opencode@0.1.0` (latest)
- **GitHub**: Tag `0.2.0` 존재, Release `v0.2.0` 발행됨.
- **package.json**: `version: "0.1.0"` (local `main` 기준), Tag 커밋 기준으로는 `"0.2.0"`으로 확인됨.
- **문제점**:
  1. GitHub Actions 워크플로우(`.github/workflows/*.yml`)가 없음.
  2. `package.json`에 `publishConfig.access="public"` 설정이 없어 scoped 패키지 배포 시 오류 가능성 있음.

## 3. 해결 단계

### 1단계: 배포용 환경 설정 (spec.md 반영)
- `package.json` 수정: `publishConfig.access = "public"` 추가.
- GitHub Secrets 설정: `NPM_TOKEN` (Automation 타입 권장) 등록.

### 2단계: GitHub Actions 워크플로우 설계
- **트리거**: `on: release: types: [published]`
- **런타임**: Bun (v1.x 이상)
- **절차**:
  1. 소스 체크아웃
  2. Node + Bun 환경 구성
  3. 의존성 설치 (`bun install --frozen-lockfile`)
  4. 빌드 수행 (`bun run build`) -> `dist/` 생성 확인
  5. 배포 수행 (`npm publish`)

### 3단계: 기존 0.2.0 누락분 배포 (재트리거)
- 워크플로우 파일을 `main`에 머지한 후, 기존 GitHub Release `v0.2.0`을 **삭제 후 동일 태그로 재발행**하여 `published` 이벤트를 강제 발생시킨다.

## 4. 기대 결과
- 이후 모든 `Release` 발행 시 자동으로 npm에 신규 버전이 반영됨.
- `0.2.0` 버전이 정상적으로 npm `latest`로 등재됨.
