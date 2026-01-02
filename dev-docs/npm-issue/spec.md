# Spec: GitHub Release 기반 npm 자동 배포 프로세스

## 1. 배포 트리거 (Trigger)
- **Event**: `release`
- **Type**: `published`
- **대상 브랜치/태그**: 모든 태그 (단, `package.json` 버전과 태그명이 일치해야 함)

## 2. 환경 요구사항
- **Runtime**: [Bun](https://bun.sh) (v1.x)
- **Package Manager**: Bun (install/build), npm (publish)
- **Secrets**:
  - `NPM_TOKEN`: npmjs.org에서 발행한 Automation Token. `@j-token` 스코프에 대한 `Write` 권한 필수.
- **package.json 설정**:
  ```json
  "publishConfig": {
    "access": "public"
  }
  ```

## 3. GitHub Actions 파이프라인 (CI/CD)

### Step 1: Checkout
- `actions/checkout@v4` 사용.

### Step 2: Setup Environments
- `oven-sh/setup-bun@v2`: 빌드 및 의존성 관리용.
- `actions/setup-node@v4`: npm publish용 (`registry-url: 'https://registry.npmjs.org'`).

### Step 3: Build
- `bun install --frozen-lockfile`
- `bun run build`: `dist/plugin`, `dist/cli`, `dist/index.d.ts` 생성을 보장해야 함.

### Step 4: Publish to npm
- **Command**: `npm publish`
- **Auth**: `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`
- **Dist-tag 정책**:
  - `prerelease: false` (정식 릴리즈) -> `latest`
  - `prerelease: true` (베타/RC) -> `next`
  - *참고: 워크플로우에서 `github.event.release.prerelease` 값에 따라 `--tag` 옵션 분기.*

## 4. 운영 규칙 및 제약사항

### 버전 관리 규칙
- **단일 소스**: 모든 버전 정보는 `package.json`을 기준으로 한다.
- **일치성 검증**: 배포 전 태그명(예: `0.2.0`)과 `package.json`의 버전이 일치하는지 CI에서 검증하는 것을 권장한다.

### 재트리거 가이드 (누락 발생 시)
- 배포가 실패하거나 누락된 경우, GitHub Release를 `Draft`로 전환 후 다시 `Publish` 하거나, 삭제 후 재발행하여 이벤트를 재발생시킨다.

### 보안
- `NPM_TOKEN`은 절대 로그에 노출되지 않도록 `secrets`를 사용하며, 워크플로우 내에서 `NODE_AUTH_TOKEN` 환경변수로만 사용한다.

## 5. 참고 링크
- [npm: Creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages)
- [GitHub: Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
