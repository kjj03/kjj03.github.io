// js/app.js
const APP_ID = 'ai_study_v26_06_1b';

// ===================================================================
// 1. 화면 탭 전환 로직 (최상단 배치: 모듈 에러가 나도 무조건 작동함)
// ===================================================================
window.changeDashboardTab = function(id) {
  const views = ["profile", "subjects", "generate", "storage", "settings"];
  views.forEach(t => {
    const view = document.getElementById('view-' + t);
    const btn = document.getElementById('tab-btn-' + t);
    if (view) view.classList.add('hidden');
    if (btn) btn.className = "px-2.5 py-1.5 rounded-lg text-xs font-black transition-all text-slate-400 hover:text-white";
  });

  // 퀴즈 화면 끄기
  document.getElementById('home-view')?.classList.remove('hidden');
  document.getElementById('quiz-view')?.classList.add('hidden');
  document.getElementById('result-view')?.classList.add('hidden');

  const activeView = document.getElementById('view-' + id);
  if (activeView) activeView.classList.remove('hidden');

  const activeBtn = document.getElementById('tab-btn-' + id);
  if (activeBtn) {
    activeBtn.className = id === 'settings' 
      ? "px-2.5 py-1.5 rounded-lg text-xs font-black transition-all text-emerald-400 bg-emerald-500/20"
      : "px-2.5 py-1.5 rounded-lg text-xs font-black transition-all text-indigo-400 bg-slate-900 shadow-inner";
  }

  // 탭 전환 시 데이터 화면 새로고침
  if (id === 'profile' && window.renderProfileTab) window.renderProfileTab();
  if (id === 'subjects' && window.renderSubjectManageTab) window.renderSubjectManageTab();
  if (id === 'generate' && window.renderGenerateTab) window.renderGenerateTab();
  if (id === 'storage' && window.renderStorageTab) window.renderStorageTab();
};

document.addEventListener('DOMContentLoaded', () => {
  window.changeDashboardTab('profile'); // 시작하자마자 프로필 탭 띄우기
});


// ===================================================================
// 2. 전역 상태 및 데이터 로컬 저장 로직 (에러 방지 적용)
// ===================================================================
window.currentUser = null;
let studySubjects = {};
let studyMaterials = {};
let quizSheets = [];

let selectedManageSubjectId = null;
let genFileContent = "";
let activeSheet = null;
let currentQuestionIndex = 0;
let tempAnswers = [];

let authModule = null;
let geminiModule = null;

try {
  studySubjects = JSON.parse(localStorage.getItem('studySubjects_v26') || '{}');
  studyMaterials = JSON.parse(localStorage.getItem('studyMaterials_v26') || '{}');
  quizSheets = JSON.parse(localStorage.getItem('quizSheets_v26') || '[]');
} catch(e) {
  console.warn("로컬 데이터 포맷 오류. 새로 시작합니다.");
}

async function saveStorage() {
  localStorage.setItem('studySubjects_v26', JSON.stringify(studySubjects));
  localStorage.setItem('studyMaterials_v26', JSON.stringify(studyMaterials));
  localStorage.setItem('quizSheets_v26', JSON.stringify(quizSheets));
  
  if (window.currentUser && authModule) {
    const syncText = document.getElementById('sync-status-text');
    if (syncText) syncText.textContent = "클라우드 백업 중...";
    try {
      await authModule.saveToCloud(window.currentUser.uid, { studySubjects, studyMaterials, quizSheets }, APP_ID);
      if (syncText) syncText.textContent = "클라우드 동기화 됨";
    } catch (e) {
      if (syncText) syncText.textContent = "동기화 실패";
    }
  }
}

// ===================================================================
// 3. 과목 관리 및 AI 문제 생성, 보관함 핵심 로직
// ===================================================================
window.createNewSubject = async function() {
  const input = document.getElementById('subj-name-input');
  if (!input || !input.value.trim()) return;
  const name = input.value.trim();
  
  if (Object.keys(studySubjects).some(k => studySubjects[k].name === name)) {
    alert("이미 존재하는 과목명입니다."); return;
  }
  
  const id = "sub_" + Date.now();
  studySubjects[id] = { id, name, chapters: {} };
  input.value = ""; 
  await saveStorage();
  window.renderSubjectManageTab();
};

window.renderSubjectManageTab = function() {
  const list = document.getElementById('subject-manage-list');
  if (!list) return;
  list.innerHTML = '';
  const ids = Object.keys(studySubjects);
  
  if (ids.length === 0) {
    list.innerHTML = `<span class="text-xs sm:text-sm text-slate-555 block text-center py-4">과목을 먼저 개설하십시오.</span>`;
    document.getElementById('subject-detail-fallback')?.classList.remove('hidden');
    document.getElementById('subject-detail-panel')?.classList.add('hidden');
    return;
  }
  
  ids.forEach(id => {
    const sub = studySubjects[id];
    const btn = document.createElement('button');
    const isSelected = selectedManageSubjectId === id;
    btn.className = `w-full text-left p-4 rounded-xl border text-sm transition-all ${isSelected ? 'bg-indigo-600/10 border-indigo-500 text-slate-200 shadow-lg' : 'bg-slate-955/45 border-slate-855 text-slate-400'}`;
    btn.innerHTML = `<span class="font-bold block text-slate-100">${sub.name}</span><span class="text-xs text-slate-500">단원 ${Object.keys(sub.chapters||{}).length}개</span>`;
    btn.onclick = () => window.selectManageSubject(id);
    list.appendChild(btn);
  });
};

window.selectManageSubject = function(id) {
  selectedManageSubjectId = id; 
  window.renderSubjectManageTab();
  document.getElementById('subject-detail-fallback')?.classList.add('hidden');
  document.getElementById('subject-detail-panel')?.classList.remove('hidden');
  document.getElementById('detail-subject-title').textContent = studySubjects[id].name;
  window.renderSubjectChapters();
};

async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  let txt = "";
  if (ext === 'html' || ext === 'txt') {
    txt = await file.text();
    const d = document.createElement('div'); d.innerHTML = txt; txt = d.textContent || "";
  } else if (ext === 'pdf') {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    if (pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      txt += textContent.items.map(item => item.str).join(" ");
    }
  }
  return txt;
}

window.createNewChapter = async function() {
  if (!selectedManageSubjectId) return;
  const el = document.getElementById('chap-name-input');
  if (!el.value.trim() || !genFileContent) { alert("단원명 입력 및 파일 업로드를 확인해주세요."); return; }
  
  const sub = studySubjects[selectedManageSubjectId];
  const id = "chap_" + Date.now();
  sub.chapters[id] = { id, name: el.value.trim() };
  
  const key = `${sub.name}___${el.value.trim()}`;
  studyMaterials[key] = { subject: sub.name, chapter: el.value.trim(), contents: [genFileContent] };
  
  genFileContent = ""; el.value = '';
  document.getElementById('gen-file-status').textContent = "파일 드래그 업로드\n(.pdf, .txt)";
  await saveStorage();
  window.renderSubjectChapters();
};

window.renderSubjectChapters = function() {
  const container = document.getElementById('chapter-manage-list');
  if (!container) return;
  container.innerHTML = '';
  const sub = studySubjects[selectedManageSubjectId];
  const keys = Object.keys(sub.chapters || {});
  
  if (keys.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-555 block py-4 text-center">등록된 단원이 없습니다.</span>`;
    return;
  }
  
  keys.forEach(k => {
    container.innerHTML += `<div class="p-4 bg-slate-950/80 rounded-xl border border-slate-855 text-sm font-bold text-slate-100">${sub.chapters[k].name}</div>`;
  });
};

window.renderGenerateTab = function() {
  const sSel = document.getElementById('gen-subject-select');
  if (!sSel) return;
  sSel.innerHTML = '<option value="" class="bg-slate-800 text-slate-100">== 과목 선택 ==</option>';
  Object.keys(studySubjects).forEach(k => {
    sSel.innerHTML += `<option value="${k}" class="bg-slate-800 text-slate-100">${studySubjects[k].name}</option>`;
  });
  sSel.addEventListener('change', () => {
    const cSel = document.getElementById('gen-chapter-select');
    cSel.innerHTML = '';
    const sub = studySubjects[sSel.value];
    if (sub) {
      Object.keys(sub.chapters || {}).forEach(k => {
        cSel.innerHTML += `<option value="${k}" class="bg-slate-800 text-slate-100">${sub.chapters[k].name}</option>`;
      });
    }
  });
};

window.handleBuildQuiz = async function() {
  const sId = document.getElementById('gen-subject-select').value;
  const cId = document.getElementById('gen-chapter-select').value;
  if (!sId || !cId) { alert("과목과 단원을 선택해주세요."); return; }
  
  if (!geminiModule) { alert("AI 모듈이 아직 로딩되지 않았습니다. 잠시 후 시도해주세요."); return; }

  const sub = studySubjects[sId];
  const chap = sub.chapters[cId];
  const key = `${sub.name}___${chap.name}`;
  if (!studyMaterials[key]) return;
  
  const text = studyMaterials[key].contents.join("\n");
  const spinner = document.getElementById('gen-loading-spinner');
  const btn = document.getElementById('build-quiz-btn');
  btn.classList.add('hidden'); spinner.classList.remove('hidden');

  const prompt = `과목명: ${sub.name}\n단원 범위: ${chap.name}\n출제 문항: 10문항\n[지침]: 대학교 전공 시험 기출 정석 스타일로 단원 전체 개념을 균등하게 분산하여 출제하세요. 응용/실무 시나리오는 제외하십시오.\n교안:\n${text.substring(0, 15000)}`;

  try {
    const res = await geminiModule.callGemini(prompt, "실전 시험 문항을 출제하는 교수입니다. JSON 포맷만 출력하십시오.", true);
    const data = JSON.parse(res);
    
    quizSheets.push({
      id: "sheet_" + Date.now(), title: data.title || `${sub.name} 평가`,
      subject: sub.name, chapter: chap.name, createdDate: new Date().toISOString().split('T')[0],
      questions: data.questions.slice(0, 10).map((q,i)=>({id: i+1, ...q})), isSolved: false
    });
    await saveStorage();
    alert("문제지 생성이 완료되었습니다!");
    window.changeDashboardTab('storage');
  } catch (err) {
    alert("문제지 생성 에러 (API 키를 확인해주세요):\n" + err.message);
  } finally {
    btn.classList.remove('hidden'); spinner.classList.add('hidden');
  }
};

window.renderStorageTab = function() {
  const grid = document.getElementById('storage-sheets-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (quizSheets.length === 0) {
    grid.innerHTML = '<div class="col-span-2 text-center py-8 text-slate-555 text-sm font-bold">보관된 문제지가 없습니다.</div>';
    return;
  }
  quizSheets.forEach(sheet => {
    grid.innerHTML += `<div class="p-4 rounded-xl border border-slate-855 bg-slate-900/40 space-y-3">
      <div class="flex justify-between text-xs text-slate-555 font-bold"><span>${sheet.createdDate}</span></div>
      <h4 class="text-sm font-bold text-slate-100">${sheet.title}</h4>
      <div class="flex justify-end pt-2 border-t border-slate-800/50">
        <button onclick="startQuizSheet('${sheet.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold">풀기 시작</button>
      </div></div>`;
  });
};

window.startQuizSheet = function(id) {
  // 퀴즈 화면 로직 (추후 확장)
  alert("퀴즈 풀기 화면으로 진입합니다! (문제지 ID: " + id + ")");
};


// ===================================================================
// 4. 외부 모듈(Firebase, Gemini) 동적 지연 로드 및 이벤트 바인딩
// ===================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1) 프로필 렌더링
  window.renderProfileTab = function() {
    const list = document.getElementById('subject-accordion-container');
    if (!list) return;
    const keys = Object.keys(studySubjects);
    if(keys.length === 0) list.innerHTML = '<div class="text-center py-8 text-slate-500 font-bold">과목을 먼저 개설해주세요.</div>';
    else list.innerHTML = keys.map(k => `<div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl mb-3"><h4 class="font-bold text-slate-200">${studySubjects[k].name}</h4></div>`).join('');
  };
  window.renderProfileTab();

  // 2) 파일 업로드 바인딩
  document.getElementById('gen-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('gen-file-status').textContent = "파일 분석 중...";
    try {
      genFileContent = await extractTextFromFile(file);
      document.getElementById('gen-file-status').textContent = "업로드 성공: " + file.name;
    } catch(err) {
      document.getElementById('gen-file-status').textContent = "파일 드래그 업로드\n(.pdf, .txt)";
    }
  });
  
  // 3) 클릭 이벤트 HTML과 매핑
  document.getElementById('create-subj-btn')?.addEventListener('click', window.createNewSubject);
  document.getElementById('create-chap-btn')?.addEventListener('click', window.createNewChapter);
  document.getElementById('build-quiz-btn')?.addEventListener('click', window.handleBuildQuiz);

  // 4) 에러 유발 모듈들을 지연 로딩 처리 (여기서 에러가 나도 위쪽 UI 로직은 이미 등록완료됨)
  try {
    geminiModule = await import('./gemini-engine.js');
    const apiKeyInput = document.getElementById('api-key-input');
    if (apiKeyInput) apiKeyInput.value = geminiModule.getGeminiKey();
    
    document.getElementById('save-api-key-btn')?.addEventListener('click', () => {
      geminiModule.saveGeminiKey(document.getElementById('api-key-input').value);
      alert('✅ AI API 키가 로컬에 안전하게 저장되었습니다.');
    });

    authModule = await import('./firebase-auth.js');
    const authBtn = document.getElementById('auth-action-btn');
    authBtn?.addEventListener('click', async () => {
      if (window.currentUser) { await authModule.logoutUser(); } 
      else { try { await authModule.loginWithGoogle(); } catch(e) { alert("로그인 에러: " + e.message); } }
    });

    authModule.onAuthStateChanged(authModule.auth, async (user) => {
      window.currentUser = user;
      document.getElementById('profile-user-name').textContent = user ? user.displayName : "게스트 계정";
      document.getElementById('sync-status-text').textContent = user ? "클라우드 동기화 됨" : "동기화 대기";
      if (authBtn) authBtn.textContent = user ? "로그아웃" : "🌐 구글 계정 연동 (클라우드 저장)";
      
      if (user) {
        const cloudData = await authModule.loadFromCloud(user.uid, APP_ID);
        if (cloudData) {
          studySubjects = cloudData.studySubjects || {};
          studyMaterials = cloudData.studyMaterials || {};
          quizSheets = cloudData.quizSheets || [];
          window.renderProfileTab();
        }
      }
    });
  } catch (error) {
    console.warn("모듈 파일 로드 중 일부 오류가 있었으나, 기본 인터페이스는 정상 작동합니다.", error);
  }
});
