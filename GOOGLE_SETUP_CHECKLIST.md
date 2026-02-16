# Google Drive 및 Google Sheets 설정 체크리스트

## 이미지 업로드 기능을 위한 필수 설정

### 1. Google Sheets - places 시트 확인

**필수 컬럼 확인**:
- [ ] `place_id` 컬럼 존재
- [ ] `image_url` 컬럼 존재 (없으면 자동 추가됨)

**확인 방법**:
1. Google Sheets 열기
2. `places` 시트 확인
3. 첫 번째 행(헤더)에 `image_url` 컬럼이 있는지 확인

**자동 추가 기능**:
- `updatePlace` 함수가 자동으로 컬럼을 추가함 (라인 156-166)
- `uploadImage` 함수도 `placeId`가 있을 때 자동으로 컬럼 추가 (라인 264-268)

### 2. Google Drive - lunch-images 폴더 확인

**폴더 생성**:
- [ ] `lunch-images` 폴더가 Google Drive에 존재하는지 확인
- 없으면 Apps Script가 자동으로 생성함 (라인 246)

**공유 설정**:
- [ ] 폴더 공유 설정: "링크가 있는 모든 사용자" → "보기 권한"
- Apps Script가 자동으로 설정함 (라인 248)

**확인 방법**:
1. Google Drive 열기
2. `lunch-images` 폴더 검색
3. 폴더 우클릭 → 공유 → "링크가 있는 모든 사용자" 확인

### 3. Apps Script 권한 확인

**필수 권한**:
- [ ] Google Drive 접근 권한
- [ ] Google Sheets 접근 권한

**권한 확인 방법**:
1. Apps Script 편집기 열기
2. 왼쪽 메뉴에서 "실행" 클릭
3. 권한 요청이 나타나면 승인
4. 또는 "프로젝트 설정" → "권한" 확인

**권한 부여 방법**:
1. Apps Script 편집기에서 함수 실행
2. "권한 검토" 팝업에서 "권한 확인" 클릭
3. Google 계정 선택
4. "고급" → "안전하지 않은 페이지로 이동" 클릭 (필요시)
5. "허용" 클릭

### 4. 이미지 URL 형식 확인

**현재 사용 중인 형식**:
```
https://drive.google.com/uc?id={fileId}
```

**예시**:
```
https://drive.google.com/uc?id=1a2b3c4d5e6f7g8h9i0j
```

**확인 방법**:
1. Google Drive에서 이미지 파일 열기
2. URL에서 `id=` 뒤의 값이 fileId
3. `https://drive.google.com/uc?id={fileId}` 형식으로 접근 가능한지 확인

## 문제 해결 가이드

### 문제 1: "알 수 없는 엔드포인트" 에러

**가능한 원인**:
1. Apps Script 배포가 완료되지 않음
2. Apps Script의 `handleRequest` 함수에서 경로를 찾지 못함
3. HTTP 메서드가 올바르지 않음

**해결 방법**:
1. GitHub Actions에서 Apps Script 배포 완료 확인
2. Apps Script 편집기에서 코드 확인
3. Apps Script 실행 로그 확인

### 문제 2: 이미지 업로드는 성공하지만 URL이 저장되지 않음

**가능한 원인**:
1. Google Sheets의 `places` 시트에 `image_url` 컬럼이 없음
2. `place_id`가 일치하지 않음
3. Apps Script 권한 부족

**해결 방법**:
1. Google Sheets에서 `image_url` 컬럼 수동 추가
2. `place_id` 값 확인
3. Apps Script 권한 재확인

### 문제 3: 이미지가 표시되지 않음

**가능한 원인**:
1. Google Drive 폴더/파일 공유 설정 문제
2. 이미지 URL 형식 문제
3. CORS 문제

**해결 방법**:
1. Google Drive에서 폴더/파일 공유 설정 확인
2. 이미지 URL이 올바른 형식인지 확인
3. 브라우저 콘솔에서 이미지 로드 에러 확인

## 수동 설정이 필요한 경우

### Google Sheets에 image_url 컬럼 추가

1. Google Sheets 열기
2. `places` 시트 선택
3. 첫 번째 행(헤더)의 마지막 열 옆에 `image_url` 입력
4. 저장

### Google Drive에 lunch-images 폴더 생성

1. Google Drive 열기
2. "새로 만들기" → "폴더" 클릭
3. 폴더 이름: `lunch-images`
4. 폴더 우클릭 → "공유" → "링크가 있는 모든 사용자" → "보기 권한"
5. 저장

## 자동 설정 기능

다음 기능들은 Apps Script가 자동으로 처리합니다:

1. ✅ `lunch-images` 폴더 자동 생성 (없으면)
2. ✅ 폴더 공유 설정 자동 적용
3. ✅ 파일 공유 설정 자동 적용
4. ✅ Google Sheets에 `image_url` 컬럼 자동 추가 (없으면)
5. ✅ 이미지 URL 자동 저장 (`placeId`가 있을 때)

## 테스트 방법

1. **이미지 업로드 테스트**:
   - 등록 탭 → STEP2 → 이미지 선택 → 등록 완료
   - 콘솔에서 이미지 업로드 성공 메시지 확인
   - Google Drive에서 `lunch-images` 폴더에 이미지 파일 확인

2. **이미지 URL 저장 테스트**:
   - Google Sheets의 `places` 시트에서 해당 행의 `image_url` 컬럼 확인
   - 이미지 URL이 올바르게 저장되었는지 확인

3. **이미지 표시 테스트**:
   - 목록 탭에서 이미지가 표시되는지 확인
   - 브라우저 개발자 도구에서 이미지 로드 에러 확인
