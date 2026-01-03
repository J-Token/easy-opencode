# OpenAI OAuth 플러그인 안내 추가 상세 스펙

## 대상 파일
- `README.md`
- `README.ko.md`

## 추가될 내용 (영문)
### OpenAI OAuth Support
To use OpenAI OAuth models, you must install the following plugin:
- Repository: [opencode-openai-codex-auth](https://github.com/numman-ali/opencode-openai-codex-auth)
- Configuration:
  ```json
  {
    "plugin": ["opencode-openai-codex-auth@4.2.0"]
  }
  ```

## 추가될 내용 (국문)
### OpenAI OAuth 지원
OpenAI OAuth 모델을 사용하려면 아래 플러그인을 반드시 설치해야 합니다:
- 저장소: [opencode-openai-codex-auth](https://github.com/numman-ali/opencode-openai-codex-auth)
- 설정 방법:
  ```json
  {
    "plugin": ["opencode-openai-codex-auth@4.2.0"]
  }
  ```

## 위치 선정
- `## CLI (provider sync)` 섹션 아래 혹은 `## Install` 섹션의 하위 항목으로 추가하여 사용자가 OpenAI 모델 사용 전에 인지할 수 있도록 함.
- 영문 버전에서는 `Built-in model presets` 시작 전에 추가하는 것이 적절해 보임.
