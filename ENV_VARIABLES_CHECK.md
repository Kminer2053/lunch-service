# 환경변수 확인 가이드

## Render 환경변수 설정 확인

점심 추천 서비스가 정상 작동하려면 다음 환경변수들이 Render에 설정되어 있어야 합니다.

### 필수 환경변수

1. **GOOGLE_MAPS_API_KEY**
   - Google Directions API 키
   - 도보 소요시간 계산에 사용
   - 설정하지 않으면 직선거리로 추정됨
   - [Google Cloud Console](https://console.cloud.google.com/)에서 생성

2. **NCP_APIGW_API_KEY_ID**
   - NCP Maps API Gateway Key ID
   - 지도 미리보기 및 주소 변환에 사용

3. **NCP_APIGW_API_KEY**
   - NCP Maps API Gateway Key
   - 지도 미리보기 및 주소 변환에 사용

4. **GOOGLE_APPS_SCRIPT_URL**
   - Google Apps Script 웹 앱 배포 URL

5. **LUNCH_API_KEY**
   - Apps Script와 공유하는 API 키

### 확인 방법

Render 대시보드에서:
1. 서비스 선택
2. **Environment** 탭 이동
3. 위 환경변수들이 모두 설정되어 있는지 확인

### 문제 해결

#### 도보 소요시간이 직선거리로 추정되는 경우
- `GOOGLE_MAPS_API_KEY`가 설정되지 않았거나 잘못된 키입니다
- Google Cloud Console에서 Directions API가 활성화되어 있는지 확인

#### 지도 미리보기가 표시되지 않는 경우
- `NCP_APIGW_API_KEY_ID`와 `NCP_APIGW_API_KEY`가 설정되어 있는지 확인
- NCP 콘솔에서 Maps API가 활성화되어 있는지 확인
