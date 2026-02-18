/**
 * Google Apps Script - 점심 추천 서비스 API
 * 
 * 배포 방법:
 * 1. Google Sheets에서 확장 프로그램 > Apps Script 열기
 * 2. 이 코드를 붙여넣기
 * 3. 환경변수 설정 (스크립트 속성):
 *    - API_KEY: server.js와 공유할 x-api-key 값
 *    - PERPLEXITY_API_KEY: (선택) LLM API 키
 *    - KMA_API_KEY: (선택) 기상청 동네예보 API 키 (공공데이터포털 발급)
 * 4. 권한 확인 및 부여:
 *    - 함수 실행 시 권한 요청 팝업에서 "허용" 클릭
 *    - Google Drive 및 Google Sheets 접근 권한 필요
 *    - 자세한 내용은 APPS_SCRIPT_PERMISSIONS_GUIDE.md 참고
 * 5. 배포 > 새 배포 > 유형: 웹 앱
 * 6. 실행 대상: 나, 액세스 권한: 모든 사용자
 * 7. 배포 URL을 복사하여 server.js의 GOOGLE_APPS_SCRIPT_URL에 설정
 */

// 컬럼명 마이그레이션: indoor_ok → reservation_ok
function migrateIndoorToReservation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('places');
  
  if (!sheet) {
    Logger.log('places 시트를 찾을 수 없습니다.');
    return 'places 시트를 찾을 수 없습니다.';
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('데이터가 없습니다.');
    return '데이터가 없습니다.';
  }
  
  const headers = data[0];
  const indoorCol = headers.indexOf('indoor_ok');
  
  if (indoorCol === -1) {
    Logger.log('indoor_ok 컬럼이 없습니다. 이미 마이그레이션되었거나 컬럼명이 다릅니다.');
    return 'indoor_ok 컬럼이 없습니다.';
  }
  
  // 컬럼명 변경
  sheet.getRange(1, indoorCol + 1).setValue('reservation_ok');
  Logger.log('컬럼명이 indoor_ok에서 reservation_ok로 변경되었습니다.');
  
  return '✅ 마이그레이션 완료: indoor_ok → reservation_ok';
}

// 기상청 API 테스트 함수
function testWeatherAPI() {
  // 테스트용 인증키 (실제 사용 시 스크립트 속성에서 가져오기)
  let apiKey = PropertiesService.getScriptProperties().getProperty('KMA_API_KEY');
  if (!apiKey) {
    apiKey = '59c12627231e31f0c49b608447cbafdb00eeea0a469b5d1338b7268f03bcf0fb';
  }
  const lat = 37.5264; // 서울 영등포구
  const lon = 126.8962;
  
  try {
    // 격자 좌표로 변환
    const grid = convertToGrid(lat, lon);
    Logger.log(`격자 좌표: nx=${grid.nx}, ny=${grid.ny}`);
    
    // 현재 시간 기준 (초단기실황은 매 시간 업데이트)
    const now = new Date();
    const baseDate = Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd');
    const currentHour = parseInt(Utilities.formatDate(now, 'Asia/Seoul', 'HH'));
    const currentMin = parseInt(Utilities.formatDate(now, 'Asia/Seoul', 'mm'));
    
    // base_time은 현재 시간의 1시간 전 정각 (예: 14:30이면 13:00 데이터 조회)
    // 초단기실황은 매 정각에 업데이트되므로 최신 데이터는 1시간 전
    let baseHour = currentHour > 0 ? currentHour - 1 : 23;
    // 자정 근처 처리
    if (currentHour === 0) {
      baseHour = 23;
      // baseDate도 하루 전으로 조정 필요할 수 있지만 일단 현재 날짜 사용
    }
    const baseTime = String(baseHour).padStart(2, '0') + '00';
    
    Logger.log(`현재 시간: ${Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm')}`);
    Logger.log(`base_date: ${baseDate}, base_time: ${baseTime}`);
    
    // 기상청 초단기실황 API 테스트
    const url = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodeURIComponent(apiKey)}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${grid.nx}&ny=${grid.ny}`;
    
    Logger.log(`API URL (인증키 제외): http://apis.data.go.kr/...&base_date=${baseDate}&base_time=${baseTime}&nx=${grid.nx}&ny=${grid.ny}`);
    
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`응답 상태 코드: ${statusCode}`);
    Logger.log(`응답 내용: ${responseText.substring(0, 1000)}`);
    
    if (statusCode === 200) {
      const data = JSON.parse(responseText);
      
      if (data.response && data.response.body) {
        if (data.response.body.items && data.response.body.items.item) {
          const items = data.response.body.items.item;
          Logger.log(`데이터 항목 수: ${items.length}`);
          
          items.forEach(item => {
            Logger.log(`${item.category}: ${item.obsrValue} (${item.baseDate} ${item.baseTime})`);
          });
          
          // 날씨 정보 파싱 테스트
          const weatherInfo = getWeatherInfo();
          Logger.log(`파싱된 날씨 정보: ${JSON.stringify(weatherInfo)}`);
          
          return {
            success: true,
            message: 'API 정상 작동',
            grid: grid,
            items: items,
            parsed: weatherInfo
          };
        } else {
          Logger.log('응답 구조: ' + JSON.stringify(data.response.body, null, 2).substring(0, 1000));
          return {
            success: false,
            message: '데이터 항목이 없습니다',
            response: data.response.body
          };
        }
      } else {
        return {
          success: false,
          message: '응답 구조가 예상과 다릅니다',
          response: data
        };
      }
    } else {
      // 403 오류 상세 분석
      let errorDetail = '';
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.response && errorData.response.header) {
          errorDetail = `결과코드: ${errorData.response.header.resultCode}, 메시지: ${errorData.response.header.resultMsg}`;
        }
      } catch (e) {
        errorDetail = responseText.substring(0, 500);
      }
      
      Logger.log(`403 오류 상세: ${errorDetail}`);
      
      return {
        success: false,
        message: `HTTP ${statusCode} 오류`,
        detail: errorDetail,
        response: responseText.substring(0, 500),
        url_info: {
          base_date: baseDate,
          base_time: baseTime,
          nx: grid.nx,
          ny: grid.ny
        }
      };
    }
  } catch (error) {
    Logger.log(`에러 발생: ${error.toString()}`);
    return {
      success: false,
      message: '에러 발생',
      error: error.toString()
    };
  }
}

// 권한 확인 함수 (테스트용)
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

// 환경변수 가져오기
function getApiKey() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('API_KEY') || '';
}

function getPerplexityApiKey() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('PERPLEXITY_API_KEY') || '';
}

// 캐시 (CacheService): 읽기 성능 개선, CUD 시 무효화
var CACHE_TTL_SECONDS = 600;

function getCached(key) {
  var raw = CacheService.getScriptCache().get(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function setCached(key, value) {
  CacheService.getScriptCache().put(key, JSON.stringify(value), CACHE_TTL_SECONDS);
}

function invalidateCacheFor(sheetName) {
  var cache = CacheService.getScriptCache();
  if (sheetName === 'daily_recommendations') {
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    cache.remove('lunch_daily_' + today);
  } else {
    cache.remove('lunch_' + sheetName);
  }
}

// Google Sheets에서 데이터 가져오기 (places/reviews/config는 캐시 사용)
function getSheetData(sheetName) {
  var cacheKey = 'lunch_' + sheetName;
  if (sheetName === 'places' || sheetName === 'reviews' || sheetName === 'config') {
    var cached = getCached(cacheKey);
    if (cached != null) return cached;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return [];
  }

  const headers = data[0];
  const rows = data.slice(1);

  var result = rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });

  if (sheetName === 'places' || sheetName === 'reviews' || sheetName === 'config') {
    setCached(cacheKey, result);
  }
  return result;
}

// Google Sheets에 데이터 추가
function appendSheetData(sheetName, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // 헤더 추가 (첫 번째 데이터의 키를 헤더로 사용)
    const headers = Object.keys(data);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => data[header] || '');
  sheet.appendRow(row);
  
  return {
    success: true,
    data: data
  };
}

// ID 생성 (타임스탬프 기반)
function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// GET /places - 장소 목록 조회 (리뷰 시트 1회 읽기 + 메모리 집계로 N+1 제거)
function getPlaces() {
  const places = getSheetData('places');
  const reviews = getSheetData('reviews');
  const statsByPlace = aggregateAllReviews(reviews);
  const placesWithReviews = places.map(function(place) {
    if (place.indoor_ok !== undefined && place.reservation_ok === undefined) {
      place.reservation_ok = place.indoor_ok;
    }
    var reviewStats = statsByPlace[place.place_id] || { good: 0, bad: 0 };
    return Object.assign({}, place, {
      review_good: reviewStats.good || 0,
      review_bad: reviewStats.bad || 0
    });
  });
  return { success: true, data: placesWithReviews };
}

// POST /places - 새 장소 등록
function createPlace(requestData) {
  const newName = (requestData.name || '').trim();
  if (!newName) {
    return { success: false, error: '상호명을 입력해주세요.' };
  }
  
  // 중복 상호명 체크
  const places = getSheetData('places');
  const duplicatePlace = places.find(function(place) {
    return place.name && place.name.trim().toLowerCase() === newName.toLowerCase();
  });
  
  if (duplicatePlace) {
    return { success: false, error: '이미 등록되어 있는 상점입니다.' };
  }
  
  const placeId = generateId('place');
  const now = new Date().toISOString();
  
  const placeData = {
    place_id: placeId,
    name: newName,
    address_text: requestData.address_text || '',
    naver_map_url: requestData.naver_map_url || '',
    category: requestData.category || '',
    price_level: requestData.price_level || '',
    tags: requestData.tags || '',
    walk_min: requestData.walk_min || 0,
    solo_ok: requestData.solo_ok || false,
    group_ok: requestData.group_ok || false,
    reservation_ok: requestData.reservation_ok || false,
    image_url: requestData.image_url || '',
    lat: requestData.lat || '',
    lng: requestData.lng || '',
    created_at: now,
    updated_at: now
  };
  
  appendSheetData('places', placeData);
  invalidateCacheFor('places');
  return {
    success: true,
    data: {
      place_id: placeId,
      created_at: now
    }
  };
}

// PUT /places/:id - 장소 수정
function updatePlace(placeId, requestData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('places');
  if (!sheet) return { success: false, error: 'places 시트를 찾을 수 없습니다.' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('place_id');
  if (idCol === -1) return { success: false, error: 'place_id 컬럼을 찾을 수 없습니다.' };
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === placeId) {
      const row = i + 1;
      const now = new Date().toISOString();
      
      // 모든 필드 업데이트
      const fields = ['name', 'address_text', 'category', 'price_level', 'walk_min', 
                      'keywords', 'tags', 'solo_ok', 'group_ok', 'reservation_ok', 
                      'image_url', 'naver_map_url', 'lat', 'lng'];
      
      fields.forEach(field => {
        let colIdx = headers.indexOf(field);
        
        // 필드가 시트에 없으면 컬럼 추가
        if (colIdx === -1) {
          colIdx = headers.length;
          sheet.getRange(1, colIdx + 1).setValue(field);
          headers.push(field);
        }
        
        let value = requestData[field];
        if (value === undefined) value = '';
        if (field === 'solo_ok' || field === 'group_ok' || field === 'reservation_ok') {
          value = value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1';
        }
        sheet.getRange(row, colIdx + 1).setValue(value);
      });
      
      // updated_at 갱신
      const updatedAtCol = headers.indexOf('updated_at');
      if (updatedAtCol !== -1) {
        sheet.getRange(row, updatedAtCol + 1).setValue(now);
      }
      invalidateCacheFor('places');
      return { success: true, data: { place_id: placeId, updated_at: now } };
    }
  }
  return { success: false, error: '해당 장소를 찾을 수 없습니다.' };
}

// DELETE /places/:id - 장소 삭제 (연관 리뷰도 함께 삭제)
function deletePlace(placeId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 먼저 해당 장소의 리뷰 모두 삭제
  const reviewsSheet = ss.getSheetByName('reviews');
  if (reviewsSheet) {
    const reviewsData = reviewsSheet.getDataRange().getValues();
    if (reviewsData.length > 1) {
      const reviewsHeaders = reviewsData[0];
      const placeIdCol = reviewsHeaders.indexOf('place_id');
      if (placeIdCol !== -1) {
        // 아래에서부터 삭제 (인덱스가 밀리지 않도록)
        for (let i = reviewsData.length - 1; i >= 1; i--) {
          if (reviewsData[i][placeIdCol] === placeId) {
            reviewsSheet.deleteRow(i + 1);
          }
        }
      }
    }
  }
  
  // 2. 장소 삭제
  const sheet = ss.getSheetByName('places');
  if (!sheet) return { success: false, error: 'places 시트를 찾을 수 없습니다.' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('place_id');
  if (idCol === -1) return { success: false, error: 'place_id 컬럼을 찾을 수 없습니다.' };
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idCol] === placeId) {
      sheet.deleteRow(i + 1);
      invalidateCacheFor('reviews');
      invalidateCacheFor('places');
      return { success: true };
    }
  }
  return { success: false, error: '해당 장소를 찾을 수 없습니다.' };
}

// GET /config - 설정 조회
function getConfig() {
  const configs = getSheetData('config');
  return { success: true, data: configs };
}

// POST /config - 설정 저장/업데이트
function updateConfig(requestData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('config');
  if (!sheet) {
    sheet = ss.insertSheet('config');
    sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  }
  const key = requestData.key;
  const value = requestData.value;
  if (!key) return { success: false, error: 'key가 필요합니다.' };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      invalidateCacheFor('config');
      return { success: true, data: { key: key, value: value } };
    }
  }
  sheet.appendRow([key, value]);
  invalidateCacheFor('config');
  return { success: true, data: { key: key, value: value } };
}

// POST /upload-image - Google Drive에 이미지 업로드
function uploadImage(requestData) {
  const base64 = requestData.image_base64;
  const filename = requestData.filename || 'place_image.jpg';
  const placeId = requestData.place_id || '';
  if (!base64) return { success: false, error: 'image_base64가 필요합니다.' };
  try {
    var folders = DriveApp.getFoldersByName('lunch-images');
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder('lunch-images');
      // 폴더도 공유 설정 (파일 접근을 위해)
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    var decoded = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(decoded, 'image/jpeg', filename);
    var file = folder.createFile(blob);
    // 파일 공유 설정 (링크가 있는 사람은 볼 수 있음)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();
    // 'uc?id=' 대신 'lh3.googleusercontent.com/d/' 형식 사용 (이미지 태그용)
    var imageUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    if (placeId) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('places');
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        var idCol = headers.indexOf('place_id');
        var imgCol = headers.indexOf('image_url');
        if (imgCol === -1) {
          imgCol = headers.length;
          sheet.getRange(1, imgCol + 1).setValue('image_url');
        }
        if (idCol !== -1) {
          for (var i = 1; i < data.length; i++) {
            if (data[i][idCol] === placeId) {
              sheet.getRange(i + 1, imgCol + 1).setValue(imageUrl);
              break;
            }
          }
        }
        invalidateCacheFor('places');
      }
    }
    return { success: true, data: { image_url: imageUrl, file_id: fileId } };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// POST /verify-register-password - 등록 비밀번호 검증
function verifyRegisterPassword(requestData) {
  const password = String(requestData.password || '');
  
  // config 시트에서 비밀번호 가져오기
  const configs = getSheetData('config');
  // 'register_password' 키를 가진 설정값 찾기
  const passwordConfig = configs.find(c => c.key === 'register_password');
  
  // 설정값이 없으면 '1234'를 기본값으로 사용
  // 주의: 시트에서 숫자로 읽혀올 수 있으므로 String()으로 명시적 변환
  const dbValue = passwordConfig ? passwordConfig.value : '1234';
  const correctPassword = String(dbValue); 
  
  if (password === correctPassword) {
    return { success: true };
  } else {
    // 디버깅을 위해 입력값과 DB값을 비교 정보 반환 (보안상 실제 서비스에서는 주의 필요)
    return { 
      success: false, 
      error: '비밀번호가 올바르지 않습니다.',
      debug: {
        inputLength: password.length,
        dbLength: correctPassword.length,
        inputVal: password, // 디버깅용: 사용자가 콘솔에서 확인 가능
        dbVal: correctPassword // 디버깅용: 실제 DB에서 읽은 값
      }
    };
  }
}

// POST /admin-verify - 관리자 비밀번호 검증
function verifyAdminPassword(requestData) {
  const password = String(requestData.password || '');
  const configs = getSheetData('config');
  const pwConfig = configs.find(c => c.key === 'admin_password');
  const dbValue = pwConfig ? pwConfig.value : 'admin1234';
  const correctPassword = String(dbValue);
  if (password === correctPassword) {
    return { success: true };
  }
  return { success: false, error: '비밀번호가 일치하지 않습니다.' };
}

// GET /daily-recommendations - 오늘의 추천 조회 (캐시 사용)
function getDailyRecommendations() {
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var cacheKey = 'lunch_daily_' + today;
  var cached = getCached(cacheKey);
  if (cached != null) return { success: true, data: cached };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('daily_recommendations');
  if (!sheet) return { success: true, data: null };
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: null };
  var headers = data[0];
  var dateCol = headers.indexOf('date');
  var jsonCol = headers.indexOf('recommendations_json');
  if (dateCol === -1 || jsonCol === -1) return { success: true, data: null };
  for (var i = data.length - 1; i >= 1; i--) {
    var rowDate = data[i][dateCol];
    if (typeof rowDate === 'object' && rowDate.getTime) {
      rowDate = Utilities.formatDate(rowDate, 'Asia/Seoul', 'yyyy-MM-dd');
    }
    if (String(rowDate) === today) {
      try {
        var recs = JSON.parse(data[i][jsonCol]);
        setCached(cacheKey, recs);
        return { success: true, data: recs };
      } catch (e) {
        return { success: true, data: null };
      }
    }
  }
  return { success: true, data: null };
}

// POST /generate-daily - 일일 추천 생성
function generateDaily(requestData) {
  var result = recommendLunch(requestData || { text: '오늘의 점심 추천', preset: [], exclude: [] });
  if (!result.success || !result.data) return result;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('daily_recommendations');
  if (!sheet) {
    sheet = ss.insertSheet('daily_recommendations');
    sheet.getRange(1, 1, 1, 3).setValues([['date', 'recommendations_json', 'created_at']]);
  }
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var data = sheet.getDataRange().getValues();
  var dateCol = 0;
  var replaced = false;
  for (var i = 1; i < data.length; i++) {
    var rowDate = data[i][dateCol];
    if (typeof rowDate === 'object' && rowDate.getTime) {
      rowDate = Utilities.formatDate(rowDate, 'Asia/Seoul', 'yyyy-MM-dd');
    }
    if (String(rowDate) === today) {
      sheet.getRange(i + 1, 2).setValue(JSON.stringify(result.data));
      sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    sheet.appendRow([today, JSON.stringify(result.data), new Date().toISOString()]);
  }
  invalidateCacheFor('daily_recommendations');
  return { success: true, data: result.data };
}

// POST /reviews - 리뷰 등록
function createReview(requestData) {
  // 코멘트 필수 검증
  const comment = (requestData.comment || '').toString().trim();
  if (!comment) {
    return { success: false, error: '코멘트를 입력해주세요.' };
  }
  
  const reviewId = generateId('review');
  const now = new Date().toISOString();
  
  const reviewData = {
    review_id: reviewId,
    place_id: requestData.place_id || '',
    verdict: requestData.verdict || 'neutral',
    reasons: requestData.reasons || '',
    comment: comment,
    created_at: now
  };
  
  appendSheetData('reviews', reviewData);
  invalidateCacheFor('reviews');
  return {
    success: true,
    data: {
      review_id: reviewId,
      created_at: now
    }
  };
}

// 리뷰 전체 1회 읽고 place_id별로 집계 (N+1 방지)
function aggregateAllReviews(reviewsRows) {
  const byPlace = {};
  for (var i = 0; i < reviewsRows.length; i++) {
    var r = reviewsRows[i];
    var pid = r.place_id || '';
    if (!byPlace[pid]) {
      byPlace[pid] = { total: 0, good: 0, bad: 0, neutral: 0, average: 0 };
    }
    byPlace[pid].total++;
    if (r.verdict === 'good') byPlace[pid].good++;
    else if (r.verdict === 'bad') byPlace[pid].bad++;
    else byPlace[pid].neutral++;
  }
  for (var placeId in byPlace) {
    var o = byPlace[placeId];
    o.average = o.total > 0 ? (o.good * 1 + o.neutral * 0.5) / o.total : 0;
  }
  return byPlace;
}

// 단일 place_id 리뷰 집계 (호환용; 가능하면 aggregateAllReviews 사용)
function aggregateReviews(placeId) {
  const reviews = getSheetData('reviews');
  const placeReviews = reviews.filter(function(r) { return r.place_id === placeId; });
  if (placeReviews.length === 0) {
    return { total: 0, good: 0, bad: 0, neutral: 0, average: 0 };
  }
  var good = placeReviews.filter(function(r) { return r.verdict === 'good'; }).length;
  var bad = placeReviews.filter(function(r) { return r.verdict === 'bad'; }).length;
  var neutral = placeReviews.filter(function(r) { return r.verdict === 'neutral'; }).length;
  var average = (good * 1 + neutral * 0.5) / placeReviews.length;
  return { total: placeReviews.length, good: good, bad: bad, neutral: neutral, average: average };
}

// 규칙 기반 점수 계산
function calculateScore(place, preset, reviewStats) {
  let score = 0;
  
  // 프리셋 매칭 점수
  if (preset.includes('solo_ok') && place.solo_ok) score += 10;
  if (preset.includes('group_ok') && place.group_ok) score += 10;
  if (preset.includes('reservation_ok') && place.reservation_ok) score += 10;
  
  // 리뷰 평균 점수 (0-10점)
  score += reviewStats.average * 10;
  
  // 최근 리뷰 가중치 (리뷰가 많을수록 높은 점수)
  score += Math.min(reviewStats.total * 0.5, 5);
  
  // 거리 가중치 (가까울수록 높은 점수)
  if (place.walk_min) {
    score += Math.max(10 - place.walk_min, 0);
  }
  
  return score;
}

// POST /recommend - 점심 추천
function recommendLunch(requestData) {
  const text = requestData.text || '';
  const preset = requestData.preset || [];
  const exclude = requestData.exclude || [];
  
  // text는 선택사항 (없으면 일반 추천)
  
  // 1. 모든 장소 + 리뷰 1회 읽기
  const places = getSheetData('places');
  const reviews = getSheetData('reviews');
  const statsByPlace = aggregateAllReviews(reviews);
  
  // 호환성: indoor_ok → reservation_ok 매핑
  const placesNormalized = places.map(function(place) {
    if (place.indoor_ok !== undefined && place.reservation_ok === undefined) {
      place.reservation_ok = place.indoor_ok;
    }
    return place;
  });
  
  // 2. 제외 목록 필터링
  const filteredPlaces = placesNormalized.filter(function(p) { return exclude.indexOf(p.place_id) === -1; });
  
  // 3. 리뷰 집계 및 점수 계산 (메모리 집계 사용)
  const defaultStats = { total: 0, good: 0, bad: 0, neutral: 0, average: 0 };
  const scoredPlaces = filteredPlaces.map(function(place) {
    const reviewStats = statsByPlace[place.place_id] || defaultStats;
    const score = calculateScore(place, preset, reviewStats);
    return Object.assign({}, place, { reviewStats: reviewStats, score: score });
  });
  
  // 4. 좋아요 수 기준으로 정렬하여 상위 30개 shortlist 생성
  const shortlist = scoredPlaces
    .sort((a, b) => {
      // 좋아요 수가 같으면 점수로 정렬
      if (b.reviewStats.good !== a.reviewStats.good) {
        return b.reviewStats.good - a.reviewStats.good;
      }
      return b.score - a.score;
    })
    .slice(0, 30);
  
  // 5. 날씨 정보 가져오기
  const weatherInfo = getWeatherInfo();
  
  // 6. LLM 호출 (키가 있으면)
  const perplexityKey = getPerplexityApiKey();
  
  if (perplexityKey && shortlist.length > 0) {
    try {
      const hasUserRequest = text && text.trim().length > 0;
      const topCount = hasUserRequest ? 1 : 3;
      const llmResult = callPerplexityAPI(text, shortlist, perplexityKey, weatherInfo, topCount);
      if (llmResult && llmResult.length > 0) {
        // reco_logs에 기록
        logRecommendation(text, preset, exclude, llmResult.map(r => r.place_id));
        return {
          success: true,
          data: llmResult
        };
      }
    } catch (error) {
      console.error('LLM 호출 실패:', error);
      // 폴백으로 진행
    }
  }
  
  // 7. 폴백: 사용자 요청 있으면 TOP1, 없으면 TOP3 반환
  const hasUserRequest = text && text.trim().length > 0;
  const topCount = hasUserRequest ? 1 : 3;
  const topResults = shortlist.slice(0, topCount).map(place => ({
    place_id: place.place_id,
    name: place.name,
    address_text: place.address_text,
    naver_map_url: place.naver_map_url,
    category: place.category,
    price_level: place.price_level,
    tags: place.tags,
    walk_min: place.walk_min,
    reason: `리뷰 점수 ${place.reviewStats.average.toFixed(1)}점, 총 ${place.reviewStats.total}개 리뷰`
  }));
  
  // reco_logs에 기록
  logRecommendation(text, preset, exclude, topResults.map(p => p.place_id));
  
  return {
    success: true,
    data: topResults
  };
}

// 좌표를 기상청 격자 좌표로 변환
function convertToGrid(lat, lon) {
  const RE = 6371.00877; // 지구 반경(km)
  const GRID = 5.0; // 격자 간격(km)
  const SLAT1 = 30.0; // 투영 위도1(degree)
  const SLAT2 = 60.0; // 투영 위도2(degree)
  const OLON = 126.0; // 기준점 경도(degree)
  const OLAT = 38.0; // 기준점 위도(degree)
  const XO = 43; // 기준점 X좌표(GRID)
  const YO = 136; // 기준점 Y좌표(GRID)
  
  const DEGRAD = Math.PI / 180.0;
  const RADDEG = 180.0 / Math.PI;
  
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;
  
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  
  let ra = Math.tan(Math.PI * 0.25 + (lat) * DEGRAD * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  
  const gridX = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const gridY = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  
  return { nx: gridX, ny: gridY };
}

// 날씨 정보 가져오기 (서울 영등포구) - 기상청 동네예보 API 사용
function getWeatherInfo() {
  try {
    // 공공데이터포털 기상청 API 키 (스크립트 속성에서 가져오기)
    let apiKey = PropertiesService.getScriptProperties().getProperty('KMA_API_KEY');
    // 테스트용: 인증키가 없으면 하드코딩된 키 사용 (개발/테스트 전용)
    if (!apiKey) {
      apiKey = '59c12627231e31f0c49b608447cbafdb00eeea0a469b5d1338b7268f03bcf0fb';
    }
    if (!apiKey) {
      return { description: '날씨 정보 없음', temp: null };
    }
    
    // 서울 영등포구 좌표
    const lat = 37.5264;
    const lon = 126.8962;
    
    // 격자 좌표로 변환
    const grid = convertToGrid(lat, lon);
    
    // 현재 시간 기준 (초단기실황은 매 시간 업데이트, base_time은 정각 시간)
    const now = new Date();
    const baseDate = Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd');
    const currentHour = parseInt(Utilities.formatDate(now, 'Asia/Seoul', 'HH'));
    // base_time은 현재 시간의 1시간 전 정각 (예: 14시면 13시 데이터 조회)
    // 초단기실황은 매 정각에 업데이트되므로, 현재 시간이 14:30이면 13:00 데이터가 최신
    const baseHour = currentHour > 0 ? currentHour - 1 : 23;
    const baseTime = String(baseHour).padStart(2, '0') + '00';
    
    // 기상청 초단기실황 API (공공데이터포털)
    const url = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodeURIComponent(apiKey)}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${grid.nx}&ny=${grid.ny}`;
    
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const statusCode = response.getResponseCode();
    
    if (statusCode === 200) {
      const data = JSON.parse(response.getContentText());
      
      if (data.response && data.response.body && data.response.body.items && data.response.body.items.item) {
        const items = data.response.body.items.item;
        let temp = null;
        let pty = null; // 강수형태
        let reh = null; // 습도
        
        items.forEach(item => {
          if (item.category === 'T1H') temp = Math.round(parseFloat(item.obsrValue)); // 기온
          if (item.category === 'PTY') pty = item.obsrValue; // 강수형태 (0:없음, 1:비, 2:비/눈, 3:눈, 4:소나기)
          if (item.category === 'REH') reh = parseFloat(item.obsrValue); // 습도
        });
        
        // 날씨 설명 생성 (초단기실황에는 SKY가 없으므로 PTY와 기온으로 판단)
        let description = '';
        if (pty === '1') description = '비';
        else if (pty === '2') description = '비/눈';
        else if (pty === '3') description = '눈';
        else if (pty === '4') description = '소나기';
        else if (pty === '0') {
          // 강수 없음 + 기온으로 날씨 판단
          if (temp !== null) {
            if (temp >= 25) description = '맑고 더움';
            else if (temp >= 15) description = '맑음';
            else if (temp >= 5) description = '맑고 쌀쌀함';
            else description = '맑고 추움';
          } else {
            description = '맑음';
          }
        } else {
          description = '날씨 정보 없음';
        }
        
        return {
          description: description,
          temp: temp,
          feels_like: null // 기상청 API에는 체감온도가 없음
        };
      } else {
        // 응답은 있지만 데이터가 없는 경우
        const errorMsg = data.response?.header?.resultMsg || '데이터 없음';
        console.error('날씨 API 응답 오류:', errorMsg, JSON.stringify(data.response?.header));
      }
    } else {
      // HTTP 오류 응답 파싱
      try {
        const errorData = JSON.parse(response.getContentText());
        const errorMsg = errorData.response?.header?.resultMsg || `HTTP ${statusCode}`;
        console.error('날씨 API HTTP 오류:', statusCode, errorMsg);
      } catch (e) {
        console.error('날씨 API 오류 응답 파싱 실패:', statusCode, response.getContentText().substring(0, 200));
      }
    }
  } catch (error) {
    console.error('날씨 정보 가져오기 실패:', error.toString());
  }
  
  return { description: '날씨 정보 없음', temp: null };
}

// Perplexity API 호출
function callPerplexityAPI(text, shortlist, apiKey, weatherInfo, topCount = 3) {
  const url = 'https://api.perplexity.ai/chat/completions';
  
  // shortlist를 JSON 문자열로 변환 (좋아요/싫어요 카운트 포함)
  const placesSummary = shortlist.map(p => {
    const features = [];
    if (p.solo_ok) features.push('혼밥가능');
    if (p.group_ok) features.push('단체가능');
    if (p.reservation_ok) features.push('예약가능');
    
    return {
      place_id: p.place_id,
      name: p.name,
      category: p.category || '',
      tags: p.tags || '',
      walk_min: p.walk_min || null,
      features: features.length > 0 ? features.join(', ') : '없음',
      review_good: p.reviewStats.good || 0,
      review_bad: p.reviewStats.bad || 0,
      review_average: p.reviewStats.average || 0
    };
  });
  
  const weatherText = weatherInfo.temp !== null 
    ? `오늘 서울 영등포구 날씨: ${weatherInfo.description}, 기온 ${weatherInfo.temp}°C${weatherInfo.feels_like ? ` (체감 ${weatherInfo.feels_like}°C)` : ''}`
    : '';
  
  const userRequestText = text && text.trim() ? `사용자 요청: "${text.trim()}"` : '사용자 요청: 없음 (일반 추천)';
  const topCountText = topCount === 1 ? 'Top 1개' : `Top ${topCount}개`;
  
  const prompt = `다음은 점심 식당 후보 목록입니다. ${userRequestText}

${weatherText ? weatherText + '\n\n' : ''}후보 목록 (좋아요 수가 많은 상위 30개):
${JSON.stringify(placesSummary, null, 2)}

**중요 제약사항:**
1. 반드시 위 후보 목록의 place_id만 사용해야 합니다.
2. ${topCountText}를 선택하고, 각각에 대해 1문장으로 이유를 설명하세요.
3. reason 작성 시 다음을 반드시 고려하세요:
   - 카테고리(category): 한식, 일식, 중식, 양식, 카페 등
   - 태그(tags): 가성비, 혼밥, 단체 등
   - 좋아요 수(review_good): 많은 좋아요는 인기와 만족도를 나타냅니다
   - 날씨: ${weatherText ? '현재 날씨를 고려하여 적합한 메뉴나 장소를 추천하세요.' : '날씨 정보가 없으므로 일반적인 추천을 하세요.'}
4. reason 작성 시 "혼밥가능", "단체가능", "예약가능" 같은 자연스러운 표현을 사용하세요. 필드명(solo_ok, group_ok 등)을 직접 사용하지 마세요.
5. JSON 형식으로만 응답하세요.

응답 형식:
{
  "recommendations": [
    {
      "place_id": "place_123",
      "reason": "이유 1문장 (카테고리, 태그, 좋아요 수, 날씨를 고려한 자연스러운 설명)"
    }
  ]
}`;
  
  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: topCount === 1 ? 300 : 500
    })
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
      const content = responseData.choices[0].message.content;
      
      // JSON 추출
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          // place_id로 전체 정보 매칭
          return parsed.recommendations.map(rec => {
            const place = shortlist.find(p => p.place_id === rec.place_id);
            if (place) {
              return {
                place_id: place.place_id,
                name: place.name,
                address_text: place.address_text,
                naver_map_url: place.naver_map_url,
                category: place.category,
                price_level: place.price_level,
                tags: place.tags,
                walk_min: place.walk_min,
                reason: rec.reason || '추천'
              };
            }
            return null;
          }).filter(p => p !== null).slice(0, 3);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Perplexity API 호출 오류:', error);
    return null;
  }
}

// 추천 로그 기록
function logRecommendation(text, preset, exclude, resultPlaceIds) {
  const logData = {
    log_id: generateId('log'),
    text: text,
    preset: JSON.stringify(preset),
    exclude: JSON.stringify(exclude),
    result_place_ids: JSON.stringify(resultPlaceIds),
    created_at: new Date().toISOString()
  };
  
  appendSheetData('reco_logs', logData);
}

// 메인 doPost 함수 (웹 앱으로 배포)
function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const request = e;
    const path = request.parameter.path || '';
    // 실제 HTTP 메서드 (Apps Script는 GET/POST만 지원)
    const httpMethod = e.postData ? 'POST' : 'GET';
    // 원본 메서드 (쿼리 파라미터에서 가져옴, PUT/DELETE일 수 있음)
    const originalMethod = request.parameter.method || httpMethod;
    
    // 디버깅을 위한 로그
    console.log('Apps Script 요청:', { 
      path: path, 
      httpMethod: httpMethod, 
      originalMethod: originalMethod,
      hasPostData: !!e.postData,
      parameterMethod: request.parameter.method
    });
    
    let result;
    
    // 라우팅
    // 참고: Apps Script는 GET/POST만 지원하므로, PUT/DELETE는 POST로 변환되어 method 쿼리 파라미터로 전달됨
    
    if (path === 'places' && httpMethod === 'GET') {
      result = getPlaces();
    } else if (path === 'places' && httpMethod === 'POST' && originalMethod === 'POST') {
      // 새 장소 생성 (POST만)
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = createPlace(requestData);
    } else if (path.startsWith('places/')) {
      // places/{id} 경로 처리
      const placeId = path.replace('places/', '');
      
      // 원본 메서드가 PUT이면 수정
      if (originalMethod === 'PUT') {
        const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
        result = updatePlace(placeId, requestData);
      } else if (originalMethod === 'DELETE') {
        // 원본 메서드가 DELETE면 삭제
        result = deletePlace(placeId);
      } else {
        result = {
          success: false,
          error: `places/${placeId} 경로에 대한 잘못된 메서드: httpMethod=${httpMethod}, originalMethod=${originalMethod}`
        };
      }
    } else if (path === 'reviews' && httpMethod === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = createReview(requestData);
    } else if (path === 'recommend' && httpMethod === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = recommendLunch(requestData);
    } else if (path === 'config' && httpMethod === 'GET') {
      result = getConfig();
    } else if (path === 'config' && httpMethod === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = updateConfig(requestData);
    } else if (path === 'upload-image' && httpMethod === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = uploadImage(requestData);
    } else if (path === 'daily-recommendations' && httpMethod === 'GET') {
      result = getDailyRecommendations();
    } else if (path === 'generate-daily' && httpMethod === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = generateDaily(requestData);
    } else if (path === 'verify-register-password' && httpMethod === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = verifyRegisterPassword(requestData);
    } else if (path === 'admin-verify' && httpMethod === 'POST') {
      const requestData = e.postData ? JSON.parse(e.postData.contents) : {};
      result = verifyAdminPassword(requestData);
    } else {
      // 더 구체적인 에러 메시지 제공
      const debugInfo = {
        path: path,
        httpMethod: httpMethod,
        originalMethod: originalMethod,
        hasPostData: !!e.postData,
        pathStartsWithPlaces: path.startsWith('places/'),
        pathIsPlaces: path === 'places'
      };
      result = {
        success: false,
        error: `알 수 없는 엔드포인트: ${path} (httpMethod: ${httpMethod}, originalMethod: ${originalMethod})`
      };
      console.log('알 수 없는 엔드포인트:', debugInfo);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('요청 처리 오류:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
