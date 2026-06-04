// js/app.js
import { auth, loginWithGoogle, logoutUser, saveToCloud, loadFromCloud, onAuthStateChanged } from './firebase-auth.js';
import { saveGeminiKey, getGeminiKey, callGemini } from './gemini-engine.js';

const APP_ID = 'c_f04126b33eaae657_ai_v26_06b';
let currentUser = null;

// 상태 변수 선언 (studySubjects, quizSheets 등 기존 변수들)
let studySubjects = {}, quizSheets = []; 

// 1. 초기화 및 이벤트 리스너 바인딩
document.addEventListener('DOMContentLoaded', () => {
  // API 키 UI 초기화
  const apiKeyInput = document.getElementById('api-key-input');
  if (apiKeyInput) apiKeyInput.value = getGeminiKey();
  
  document.getElementById('save-api-key-btn')?.addEventListener('click', () => {
    saveGeminiKey(document.getElementById('api-key-input').value);
    alert('API 키가 로컬에 안전하게 저장되었습니다.');
  });

  // 구글 로그인 제어
  document.getElementById('auth-action-btn')?.addEventListener('click', async () => {
    if (currentUser) {
      await logoutUser();
    } else {
      try {
        await loginWithGoogle();
      } catch(e) { alert("로그인 실패: " + e.message); }
    }
  });
});

// 2. 인증 상태 변화 감지 및 자동 클라우드 동기화
onAuthStateChanged(auth, async (user) => {
  const btn = document.getElementById('auth-action-btn');
  const nameLabel = document.getElementById('profile-user-name');
  
  if (user) {
    currentUser = user;
    nameLabel.textContent = user.displayName || "구글 사용자";
    btn.textContent = "로그아웃";
    btn.classList.replace('bg-blue-600', 'bg-slate-700');
    
    // 클라우드에서 데이터 끌어오기
    const cloudData = await loadFromCloud(user.uid, APP_ID);
    if (cloudData) {
      studySubjects = cloudData.studySubjects || {};
      quizSheets = cloudData.quizSheets || [];
      // (기타 변수 복원 생략)
      renderProfileTab();
    }
  } else {
    currentUser = null;
    nameLabel.textContent = "게스트 계정";
    btn.textContent = "🌐 구글 계정 연동 (클라우드 저장)";
    btn.classList.replace('bg-slate-700', 'bg-blue-600');
    // 로컬 스토리지 데이터 로드 로직 실행
  }
});

// 3. 글로벌 함수 노출 (HTML onclick 매핑용)
window.changeDashboardTab = function(id) {
  // 기존 탭 스위칭 로직
};
window.handleBuildQuiz = async function() {
  // gemini-engine.js의 callGemini()를 호출하여 로직 수행
  // 기존의 극단적 기출 회피 제약을 삭제하고 균등분포 로직을 적용한 v3.2 프롬프트 반영
};
// ... 기존 함수들을 window 객체에 모두 매핑 (createNewSubject 등)
