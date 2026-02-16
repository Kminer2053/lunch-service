# Apps Script 파일 정리 가이드

## 정상적인 Apps Script 프로젝트 구조

Apps Script 프로젝트에는 다음 파일만 있어야 합니다:

### 필수 파일
1. **`Code.gs`** 또는 **`apps-script-template.gs`**
   - 백엔드 API 로직만 포함
   - 브라우저용 코드(`window`, `document` 등) 포함하지 않음

2. **`appsscript.json`**
   - 프로젝트 설정 파일
   - 권한 범위(oauthScopes) 정의

### 포함되면 안 되는 파일
- ❌ `lunch.js` / `lunch.gs` (프론트엔드 파일)
- ❌ `lunch.css` (스타일 파일)
- ❌ `index.html` (HTML 파일)
- ❌ `browser-test.js` / `browser-test.gs` (테스트 파일)
- ❌ `*.md` (문서 파일)

## 현재 문제

Apps Script 편집기에서 다음 파일들이 보이고 있습니다:
- `lunch.gs` ← 삭제 필요
- `index.html` ← 삭제 필요

이 파일들이 포함되어 있으면:
- `ReferenceError: window is not defined` 오류 발생
- Apps Script가 브라우저 환경이 아니므로 `window` 객체가 없음

## 해결 방법

### 방법 1: Apps Script 편집기에서 수동 삭제 (즉시)

1. **Apps Script 편집기 열기**
   - Google Sheets → 확장 프로그램 → Apps Script

2. **불필요한 파일 삭제**
   - 왼쪽 파일 목록에서 `lunch.gs` 파일 선택
   - 파일 옆의 "⋮" 메뉴 클릭 → "삭제" 선택
   - `index.html` 파일도 동일하게 삭제

3. **확인**
   - 파일 목록에 `apps-script-template.gs` (또는 `Code.gs`)와 `appsscript.json`만 남아있는지 확인

### 방법 2: GitHub Actions 재배포 (자동)

`.claspignore` 파일이 업데이트되었으므로, 다음 배포 시 자동으로 제외됩니다:

1. **GitHub Actions 워크플로우 확인**
   - https://github.com/Kminer2053/lunch-service/actions
   - "Deploy Apps Script" 워크플로우가 실행되면 자동으로 정리됨

2. **수동 트리거** (필요시)
   - GitHub Actions에서 "Run workflow" 버튼 클릭
   - `apps-script-template.js` 파일이 변경되지 않았어도 수동 실행 가능

## `.claspignore` 파일 확인

현재 `.claspignore` 파일에 다음이 포함되어 있습니다:
```
# 프론트엔드 파일 (브라우저용)
lunch.js
lunch.css
index.html

# 테스트 파일
browser-test.js
browser-test-results.json

# 문서 파일
*.md
...
```

## 권장 작업 순서

1. ✅ **즉시**: Apps Script 편집기에서 `lunch.gs`, `index.html` 수동 삭제
2. ✅ **확인**: `checkPermissions` 함수 실행하여 권한 확인
3. ✅ **자동화**: GitHub Actions가 다음 배포 시 자동으로 정리

## 정상 상태 확인

Apps Script 편집기의 파일 목록이 다음과 같아야 합니다:
```
LunchService
├── apps-script-template.gs (또는 Code.gs)
└── appsscript.json
```

이 두 파일만 있으면 정상입니다!
