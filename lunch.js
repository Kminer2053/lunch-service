// 백엔드 URL: API_BASE_URL 있으면 server.js 프록시 사용(CORS 회피), 없으면 Apps Script 직접 호출
const APPS_SCRIPT_URL = window.APPS_SCRIPT_URL || '';
const API_BASE_URL = (window.API_BASE_URL && !String(window.API_BASE_URL).startsWith('__'))
    ? window.API_BASE_URL
    : 'https://myteamdashboard.onrender.com';

/** Apps Script 호출: API_BASE_URL이 있으면 로직 없는 프록시 경유, 없으면 Apps Script 직접 (path, method, body) */
async function callAppsScript(path, method = 'GET', body = null) {
    const useProxy = API_BASE_URL && !String(API_BASE_URL).startsWith('__');
    const baseUrl = useProxy
        ? API_BASE_URL.replace(/\/$/, '') + '/lunch/api/apps-script'
        : (APPS_SCRIPT_URL && !String(APPS_SCRIPT_URL).startsWith('__') ? APPS_SCRIPT_URL : '');
    if (!baseUrl) {
        throw new Error('APPS_SCRIPT_URL 또는 API_BASE_URL이 설정되지 않았습니다.');
    }
    const cleanPath = path.replace(/^\//, '');
    const httpMethod = (method === 'PUT' || method === 'DELETE') ? 'POST' : method;
    const apiUrl = `${baseUrl}?path=${encodeURIComponent(cleanPath)}&method=${method}`;
    const opts = { method: httpMethod, headers: { 'Content-Type': 'application/json' } };
    if (body && httpMethod === 'POST') opts.body = JSON.stringify(body);
    const res = await fetch(apiUrl, opts);
    return res.json();
}

// 전역 상태
let selectedPresets = [];
let currentTags = [];
let selectedCategory = '';
let selectedFeatures = { solo_ok: false, group_ok: false, reservation_ok: false };
let imageBase64 = '';
let currentFilterCat = '전체';
let registerAuthenticated = false;
let editMode = false;
let editingPlaceId = null;
let placesData = []; // 관리자 페이지에서 사용할 장소 데이터
let sessionRecommendResult = null; // 세션 내 개별 추천 결과 (추천 받기 클릭 시 저장, 새로고침 시 초기화)
let shareRecommendationsData = {}; // 공유하기용 추천 데이터 (containerId별)

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initRecommend();
    initShareButtons();
    initList();
    initRegister();
    initAdmin();
    initReview();
    loadPlaces();
    loadDailyRecommendations();
    lucide.createIcons();
});

// ===== 탭 전환 =====
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // 등록 탭을 클릭할 때마다 비밀번호 모달 표시 (같은 세션에서도)
            if (targetTab === 'register-tab') {
                // 다른 탭으로 이동할 때 인증 상태 리셋
                if (registerAuthenticated) {
                    registerAuthenticated = false;
                }
                showPasswordModal();
                return;
            }

            // 다른 탭으로 이동할 때 등록 인증 상태 리셋
            if (registerAuthenticated) {
                registerAuthenticated = false;
            }

            activateTab(targetTab, tabButtons, tabContents);
        });
    });
}

function activateTab(targetTab, tabButtons, tabContents) {
    if (!tabButtons) tabButtons = document.querySelectorAll('.tab-btn');
    if (!tabContents) tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(tab => tab.classList.remove('active'));
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
    if (targetBtn) targetBtn.classList.add('active');
    document.getElementById(targetTab)?.classList.add('active');
    // 추천/목록 탭에서만 제휴 배너 표시
    const banner = document.getElementById('lunch-affiliate-banner');
    if (banner) banner.style.display = (targetTab === 'recommend-tab' || targetTab === 'list-tab') ? 'block' : 'none';
}

// ===== 암호 모달 =====
function showPasswordModal() {
    const modal = document.getElementById('password-modal');
    if (!modal) {
        console.error('[showPasswordModal] 모달 요소를 찾을 수 없습니다.');
        showToast('모달을 표시할 수 없습니다.');
        return;
    }
    
    const passwordInput = document.getElementById('register-password-input');
    const btnCancel = document.getElementById('btn-pw-cancel');
    const btnConfirm = document.getElementById('btn-pw-confirm');
    
    if (!passwordInput || !btnCancel || !btnConfirm) {
        console.error('[showPasswordModal] 모달 내부 요소를 찾을 수 없습니다.');
        showToast('모달을 표시할 수 없습니다.');
        return;
    }
    
    // 모달 표시
    modal.style.display = 'flex';
    modal.style.zIndex = '9999'; // z-index 명시적 설정
    
    // 입력값 초기화 및 포커스
    passwordInput.value = '';
    setTimeout(() => {
        passwordInput.focus();
    }, 100);
    
    // 이벤트 리스너 설정
    btnCancel.onclick = () => { 
        modal.style.display = 'none';
    };
    btnConfirm.onclick = () => verifyRegisterPassword();
    passwordInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            verifyRegisterPassword();
        }
    };
}

async function verifyRegisterPassword() {
    const pw = document.getElementById('register-password-input').value;
    if (!pw) { showToast('암호를 입력하세요.'); return; }
    showLoading(true);
    try {
        const data = await callAppsScript('verify-register-password', 'POST', { password: pw });
        if (data.success) {
            registerAuthenticated = true;
            // 세션 스토리지에 저장하지 않음 (매번 입력 요구)
            document.getElementById('password-modal').style.display = 'none';
            activateTab('register-tab');
            showToast('인증 완료');
        } else {
            // 비밀번호 틀렸을 때 모달 닫고 이전 화면으로 복귀
            document.getElementById('password-modal').style.display = 'none';
            document.getElementById('register-password-input').value = '';
            showToast(data.error || '올바른 비밀번호를 입력해주세요.');
        }
    } catch (e) {
        // 에러 발생 시에도 모달 닫기
        document.getElementById('password-modal').style.display = 'none';
        showToast('인증 중 오류가 발생했습니다.');
    } finally { showLoading(false); }
}

// ===== 추천 기능 =====
function initRecommend() {
    const recommendBtn = document.getElementById('recommend-btn');
    document.querySelectorAll('.preset-chips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            const preset = chip.getAttribute('data-preset');
            if (chip.classList.contains('active')) {
                if (!selectedPresets.includes(preset)) selectedPresets.push(preset);
            } else {
                selectedPresets = selectedPresets.filter(p => p !== preset);
            }
        });
    });
    recommendBtn.addEventListener('click', async () => {
        const text = document.getElementById('recommend-text').value.trim();
        if (!text) { showToast('추천 요청을 입력해주세요.'); return; }
        await requestRecommendation(text, selectedPresets, []);
    });
}

async function requestRecommendation(text, preset = [], exclude = []) {
    showLoading(true);
    try {
        const data = await callAppsScript('recommend', 'POST', { text, preset, exclude });
        if (data.success && data.data?.length > 0) {
            sessionRecommendResult = data.data;
            renderRecommendSection();
            showToast('맞춤 추천이 완료되었습니다.');
        } else {
            sessionRecommendResult = [];
            renderRecommendSection();
            const container = document.getElementById('recommend-results');
            if (container) {
                container.innerHTML =
                    '<div class="empty-state"><i data-lucide="frown"></i><div class="empty-state-text">추천 결과가 없습니다</div></div>';
                lucide.createIcons();
            }
        }
    } catch (error) {
        console.error('추천 요청 실패:', error);
        showToast('추천 요청 중 오류가 발생했습니다.');
    } finally { showLoading(false); }
}

/** 추천 영역 렌더링: 세션에 개별 추천 결과가 있으면 표시, 없으면 오늘의 추천 TOP3 표시 */
function renderRecommendSection() {
    const dailySection = document.getElementById('daily-section');
    const recommendWrapper = document.getElementById('recommend-results-wrapper');
    const recommendResults = document.getElementById('recommend-results');
    if (!dailySection || !recommendWrapper || !recommendResults) return;

    if (sessionRecommendResult !== null && sessionRecommendResult.length > 0) {
        dailySection.style.display = 'none';
        recommendWrapper.style.display = 'block';
        displayRecommendations(sessionRecommendResult, 'recommend-results');
    } else if (sessionRecommendResult !== null && sessionRecommendResult.length === 0) {
        dailySection.style.display = 'none';
        recommendWrapper.style.display = 'block';
        recommendResults.innerHTML =
            '<div class="empty-state"><i data-lucide="frown"></i><div class="empty-state-text">추천 결과가 없습니다</div></div>';
        const recShareSection = document.getElementById('recommend-share-section');
        if (recShareSection) recShareSection.style.display = 'none';
        lucide.createIcons();
    } else {
        recommendWrapper.style.display = 'none';
        recommendResults.innerHTML = '';
    }
}

async function loadDailyRecommendations() {
    try {
        // places가 없으면 먼저 로드 (place_id로 이미지를 찾기 위해 필요)
        if (!window.allPlaces || window.allPlaces.length === 0) {
            try {
                const placesData = await callAppsScript('places', 'GET');
                if (placesData.success && placesData.data) {
                    window.allPlaces = placesData.data;
                }
            } catch (e) {
                console.warn('일일 추천 표시를 위한 places 로드 실패:', e);
            }
        }
        
        const data = await callAppsScript('daily-recommendations', 'GET');
        if (data.success && data.data && data.data.length > 0) {
            const section = document.getElementById('daily-section');
            section.style.display = 'block';
            const today = new Date();
            document.getElementById('daily-date').textContent =
                `${today.getMonth()+1}/${today.getDate()} 추천`;
            displayRecommendations(data.data, 'daily-results');
        }
        renderRecommendSection();
    } catch (e) { /* silent */ }
}

function bindImageErrorHandlers(container) {
    if (!container) return;
    container.querySelectorAll('.place-card-img').forEach(img => {
        img.addEventListener('error', function () {
            const wrapper = this.closest('.place-card-img-wrapper');
            if (!wrapper) return;
            const placeholder = wrapper.querySelector('.place-card-img-placeholder');
            this.style.display = 'none';
            if (placeholder) placeholder.style.display = 'flex';
        });
    });
}

/** 추천 결과를 카톡 등에 붙여넣기용 텍스트로 포맷 */
function formatRecommendationsForShare(recommendations) {
    if (!recommendations || recommendations.length === 0) return '';
    return recommendations.map((item, i) => {
        const emoji = i === 0 ? '1️⃣' : i === 1 ? '2️⃣' : '3️⃣';
        let text = `${emoji} ${item.name || '이름 없음'}\n`;
        if (item.reason) text += `📍 이유: ${item.reason}\n`;
        if (item.address_text) text += `📍 주소: ${item.address_text}\n`;
        if (item.naver_map_url) text += `🗺️ 지도: ${item.naver_map_url}\n`;
        if (item.category) text += `🏷️ 카테고리: ${item.category}\n`;
        if (item.walk_min) text += `🚶 도보: ${item.walk_min}분\n`;
        return text.trim();
    }).join('\n\n') + '\n\n🍽️ 오늘점심,여기\n' + (typeof window !== 'undefined' ? window.location.origin : 'https://lunch-service.vercel.app');
}

/** 클립보드에 추천 텍스트 복사 */
async function copyRecommendationsToClipboard(recommendations) {
    const text = formatRecommendationsForShare(recommendations);
    if (!text) { showToast('공유할 내용이 없습니다.'); return; }
    try {
        await navigator.clipboard.writeText(text);
        showToast('클립보드에 복사되었습니다. 카톡에 붙여넣기 해보세요!');
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showToast('클립보드에 복사되었습니다. 카톡에 붙여넣기 해보세요!');
        } catch (e2) {
            showToast('복사에 실패했습니다.');
        }
        document.body.removeChild(ta);
    }
}

function initShareButtons() {
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const source = btn.getAttribute('data-share-source');
            const data = shareRecommendationsData[source];
            if (data && data.length > 0) {
                copyRecommendationsToClipboard(data);
            } else {
                showToast('공유할 추천 결과가 없습니다.');
            }
        });
    });
}

function displayRecommendations(recommendations, containerId) {
    shareRecommendationsData[containerId] = recommendations || [];
    const shareSectionId = containerId === 'daily-results' ? 'daily-share-section' : 'recommend-share-section';
    const shareSection = document.getElementById(shareSectionId);
    if (shareSection) {
        shareSection.style.display = (recommendations && recommendations.length > 0) ? 'block' : 'none';
    }

    const container = document.getElementById(containerId);
    container.innerHTML = recommendations.map((place, index) => {
        // place_id가 있고 image_url이 없으면 allPlaces에서 찾아서 사용
        let imageUrl = place.image_url;
        if (!imageUrl && place.place_id && window.allPlaces) {
            const placeFromDb = window.allPlaces.find(p => p.place_id === place.place_id);
            if (placeFromDb && placeFromDb.image_url) {
                imageUrl = placeFromDb.image_url;
            }
        }
        imageUrl = getDisplayImageUrl(imageUrl);
        const imgHtml = imageUrl
            ? `<div class="place-card-img-wrapper"><img class="place-card-img" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(place.name)}" referrerpolicy="no-referrer"><div class="place-card-img-placeholder" style="display:none"><i data-lucide="utensils-crossed"></i></div></div>`
            : '<div class="place-card-img-wrapper"><div class="place-card-img-placeholder"><i data-lucide="utensils-crossed"></i></div></div>';
        return `
            <div class="place-card">
                ${imgHtml}
                <div class="place-card-body">
                    <div class="place-card-top">
                        <div class="place-name">${escapeHtml(place.name || '이름 없음')}</div>
                        <span class="place-rank">${index + 1}위</span>
                    </div>
                    ${place.reason ? `<div class="place-reason">"${escapeHtml(place.reason)}"</div>` : ''}
                    <div class="place-meta">
                        ${place.category ? `<span class="place-tag cat">${escapeHtml(place.category)}</span>` : ''}
                        ${place.walk_min ? `<span class="place-tag walk"><i data-lucide="footprints" style="width:10px;height:10px"></i> ${place.walk_min}분</span>` : ''}
                        ${place.price_level ? `<span class="place-tag price">${escapeHtml(place.price_level)}</span>` : ''}
                    </div>
                    <div class="place-info">
                        ${place.address_text ? `<div class="place-info-item"><i data-lucide="map-pin"></i> ${escapeHtml(place.address_text)}</div>` : ''}
                        ${place.tags ? `<div class="place-info-item"><i data-lucide="hash"></i> ${escapeHtml(place.tags)}</div>` : ''}
                    </div>
                    <div class="place-actions">
                        ${place.naver_map_url ? `<button class="btn-secondary" onclick="openMap('${escapeAttr(place.naver_map_url)}')"><i data-lucide="map"></i> 지도 열기</button>` : ''}
                    </div>
                </div>
            </div>`;
    }).join('');
    bindImageErrorHandlers(container);
    lucide.createIcons();
}

function openMap(url) { window.open(url, '_blank'); }

// ===== 목록 기능 =====
function initList() {
    document.getElementById('search-input').addEventListener('input', (e) => filterPlaces());
    document.querySelectorAll('.cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilterCat = chip.getAttribute('data-cat');
            filterPlaces();
        });
    });
}

async function loadPlaces() {
    showLoading(true);
    try {
        const data = await callAppsScript('places', 'GET');
        if (data.success && data.data) {
            window.allPlaces = data.data;
            displayPlaces(data.data);
        }
    } catch (error) { console.error('장소 목록 로드 실패:', error); }
    finally { showLoading(false); }
}

function displayPlaces(places) {
    const placesList = document.getElementById('places-list');
    if (!places || places.length === 0) {
        placesList.innerHTML = '<div class="empty-state"><i data-lucide="inbox"></i><div class="empty-state-text">등록된 장소가 없습니다</div></div>';
        lucide.createIcons();
        return;
    }
    placesList.innerHTML = places.map(place => {
        const imageUrl = getDisplayImageUrl(place.image_url);
        const imgHtml = imageUrl
            ? `<div class="place-card-img-wrapper"><img class="place-card-img" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(place.name)}" referrerpolicy="no-referrer"><div class="place-card-img-placeholder" style="display:none"><i data-lucide="utensils-crossed"></i></div></div>`
            : '<div class="place-card-img-wrapper"><div class="place-card-img-placeholder"><i data-lucide="utensils-crossed"></i></div></div>';
        return `
            <div class="place-card">
                ${imgHtml}
                <div class="place-card-body">
                    <div class="place-card-top">
                        <div class="place-name">${escapeHtml(place.name || '이름 없음')}</div>
                    </div>
                    <div class="place-meta">
                        ${place.category ? `<span class="place-tag cat">${escapeHtml(place.category)}</span>` : ''}
                        ${place.walk_min ? `<span class="place-tag walk"><i data-lucide="footprints" style="width:10px;height:10px"></i> ${place.walk_min}분</span>` : ''}
                        ${place.price_level ? `<span class="place-tag price">${escapeHtml(place.price_level)}</span>` : ''}
                    </div>
                    <div class="place-info">
                        ${place.address_text ? `<div class="place-info-item"><i data-lucide="map-pin"></i> ${escapeHtml(place.address_text)}</div>` : ''}
                        ${place.tags ? `<div class="place-info-item"><i data-lucide="hash"></i> ${escapeHtml(place.tags)}</div>` : ''}
                    </div>
                    <div class="place-actions">
                        ${place.naver_map_url ? `<button class="btn-secondary" onclick="openMap('${escapeAttr(place.naver_map_url)}')"><i data-lucide="map"></i> 지도 열기</button>` : ''}
                        <button class="btn-review btn-review-good" onclick="openReviewModal('${place.place_id}', '${escapeAttr(place.name)}', 'good')">
                            <i data-lucide="thumbs-up"></i> ${place.review_good || 0}
                        </button>
                        <button class="btn-review btn-review-bad" onclick="openReviewModal('${place.place_id}', '${escapeAttr(place.name)}', 'bad')">
                            <i data-lucide="thumbs-down"></i> ${place.review_bad || 0}
                        </button>
                    </div>
                </div>
            </div>`;
    }).join('');
    bindImageErrorHandlers(placesList);
    lucide.createIcons();
}

function filterPlaces() {
    if (!window.allPlaces) return;
    const query = (document.getElementById('search-input').value || '').toLowerCase();
    const filtered = window.allPlaces.filter(place => {
        const matchText = !query || [place.name, place.address_text, place.category, place.tags]
            .filter(Boolean).join(' ').toLowerCase().includes(query);
        const matchCat = currentFilterCat === '전체' || (place.category || '').includes(currentFilterCat);
        return matchText && matchCat;
    });
    displayPlaces(filtered);
}

// ===== 등록 기능 =====
function initRegister() {
    const form = document.getElementById('place-form');
    document.getElementById('btn-search-place').addEventListener('click', searchPlace);
    document.getElementById('place-search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); searchPlace(); }
    });
    document.getElementById('btn-manual-entry').addEventListener('click', () => {
        document.getElementById('register-step1').style.display = 'none';
        document.getElementById('register-step2').style.display = 'flex';
        clearPlaceForm();
    });
    document.getElementById('btn-back-step1').addEventListener('click', () => {
        document.getElementById('register-step2').style.display = 'none';
        document.getElementById('register-step1').style.display = 'flex';
        editMode = false;
        editingPlaceId = null;
        clearPlaceForm();
    });
    form.addEventListener('submit', async (e) => { e.preventDefault(); await submitPlace(); });

    // 카테고리 칩
    document.querySelectorAll('.cat-select').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.cat-select').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedCategory = chip.getAttribute('data-value');
            document.getElementById('place-category').value = selectedCategory;
        });
    });

    // 특징 칩
    document.querySelectorAll('.feat-select').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            const feat = chip.getAttribute('data-feat');
            selectedFeatures[feat] = chip.classList.contains('active');
        });
    });

    // 태그 입력 (IME 안전 처리)
    const tagInput = document.getElementById('tag-input');
    if (tagInput) {
        let isComposing = false; // 한글 입력 조합 상태 추적
        
        // 한글 입력 조합 시작
        tagInput.addEventListener('compositionstart', () => {
            isComposing = true;
        });
        
        // 한글 입력 조합 완료
        tagInput.addEventListener('compositionend', () => {
            isComposing = false;
        });
        
        // keydown 이벤트 처리 (IME 조합 중에는 처리하지 않음)
        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // IME 조합 중이면 무시
                if (e.isComposing || isComposing) {
                    return;
                }
                
                e.preventDefault(); 
                e.stopPropagation(); 
                e.stopImmediatePropagation(); // 같은 요소의 다른 리스너도 차단
                
                // 입력값을 먼저 저장
                const value = tagInput.value.trim();
                
                // 즉시 입력 필드를 비우기 (다른 이벤트보다 먼저)
                tagInput.value = '';
                
                // 입력값이 있으면 태그 추가
                if (value) {
                    const tag = value.replace(/^#/, '');
                    if (tag && tag.length > 0 && !currentTags.includes(tag)) {
                        currentTags.push(tag);
                        renderTags();
                    }
                }
                
                // 입력 필드가 비워졌는지 다시 확인
                setTimeout(() => {
                    if (tagInput.value.trim().length > 0) {
                        tagInput.value = '';
                    }
                }, 0);
            }
        }, { once: false, passive: false });
    }
    document.getElementById('btn-add-tag').addEventListener('click', addTag);

    // 이미지 업로드
    const imageArea = document.getElementById('image-upload-area');
    const imageInput = document.getElementById('place-image');
    imageArea.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageSelect);
}

async function searchPlace() {
    const query = document.getElementById('place-search-input').value.trim();
    if (!query) { showToast('검색어를 입력하세요.'); return; }
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/lunch/search-place`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
            displaySearchResults(data.data);
        } else {
            document.getElementById('search-results').innerHTML =
                '<p style="text-align:center;color:#999;font-size:13px;padding:12px;">검색 결과가 없습니다.</p>';
        }
    } catch (e) {
        showToast('검색 중 오류가 발생했습니다.');
    } finally { showLoading(false); }
}

function displaySearchResults(items) {
    const container = document.getElementById('search-results');
    container.innerHTML = items.map((item, idx) => `
        <div class="search-result-item" data-idx="${idx}">
            <div class="search-result-name">${escapeHtml(item.name)}</div>
            <div class="search-result-meta">
                ${item.category_mapped ? `<span class="search-result-cat">${escapeHtml(item.category_mapped)}</span> ` : ''}
                ${escapeHtml(item.address_text)}
            </div>
        </div>
    `).join('');
    container.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-idx'));
            selectSearchResult(items[idx]);
        });
    });
}

async function selectSearchResult(item) {
    showLoading(true);
    try {
        // 카테고리 자동 선택
        if (item.category_mapped) {
            document.querySelectorAll('.cat-select').forEach(c => c.classList.remove('active'));
            const catChip = document.querySelector(`.cat-select[data-value="${item.category_mapped}"]`);
            if (catChip) catChip.classList.add('active');
            selectedCategory = item.category_mapped;
            document.getElementById('place-category').value = selectedCategory;
        }

        const placeName = item.name || '';
        if (!placeName) {
            showToast('상호명 정보가 없습니다.');
            return;
        }

        // 중복 상호명 체크
        const placesData = await callAppsScript('places', 'GET');
        if (placesData.success && placesData.data) {
            const duplicatePlace = placesData.data.find(p => 
                p.name && p.name.trim().toLowerCase() === placeName.trim().toLowerCase()
            );
            if (duplicatePlace) {
                showToast('이미 등록되어 있는 상점입니다.');
                return;
            }
        }

        document.getElementById('place-name').value = placeName;
        document.getElementById('place-address').value = item.address_text || '';

        if (item.naver_link) {
            document.getElementById('place-map-url').value = item.naver_link;
        }

        // 지오코딩으로 좌표/도보시간 가져오기
        if (item.address_text) {
            const geoRes = await fetch(`${API_BASE_URL}/lunch/geocode-address`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: item.address_text })
            });
            const geoData = await geoRes.json();
            if (geoData.success && geoData.data) {
                document.getElementById('place-walk').value = geoData.data.walk_min || 0;
                document.getElementById('place-lat').value = geoData.data.lat || '';
                document.getElementById('place-lng').value = geoData.data.lng || '';
                if (!item.naver_link && geoData.data.naver_map_url) {
                    document.getElementById('place-map-url').value = geoData.data.naver_map_url;
                }
                updateMapPreview(geoData.data.lat, geoData.data.lng);
                
                // 도보시간 출처 표시
                if (geoData.data.walk_source) {
                    const sourceGroup = document.getElementById('walk-source-group');
                    const sourceText = document.getElementById('walk-source-text');
                    if (sourceGroup && sourceText) {
                        sourceGroup.style.display = 'block';
                        if (geoData.data.walk_source === 'tmap') {
                            sourceText.textContent = '도보 소요시간은 TMAP API로 계산되었습니다.';
                            sourceText.style.color = 'var(--primary)';
                        } else {
                            sourceText.textContent = '도보 소요시간은 직선거리로 추정되었습니다.';
                            sourceText.style.color = 'var(--text-secondary)';
                        }
                    }
                }
            }
        }

        document.getElementById('register-step1').style.display = 'none';
        document.getElementById('register-step2').style.display = 'flex';
        showToast('정보를 불러왔습니다. 확인 후 등록하세요.');
    } catch (e) {
        console.error('selectSearchResult error:', e);
        showToast('정보 처리 중 오류가 발생했습니다.');
    } finally { showLoading(false); }
}

function fillPlaceForm(data) {
    document.getElementById('place-name').value = data.name || '';
    document.getElementById('place-address').value = data.address_text || '';
    document.getElementById('place-map-url').value = data.naver_map_url || '';
    document.getElementById('place-walk').value = data.walk_min != null ? data.walk_min : 0;

    if (data.category) {
        const mapped = mapCategoryFrontend(data.category);
        document.querySelectorAll('.cat-select').forEach(c => c.classList.remove('active'));
        const chip = document.querySelector(`.cat-select[data-value="${mapped}"]`);
        if (chip) chip.classList.add('active');
        selectedCategory = mapped;
        document.getElementById('place-category').value = mapped;
    }
}

function mapCategoryFrontend(raw) {
    if (!raw) return '기타';
    const keywords = { '한식':'한식','중식':'중식','중국':'중식','일식':'일식','일본':'일식','양식':'양식','분식':'분식','카페':'카페','디저트':'카페' };
    const top = raw.split('>')[0].replace(/<[^>]+>/g,'').trim();
    if (keywords[top]) return keywords[top];
    for (const [k,v] of Object.entries(keywords)) { if (raw.includes(k)) return v; }
    return '기타';
}

function clearPlaceForm() {
    document.getElementById('place-name').value = '';
    document.getElementById('place-address').value = '';
    document.getElementById('place-map-url').value = '';
    document.getElementById('place-walk').value = 0;
    document.getElementById('place-price').value = '';
    document.getElementById('place-lat').value = '';
    document.getElementById('place-lng').value = '';
    selectedCategory = '';
        selectedFeatures = { solo_ok: false, group_ok: false, reservation_ok: false };
    currentTags = [];
    imageBase64 = '';
    editMode = false;
    editingPlaceId = null;
    document.querySelectorAll('.cat-select, .feat-select').forEach(c => c.classList.remove('active'));
    document.getElementById('tags-container').innerHTML = '';
    document.getElementById('place-tags').value = '';
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('image-placeholder').style.display = 'flex';
    
    // 버튼 텍스트 원래대로 복원
    const submitBtn = document.querySelector('#place-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i data-lucide="check-circle" class="btn-icon"></i> 등록 완료하기';
        lucide.createIcons();
    }
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('image-placeholder').style.display = 'flex';
    document.getElementById('map-preview-group').style.display = 'none';
    const walkSourceGroup = document.getElementById('walk-source-group');
    if (walkSourceGroup) walkSourceGroup.style.display = 'none';
}

function updateMapPreview(lat, lng) {
    if (!lat || !lng) return;
    const img = document.getElementById('map-preview-img');
    const errorDiv = document.getElementById('map-preview-error');
    if (img && errorDiv) {
        img.style.display = 'block';
        errorDiv.style.display = 'none';
        img.onerror = function() {
            this.style.display = 'none';
            if (errorDiv) errorDiv.style.display = 'block';
        };
        img.src = `${API_BASE_URL}/lunch/static-map?lat=${lat}&lng=${lng}&w=380&h=160`;
    }
    const group = document.getElementById('map-preview-group');
    if (group) group.style.display = 'block';
}

// 태그 관리
let isAddingTag = false; // 중복 실행 방지 플래그
function addTag() {
    // 이미 실행 중이면 즉시 반환
    if (isAddingTag) {
        console.log('[addTag] 중복 실행 방지');
        return;
    }
    
    const input = document.getElementById('tag-input');
    if (!input) return;
    
    const tag = input.value.trim().replace(/^#/, '');
    
    // 입력값이 비어있거나 공백만 있으면 무시
    if (!tag || tag.length === 0) {
        input.value = ''; // 빈 값이어도 입력 필드 비우기
        return;
    }
    
    // 중복 태그 체크
    if (currentTags.includes(tag)) {
        input.value = '';
        return;
    }
    
    isAddingTag = true;
    
    try {
        currentTags.push(tag);
        renderTags();
        input.value = ''; // 태그 추가 후 입력 필드 비우기
    } finally {
        // setTimeout을 사용하여 다음 이벤트 루프에서 플래그 리셋
        setTimeout(() => {
            isAddingTag = false;
        }, 100);
    }
}
function removeTag(tag) {
    currentTags = currentTags.filter(t => t !== tag);
    renderTags();
}
function renderTags() {
    const container = document.getElementById('tags-container');
    container.innerHTML = currentTags.map(tag => `
        <span class="tag-pill">#${escapeHtml(tag)}
            <button type="button" onclick="removeTag('${escapeAttr(tag)}')"><i data-lucide="x"></i></button>
        </span>`).join('');
    document.getElementById('place-tags').value = currentTags.join(',');
    lucide.createIcons();
}

// 이미지 처리
function resizeImage(file, maxW = 1920, maxH = 1080, quality = 0.85) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxW || height > maxH) {
                const ratio = Math.min(maxW / width, maxH / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            URL.revokeObjectURL(img.src);
            resolve(dataUrl);
        };
        img.src = URL.createObjectURL(file);
    });
}

async function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { showToast('이미지는 20MB 이하만 가능합니다.'); return; }
    showLoading(true);
    try {
        const dataUrl = await resizeImage(file, 1920, 1080, 0.85);
        imageBase64 = dataUrl.split(',')[1];
        document.getElementById('image-preview').src = dataUrl;
        document.getElementById('image-preview').style.display = 'block';
        document.getElementById('image-placeholder').style.display = 'none';
    } catch (err) {
        console.error('이미지 리사이즈 실패:', err);
        showToast('이미지 처리에 실패했습니다.');
    } finally { showLoading(false); }
}

async function submitPlace() {
    const formData = {
        name: document.getElementById('place-name').value.trim(),
        address_text: document.getElementById('place-address').value.trim(),
        naver_map_url: document.getElementById('place-map-url').value.trim(),
        category: selectedCategory || document.getElementById('place-category').value || '',
        price_level: document.getElementById('place-price').value || '',
        walk_min: parseInt(document.getElementById('place-walk').value) || 0,
        solo_ok: selectedFeatures.solo_ok,
        group_ok: selectedFeatures.group_ok,
        reservation_ok: selectedFeatures.reservation_ok,
        tags: currentTags.join(','),
        lat: document.getElementById('place-lat').value || '',
        lng: document.getElementById('place-lng').value || ''
    };
    if (!formData.name || !formData.address_text) { showToast('이름과 주소는 필수 항목입니다.'); return; }

    showLoading(true);
    try {
        // 이미지 먼저 업로드
        if (imageBase64) {
            try {
                const uploadPayload = {
                    image_base64: imageBase64, 
                    filename: `${formData.name || 'place'}_${Date.now()}.jpg`,
                    place_id: editMode && editingPlaceId ? editingPlaceId : ''
                };
                
                console.log('[submitPlace] 이미지 업로드 요청:', { hasPlaceId: !!uploadPayload.place_id, placeId: uploadPayload.place_id, editMode: editMode });
                
                const imgData = await callAppsScript('upload-image', 'POST', uploadPayload);
                
                if (!imgData.success) {
                    console.error('[submitPlace] 이미지 업로드 실패:', imgData.error);
                    showToast(`이미지 업로드 실패: ${imgData.error || '알 수 없는 오류'}`);
                } else {
                    if (imgData.data?.image_url) {
                        formData.image_url = imgData.data.image_url;
                        console.log('[submitPlace] 이미지 업로드 성공:', imgData.data.image_url);
                    }
                }
            } catch (e) { 
                console.error('이미지 업로드 네트워크 오류:', e);
                showToast('이미지 업로드 중 오류가 발생했습니다. 이미지 없이 등록됩니다.');
            }
        }

        // 수정 모드인지 확인
        if (editMode && editingPlaceId) {
            const data = await callAppsScript(`places/${editingPlaceId}`, 'PUT', formData);
            if (data.success) {
                showToast('수정 완료');
                clearPlaceForm();
                document.getElementById('register-step2').style.display = 'none';
                document.getElementById('register-step1').style.display = 'flex';
                loadPlaces();
                loadAdminData();
                activateTab('list-tab');
            } else {
                showToast(`수정 실패: ${data.error || '알 수 없는 오류'}`);
            }
        } else {
            const data = await callAppsScript('places', 'POST', formData);
            if (data.success) {
                showToast('장소가 등록되었습니다!');
                clearPlaceForm();
                document.getElementById('register-step2').style.display = 'none';
                document.getElementById('register-step1').style.display = 'flex';
                document.getElementById('place-search-input').value = '';
                document.getElementById('search-results').innerHTML = '';
                loadPlaces();
                activateTab('list-tab');
            } else {
                showToast('등록 실패: ' + (data.error || '알 수 없는 오류'));
            }
        }
    } catch (error) {
        console.error('장소 등록 실패:', error);
        showToast('등록 중 오류가 발생했습니다.');
    } finally { showLoading(false); }
}

// ===== 관리자 기능 =====
function initAdmin() {
    // 타이틀 더블클릭으로 관리자 진입
    document.getElementById('main-title').addEventListener('dblclick', () => {
        const modal = document.getElementById('admin-modal');
        modal.style.display = 'flex';
        document.getElementById('admin-password-input').value = '';
        document.getElementById('admin-password-input').focus();
    });

    document.getElementById('btn-admin-cancel').onclick = () => {
        document.getElementById('admin-modal').style.display = 'none';
    };
    document.getElementById('btn-admin-confirm').onclick = verifyAdmin;
    document.getElementById('admin-password-input').onkeydown = (e) => {
        if (e.key === 'Enter') verifyAdmin();
    };

    document.getElementById('btn-admin-close').onclick = () => {
        activateTab('recommend-tab');
    };

    document.getElementById('btn-save-register-pw').onclick = () =>
        saveConfig('register_password', document.getElementById('admin-register-pw').value);
    document.getElementById('btn-save-cron').onclick = () =>
        saveConfig('cron_time', document.getElementById('admin-cron-time').value);
    document.getElementById('btn-save-company-location').onclick = () => saveCompanyLocation();
    document.getElementById('btn-generate-daily').onclick = generateDailyManual;
}

async function verifyAdmin() {
    const pw = document.getElementById('admin-password-input').value;
    if (!pw) { showToast('비밀번호를 입력하세요.'); return; }
    showLoading(true);
    try {
        const data = await callAppsScript('admin-verify', 'POST', { password: pw });
        if (data.success) {
            document.getElementById('admin-modal').style.display = 'none';
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById('admin-tab').classList.add('active');
            const banner = document.getElementById('lunch-affiliate-banner');
            if (banner) banner.style.display = 'none';
            await loadAdminData();
            showToast('관리자 인증 완료');
        } else {
            showToast(data.error || '비밀번호가 일치하지 않습니다.');
        }
    } catch (e) {
        showToast('인증 중 오류가 발생했습니다.');
    } finally { showLoading(false); }
}

async function loadAdminData() {
    showLoading(true);
    try {
        const data = await callAppsScript('config', 'GET');
        if (data.success && data.data) {
            const configs = Array.isArray(data.data) ? data.data : [];
            const regPw = configs.find(c => c.key === 'register_password');
            const cron = configs.find(c => c.key === 'cron_time');
            const companyLat = configs.find(c => c.key === 'company_lat');
            const companyLng = configs.find(c => c.key === 'company_lng');
            if (regPw) document.getElementById('admin-register-pw').value = regPw.value || '';
            if (cron) document.getElementById('admin-cron-time').value = cron.value || '';
            const latEl = document.getElementById('admin-company-lat');
            const lngEl = document.getElementById('admin-company-lng');
            if (latEl) latEl.value = companyLat ? (companyLat.value || '') : '';
            if (lngEl) lngEl.value = companyLng ? (companyLng.value || '') : '';
        }
    } catch (e) { /* silent */ }

    // 장소 목록 로드
    try {
        const data = await callAppsScript('places', 'GET');
        if (data.success && data.data) {
            placesData = data.data; // 전역 변수에 저장
            const list = document.getElementById('admin-places-list');
            list.innerHTML = data.data.map(p => `
                <div class="admin-place-item" id="place-item-${p.place_id}">
                    <div class="admin-place-view">
                        <div>
                            <div class="place-name">${escapeHtml(p.name || '')}</div>
                            <div style="font-size:11px;color:#999;">${escapeHtml(p.category || '')} | ${escapeHtml(p.address_text || '')}</div>
                        </div>
                        <div>
                            <button class="btn-sm" onclick="editPlace('${p.place_id}')">수정</button>
                            <button class="btn-delete" onclick="deletePlace('${p.place_id}')">삭제</button>
                        </div>
                    </div>
                    <div class="admin-place-edit" id="place-edit-${p.place_id}" style="display:none;">
                        <div class="form-group">
                            <label>이름</label>
                            <input type="text" id="edit-name-${p.place_id}" value="${escapeAttr(p.name || '')}">
                        </div>
                        <div class="form-group">
                            <label>주소</label>
                            <input type="text" id="edit-address-${p.place_id}" value="${escapeAttr(p.address_text || '')}">
                        </div>
                        <div class="form-group">
                            <label>카테고리</label>
                            <input type="text" id="edit-category-${p.place_id}" value="${escapeAttr(p.category || '')}">
                        </div>
                        <div class="form-group">
                            <label>가격대</label>
                            <input type="text" id="edit-price-${p.place_id}" value="${escapeAttr(p.price_level || '')}">
                        </div>
                        <div class="form-group">
                            <label>도보시간 (분)</label>
                            <input type="number" id="edit-walk-${p.place_id}" value="${p.walk_min || 0}">
                        </div>
                        <div class="form-group">
                            <label>키워드</label>
                            <input type="text" id="edit-keywords-${p.place_id}" value="${escapeAttr(p.keywords || '')}">
                        </div>
                        <div class="form-group">
                            <label>태그</label>
                            <input type="text" id="edit-tags-${p.place_id}" value="${escapeAttr(p.tags || '')}">
                        </div>
                        <div class="form-group">
                            <label>이미지 URL</label>
                            <input type="text" id="edit-image-${p.place_id}" value="${escapeAttr(p.image_url || '')}">
                        </div>
                        <div class="form-group">
                            <label>네이버 지도 URL</label>
                            <input type="text" id="edit-naver-${p.place_id}" value="${escapeAttr(p.naver_map_url || '')}">
                        </div>
                        <div class="form-group">
                            <label>위도</label>
                            <input type="number" step="any" id="edit-lat-${p.place_id}" value="${p.lat || ''}">
                        </div>
                        <div class="form-group">
                            <label>경도</label>
                            <input type="number" step="any" id="edit-lng-${p.place_id}" value="${p.lng || ''}">
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="edit-solo-${p.place_id}" ${p.solo_ok ? 'checked' : ''}>
                                혼밥 가능
                            </label>
                            <label>
                                <input type="checkbox" id="edit-group-${p.place_id}" ${p.group_ok ? 'checked' : ''}>
                                단체 가능
                            </label>
                            <label>
                                <input type="checkbox" id="edit-reservation-${p.place_id}" ${p.reservation_ok ? 'checked' : ''}>
                                예약 가능
                            </label>
                        </div>
                        <div class="form-row">
                            <button class="btn-primary" onclick="savePlace('${p.place_id}')">저장</button>
                            <button class="btn-secondary" onclick="cancelEditPlace('${p.place_id}')">취소</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) { /* silent */ } finally { showLoading(false); }
}

function editPlace(placeId) {
    // 장소 데이터 찾기
    const place = placesData.find(p => p.place_id === placeId);
    if (!place) {
        showToast('장소 정보를 찾을 수 없습니다.');
        return;
    }
    
    // 수정 모드 설정
    editMode = true;
    editingPlaceId = placeId;
    
    // 등록 탭으로 전환
    activateTab('register-tab');
    
    // STEP2 화면 표시
    document.getElementById('register-step1').style.display = 'none';
    document.getElementById('register-step2').style.display = 'flex';
    
    // 폼에 데이터 채우기
    document.getElementById('place-name').value = place.name || '';
    document.getElementById('place-address').value = place.address_text || '';
    document.getElementById('place-map-url').value = place.naver_map_url || '';
    document.getElementById('place-price').value = place.price_level || '';
    document.getElementById('place-walk').value = place.walk_min || 0;
    document.getElementById('place-lat').value = place.lat || '';
    document.getElementById('place-lng').value = place.lng || '';
    
    // 카테고리 선택
    selectedCategory = place.category || '';
    if (selectedCategory) {
        document.querySelectorAll('.cat-select').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-value') === selectedCategory) {
                btn.classList.add('active');
            }
        });
        document.getElementById('place-category').value = selectedCategory;
    }
    
    // 특징 키워드 선택
    selectedFeatures = {
        solo_ok: place.solo_ok || false,
        group_ok: place.group_ok || false,
        reservation_ok: place.reservation_ok || false
    };
    document.querySelectorAll('.feat-select').forEach(btn => {
        const feat = btn.getAttribute('data-feat');
        btn.classList.remove('active');
        if (selectedFeatures[feat]) {
            btn.classList.add('active');
        }
    });
    
    // 태그 채우기
    currentTags = place.tags ? place.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    renderTags();
    
    // 이미지 URL이 있으면 미리보기 표시
    if (place.image_url) {
        document.getElementById('image-preview').src = getDisplayImageUrl(place.image_url);
        document.getElementById('image-preview').style.display = 'block';
        document.getElementById('image-placeholder').style.display = 'none';
        imageBase64 = ''; // 기존 이미지는 URL만 사용
    } else {
        document.getElementById('image-preview').style.display = 'none';
        document.getElementById('image-placeholder').style.display = 'flex';
        imageBase64 = '';
    }
    
    // 버튼 텍스트 변경
    const submitBtn = document.querySelector('#place-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i data-lucide="check-circle" class="btn-icon"></i> 수정 완료하기';
        lucide.createIcons();
    }
    
    // 지도 미리보기 업데이트
    if (place.lat && place.lng) {
        updateMapPreview(place.lat, place.lng);
    }
}

function cancelEditPlace(placeId) {
    const viewDiv = document.querySelector(`#place-item-${placeId} .admin-place-view`);
    const editDiv = document.getElementById(`place-edit-${placeId}`);
    if (viewDiv && editDiv) {
        viewDiv.style.display = 'flex';
        editDiv.style.display = 'none';
    }
}

async function savePlace(placeId) {
    showLoading(true);
    try {
        const data = {
            name: document.getElementById(`edit-name-${placeId}`).value,
            address_text: document.getElementById(`edit-address-${placeId}`).value,
            category: document.getElementById(`edit-category-${placeId}`).value,
            price_level: document.getElementById(`edit-price-${placeId}`).value,
            walk_min: parseInt(document.getElementById(`edit-walk-${placeId}`).value) || 0,
            keywords: document.getElementById(`edit-keywords-${placeId}`).value,
            tags: document.getElementById(`edit-tags-${placeId}`).value,
            image_url: document.getElementById(`edit-image-${placeId}`).value,
            naver_map_url: document.getElementById(`edit-naver-${placeId}`).value,
            lat: parseFloat(document.getElementById(`edit-lat-${placeId}`).value) || null,
            lng: parseFloat(document.getElementById(`edit-lng-${placeId}`).value) || null,
            solo_ok: document.getElementById(`edit-solo-${placeId}`).checked,
            group_ok: document.getElementById(`edit-group-${placeId}`).checked,
            reservation_ok: document.getElementById(`edit-reservation-${placeId}`).checked
        };
        
        console.log('[savePlace] 수정 요청:', { placeId, data });
        
        const result = await callAppsScript(`places/${placeId}`, 'PUT', data);
        console.log('[savePlace] 응답:', result);
        
        if (result.success) {
            showToast('수정 완료');
            loadAdminData();
            loadPlaces();
        } else {
            const errorMsg = result.error || '알 수 없는 오류';
            console.error('[savePlace] 수정 실패:', errorMsg);
            showToast(`수정 실패: ${errorMsg}`);
        }
    } catch (e) {
        console.error('[savePlace] 예외 발생:', e);
        showToast(`수정 중 오류: ${e.message || '네트워크 오류'}`);
    } finally {
        showLoading(false);
    }
}

async function saveConfig(key, value) {
    if (!value) { showToast('값을 입력하세요.'); return; }
    showLoading(true);
    try {
        const data = await callAppsScript('config', 'POST', { key, value });
        if (data.success) {
            showToast('저장 완료');
            // 크론 시간 저장 시 서버에 반영 요청 (관리자 화면 설정이 자동 적용되도록)
            if (key === 'cron_time' && API_BASE_URL && !String(API_BASE_URL).startsWith('__')) {
                try {
                    const base = API_BASE_URL.replace(/\/$/, '');
                    const res = await fetch(`${base}/lunch/admin/reload-daily-cron`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                    const json = await res.json();
                    if (json.success && json.cron) showToast('저장 완료. 서버 스케줄 반영됨: ' + json.cron);
                } catch (e) { /* 서버 반영 실패해도 저장은 완료됨 */ }
            }
        } else showToast('저장 실패');
    } catch (e) { showToast('저장 중 오류'); }
    finally { showLoading(false); }
}

async function saveCompanyLocation() {
    const latVal = document.getElementById('admin-company-lat').value.trim();
    const lngVal = document.getElementById('admin-company-lng').value.trim();
    showLoading(true);
    try {
        await callAppsScript('config', 'POST', { key: 'company_lat', value: latVal || '' });
        await callAppsScript('config', 'POST', { key: 'company_lng', value: lngVal || '' });
        showToast('저장 완료');
        if (API_BASE_URL && !String(API_BASE_URL).startsWith('__')) {
            try {
                const base = API_BASE_URL.replace(/\/$/, '');
                await fetch(`${base}/lunch/admin/reload-origin`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            } catch (e) { /* 서버 반영 실패해도 저장은 완료됨 */ }
        }
    } catch (e) {
        showToast('저장 중 오류');
    } finally {
        showLoading(false);
    }
}

async function generateDailyManual() {
    showLoading(true);
    try {
        const data = await callAppsScript('generate-daily', 'POST', { text: '오늘의 점심 추천' });
        if (data.success) showToast('일일 추천이 생성되었습니다.');
        else showToast('생성 실패: ' + (data.error || ''));
    } catch (e) { showToast('생성 중 오류'); }
    finally { showLoading(false); }
}

async function deletePlace(placeId) {
    if (!confirm('이 장소를 삭제하면 연결된 모든 리뷰도 함께 삭제됩니다. 계속하시겠습니까?')) return;
    showLoading(true);
    try {
        const data = await callAppsScript(`places/${placeId}`, 'DELETE');
        
        if (data.success) {
            showToast('삭제 완료');
            loadAdminData();
            loadPlaces();
        } else {
            const errorMsg = data.error || '알 수 없는 오류';
            console.error('[deletePlace] 삭제 실패:', errorMsg);
            showToast(`삭제 실패: ${errorMsg}`);
        }
    } catch (e) { 
        console.error('[deletePlace] 예외 발생:', e);
        showToast(`삭제 중 오류: ${e.message || '네트워크 오류'}`);
    }
    finally { showLoading(false); }
}

// ===== 유틸리티 =====
function showLoading(show) { document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; }
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}
// 이미지 URL 변환 (구글 드라이브 -> lh3)
function getDisplayImageUrl(url) {
    if (!url) return '';
    // 구글 드라이브 uc?id= 형식인 경우 lh3 링크로 변환
    if (url.includes('drive.google.com/uc?id=')) {
        return url.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/');
    }
    return url;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function escapeAttr(text) {
    return String(text).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ===== 리뷰 기능 =====
let currentReviewPlaceId = null;
let currentReviewVerdict = null;

function initReview() {
    const commentEl = document.getElementById('review-comment');
    if (commentEl) {
        commentEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submitReview();
            }
        });
    }
}

function openReviewModal(placeId, placeName, verdict) {
    currentReviewPlaceId = placeId;
    currentReviewVerdict = verdict;
    const modal = document.getElementById('review-modal');
    const placeNameEl = document.getElementById('review-place-name');
    const commentEl = document.getElementById('review-comment');
    
    if (placeNameEl) placeNameEl.textContent = placeName;
    if (commentEl) commentEl.value = '';
    
    modal.style.display = 'flex';
    setTimeout(() => {
        if (commentEl) commentEl.focus();
    }, 100);
}

async function submitReview() {
    const commentEl = document.getElementById('review-comment');
    const comment = (commentEl?.value || '').trim();
    
    if (!comment) {
        showToast('코멘트를 입력해주세요.');
        return;
    }
    
    if (!currentReviewPlaceId || !currentReviewVerdict) {
        showToast('오류가 발생했습니다.');
        return;
    }
    
    showLoading(true);
    try {
        const data = await callAppsScript('reviews', 'POST', {
            place_id: currentReviewPlaceId,
            verdict: currentReviewVerdict,
            comment: comment
        });
        
        if (data.success) {
            document.getElementById('review-modal').style.display = 'none';
            showToast('리뷰가 등록되었습니다.');
            loadPlaces(); // 목록 갱신하여 카운트 업데이트
        } else {
            showToast(data.error || '리뷰 등록에 실패했습니다.');
        }
    } catch (e) {
        console.error('[submitReview] 오류:', e);
        showToast('리뷰 등록 중 오류가 발생했습니다.');
    } finally {
        showLoading(false);
    }
}

function cancelReview() {
    document.getElementById('review-modal').style.display = 'none';
    currentReviewPlaceId = null;
    currentReviewVerdict = null;
}

// 전역 함수 노출
window.openMap = openMap;
window.removeTag = removeTag;
window.deletePlace = deletePlace;
window.editPlace = editPlace;
window.cancelEditPlace = cancelEditPlace;
window.savePlace = savePlace;
window.openReviewModal = openReviewModal;
window.submitReview = submitReview;
window.cancelReview = cancelReview;
