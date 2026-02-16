# Apps Script API 활성화 방법

## 방법 1: Apps Script 설정에서 활성화 (간단)

1. https://script.google.com/home/usersettings 접속
2. "Google Apps Script API" 토글을 **켜기** (ON)
3. 저장

## 방법 2: Google Cloud Console에서 활성화

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 (또는 새 프로젝트 생성)
3. 왼쪽 메뉴에서 **"API 및 서비스"** > **"라이브러리"** 클릭
4. 검색창에 **"Apps Script API"** 입력
5. **"Apps Script API"** 클릭
6. **"사용 설정"** 버튼 클릭

## 활성화 후

- API 활성화 후 몇 분 정도 기다려야 할 수 있습니다
- GitHub Actions 워크플로우를 다시 실행하세요
  - Actions 탭 > 실패한 워크플로우 > "Re-run jobs" 클릭
  - 또는 `apps-script-template.js` 파일을 약간 수정하고 푸시

## 확인 방법

활성화가 완료되었는지 확인하려면:
- Google Cloud Console > API 및 서비스 > 사용 설정된 API
- "Apps Script API"가 목록에 있는지 확인
