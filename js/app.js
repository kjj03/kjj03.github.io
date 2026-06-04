// js/app.js
import { auth, loginWithGoogle, logoutUser, onAuthStateChanged, saveToCloud, loadFromCloud } from './firebase-auth.js';
import { saveGeminiKey, getGeminiKey } from './gemini-engine.js';

const APP_ID = 'ai_study_v26_06b';
let currentUser = null;

// ==========================================
// 1. 화면 탭 전환 로직 (가장 중요)
// ==========================================
window.changeDashboardTab = function(id) {
  const views = ["profile", "subjects", "generate", "storage", "settings"];
  
  views.forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    
    if (view) view.classList.add('hidden');
    if (btn) btn.className = "px-2.5 py-1.5 rounded-lg text-xs font-black transition-all text-slate-400 hover:text-white";
  });

  const activeView = document.getElementById(`view-${id}`);
  if (activeView) activeView.classList.remove('hidden');

  const activeBtn = document.getElementById(`tab-btn-${id}`);
  if (activeBtn) {
    activeBtn.className = id === 'settings' 
      ? "px-2.5 py-1.5 rounded-lg text-xs font-black transition-all text-emerald-400 bg-emerald-500/20"
      : "px-2.5 py-1.5 rounded-lg text-xs font-black transition-all text-indigo-400 bg-slate-900 shadow-inner";
  }
};

// ==========================================
// 2. 초기 세팅 및 로그인 이벤트 연동
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // 처음 사이트 접속 시 프로필 탭 강제 열기
  window.changeDashboardTab("profile");

  // API 키 불러오기 세팅
  const apiKeyInput = document.getElementById('api-key-input');
  if (apiKeyInput) apiKeyInput.value = getGeminiKey();
  
  document.getElementById('save-api-key-btn')?.addEventListener('click', () => {
    saveGeminiKey(document.getElementById('api-key-input').value);
    alert('✅ AI API 키가 로컬에 안전하게 저장되었습니다.');
  });

  // 구글 로그인/로그아웃 버튼 클릭 이벤트
  const authBtn = document.getElementById('auth-action-btn');
  if (authBtn) {
    authBtn.addEventListener('click', async () => {
      if (currentUser) {
        await logoutUser();
      } else {
        try {
          await loginWithGoogle();
        } catch(e) {
          alert("로그인 중 에러 발생: " + e.message);
        }
      }
    });
  }
});

// ==========================================
// 3. 구글 계정 로그인 상태 감지기
// ==========================================
onAuthStateChanged(auth, async (user) => {
  const nameLabel = document.getElementById('profile-user-name');
  const emailLabel = document.getElementById('profile-user-email');
  const authBtn = document.getElementById('auth-action-btn');
  const syncStatus = document.getElementById('sync-status-text');
  
  if (user) {
    // 로그인 성공 상태
    currentUser = user;
    if (nameLabel) nameLabel.textContent = user.displayName;
    if (emailLabel) emailLabel.textContent = user.email;
    if (syncStatus) syncStatus.textContent = "클라우드 동기화 됨";
    
    if (authBtn) {
      authBtn.textContent = "로그아웃";
      authBtn.className = "px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-black text-xs rounded-xl transition-all shadow-md mt-2";
    }
  } else {
    // 로그아웃 (또는 미로그인) 상태
    currentUser = null;
    if (nameLabel) nameLabel.textContent = "게스트 계정";
    if (emailLabel) emailLabel.textContent = "(오프라인 모드)";
    if (syncStatus) syncStatus.textContent = "동기화 대기";
    
    if (authBtn) {
      authBtn.textContent = "🌐 구글 계정 연동 (클라우드 저장)";
      authBtn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all shadow-md mt-2";
    }
  }
});
