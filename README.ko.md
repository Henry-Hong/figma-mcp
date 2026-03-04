# @devheerim/figma-mcp

[English](./README.md) | **한국어**

Figma REST API를 통해 프로토타입 플로우 데이터(화면 목록, 연결 정보, 전체 플로우 맵)를 제공하는 Enhanced Figma MCP Server입니다.

공식 `https://mcp.figma.com/mcp`의 완전 대체제로 설계되었으며, 누락된 프로토타입 인터랙션 레이어를 추가하여 Claude Code가 하나의 Figma URL로 전체 사용자 플로우를 이해하고 정확한 코드를 생성할 수 있도록 합니다.

## 제공 도구

| 도구 | 설명 |
|------|------|
| `get_section_frames` | Figma 섹션 노드 내 모든 프레임(화면) 목록 반환 |
| `get_prototype_connections` | 노드의 프로토타입 인터랙션(트리거 + 이동 대상) 반환 |
| `get_flow_map` | 섹션 내 전체 프로토타입 플로우의 방향 그래프 생성 |
| `get_design_context` | 전체 디자인 컨텍스트: XML 구조 + 스크린샷 + 변수 + 스타일 |
| `get_metadata` | 노드 구조를 XML로 반환 |
| `get_screenshot` | 노드의 Base64 PNG 스크린샷 반환 |
| `get_variable_defs` | 변수 정의 반환 (Enterprise) 또는 bound variable 참조 (폴백) |

## 요구사항

- Node.js 18+
- Figma API 키 ([발급하기](https://www.figma.com/developers/api#access-tokens))

## 설치 및 설정

### 1. API 키 설정

```bash
export FIGMA_API_KEY=your_figma_api_key_here
```

### 2. `.mcp.json`에 등록

프로젝트의 `.mcp.json` (또는 `~/.claude/mcp.json`)에 추가:

```json
{
  "mcpServers": {
    "figma": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@devheerim/figma-mcp"],
      "env": {
        "FIGMA_API_KEY": "${FIGMA_API_KEY}"
      }
    }
  }
}
```

## 사용법

### 섹션 내 화면 목록 가져오기

```
get_section_frames(fileKey: "abc123", sectionNodeId: "24626:100")
```

섹션 바로 아래에 있는 프레임 노드 목록을 반환합니다.

### 화면의 프로토타입 연결 정보 가져오기

```
get_prototype_connections(fileKey: "abc123", nodeId: "24626:6637")
```

아래와 같은 연결 정보를 반환합니다:
```json
{
  "connections": [
    {
      "trigger": "ON_CLICK",
      "action": "NAVIGATE",
      "destinationId": "24626:6654",
      "destinationName": "다음 화면"
    }
  ]
}
```

### 섹션 전체 플로우 맵 가져오기

```
get_flow_map(fileKey: "abc123", nodeId: "24626:100")
```

방향 그래프를 반환합니다:
```json
{
  "nodes": [{ "id": "24626:6637", "name": "홈" }, ...],
  "edges": [{ "from": "24626:6637", "to": "24626:6654", "trigger": "ON_CLICK", "action": "NAVIGATE" }],
  "entryPoints": ["24626:6637"]
}
```

### Figma URL에서 ID 추출

URL 예시:
```
https://www.figma.com/design/AbCdEfGhIjKl/MyApp?node-id=24626-100
```

- `fileKey` = `AbCdEfGhIjKl`
- `nodeId` = `24626:100` (`-`를 `:`로 변환)

## Figma에서 ID 찾는 방법

1. Figma 파일 열기
2. 섹션 또는 프레임 우클릭 → **링크 복사**
3. URL에서 `node-id` 값 추출 후 `-`를 `:`로 변환

## 레이트 리밋

Figma API 레이트 리밋은 자동으로 처리됩니다:
- Nodes API: 분당 30회
- Images API: 분당 10회
- `Retry-After` 헤더 기반 지수 백오프 (최대 60초)

## Variables API

`get_variable_defs` 도구는 전체 변수 해석을 위해 Figma Enterprise 플랜이 필요합니다. Enterprise 플랜이 아닌 경우 노드 데이터의 `boundVariables` 참조로 자동 폴백합니다.

## 개발

```bash
git clone https://github.com/Henry-Hong/figma-mcp
cd figma-mcp
npm install
npm run build
npm test
```

## 라이선스

MIT
