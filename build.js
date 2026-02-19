/**
 * Vercel 빌드 시 환경변수(APPS_SCRIPT_URL, API_BASE_URL)를 index.html에 주입합니다.
 * 로컬: node build.js 로 빌드하거나, index.html을 직접 열면 placeholder 그대로라 에러 날 수 있음.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
const API_BASE_URL = process.env.API_BASE_URL || 'https://myteamdashboard.onrender.com';

fs.mkdirSync(dist, { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/__APPS_SCRIPT_URL__/g, APPS_SCRIPT_URL);
html = html.replace(/__API_BASE_URL__/g, API_BASE_URL);
fs.writeFileSync(path.join(dist, 'index.html'), html);

['lunch.js', 'lunch.css', 'icon-192.png', 'manifest.json'].forEach((file) => {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(dist, file));
  }
});

console.log('Build done. APPS_SCRIPT_URL:', APPS_SCRIPT_URL ? 'set' : '(empty)');
