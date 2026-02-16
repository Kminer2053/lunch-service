# Apps Script 권한 설정 가이드

## 필요한 권한

이미지 업로드 기능을 위해 다음 권한이 필요합니다:

1. **Google Drive 접근 권한**
   - 폴더 생성 및 파일 업로드
   - 파일 공유 설정

2. **Google Sheets 접근 권한**
   - 시트 데이터 읽기/쓰기
   - 컬럼 추가

## 권한 확인 및 부여 방법

### 방법 1: 함수 실행을 통한 권한 요청

1. **Apps Script 편집기 열기**
   - Google Sheets에서 "확장 프로그램" → "Apps Script" 클릭
   - 또는 https://script.google.com 접속

2. **테스트 함수 실행**
   ```javascript
   // 편집기에 다음 함수 추가하고 실행
   function testPermissions() {
     try {
       // Drive 접근 테스트
       var folders = DriveApp.getFoldersByName('lunch-images');
       Logger.log('Drive 접근 성공');
       
       // Sheets 접근 테스트
       var ss = SpreadsheetApp.getActiveSpreadsheet();
       var sheet = ss.getSheetByName('places');
       Logger.log('Sheets 접근 성공');
       
       return '모든 권한이 정상적으로 설정되었습니다.';
     } catch (e) {
       return '권한 오류: ' + e.toString();
     }
   }
   ```

3. **권한 요청 팝업 처리**
   - 함수 실행 시 "권한 검토" 팝업이 나타남
   - "권한 확인" 클릭
   - Google 계정 선택
   - "고급" → "안전하지 않은 페이지로 이동" 클릭 (필요시)
   - "허용" 클릭

### 방법 2: 수동 권한 확인

1. **Apps Script 편집기에서**
   - 왼쪽 메뉴에서 "프로젝트 설정" (톱니바퀴 아이콘) 클릭
   - "권한" 섹션 확인
   - 필요한 권한이 표시되어 있는지 확인

2. **권한 목록 확인**
   - Google Drive API
   - Google Sheets API

### 방법 3: 배포를 통한 권한 요청

1. **웹 앱 배포**
   - "배포" → "새 배포" 클릭
   - 유형: "웹 앱" 선택
   - 실행 대상: "나"
   - 액세스 권한: "모든 사용자" 선택
   - "배포" 클릭

2. **권한 요청 처리**
   - 배포 시 권한 요청 팝업이 나타남
   - 위와 동일하게 권한 부여

## 권한 오류 해결

### 오류 1: "이 앱이 확인되지 않았습니다"

**원인**: Apps Script 앱이 Google의 검증을 받지 않음

**해결 방법**:
1. "고급" 클릭
2. "안전하지 않은 페이지로 이동" 클릭
3. "허용" 클릭

### 오류 2: "권한이 거부되었습니다"

**원인**: 권한 요청을 거부했거나 권한이 만료됨

**해결 방법**:
1. Apps Script 편집기에서 함수 다시 실행
2. 권한 요청 팝업에서 "허용" 클릭
3. 또는 Google 계정 설정에서 Apps Script 권한 확인

### 오류 3: "Drive 서비스에 액세스할 수 없습니다"

**원인**: Google Drive API가 활성화되지 않음

**해결 방법**:
1. Apps Script 편집기에서 "리소스" → "고급 Google 서비스" 클릭
2. "Google Drive API" 활성화
3. 또는 Google Cloud Console에서 API 활성화

## 권한 확인 스크립트

다음 스크립트를 Apps Script 편집기에 추가하여 권한을 확인할 수 있습니다:

```javascript
function checkPermissions() {
  var results = [];
  
  // Drive 권한 확인
  try {
    var folders = DriveApp.getFoldersByName('lunch-images');
    results.push('✅ Google Drive 접근 권한: 정상');
  } catch (e) {
    results.push('❌ Google Drive 접근 권한: ' + e.toString());
  }
  
  // Sheets 권한 확인
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('places');
    if (sheet) {
      results.push('✅ Google Sheets 접근 권한: 정상');
    } else {
      results.push('⚠️ Google Sheets 접근 권한: 정상 (places 시트 없음)');
    }
  } catch (e) {
    results.push('❌ Google Sheets 접근 권한: ' + e.toString());
  }
  
  // 결과 출력
  Logger.log(results.join('\n'));
  return results.join('\n');
}
```

## 테스트 방법

1. **권한 확인 스크립트 실행**
   - 위의 `checkPermissions` 함수 실행
   - 실행 로그에서 결과 확인

2. **이미지 업로드 테스트**
   - 프론트엔드에서 이미지 업로드 시도
   - Apps Script 실행 로그 확인
   - Google Drive에서 `lunch-images` 폴더 확인

3. **에러 로그 확인**
   - Apps Script 편집기에서 "실행" → "실행 로그" 확인
   - 권한 관련 에러 메시지 확인

## 중요 사항

1. **처음 실행 시 권한 요청**
   - Apps Script 함수를 처음 실행할 때 권한 요청 팝업이 나타남
   - 반드시 "허용"을 클릭해야 함

2. **권한은 계정별로 부여됨**
   - 각 Google 계정마다 권한을 별도로 부여해야 함
   - 다른 계정으로 테스트할 경우 권한 재부여 필요

3. **권한은 영구적임**
   - 한 번 권한을 부여하면 계속 유지됨
   - 권한을 취소하려면 Google 계정 설정에서 수동으로 제거해야 함

## 다음 단계

권한 확인 후:
1. ✅ 이미지 업로드 기능 테스트
2. ✅ Google Drive 폴더 생성 확인
3. ✅ Google Sheets에 image_url 저장 확인
