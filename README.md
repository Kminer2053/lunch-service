# 🍽️ 오늘 점심, 여기

간편한 점심 추천 및 관리 웹 애플리케이션

## 아키텍처

- **CRUD(장소/설정/비밀번호/이미지 등)**: 프론트엔드 → **Google Apps Script** 직접 호출 (Google Sheets·Drive)
- **외부 API(네이버 검색, NCP 지오코딩, TMAP 도보거리, 정적 지도)**: 프론트엔드 → **server.js(프록시)** → Naver/NCP/TMAP

프론트엔드에서 `APPS_SCRIPT_URL`(웹앱 배포 URL)과 `API_BASE_URL`(Render 등 프록시 서버)을 구분해 사용합니다.

## 📱 기능

### 1. 🔍 추천
- 자연어로 점심 식당 추천 요청
- 프리셋 선택 (혼밥, 단체, 실내)
- AI 기반 개인화 추천
- 마음에 들지 않는 장소 제외 기능

### 2. 📋 목록
- 등록된 모든 식당 목록 조회
- 실시간 검색 및 필터링
- 상세 정보 확인 (주소, 카테고리, 가격대, 도보 시간 등)

### 3. ➕ 등록
- 새로운 식당 정보 등록
- 주소, 카테고리, 가격대, 태그 등 상세 정보 입력
- 네이버 지도 연동

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

2. URL 설정 (index.html 또는 빌드 시 주입):

- **APPS_SCRIPT_URL**: Apps Script 웹앱 배포 URL (CRUD용). 예: `https://script.google.com/macros/s/XXXX/exec`
- **API_BASE_URL**: 외부 API 프록시 서버 URL (검색/지오코딩/정적 지도용). 예: `https://your-render-app.onrender.com`

```html
<script>
  window.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
  window.API_BASE_URL = 'https://your-render-app.onrender.com';
</script>
<script src="lunch.js"></script>
```

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

## 📖 API 문서

### Apps Script 직접 호출 (CRUD)

프론트엔드에서 `callAppsScript(path, method, body)`로 호출하는 경로:

- `places` (GET) - 장소 목록 조회
- `places` (POST) - 새 장소 등록
- `places/{id}` (PUT/DELETE) - 장소 수정/삭제
- `config` (GET/POST) - 설정 조회/저장
- `verify-register-password` (POST) - 등록 비밀번호 검증
- `admin-verify` (POST) - 관리자 비밀번호 검증
- `upload-image` (POST) - 이미지 업로드
- `recommend` (POST) - 점심 추천
- `daily-recommendations` (GET) - 오늘의 추천
- `generate-daily` (POST) - 일일 추천 생성

### server.js 프록시 (외부 API만)

- `POST /lunch/search-place` - 네이버 지역 검색
- `POST /lunch/geocode-address` - NCP 지오코딩 + TMAP 도보거리
- `GET /lunch/static-map` - NCP 정적 지도 이미지

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

## 🧪 테스트

### 수동 테스트

1. **추천 기능**:
   - 자연어 입력: "가까운 곳에서 혼밥 가능한 곳"
   - 프리셋 선택: 혼밥, 단체, 실내
   - 결과 확인

2. **목록 기능**:
   - 검색어 입력: "한식", "가성비" 등
   - 필터링 확인

3. **등록 기능**:
   - 필수 필드 검증 (이름, 주소)
   - 등록 후 목록에서 확인

### 브라우저 호환성

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🐛 문제 해결

### API 호출 실패

1. **CRUD 실패**: `APPS_SCRIPT_URL`이 올바른지 확인 (index.html 또는 Vercel 환경변수)
2. **검색/지도 실패**: `API_BASE_URL`(Render 등)이 올바른지 확인
3. 네트워크 탭에서 요청 URL과 응답 코드 확인
4. CORS 에러 시 백엔드(server.js) 허용 도메인 확인

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

## 🔗 관련 링크

- [백엔드 설정 가이드](../docs/lunch-service/setup-guide.md)
- [Apps Script 템플릿](../docs/lunch-service/apps-script-template.js)
- [API 스펙](../API_SPEC.md)
