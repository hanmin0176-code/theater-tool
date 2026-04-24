# Theater Tool Handoff

작성일: 2026-04-24  
작업 기준 폴더: `C:\Users\GB010\Desktop\MANOSA\theater-tool-main`  
GitHub 저장소: `https://github.com/hanmin0176-code/theater-tool`

## 현재 상태

- 이 버전은 **안정버전으로 배포 가능한 상태**다.
- 로컬 기준 주요 동작 확인 완료:
  - 접속코드 입장
  - 템플릿 저장 / 덮어쓰기 / 불러오기 / 삭제 / 복구
  - `000000` 샘플방 읽기 전용 동작
  - 템플릿 목록 최근 5개 표시 + 추가 펼치기
  - 휴지통 접기/펼치기
  - 활동 로그 10개 제한 + 스크롤
  - 이미지 저장량 표시 레이아웃 수정
  - PNG 캡처 / HTML 저장

## 이번 안정버전에 포함된 핵심 변경

### 1. 템플릿 저장 구조 최적화

- 템플릿 본문과 별도로 **메타 인덱스**를 유지하도록 변경
- 버전 수를 매번 전체 스캔하지 않고 **메타 값으로 관리**
- 휴지통 / 활동 로그 / 캐릭터 프리셋 메타도 분리

관련 파일:

- `netlify/functions/templates.mjs`
- `netlify/functions/images.mjs`

### 2. 초기 로딩 경량화

- 공개 샘플 템플릿 JSON을 **lazy load**
- `html-to-image`를 캡처 시점에만 **dynamic import**
- 메인 번들 크기를 크게 줄임

관련 파일:

- `src/App.tsx`

### 3. 템플릿 패널 분리

- 템플릿 저장소 UI를 별도 컴포넌트로 추출

관련 파일:

- `src/components/TemplateStoragePanel.tsx`

### 4. 이미지 업로드 캐시

- 같은 방에서 같은 이미지 업로드 요청이 중복될 때 캐시 사용

관련 파일:

- `src/utils/imageUploadCache.ts`

### 5. 사용감 개선

- `000000` 샘플방은 로컬 초안으로 오염되지 않음
- 저장 버튼 흐름을 **새 템플릿 저장 / 현재 템플릿 덮어쓰기**로 분리
- 템플릿 / 휴지통 접기 상태를 브라우저에 저장
- 이미지 저장량 UI 줄바꿈 문제 수정

## 지금 바로 이어서 작업할 때 참고

### 우선 작업 추천 순서

1. 실제 사용 중 불편한 UX 세부 수정
2. 모바일/좁은 폭 레이아웃 다듬기
3. 필요 시 실시간 협업이 아닌 가벼운 충돌 방지 기능
4. 마지막에 추가 최적화나 리팩토링

### 아직 보류한 것

- 실시간 공동편집
- 저장 충돌 경고
- 진짜 동시편집 락

## 로컬에서 최신화 후 이어서 작업하는 방법

자택 PC Codex에서 이 저장소 기준으로 최신화:

```bash
git clone https://github.com/hanmin0176-code/theater-tool.git
cd theater-tool
npm install
npm run dev
```

Netlify Functions 포함 로컬 테스트:

```bash
npm run dev
```

기본 주소:

- 앱 + Functions: `http://localhost:8888`
- Vite 직통: `http://localhost:5173`

## 작업 시 주의사항

- `main` 기준으로 작업 이어가면 된다.
- 템플릿/이미지 저장 구조는 이제 **인덱스 기반**이라, 새 기능 추가 시 메타 갱신도 같이 봐야 한다.
- `000000`은 샘플방이라 **읽기 전용** 전제로 유지하는 게 안전하다.
- 로컬 개발 중 `netlify-dev.log`, `netlify-dev.err.log`는 생성될 수 있는데, 커밋하지 않는 게 좋다.

## 다음 Codex에게 전달할 짧은 문장

이 저장소는 극장 도구 제작기 안정버전이며, 2026-04-24 기준 최적화 1~5까지 반영된 상태다.  
`templates.mjs`와 `images.mjs`는 인덱스 기반 저장 구조로 바뀌었고, `src/App.tsx`는 샘플 템플릿 lazy load / 캡처 dynamic import / 템플릿 패널 분리 반영 상태다.  
다음 작업은 기능 추가보다 UX 미세 수정과 필요 기능 보강 위주로 이어가면 된다.
