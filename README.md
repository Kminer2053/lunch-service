# 🍽️ 오늘 점심, 여기

간편한 점심 추천 및 관리 웹 애플리케이션

## 아키텍처

- **CRUD(장소/설정/비밀번호/이미지 등)**: 프론트엔드 → **server.js(프록시)** → **Google Apps Script** (Google Sheets·Drive)
  - CORS 문제 해결을 위해 프록시를 통해 Apps Script 호출
- **외부 API(네이버 검색, NCP 지오코딩, TMAP 도보거리, 정적 지도)**: 프론트엔드 → **server.js(프록시)** → Naver/NCP/TMAP
- **카카오톡 봇**: 카카오톡 → **server.js** → **Google Apps Script** (점심 추천)

프론트엔드에서 `API_BASE_URL`(Render 등 프록시 서버)을 통해 모든 API 호출을 수행합니다.

## 📱 기능

### 1. 🔍 추천
- 자연어로 점심 식당 추천 요청
- 프리셋 선택 (혼밥, 단체, 예약)
- AI 기반 개인화 추천 (Perplexity AI)
  - 날씨 정보 반영 (서울 영등포구 기상청 API)
  - 좋아요 수 기반 추천 (상위 30개 중 선택)
  - 사용자 요청 시 TOP 1, 없으면 TOP 3 반환
- 카카오톡 봇 연동 (`/점심` 명령어)

### 2. 📋 목록
- 등록된 모든 식당 목록 조회
- 실시간 검색 및 필터링
- 상세 정보 확인 (주소, 카테고리, 가격대, 도보 시간 등)
- 리뷰 기능 (좋아요/싫어요 및 코멘트 작성)
- 리뷰 통계 표시 (좋아요/싫어요 수)

### 3. ➕ 등록
- 새로운 식당 정보 등록
- 주소, 카테고리, 가격대, 태그 등 상세 정보 입력
- 네이버 지도 연동
- 관리자 기능 (장소 삭제 시 리뷰도 함께 삭제)

## 🚀 시작하기

### 사전 준비

- Node.js 14 이상
- npm 또는 yarn
- Google Apps Script 웹앱 배포 (CRUD 백엔드)
- 백엔드 API 서버 (server.js) — 외부 API 프록시용 (검색/지오코딩/지도)

### 설치

1. 저장소 클론:
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo/lunch-service
```

2. URL 설정 (Vercel 환경변수 또는 빌드 시 주입):

- **API_BASE_URL**: 백엔드 프록시 서버 URL (모든 API 호출용). 예: `https://your-render-app.onrender.com`
- **APPS_SCRIPT_URL**: (선택) 프록시 사용 시 비워도 됨

Vercel 환경변수로 설정하거나, 빌드 시 `build.js`가 자동으로 주입합니다.

3. 로컬 개발 서버 실행:

```bash
# Python 3 사용
python3 -m http.server 8000

# 또는 Node.js의 http-server 사용
npx http-server -p 8000
```

4. 브라우저에서 접속:
```
http://localhost:8000
```

## 📦 배포

### Vercel 배포 (권장)

1. Vercel 계정 생성 및 로그인
2. 프로젝트 루트에 `vercel.json` 생성:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "lunch-service/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/lunch-service/$1"
    }
  ]
}
```

3. 배포:
```bash
cd lunch-service
vercel
```

4. 배포된 URL을 백엔드 `.env` 파일의 `LUNCH_WEB_URL`에 설정

### Netlify 배포

1. Netlify 계정 생성 및 로그인
2. `lunch-service` 폴더를 배포:
```bash
cd lunch-service
netlify deploy
```

3. 프로덕션 배포:
```bash
netlify deploy --prod
```

### GitHub Pages 배포

1. `lunch-service` 폴더를 저장소 루트로 이동
2. GitHub 저장소 Settings > Pages
3. Source: `main` 브랜치
4. 배포 완료 후 URL 확인

## 🔧 설정

### API 엔드포인트 설정

배포 환경에 따라 `API_BASE_URL`을 변경하세요:

**개발 환경**:
```javascript
const API_BASE_URL = 'http://localhost:4000';
```

**프로덕션 환경**:
```javascript
const API_BASE_URL = 'https://myteamdashboard.onrender.com';
```

### CORS 설정

백엔드 서버 (`server.js`)에서 프론트엔드 도메인을 CORS에 추가해야 합니다:

```javascript
const allowedOrigins = [
    // ... 기존 설정
    'https://your-lunch-service.vercel.app',  // 프론트엔드 URL 추가
];
```

**참고**: Apps Script는 CORS 헤더를 지원하지 않으므로, 모든 Apps Script 호출은 `server.js` 프록시를 통해 수행됩니다.

## 📖 API 문서

### server.js 프록시 (모든 API 호출)

프론트엔드에서 `API_BASE_URL/lunch/api/apps-script`를 통해 Apps Script 호출:

- `places` (GET) - 장소 목록 조회 (리뷰 통계 포함)
- `places` (POST) - 새 장소 등록
- `places/{id}` (PUT/DELETE) - 장소 수정/삭제 (삭제 시 리뷰도 함께 삭제)
- `reviews` (POST) - 리뷰 작성 (좋아요/싫어요, 코멘트 필수)
- `config` (GET/POST) - 설정 조회/저장
- `verify-register-password` (POST) - 등록 비밀번호 검증
- `admin-verify` (POST) - 관리자 비밀번호 검증
- `upload-image` (POST) - 이미지 업로드
- `recommend` (POST) - 점심 추천 (text 선택사항, 없으면 TOP3)
- `daily-recommendations` (GET) - 오늘의 추천
- `generate-daily` (POST) - 일일 추천 생성

### server.js 프록시 (외부 API)

- `POST /lunch/search-place` - 네이버 지역 검색
- `POST /lunch/geocode-address` - NCP 지오코딩 + TMAP 도보거리
- `GET /lunch/static-map` - NCP 정적 지도 이미지

### 카카오톡 봇 API

- `POST /lunch/recommend` - 카카오톡 봇용 점심 추천 프록시
  - `text`: 선택사항 (없으면 빈 문자열로 TOP3 반환)
  - `preset`: 배열 (기본값: [])
  - `exclude`: 배열 (기본값: [])

## 🎨 UI/UX

### 모바일 최적화

- 최대 너비: 420px
- 반응형 디자인
- 터치 친화적 UI
- 하단 고정 탭바

### 스타일 커스터마이징

`lunch.css` 파일에서 색상 및 스타일을 변경할 수 있습니다:

```css
/* 주요 색상 */
.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

## 💬 카카오톡 봇 연동

점심 추천 서비스는 카카오톡 봇과 연동되어 있습니다.

### 사용 방법

- `/점심` - 오늘 추천 TOP 3 반환
- `/점심 [메뉴·기분]` - 맞춤 1곳 추천
  - 예: `/점심 매콤한거`
  - 예: `/점심 가벼운 샐러드`

### 응답 형식

카카오톡 봇 응답에는 다음 정보가 포함됩니다:
- 추천 장소 정보 (이름, 이유, 주소, 지도 링크, 카테고리, 도보 시간)
- 점심 추천 사용법 안내
- 웹 서비스 링크 (더 많은 기능)

### 설정

카카오톡 봇 연동을 위해 `server.js`에 다음 환경변수가 필요합니다:
- `GOOGLE_APPS_SCRIPT_URL`: Apps Script 웹앱 배포 URL
- `LUNCH_WEB_URL`: 점심 웹 앱 주소 (카카오톡 메시지에 링크로 사용)
- `LUNCH_API_KEY`: (선택) Apps Script API 키 검증용

## 🧪 테스트

### 수동 테스트

1. **추천 기능**:
   - 자연어 입력: "가까운 곳에서 혼밥 가능한 곳"
   - 프리셋 선택: 혼밥, 단체, 예약
   - 결과 확인
   - 날씨 정보 반영 여부 확인

2. **목록 기능**:
   - 검색어 입력: "한식", "가성비" 등
   - 필터링 확인
   - 리뷰 작성 및 통계 확인

3. **등록 기능**:
   - 필수 필드 검증 (이름, 주소)
   - 등록 후 목록에서 확인

4. **카카오톡 봇**:
   - `/점심` 명령어로 TOP3 추천 확인
   - `/점심 매콤한거` 등으로 맞춤 추천 확인

### 브라우저 호환성

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🐛 문제 해결

### API 호출 실패

1. **CRUD 실패**: `API_BASE_URL`이 올바른지 확인 (Vercel 환경변수)
2. **검색/지도 실패**: `API_BASE_URL`(Render 등)이 올바른지 확인
3. 네트워크 탭에서 요청 URL과 응답 코드 확인
4. CORS 에러 시 백엔드(server.js) 허용 도메인 확인
5. Render 환경변수 확인: `GOOGLE_APPS_SCRIPT_URL`, `LUNCH_WEB_URL` 설정 여부

### 추천 결과가 없음

1. 백엔드 서버가 실행 중인지 확인
2. Google Apps Script가 배포되었는지 확인
3. 장소가 등록되어 있는지 확인

### 스타일이 깨짐

1. 브라우저 캐시 삭제
2. CSS 파일 경로 확인
3. 모바일 뷰포트 설정 확인

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 🤝 기여

버그 리포트 및 기능 제안은 GitHub Issues를 이용해주세요.

## 📧 문의

프로젝트 관련 문의는 이메일 또는 GitHub Issues로 연락주세요.

## 📋 주요 변경사항

### v2.0 (최신)
- ✅ CORS 문제 해결: 프록시를 통한 Apps Script 호출
- ✅ 리뷰 기능 추가: 좋아요/싫어요 및 코멘트 작성
- ✅ AI 추천 최적화: 날씨 반영, 좋아요 수 기반 추천
- ✅ 카카오톡 봇 연동: `/점심` 명령어 지원
- ✅ 필드명 변경: `indoor_ok` → `reservation_ok`
- ✅ UI 개선: 헤더 패딩 최적화, 미사용 기능 제거

### v1.0
- 초기 릴리스

## 🔗 관련 링크

- [배포 환경 설정 가이드](./DEPLOY_ENV_CHECKLIST.md)
- [Apps Script 템플릿](./apps-script-template.js)
- [API 스펙](../API_SPEC.md)
