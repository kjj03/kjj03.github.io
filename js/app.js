// js/app.js

// ==========================================
// 1. 화면 탭 전환 로직 (최상단 배치: 모듈 에러와 무관하게 무조건 등록됨)
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

// 페이지 렌더링 직후 프로필 탭 초기화
document.addEventListener('DOMContentLoaded', () => {
  window.changeDashboardTab("profile");
});

// ==========================================
// 2. 동적 임포트(Dynamic Import) 적용 영역
// ==========================================
// 다른 파일에 에러가 있거나 경로가 틀려도, 탭 전환 기능이 먹통되지 않도록 안전하게 분리합니다.
async function initializeModules() {
  try {
    // 각각의 모듈을 비동기로 로드합니다.
    const geminiModule = await import('./gemini-engine.js');
    const authModule = await import('./firebase-auth.js');
    
    // API 키 UI 렌더링
    const apiKeyInput = document.getElementById('api-key-input');
    if (apiKeyInput) apiKeyInput.value = geminiModule.getGeminiKey();
    
    document.getElementById('save-api-key-btn')?.addEventListener('click', () => {
      geminiModule.saveGeminiKey(document.getElementById('api-key-input').value);
      alert('✅ AI API 키가 로컬에 안전하게 저장되었습니다.');
    });

    // 구글 로그인 제어
    const authBtn = document.getElementById('auth-action-btn');
    if (authBtn) {
      authBtn.addEventListener('click', async () => {
        if (window.currentUser) {
          await authModule.logoutUser();
        } else {
          try {
            await authModule.loginWithGoogle();
          } catch(e) {
            alert("로그인 중 에러 발생: " + e.message);
          }
        }
      });
    }

    // 로그인 상태 감지
    authModule.onAuthStateChanged(authModule.auth, (user) => {
      window.currentUser = user;
      const nameLabel = document.getElementById('profile-user-name');
      const emailLabel = document.getElementById('profile-user-email');
      const syncStatus = document.getElementById('sync-status-text');
      
      if (user) {
        if (nameLabel) nameLabel.textContent = user.displayName;
        if (emailLabel) emailLabel.textContent = user.email;
        if (syncStatus) syncStatus.textContent = "클라우드 동기화 됨";
        if (authBtn) {
          authBtn.textContent = "로그아웃";
          authBtn.className = "px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-black text-xs rounded-xl transition-all shadow-md mt-2";
        }
      } else {
        if (nameLabel) nameLabel.textContent = "게스트 계정";
        if (emailLabel) emailLabel.textContent = "(오프라인 모드)";
        if (syncStatus) syncStatus.textContent = "동기화 대기";
        if (authBtn) {
          authBtn.textContent = "🌐 구글 계정 연동 (클라우드 저장)";
          authBtn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all shadow-md mt-2";
        }
      }
    });

  } catch (error) {
    console.error("🚨 [모듈 로드 실패] 파일 경로 오류 또는 내부 코드 에러 발생:", error);
    alert("로그인/AI 관련 파일을 불러오지 못했습니다. F12 콘솔창의 에러 경로를 확인해 주세요.");
  }
}

// 모듈 초기화 실행
initializeModules();
