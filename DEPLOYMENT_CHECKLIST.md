# 배포 체크리스트

## 배포 전 확인사항

### 코드 변경사항 확인
- [ ] `server.js`: PUT/DELETE를 POST로 변환하는 로직 추가됨
- [ ] `apps-script-template.js`: PUT/DELETE 라우팅 로직 개선 및 디버깅 로그 추가
- [ ] `lunch.js`: 태그 입력 버그 수정, 비밀번호 모달 개선
- [ ] 모든 변경사항이 커밋되어 있음

## 배포 순서

### 1단계: Apps Script 배포

**자동 배포**:
- `apps-script-template.js` 파일이 변경되면 GitHub Actions가 자동으로 배포
- 확인: https://github.com/Kminer2053/lunch-service/actions

**수동 배포** (필요시):
1. GitHub 리포지토리로 이동: https://github.com/Kminer2053/lunch-service
2. Actions 탭 클릭
3. "Deploy Apps Script" 워크플로우 선택
4. "Run workflow" 버튼 클릭
5. main 브랜치 선택 후 "Run workflow" 실행

**배포 확인**:
- [ ] GitHub Actions 워크플로우가 성공적으로 완료됨
- [ ] Apps Script 편집기에서 코드 변경사항 확인
- [ ] Apps Script 실행 로그에서 디버깅 메시지 확인 가능
- [ ] **웹앱 재배포 확인**: GitHub Actions 로그에서 배포 URL 확인
  - [ ] `clasp version`이 성공적으로 실행됨
  - [ ] `clasp deploy`가 성공적으로 실행됨
  - [ ] 배포 URL이 출력되었는지 확인 (예: `https://script.google.com/macros/s/.../exec`)
  - [ ] Render의 `GOOGLE_APPS_SCRIPT_URL` 환경변수가 배포 URL과 일치하는지 확인
    - Render 대시보드 → 환경변수 → `GOOGLE_APPS_SCRIPT_URL` 값 확인
    - 배포 URL과 정확히 일치해야 함 (마지막에 `/exec` 포함)

**주요 변경사항**:
- PUT/DELETE 요청이 POST로 변환되어 오는 경우도 처리하도록 라우팅 로직 수정
- 디버깅을 위한 로그 추가 (`console.log('Apps Script 요청:', ...)`)
- 에러 메시지 개선 (경로와 메서드 정보 포함)
- **자동 웹앱 재배포**: `clasp push` 후 `clasp version` 및 `clasp deploy` 자동 실행
  - `CLASP_DEPLOYMENT_ID` secret이 설정되어 있으면 기존 배포 업데이트
  - 없으면 새 배포 생성 (배포 ID를 로그에 출력하여 다음 배포에 사용 가능)

### 2단계: 백엔드 배포 (Render)

**자동 배포**:
- `server.js` 파일이 변경되면 Render가 자동으로 배포

**수동 재배포** (필요시):
1. Render 대시보드 접속
2. 해당 서비스 선택
3. "Manual Deploy" 버튼 클릭
4. "Deploy latest commit" 선택

**배포 확인**:
- [ ] Render 배포 로그에서 에러 없이 빌드 완료 확인
- [ ] 서버가 정상적으로 시작되었는지 확인 (로그에서 "Server running" 메시지 확인)
- [ ] 환경변수 설정 확인:
  - [ ] `GOOGLE_APPS_SCRIPT_URL` 설정됨
    - **중요**: 이 값이 Apps Script 웹앱 배포 URL과 정확히 일치해야 함
    - 형식: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`
    - GitHub Actions 배포 로그에서 확인한 배포 URL과 비교
  - [ ] `LUNCH_API_KEY` 설정됨 (Apps Script의 `API_KEY`와 동일해야 함)
  - [ ] 기타 필요한 환경변수 설정됨

**주요 변경사항**:
- `callAppsScript` 함수에서 PUT/DELETE 요청을 POST로 변환하는 로직 추가
- 변환된 요청도 body를 전달하도록 수정

### 3단계: 프론트엔드 배포 (Vercel)

**자동 배포**:
- `lunch-service` 폴더의 변경사항이 자동으로 배포됨

**수동 배포** (필요시):
1. Vercel 대시보드 접속: https://vercel.com/dashboard
2. 해당 프로젝트 선택
3. "Deployments" 탭에서 "Redeploy" 클릭
4. 또는 Vercel CLI 사용: `cd lunch-service && vercel --prod`

**배포 확인**:
- [ ] Vercel 빌드 로그에서 에러 없이 빌드 완료 확인
- [ ] 배포된 URL 접속 테스트
- [ ] 브라우저 콘솔에서 에러 없음 확인 (F12 → Console 탭)

**주요 변경사항**:
- 태그 입력 중복 생성 버그 수정 (`addTag` 함수 개선)
- 비밀번호 모달 표시 개선 (`showPasswordModal` 함수 개선)

## 배포 후 테스트

배포가 완료되면 `TEST_GUIDE.md`의 테스트 계획을 따라 모든 기능을 테스트하세요.

**필수 테스트 항목**:
1. 태그 입력 중복 생성 버그 수정 확인
2. 비밀번호 모달 표시 확인
3. 비밀번호 검증 실패 처리 확인
4. 이미지 업로드 기능 확인
5. 관리자 삭제 기능 확인
6. 관리자 수정 기능 확인 (UI 및 저장)
7. 이미지 수정 기능 확인

## 문제 발생 시

### Apps Script 배포 실패
1. GitHub Actions 로그 확인
2. `CLASP_RC`, `CLASP_SCRIPT_ID`, `CLASP_DEPLOYMENT_ID` 시크릿 확인
3. Apps Script 편집기에서 수동으로 코드 확인
4. **웹앱 배포 URL 불일치 문제**:
   - 증상: "알 수 없는 엔드포인트" 에러가 계속 발생
   - 확인: Render의 `GOOGLE_APPS_SCRIPT_URL`이 최신 배포 URL과 일치하는지 확인
   - 해결: GitHub Actions 배포 로그에서 배포 URL 확인 후 Render 환경변수 업데이트
   - 또는 `clasp deployments` 명령으로 현재 배포 목록 확인

### 백엔드 배포 실패
1. Render 배포 로그 확인
2. 환경변수 설정 확인
3. 서버 로그에서 에러 메시지 확인
4. Node.js 버전 확인 (22.x 필요)

### 프론트엔드 배포 실패
1. Vercel 빌드 로그 확인
2. 빌드 에러 메시지 확인
3. `vercel.json` 설정 확인

## 배포 완료 확인

모든 배포가 완료되면:
- [ ] Apps Script 배포 완료
- [ ] 백엔드 배포 완료
- [ ] 프론트엔드 배포 완료
- [ ] 모든 테스트 통과

이제 사용자에게 서비스를 제공할 수 있습니다!
