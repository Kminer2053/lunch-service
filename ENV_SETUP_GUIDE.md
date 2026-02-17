# 환경 설정 안내

Vercel 배포 시 **환경변수**로 URL을 넣는 방식과, 로컬/직접 수정 방식 둘 다 지원합니다.

---

## 1. Vercel 환경변수 방식 (권장)

빌드 시 `index.html`에 값이 주입됩니다. 코드에 URL을 넣지 않아도 됩니다.

### Vercel에서 설정할 환경변수

1. Vercel 대시보드 → 해당 프로젝트 → **Settings** → **Environment Variables**
2. 아래 변수 추가 (Production, Preview, Development 원하는 환경에 체크)

| 이름 | 값 | 필수 |
|------|-----|------|
| **APPS_SCRIPT_URL** | `https://script.google.com/macros/s/배포ID/exec` | 예 |
| **API_BASE_URL** | `https://myteamdashboard.onrender.com` (또는 사용 중인 Render URL) | 선택 |

- **APPS_SCRIPT_URL**: GitHub Actions "Deploy Apps Script" 로그의 Web App URL, 또는 Google Sheets → 확장프로그램 → Apps Script → 배포 → 배포 관리 → 웹 앱 URL
- **API_BASE_URL**: 비워두면 빌드 스크립트가 기본값(`https://myteamdashboard.onrender.com`)을 넣습니다. 다른 주소 쓰면 여기 입력.

### 동작 방식

- `vercel.json`에 `buildCommand: "node build.js"`, `outputDirectory: "dist"` 설정됨
- 빌드 시 `build.js`가 `APPS_SCRIPT_URL`, `API_BASE_URL`을 읽어 `dist/index.html`에 치환
- 배포되는 건 `dist/` 안의 파일들

환경변수 추가/수정 후 **Redeploy** 해야 반영됩니다.

---

## 2. index.html에 직접 넣는 방식 (로컬 또는 Vercel 미사용 시)

Vercel을 쓰지 않거나, 로컬에서 바로 확인할 때 사용합니다.

**파일:** `lunch-service/index.html`  
**위치:** `</body>` 위, `<script src="lunch.js"></script>` 앞의 `<script>` 블록

```html
<script>
    window.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/배포ID/exec';
    window.API_BASE_URL = window.API_BASE_URL || 'https://myteamdashboard.onrender.com';
</script>
```

- 현재는 placeholder(`__APPS_SCRIPT_URL__`, `__API_BASE_URL__`)가 있어서, **빌드 없이** 파일을 열면 값이 비어 있는 것처럼 동작합니다.
- 위처럼 직접 넣으면 빌드 없이도 동작합니다 (직접 넣은 값이 placeholder보다 우선).

---

## 3. 로컬에서 빌드해서 확인하려면

환경변수를 넣은 뒤 빌드하면 `dist/`에 주입된 결과가 나옵니다.

```bash
cd lunch-service
APPS_SCRIPT_URL='https://script.google.com/macros/s/배포ID/exec' node build.js
# 그 다음 dist/index.html 을 브라우저로 열거나, dist 폴더를 로컬 서버로 서빙
```

---

## 요약

| 방식 | 설정 위치 | 비고 |
|------|-----------|------|
| **Vercel 환경변수** | Vercel → Settings → Environment Variables | APPS_SCRIPT_URL, API_BASE_URL 추가 후 Redeploy |
| **index.html 직접** | `index.html` 내 script 블록 | 로컬 또는 빌드 없이 사용 시 |

Vercel 쓸 때는 환경변수만 설정하면 되고, `index.html`은 수정하지 않아도 됩니다.
