# 배포 체크리스트

## 아키텍처 요약

- **CRUD**: 프론트엔드 → Apps Script 직접 호출 (server.js 경유 없음)
- **외부 API**: 프론트엔드 → server.js(프록시) → Naver/NCP/TMAP

## 배포 전 확인사항

### 코드 변경사항 확인
- [ ] `apps-script-template.js`: API 키 검증 제거, admin-verify 경로 추가
- [ ] `lunch.js`: CRUD는 callAppsScript(APPS_SCRIPT_URL) 직접 호출, 외부 API만 API_BASE_URL 사용
- [ ] `server.js`: 점심 CRUD 프록시 제거, search-place / geocode-address / static-map 만 유지
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
- [ ] 배포 URL 확인 (예: `https://script.google.com/macros/s/.../exec`)
- [ ] **프론트엔드(Vercel)에 배포 URL 설정**: `APPS_SCRIPT_URL`에 위 URL 설정 (index.html 또는 Vercel 환경변수로 주입)

**주요 변경사항**:
- API 키 검증 제거 (프론트엔드 직접 호출, 웹앱 "모든 사용자" 접근)
- admin-verify 경로 추가 (관리자 비밀번호 검증)
- PUT/DELETE는 쿼리 파라미터 `method`로 구분

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
- [ ] 환경변수 확인 (점심 서비스 **외부 API 프록시**용만 필요):
  - [ ] `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` (지역 검색)
  - [ ] `NCP_APIGW_API_KEY_ID` / `NCP_APIGW_API_KEY` (지오코딩, 정적 지도)
  - [ ] `TMAP_API_KEY` (도보 거리)
  - ~~`GOOGLE_APPS_SCRIPT_URL`~~, ~~`LUNCH_API_KEY`~~ → CRUD는 프론트에서 Apps Script 직접 호출하므로 불필요

**주요 변경사항**:
- 점심 CRUD 관련 엔드포인트 제거 (places, config, upload-image, verify 등)
- 유지: `/lunch/search-place`, `/lunch/geocode-address`, `/lunch/static-map` 만

### 3단계: 프론트엔드 배포 (Vercel)

**필수 설정**:
- 배포된 Apps Script 웹앱 URL을 프론트엔드에 전달해야 함. `index.html`의 `window.APPS_SCRIPT_URL` 또는 Vercel 환경변수로 빌드 시 주입.
- `window.API_BASE_URL`: Render 등 외부 API 프록시 URL.

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
   - 확인: 프론트엔드(Vercel/index.html)의 `APPS_SCRIPT_URL`이 최신 배포 URL과 일치하는지 확인
   - 해결: GitHub Actions 배포 로그에서 배포 URL 확인 후 Vercel 환경변수 또는 index.html의 `window.APPS_SCRIPT_URL` 업데이트
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
