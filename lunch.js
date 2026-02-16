// API 기본 URL 설정
const API_BASE_URL = window.API_BASE_URL || 'https://myteamdashboard.onrender.com';

// 전역 상태
let selectedPresets = [];
let excludedPlaces = [];
let currentTags = [];
let selectedCategory = '';
let selectedFeatures = { solo_ok: false, group_ok: false, indoor_ok: false };
let imageBase64 = '';
let currentFilterCat = '전체';
let registerAuthenticated = false;
let editMode = false;
let editingPlaceId = null;
let placesData = []; // 관리자 페이지에서 사용할 장소 데이터

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initRecommend();
    initList();
    initRegister();
    initAdmin();
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

            if (targetTab === 'register-tab' && !registerAuthenticated) {
                if (sessionStorage.getItem('register_auth') === 'true') {
                    registerAuthenticated = true;
                } else {
                    showPasswordModal();
                    return;
                }
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
}

// ===== 암호 모달 =====
function showPasswordModal() {
    const modal = document.getElementById('password-modal');
    modal.style.display = 'flex';
    document.getElementById('register-password-input').value = '';
    document.getElementById('register-password-input').focus();

    document.getElementById('btn-pw-cancel').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('btn-pw-confirm').onclick = () => verifyRegisterPassword();
    document.getElementById('register-password-input').onkeydown = (e) => {
        if (e.key === 'Enter') verifyRegisterPassword();
    };
}

async function verifyRegisterPassword() {
    const pw = document.getElementById('register-password-input').value;
    if (!pw) { showToast('암호를 입력하세요.'); return; }
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/lunch/verify-register-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        const data = await res.json();
        if (data.success) {
            registerAuthenticated = true;
            sessionStorage.setItem('register_auth', 'true');
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
        await requestRecommendation(text, selectedPresets, excludedPlaces);
    });
}

async function requestRecommendation(text, preset = [], exclude = []) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/lunch/recommend`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, preset, exclude })
        });
        const data = await response.json();
        if (data.success && data.data?.length > 0) {
            displayRecommendations(data.data, 'recommend-results');
        } else {
            document.getElementById('recommend-results').innerHTML =
                '<div class="empty-state"><i data-lucide="frown"></i><div class="empty-state-text">추천 결과가 없습니다</div></div>';
            lucide.createIcons();
        }
    } catch (error) {
        console.error('추천 요청 실패:', error);
        showToast('추천 요청 중 오류가 발생했습니다.');
    } finally { showLoading(false); }
}

async function loadDailyRecommendations() {
    try {
        const res = await fetch(`${API_BASE_URL}/lunch/daily-recommendations`);
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
            const section = document.getElementById('daily-section');
            section.style.display = 'block';
            const today = new Date();
            document.getElementById('daily-date').textContent =
                `${today.getMonth()+1}/${today.getDate()} 추천`;
            displayRecommendations(data.data, 'daily-results');
        }
    } catch (e) { /* silent */ }
}

function displayRecommendations(recommendations, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = recommendations.map((place, index) => {
        const imgHtml = place.image_url
            ? `<img class="place-card-img" src="${escapeHtml(place.image_url)}" alt="${escapeHtml(place.name)}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\"place-card-img-placeholder\"><i data-lucide=\"utensils-crossed\"></i></div>'">`
            : '<div class="place-card-img-placeholder"><i data-lucide="utensils-crossed"></i></div>';
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
                        <button class="btn-secondary btn-exclude" onclick="excludePlace('${place.place_id}')"><i data-lucide="x-circle"></i> 제외</button>
                    </div>
                </div>
            </div>`;
    }).join('');
    lucide.createIcons();
}

function openMap(url) { window.open(url, '_blank'); }

function excludePlace(placeId) {
    if (!excludedPlaces.includes(placeId)) excludedPlaces.push(placeId);
    const text = document.getElementById('recommend-text').value.trim();
    if (text) requestRecommendation(text, selectedPresets, excludedPlaces);
    showToast('제외 목록에 추가되었습니다.');
}

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
    try {
        const response = await fetch(`${API_BASE_URL}/lunch/places`);
        const data = await response.json();
        if (data.success && data.data) {
            window.allPlaces = data.data;
            displayPlaces(data.data);
        }
    } catch (error) { console.error('장소 목록 로드 실패:', error); }
}

function displayPlaces(places) {
    const placesList = document.getElementById('places-list');
    if (!places || places.length === 0) {
        placesList.innerHTML = '<div class="empty-state"><i data-lucide="inbox"></i><div class="empty-state-text">등록된 장소가 없습니다</div></div>';
        lucide.createIcons();
        return;
    }
    placesList.innerHTML = places.map(place => {
        const imgHtml = place.image_url
            ? `<img class="place-card-img" src="${escapeHtml(place.image_url)}" alt="${escapeHtml(place.name)}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\"place-card-img-placeholder\"><i data-lucide=\"utensils-crossed\"></i></div>'">`
            : '<div class="place-card-img-placeholder"><i data-lucide="utensils-crossed"></i></div>';
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
                    </div>
                </div>
            </div>`;
    }).join('');
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

    // 태그 입력
    document.getElementById('tag-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            e.stopPropagation(); // 이벤트 전파 방지
            addTag(); 
        }
    });
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

        document.getElementById('place-name').value = item.name || '';
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
    selectedFeatures = { solo_ok: false, group_ok: false, indoor_ok: false };
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
    if (isAddingTag) return; // 이미 실행 중이면 무시
    isAddingTag = true;
    
    const input = document.getElementById('tag-input');
    const tag = input.value.trim().replace(/^#/, '');
    
    // 입력값이 비어있거나 공백만 있으면 무시
    if (!tag || tag.length === 0) {
        isAddingTag = false;
        return;
    }
    
    // 중복 태그 체크
    if (!currentTags.includes(tag)) {
        currentTags.push(tag);
        renderTags();
    }
    
    input.value = '';
    isAddingTag = false;
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
        indoor_ok: selectedFeatures.indoor_ok,
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
                    filename: `${formData.name}.jpg` 
                };
                // 수정 모드일 때 placeId 전달 (Apps Script에서 직접 시트 업데이트 가능)
                if (editMode && editingPlaceId) {
                    uploadPayload.place_id = editingPlaceId;
                }
                const imgRes = await fetch(`${API_BASE_URL}/lunch/upload-image`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(uploadPayload)
                });
                
                if (!imgRes.ok) {
                    console.error('이미지 업로드 HTTP 오류:', imgRes.status, imgRes.statusText);
                    showToast('이미지 업로드에 실패했습니다. 이미지 없이 등록됩니다.');
                } else {
                    const imgData = await imgRes.json();
                    if (imgData.success && imgData.data?.image_url) {
                        formData.image_url = imgData.data.image_url;
                        console.log('이미지 업로드 성공:', imgData.data.image_url);
                    } else {
                        console.error('이미지 업로드 실패:', imgData.error || '알 수 없는 오류');
                        showToast('이미지 업로드에 실패했습니다. 이미지 없이 등록됩니다.');
                    }
                }
            } catch (e) { 
                console.error('이미지 업로드 네트워크 오류:', e);
                showToast('이미지 업로드 중 오류가 발생했습니다. 이미지 없이 등록됩니다.');
            }
        }

        // 수정 모드인지 확인
        if (editMode && editingPlaceId) {
            // 수정 요청 (PUT)
            const response = await fetch(`${API_BASE_URL}/lunch/admin/places/${editingPlaceId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                console.error('[submitPlace] HTTP 오류:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('[submitPlace] 응답 본문:', errorText);
                showToast(`수정 실패: HTTP ${response.status} ${response.statusText}`);
                return;
            }
            
            const data = await response.json();
            console.log('[submitPlace] 수정 응답:', data);
            
            if (data.success) {
                showToast('수정 완료');
                clearPlaceForm();
                document.getElementById('register-step2').style.display = 'none';
                document.getElementById('register-step1').style.display = 'flex';
                loadPlaces();
                loadAdminData(); // 관리자 페이지 목록도 새로고침
                activateTab('list-tab');
            } else {
                const errorMsg = data.error || '알 수 없는 오류';
                console.error('[submitPlace] 수정 실패:', errorMsg);
                showToast(`수정 실패: ${errorMsg}`);
            }
        } else {
            // 등록 요청 (POST)
            const response = await fetch(`${API_BASE_URL}/lunch/places`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
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
    document.getElementById('btn-generate-daily').onclick = generateDailyManual;
}

async function verifyAdmin() {
    const pw = document.getElementById('admin-password-input').value;
    if (!pw) { showToast('비밀번호를 입력하세요.'); return; }
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/lunch/admin/verify`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('admin-modal').style.display = 'none';
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById('admin-tab').classList.add('active');
            loadAdminData();
            showToast('관리자 인증 완료');
        } else {
            showToast(data.error || '비밀번호가 일치하지 않습니다.');
        }
    } catch (e) {
        showToast('인증 중 오류가 발생했습니다.');
    } finally { showLoading(false); }
}

async function loadAdminData() {
    try {
        const res = await fetch(`${API_BASE_URL}/lunch/admin/config`);
        const data = await res.json();
        if (data.success && data.data) {
            const configs = Array.isArray(data.data) ? data.data : [];
            const regPw = configs.find(c => c.key === 'register_password');
            const cron = configs.find(c => c.key === 'cron_time');
            if (regPw) document.getElementById('admin-register-pw').value = regPw.value || '';
            if (cron) document.getElementById('admin-cron-time').value = cron.value || '';
        }
    } catch (e) { /* silent */ }

    // 장소 목록 로드
    try {
        const res = await fetch(`${API_BASE_URL}/lunch/places`);
        const data = await res.json();
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
                                <input type="checkbox" id="edit-indoor-${p.place_id}" ${p.indoor_ok ? 'checked' : ''}>
                                실내 가능
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
    } catch (e) { /* silent */ }
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
        indoor_ok: place.indoor_ok || false
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
        document.getElementById('image-preview').src = place.image_url;
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
            indoor_ok: document.getElementById(`edit-indoor-${placeId}`).checked
        };
        
        console.log('[savePlace] 수정 요청:', { placeId, data });
        
        const res = await fetch(`${API_BASE_URL}/lunch/admin/places/${placeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!res.ok) {
            console.error('[savePlace] HTTP 오류:', res.status, res.statusText);
            const errorText = await res.text();
            console.error('[savePlace] 응답 본문:', errorText);
            showToast(`수정 실패: HTTP ${res.status} ${res.statusText}`);
            return;
        }
        
        const result = await res.json();
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
        const res = await fetch(`${API_BASE_URL}/lunch/admin/config`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });
        const data = await res.json();
        if (data.success) showToast('저장 완료');
        else showToast('저장 실패');
    } catch (e) { showToast('저장 중 오류'); }
    finally { showLoading(false); }
}

async function generateDailyManual() {
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/lunch/admin/generate-daily`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '오늘의 점심 추천' })
        });
        const data = await res.json();
        if (data.success) showToast('일일 추천이 생성되었습니다.');
        else showToast('생성 실패: ' + (data.error || ''));
    } catch (e) { showToast('생성 중 오류'); }
    finally { showLoading(false); }
}

async function deletePlace(placeId) {
    if (!confirm('이 장소를 삭제하시겠습니까?')) return;
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/lunch/admin/places/${placeId}`, { method: 'DELETE' });
        
        if (!res.ok) {
            console.error('[deletePlace] HTTP 오류:', res.status, res.statusText);
            const errorText = await res.text();
            console.error('[deletePlace] 응답 본문:', errorText);
            showToast(`삭제 실패: HTTP ${res.status} ${res.statusText}`);
            return;
        }
        
        const data = await res.json();
        console.log('[deletePlace] 응답:', data);
        
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
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function escapeAttr(text) {
    return String(text).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// 전역 함수 노출
window.openMap = openMap;
window.excludePlace = excludePlace;
window.removeTag = removeTag;
window.deletePlace = deletePlace;
window.editPlace = editPlace;
window.cancelEditPlace = cancelEditPlace;
window.savePlace = savePlace;
