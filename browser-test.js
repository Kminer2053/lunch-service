const { chromium } = require('playwright');

const FRONTEND_URL = 'https://lunch-service.vercel.app';
const BACKEND_URL = 'https://myteamdashboard.onrender.com';

async function runTests() {
    console.log('🚀 브라우저 자동화 테스트 시작...\n');
    
    const browser = await chromium.launch({ 
        headless: true, // 헤드리스 모드로 실행 (백그라운드)
        slowMo: 100 // 동작 속도 조절
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    // 콘솔 로그 캡처
    const consoleLogs = [];
    page.on('console', msg => {
        const text = msg.text();
        consoleLogs.push({ type: msg.type(), text });
        if (msg.type() === 'error') {
            console.error(`[브라우저 콘솔 에러] ${text}`);
        }
    });
    
    // 네트워크 요청 모니터링
    const networkErrors = [];
    page.on('response', response => {
        if (response.status() >= 400) {
            networkErrors.push({
                url: response.url(),
                status: response.status(),
                statusText: response.statusText()
            });
            console.error(`[네트워크 에러] ${response.status()} ${response.url()}`);
        }
    });
    
    const results = {
        test1_tagInput: { passed: false, error: null },
        test2_passwordModal: { passed: false, error: null },
        test3_passwordValidation: { passed: false, error: null },
        test4_imageUpload: { passed: false, error: null },
        test5_adminDelete: { passed: false, error: null },
        test6_adminEditUI: { passed: false, error: null },
        test7_adminEditSave: { passed: false, error: null },
        test8_imageEdit: { passed: false, error: null }
    };
    
    try {
        console.log('📱 프론트엔드 접속 중...');
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000); // 페이지 로딩 대기
        
        console.log('✅ 페이지 로드 완료\n');
        
        // 테스트 1: 태그 입력 중복 생성 버그 수정 확인
        console.log('🧪 테스트 1: 태그 입력 중복 생성 버그 수정 확인');
        try {
            // 세션 스토리지 초기화
            await page.evaluate(() => sessionStorage.clear());
            
            // 등록 탭 클릭
            await page.click('button[data-tab="register-tab"]');
            await page.waitForTimeout(1000);
            
            // 비밀번호 모달이 나타날 때까지 대기
            await page.waitForSelector('#password-modal', { state: 'visible', timeout: 5000 }).catch(() => {});
            
            // 비밀번호 모달이 있으면 닫기 (테스트를 위해 스킵)
            const passwordModal = await page.$('#password-modal');
            if (passwordModal) {
                const modalDisplay = await passwordModal.evaluate(el => window.getComputedStyle(el).display);
                if (modalDisplay === 'flex') {
                    // 취소 버튼 클릭하여 모달 닫기
                    await page.click('#btn-pw-cancel').catch(() => {});
                    await page.waitForTimeout(500);
                }
            }
            
            // STEP1에서 수동 입력 버튼 클릭하여 STEP2로 이동
            const manualBtn = await page.$('#btn-manual-entry');
            if (manualBtn) {
                await manualBtn.click();
                await page.waitForTimeout(1000);
            }
            
            // STEP2 화면이 표시되는지 확인
            const step2 = await page.$('#register-step2');
            if (!step2) {
                results.test1_tagInput.error = 'STEP2 화면을 찾을 수 없습니다';
                console.log(`❌ 테스트 1 실패: ${results.test1_tagInput.error}`);
            } else {
                const step2Display = await step2.evaluate(el => window.getComputedStyle(el).display);
                if (step2Display === 'none') {
                    results.test1_tagInput.error = 'STEP2 화면이 표시되지 않습니다';
                    console.log(`❌ 테스트 1 실패: ${results.test1_tagInput.error}`);
                } else {
                    // 태그 입력 필드 찾기 및 대기
                    await page.waitForSelector('#tag-input', { state: 'visible', timeout: 5000 });
                    const tagInput = await page.$('#tag-input');
                    
                    if (tagInput) {
                        // 기존 태그 개수 확인
                        const tagsBefore = await page.$$eval('.tag-pill', tags => tags.map(t => t.textContent.trim()));
                        
                        // 태그 입력
                        await tagInput.fill('가정식백반');
                        await page.keyboard.press('Enter');
                        await page.waitForTimeout(1000);
                        
                        // 태그가 하나만 생성되었는지 확인
                        const tagsAfter = await page.$$eval('.tag-pill', tags => tags.map(t => t.textContent.trim()));
                        const newTags = tagsAfter.filter(t => !tagsBefore.includes(t));
                        const targetTag = newTags.find(t => t.includes('가정식백반'));
                        const duplicateTag = newTags.find(t => t === '#반' || t === '반');
                        
                        if (targetTag && !duplicateTag && newTags.length === 1) {
                            results.test1_tagInput.passed = true;
                            console.log('✅ 테스트 1 통과: 태그가 하나만 생성됨');
                            console.log(`   생성된 태그: ${newTags.join(', ')}`);
                        } else {
                            results.test1_tagInput.error = `태그 중복 생성됨. 생성된 태그: ${newTags.join(', ')}, 개수: ${newTags.length}`;
                            console.log(`❌ 테스트 1 실패: ${results.test1_tagInput.error}`);
                        }
                    } else {
                        results.test1_tagInput.error = '태그 입력 필드를 찾을 수 없습니다';
                        console.log(`❌ 테스트 1 실패: ${results.test1_tagInput.error}`);
                    }
                }
            }
        } catch (error) {
            results.test1_tagInput.error = error.message;
            console.log(`❌ 테스트 1 실패: ${error.message}`);
        }
        
        console.log('');
        
        // 테스트 2: 비밀번호 모달 표시 확인
        console.log('🧪 테스트 2: 비밀번호 모달 표시 확인');
        try {
            // 세션 스토리지 초기화
            await page.evaluate(() => sessionStorage.clear());
            
            // 다른 탭으로 이동 후 등록 탭 클릭
            await page.click('button[data-tab="recommend-tab"]');
            await page.waitForTimeout(500);
            await page.click('button[data-tab="register-tab"]');
            
            // 모달이 표시될 때까지 대기 (최대 3초)
            try {
                await page.waitForSelector('#password-modal[style*="display: flex"], #password-modal[style*="display:flex"]', { timeout: 3000 });
                
                const modal = await page.$('#password-modal');
                if (modal) {
                    const modalDisplay = await modal.evaluate(el => window.getComputedStyle(el).display);
                    const zIndex = await modal.evaluate(el => window.getComputedStyle(el).zIndex);
                    
                    if (modalDisplay === 'flex' && parseInt(zIndex) >= 900) {
                        results.test2_passwordModal.passed = true;
                        console.log('✅ 테스트 2 통과: 비밀번호 모달이 정상적으로 표시됨');
                        console.log(`   display: ${modalDisplay}, zIndex: ${zIndex}`);
                    } else {
                        results.test2_passwordModal.error = `모달 표시 문제. display: ${modalDisplay}, zIndex: ${zIndex}`;
                        console.log(`❌ 테스트 2 실패: ${results.test2_passwordModal.error}`);
                    }
                } else {
                    results.test2_passwordModal.error = '비밀번호 모달 요소를 찾을 수 없습니다';
                    console.log(`❌ 테스트 2 실패: ${results.test2_passwordModal.error}`);
                }
            } catch (waitError) {
                // 모달이 표시되지 않음
                const modal = await page.$('#password-modal');
                if (modal) {
                    const modalDisplay = await modal.evaluate(el => window.getComputedStyle(el).display);
                    results.test2_passwordModal.error = `모달이 표시되지 않음. display: ${modalDisplay}`;
                } else {
                    results.test2_passwordModal.error = '비밀번호 모달 요소를 찾을 수 없습니다';
                }
                console.log(`❌ 테스트 2 실패: ${results.test2_passwordModal.error}`);
            }
        } catch (error) {
            results.test2_passwordModal.error = error.message;
            console.log(`❌ 테스트 2 실패: ${error.message}`);
        }
        
        console.log('');
        
        // 테스트 3: 비밀번호 검증 실패 처리 확인
        console.log('🧪 테스트 3: 비밀번호 검증 실패 처리 확인');
        try {
            const modal = await page.$('#password-modal');
            if (modal) {
                const modalDisplay = await modal.evaluate(el => window.getComputedStyle(el).display);
                if (modalDisplay === 'flex') {
                    // 잘못된 비밀번호 입력
                    const passwordInput = await page.$('#register-password-input');
                    if (passwordInput) {
                        await passwordInput.fill('wrongpassword');
                        await page.click('#btn-pw-confirm');
                        await page.waitForTimeout(2000);
                        
                        // 모달이 닫혔는지 확인
                        const modalAfter = await page.$('#password-modal');
                        const modalDisplayAfter = await modalAfter.evaluate(el => window.getComputedStyle(el).display);
                        
                        // 현재 활성화된 탭 확인
                        const activeTab = await page.$eval('.tab-content.active', el => el.id);
                        
                        if (modalDisplayAfter === 'none' && activeTab !== 'register-tab') {
                            results.test3_passwordValidation.passed = true;
                            console.log('✅ 테스트 3 통과: 비밀번호 검증 실패 시 모달이 닫히고 이전 탭으로 복귀');
                        } else {
                            results.test3_passwordValidation.error = `모달이 닫히지 않았거나 등록 탭으로 이동함. display: ${modalDisplayAfter}, activeTab: ${activeTab}`;
                            console.log(`❌ 테스트 3 실패: ${results.test3_passwordValidation.error}`);
                        }
                    }
                }
            }
        } catch (error) {
            results.test3_passwordValidation.error = error.message;
            console.log(`❌ 테스트 3 실패: ${error.message}`);
        }
        
        console.log('');
        
        // 나머지 테스트들은 실제 데이터와 상호작용이 필요하므로 스킵
        console.log('⚠️  테스트 4-8은 실제 데이터와 상호작용이 필요하여 수동 테스트가 필요합니다.');
        console.log('   - 테스트 4: 이미지 업로드 (실제 파일 선택 필요)');
        console.log('   - 테스트 5-8: 관리자 기능 (실제 데이터 필요)');
        
    } catch (error) {
        console.error('❌ 테스트 실행 중 오류:', error);
    } finally {
        console.log('\n📊 테스트 결과 요약:');
        console.log('='.repeat(50));
        Object.entries(results).forEach(([test, result]) => {
            const status = result.passed ? '✅ 통과' : (result.error ? '❌ 실패' : '⏳ 미실행');
            console.log(`${test}: ${status}`);
            if (result.error) {
                console.log(`  오류: ${result.error}`);
            }
        });
        console.log('='.repeat(50));
        
        if (networkErrors.length > 0) {
            console.log('\n⚠️  네트워크 에러:');
            networkErrors.forEach(err => {
                console.log(`  - ${err.status} ${err.url}`);
            });
        }
        
        if (consoleLogs.some(log => log.type === 'error')) {
            console.log('\n⚠️  브라우저 콘솔 에러:');
            consoleLogs.filter(log => log.type === 'error').forEach(log => {
                console.log(`  - ${log.text}`);
            });
        }
        
        // 결과를 파일로 저장
        const fs = require('fs');
        const testResults = {
            timestamp: new Date().toISOString(),
            results: results,
            networkErrors: networkErrors,
            consoleErrors: consoleLogs.filter(log => log.type === 'error').map(log => log.text)
        };
        fs.writeFileSync('browser-test-results.json', JSON.stringify(testResults, null, 2));
        console.log('\n테스트 결과가 browser-test-results.json 파일에 저장되었습니다.');
        
        await browser.close();
    }
}

runTests().catch(console.error);
