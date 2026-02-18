# 점심 서비스 배포 시 환경 설정 및 변경 사항

배포 전 아래 항목을 설정한 뒤 배포하면 됩니다. (직접 수정 후 배포)

---

## 1. Render (백엔드 server.js)

**대상**: https://dashboard.render.com → 해당 웹 서비스 → Environment

### 필수 환경변수 (점심 서비스용)

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `GOOGLE_APPS_SCRIPT_URL` | Apps Script 웹앱 배포 URL (프록시가 이 주소로 요청 전달) | `https://script.google.com/macros/s/AKfycbx.../exec` |
| `LUNCH_WEB_URL` | 점심 웹 앱 주소 (카카오봇 메시지에 링크로 넣을 때 사용) | `https://lunch-service.vercel.app` |
| `LUNCH_API_KEY` | (선택) Apps Script에서 x-api-key 검증 시 사용. 검증 안 쓰면 비워도 됨 | 32자 이상 랜덤 문자열 |

**일일 추천 크론**: Render에 `LUNCH_DAILY_CRON` 환경변수는 **넣지 않아도 됩니다.**  
점심 서비스 관리자 화면(관리자 → 일일 추천 스케줄)에서 Cron 표현식을 입력하고 저장하면, 서버가 Apps Script config에서 `cron_time`을 읽어 자동 반영합니다. (저장 시 서버에 즉시 반영)

### Apps Script에서 API 키 검증을 사용하는 경우

- Render에 `LUNCH_API_KEY` 설정
- Apps Script 스크립트 속성에 `API_KEY` = 위와 같은 값 설정

### Apps Script 스크립트 속성 (날씨 API)

| 변수명 | 설명 | 필수 여부 |
|--------|------|----------|
| `KMA_API_KEY` | 기상청 초단기실황 API 키 (공공데이터포털 발급) | 선택 (없으면 날씨 정보 없이 추천) |
| `PERPLEXITY_API_KEY` | Perplexity AI API 키 (AI 추천용) | 선택 (없으면 폴백 추천) |

**참고**: 날씨 API 키는 공공데이터포털(https://www.data.go.kr)에서 발급받을 수 있습니다.

### 점심 관련 외부 API (기능별로 필요할 때만)

| 변수명 | 용도 | 없으면 |
|--------|------|--------|
| `NAVER_CLIENT_ID` | 장소 검색 (등록 시 주소/이름 검색) | 검색 실패, 503 |
| `NAVER_CLIENT_SECRET` | 위와 쌍 | 위와 동일 |
| `NCP_APIGW_API_KEY_ID` | 지오코딩, 정적 지도 | 지오코딩/지도 503 |
| `NCP_APIGW_API_KEY` | 위와 쌍 | 위와 동일 |
| `TMAP_API_KEY` | 도보 시간 계산 | TMAP 없이 직선거리 추정으로 대체 |

**요약**:  
- **반드시 넣을 것**: `GOOGLE_APPS_SCRIPT_URL`, `LUNCH_WEB_URL`  
- **선택**: `LUNCH_API_KEY` (Apps Script 인증 시), 네이버/NCP/TMAP (해당 기능 사용 시)  
- **넣지 않아도 됨**: `LUNCH_DAILY_CRON` (일일 추천 스케줄은 관리자 화면에서 설정)

---

## 2. Vercel (프론트엔드 lunch-service)

**대상**: https://vercel.com/dashboard → 해당 프로젝트 → Settings → Environment Variables

### 빌드 시 주입되는 변수 (build.js가 index.html에 넣음)

| 변수명 | 설명 | 권장값 |
|--------|------|--------|
| `API_BASE_URL` | 백엔드(Render) 주소. 프론트가 이 주소로 프록시·외부 API 요청 | `https://myteamdashboard.onrender.com` (끝에 슬래시 없이) |
| `APPS_SCRIPT_URL` | (선택) 프록시 사용 시 비워도 됨. 비우면 프록시만 사용 | 비움 또는 실제 Apps Script URL |

**동작 요약**  
- `API_BASE_URL`이 있으면: 모든 Apps Script 호출이 `API_BASE_URL/lunch/api/apps-script` 로 감 (CORS 회피).  
- `APPS_SCRIPT_URL`은 프록시 사용 시 설정하지 않아도 됨.

### 설정 후

- **재배포 필수**: 환경변수 변경 후 Vercel에서 한 번 **Redeploy** 해야 새 값이 빌드에 반영됨.

---

## 3. Google Apps Script

- **스크립트 속성** (프로젝트 설정 → 스크립트 속성):  
  - x-api-key 검증 사용 시: `API_KEY` = Render의 `LUNCH_API_KEY`와 동일한 값  
  - 검증 안 쓰면 설정 불필요  
- **배포**: 웹 앱으로 배포된 URL을 복사해 Render의 `GOOGLE_APPS_SCRIPT_URL`에 넣음.  
- **재배포**: 코드/속성 변경 후 “배포” → “배포 관리”에서 기존 배포 수정 또는 새 배포 생성 후 새 URL을 Render에 다시 넣음.

---

## 4. 배포 순서 권장

1. **Apps Script**  
   - 코드/속성 반영 후 웹앱 배포  
   - 배포 URL 복사
2. **Render**  
   - `GOOGLE_APPS_SCRIPT_URL`, `LUNCH_WEB_URL` (그리고 필요 시 `LUNCH_API_KEY`, 네이버/NCP/TMAP) 설정  
   - 저장 후 자동 재배포 또는 수동 Deploy
3. **Vercel**  
   - `API_BASE_URL` = Render 서비스 URL (예: `https://myteamdashboard.onrender.com`)  
   - `APPS_SCRIPT_URL`은 비우거나 그대로 둠  
   - 저장 후 **Redeploy** 한 번 실행

---

## 5. 한 번에 확인할 것

- [ ] Render: `GOOGLE_APPS_SCRIPT_URL`, `LUNCH_WEB_URL` 설정됨  
- [ ] Render: (선택) `LUNCH_API_KEY`, 네이버/NCP/TMAP 필요 시 설정  
- [ ] Vercel: `API_BASE_URL` = Render URL, 변경 후 Redeploy 함  
- [ ] Apps Script: 웹앱 배포 완료, URL이 Render 설정과 일치  
- [ ] 브라우저: `https://lunch-service.vercel.app` 접속 후 추천/목록/등록 동작 확인  

이 순서대로 환경만 수정한 뒤 배포하면 됩니다.
