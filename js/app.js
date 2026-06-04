// js/app.js

// 상태 변수 선언 (로컬 데이터 보존용)
let studySubjects = {};
let quizSheets = [];
let chaptersState = {};

// ==========================================
// 1. 핵심 탭 전환 로직 (화면 스위칭)
// ==========================================
window.changeDashboardTab = function(id) {
  const views = ["profile", "subjects", "generate", "storage", "settings"];
  
  views.forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    
    // 선택되지 않은 탭 숨기기
    if (view) view.classList.add('hidden');
    
    // 버튼 스타일 초기화 (기본 회색)
    if (btn) {
      btn.className = "px-2.5 py-1.5 rounded-lg text-xs font-black transition-all text-slate-400 hover:text-white";
    }
  });

  // 선택된 탭 보이기
  const activeView = document.getElementById(`view-${id}`);
  if (activeView) activeView.classList.remove('hidden');

  // 선택된 탭 버튼에 불 들어오는 스타일 적용
  const activeBtn = document.getElementById(`tab-btn-${id}`);
  if (activeBtn) {
    if (id === 'settings') {
      activeBtn.className = "px-2.5 py-1.5 rounded-lg text-xs font-black transition-all text-emerald-400 bg-emerald-500/20";
    } else {
      activeBtn.className = "px-2.5 py-1.5 rounded-lg text-xs font-black transition-all text-indigo-400 bg-slate-900 shadow-inner";
    }
  }

  // 탭 전환 시 필요한 추가 렌더링 (데이터 불러오기)
  if (id === "profile") renderProfileTab();
  if (id === "subjects") renderSubjectManageTab();
  if (id === "generate") renderGenerateTab();
  if (id === "storage") renderStorageTab();
};

// ==========================================
// 2. 화면별 빈 렌더링 함수 (에러 방지용 뼈대)
// ==========================================
// 기존에 작성하셨던 기능들이 들어갈 자리입니다.
// 당장 에러가 나지 않도록 뼈대를 잡아두었습니다.

function renderProfileTab() {
  console.log("프로필 탭 렌더링 완료");
}

function renderSubjectManageTab() {
  console.log("과목 관리 탭 렌더링 완료");
}

function renderGenerateTab() {
  console.log("문제지 생성 탭 렌더링 완료");
  // 선택창 초기화 등
}

function renderStorageTab() {
  console.log("보관함 탭 렌더링 완료");
}

window.onGenSubjectSelectChange = function() {
  console.log("과목이 선택되었습니다.");
};

window.updateGenerateTypeLock = function() {
  console.log("유형 잠금 업데이트");
};

window.setGenType = function(type) {
  console.log("문제지 유형 선택:", type);
};

// ==========================================
// 3. 페이지가 처음 켜졌을 때 실행할 동작
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("사이트 로딩 완료");
  
  // 처음에 무조건 '학습 프로필' 탭이 켜지도록 강제 설정
  window.changeDashboardTab("profile");
});
