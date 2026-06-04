// js/app.js
import { auth, loginWithGoogle, logoutUser, onAuthStateChanged, saveToCloud, loadFromCloud } from './firebase-auth.js';
import { saveGeminiKey, getGeminiKey, callGemini } from './gemini-engine.js';

const APP_ID = 'ai_study_v26_06_1b';

// ==========================================
// 1. 전역 상태 변수 (로컬 & 클라우드 동기화용)
// ==========================================
window.currentUser = null;
let studySubjects = JSON.parse(localStorage.getItem('studySubjects_v26') || '{}');
let studyMaterials = JSON.parse(localStorage.getItem('studyMaterials_v26') || '{}');
let quizSheets = JSON.parse(localStorage.getItem('quizSheets_v26') || '[]');

let selectedManageSubjectId = null;
let genFileContent = "";
let activeSheet = null;
let currentQuestionIndex = 0;
let tempAnswers = [];

// ==========================================
// 2. 데이터 저장 로직 (로컬 + 클라우드)
// ==========================================
async function saveStorage() {
  localStorage.setItem('studySubjects_v26', JSON.stringify(studySubjects));
  localStorage.setItem('studyMaterials_v26', JSON.stringify(studyMaterials));
  localStorage.setItem('quizSheets_v26', JSON.stringify(quizSheets));
  
  if (window.currentUser) {
    const syncText = document.getElementById('sync-status-text');
    if (syncText) syncText.textContent = "클라우드 백업 중...";
    try {
      await saveToCloud(window.currentUser.uid, { studySubjects, studyMaterials, quizSheets }, APP_ID);
      if (syncText) syncText.textContent = "클라우드 동기화 됨";
    } catch (e) {
      console.error("클라우드 저장 실패", e);
      if (syncText) syncText.textContent = "동기화 실패";
    }
  }
}

// ==========================================
// 3. 과목 및 교안 관리 로직
// ==========================================
window.createNewSubject = async function() {
  const input = document.getElementById('subj-name-input');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  
  if (Object.keys(studySubjects).some(k => studySubjects[k].name === name)) {
    alert("이미 존재하는 과목명입니다.");
    return;
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
    list.innerHTML = `<span class="text-xs sm:text-sm text-slate-555 block text-center py-4 font-sans">과목을 먼저 개설하십시오.</span>`;
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
  const sub = studySubjects[id]; 
  if (!sub) return;
  
  window.renderSubjectManageTab();
  document.getElementById('subject-detail-fallback')?.classList.add('hidden');
  document.getElementById('subject-detail-panel')?.classList.remove('hidden');
  document.getElementById('detail-subject-title').textContent = sub.name;
  
  window.renderSubjectChapters();
};

// 파일 텍스트 추출 로직
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
      txt += `\n[Page ${i}]\n` + textContent.items.map(item => item.str).join(" ");
    }
  }
  return txt;
}

window.createNewChapter = async function() {
  if (!selectedManageSubjectId) return;
  const el = document.getElementById('chap-name-input');
  const val = el.value.trim(); 
  if (!val || !genFileContent) { 
    alert("단원명 입력 및 교안 문서(PDF, TXT) 업로드를 완료해 주십시오."); 
    return; 
  }
  
  const sub = studySubjects[selectedManageSubjectId];
  if (!sub.chapters) sub.chapters = {};
  
  const id = "chap_" + Date.now();
  sub.chapters[id] = { id, name: val, content: genFileContent };
  
  const key = `${sub.name}___${val}`;
  studyMaterials[key] = { subject: sub.name, chapter: val, contents: [genFileContent] };
  
  genFileContent = ""; 
  el.value = '';
  document.getElementById('gen-file-input').value = '';
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
    container.innerHTML = `<span class="text-xs sm:text-sm text-slate-555 block py-4 text-center">등록된 단원이 없습니다.</span>`;
    return;
  }
  
  keys.forEach(k => {
    const c = sub.chapters[k];
    const item = document.createElement('div');
    item.className = "p-4 bg-slate-950/80 rounded-xl border border-slate-855 flex justify-between items-center text-sm gap-3";
    item.innerHTML = `<span class="font-bold text-slate-100">${c.name}</span>`;
    container.appendChild(item);
  });
};

// ==========================================
// 4. 문제지 생성 로직 (AI Gemini 연동 - 균등 출제 모드)
// ==========================================
window.renderGenerateTab = function() {
  const sSel = document.getElementById('gen-subject-select');
  if (!sSel) return;
  sSel.innerHTML = '<option value="" class="bg-slate-800 text-slate-100">== 과목 선택 ==</option>';
  Object.keys(studySubjects).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = studySubjects[k].name;
    opt.className = "bg-slate-800 text-slate-100";
    sSel.appendChild(opt);
  });
};

window.onGenSubjectSelectChange = function() {
  const sSel = document.getElementById('gen-subject-select');
  const cSel = document.getElementById('gen-chapter-select');
  if (!sSel || !cSel) return;
  cSel.innerHTML = '';
  const sId = sSel.value;
  if (!sId || !studySubjects[sId]) {
    cSel.innerHTML = '<option value="" class="bg-slate-800 text-slate-100">== 단원 없음 ==</option>';
    return;
  }
  const sub = studySubjects[sId];
  Object.keys(sub.chapters || {}).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = sub.chapters[k].name;
    opt.className = "bg-slate-800 text-slate-100";
    cSel.appendChild(opt);
  });
};

window.handleBuildQuiz = async function() {
  const sId = document.getElementById('gen-subject-select').value;
  const cId = document.getElementById('gen-chapter-select').value;
  if (!sId || !cId) { alert("과목과 단원을 먼저 선택해주세요."); return; }
  
  const sub = studySubjects[sId];
  const chap = sub.chapters[cId];
  const key = `${sub.name}___${chap.name}`;
  if (!studyMaterials[key]) return;
  
  const text = studyMaterials[key].contents.join("\n");
  
  const spinner = document.getElementById('gen-loading-spinner');
  const btn = document.getElementById('build-quiz-btn');
  btn.classList.add('hidden');
  spinner.classList.remove('hidden');

  const limit = 10;
  const prompt = `
과목명: ${sub.name}
단원 범위: ${chap.name}
출제 대상 문항 수: ${limit}문항

[★ 출제 핵심 지침 ★]:
1. [학술적/정석적 기출 스타일 강제]: 실무, 비즈니스 시나리오를 엮은 응용 문제는 절대 출제하지 마십시오. 대학교 전공 시험에 등장하는 정석적인 형태(개념, 특징 비교, 계산 유도, O/X 판별)로만 출제하십시오.
2. [단원 전체 균등 출제 (Uniform Topic Coverage)]: 문제 출제가 교안의 일부분(예: 앞부분 개념)에만 쏠리지 않도록 철저히 방지하십시오. 각기 다른 하위 개념과 중요 주제들이 ${limit}문항 전체에 빠짐없이 균형 있게 분산 배치되게 하십시오.
3. 이전에 출제했던 중요한 기출 개념이 다시 나와도 무방합니다. 발문과 선택지의 문장 구조를 다르게 하여 퀄리티를 유지하십시오.

학습 분석용 교안 데이터:
${text.substring(0, 18000)}
  `;

  try {
    const res = await callGemini(prompt, "당신은 실전 시험 문항을 출제하는 명망 있는 교수입니다. JSON 포맷만 출력하십시오.", true);
    const data = JSON.parse(res);
    
    const qid = "sheet_" + Date.now();
    const sheet = {
      id: qid, title: data.title || `${sub.name} [${chap.name}] 평가`,
      subject: sub.name, chapter: chap.name, category: chap.name,
      createdDate: new Date().toISOString().split('T')[0],
      score: null,
      questions: data.questions.slice(0, limit).map((q,i)=>({id: i+1, ...q})),
      isSolved: false
    };
    quizSheets.push(sheet);
    await saveStorage();
    alert("문제지 생성이 완료되었습니다! 보관함에서 확인하세요.");
    
    // 자동 보관함 이동
    document.getElementById('tab-btn-storage').click();
  } catch (err) {
    alert("문제지 생성 에러: API 키를 등록하셨는지 확인해주세요.\n상세: " + err.message);
  } finally {
    btn.classList.remove('hidden');
    spinner.classList.add('hidden');
  }
};

// ==========================================
// 5. 보관함 및 퀴즈 풀이 뷰어
// ==========================================
window.renderStorageTab = function() {
  const grid = document.getElementById('storage-sheets-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  if (quizSheets.length === 0) {
    grid.innerHTML = '<div class="col-span-2 text-center py-8 text-slate-555 text-sm font-bold">보관된 문제지가 없습니다.</div>';
    return;
  }
  
  quizSheets.forEach(sheet => {
    const card = document.createElement('div');
    card.className = `p-4 rounded-xl border border-slate-855 bg-slate-900/40 flex flex-col justify-between space-y-3`;
    card.innerHTML = `
      <div>
        <div class="flex justify-between text-xs text-slate-555 font-bold"><span>${sheet.createdDate}</span><button onclick="deleteQuizSheet('${sheet.id}')" class="text-rose-455 hover:underline">삭제</button></div>
        <h4 class="text-sm font-bold text-slate-100 mt-1">${sheet.title}</h4>
      </div>
      <div class="flex justify-end pt-2 border-t border-slate-800/50">
        <button onclick="startQuizSheet('${sheet.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-all">풀기 시작</button>
      </div>
    `;
    grid.appendChild(card);
  });
};

window.deleteQuizSheet = async function(id) {
  if(!confirm("정말 삭제하시겠습니까?")) return;
  quizSheets = quizSheets.filter(s => s.id !== id);
  await saveStorage();
  window.renderStorageTab();
};

window.startQuizSheet = function(id) {
  activeSheet = quizSheets.find(s => s.id === id);
  if (!activeSheet) return;
  currentQuestionIndex = 0;
  tempAnswers = Array.from({ length: activeSheet.questions.length }, () => ({ chosen: null, isSubmitted: false }));
  
  document.getElementById('home-view').classList.add('hidden');
  document.getElementById('quiz-view').classList.remove('hidden');
  document.getElementById('result-view').classList.add('hidden');
  document.getElementById('quiz-title-label').textContent = activeSheet.title;
  
  window.loadQuestion();
};

window.loadQuestion = function() {
  const q = activeSheet.questions[currentQuestionIndex];
  const ans = tempAnswers[currentQuestionIndex];
  
  document.getElementById('question-index-label').textContent = `Q. ${String(currentQuestionIndex + 1).padStart(2, '0')}`;
  document.getElementById('question-text').textContent = q.question;
  
  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';
  
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = `w-full text-left p-3.5 rounded-xl border flex items-start space-x-3 transition-all ${ans.chosen === idx ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:bg-slate-800'}`;
    btn.innerHTML = `<span class="font-bold text-sm text-slate-200">${idx+1}. ${opt}</span>`;
    btn.onclick = () => {
      if(!ans.isSubmitted) {
        ans.chosen = idx;
        window.loadQuestion();
      }
    };
    optionsContainer.appendChild(btn);
  });

  // 버튼 상태 업데이트
  const actionBtn = document.getElementById('action-btn');
  if (ans.isSubmitted) {
    actionBtn.textContent = "✓ 제출 완료";
    actionBtn.className = "px-5 py-2.5 bg-slate-855 text-slate-500 font-bold rounded-xl cursor-default";
    document.getElementById('feedback-box').classList.remove('hidden');
    document.getElementById('feedback-title').textContent = (ans.chosen === q.answer) ? "정답입니다!" : "오답입니다.";
    document.getElementById('explanation-text').textContent = q.explanation;
  } else if (ans.chosen !== null) {
    actionBtn.textContent = "정답 확인";
    actionBtn.className = "px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl";
    actionBtn.onclick = () => { ans.isSubmitted = true; window.loadQuestion(); };
    document.getElementById('feedback-box').classList.add('hidden');
  } else {
    actionBtn.textContent = "선택 대기";
    actionBtn.className = "px-5 py-2.5 bg-slate-700 text-slate-400 font-bold rounded-xl cursor-default";
    document.getElementById('feedback-box').classList.add('hidden');
  }

  // 다음/제출 버튼 전환
  const nextBtn = document.getElementById('btn-next');
  if (currentQuestionIndex === activeSheet.questions.length - 1) {
    nextBtn.textContent = "결과 보기";
    nextBtn.onclick = window.submitEntireQuiz;
  } else {
    nextBtn.textContent = "다음 문항";
    nextBtn.onclick = window.navigateNext;
  }
};

window.navigatePrev = function() { if (currentQuestionIndex > 0) { currentQuestionIndex--; window.loadQuestion(); } };
window.navigateNext = function() { if (currentQuestionIndex < activeSheet.questions.length - 1) { currentQuestionIndex++; window.loadQuestion(); } };

window.submitEntireQuiz = async function() {
  let corr = 0;
  activeSheet.questions.forEach((q, i) => { if (tempAnswers[i].chosen === q.answer) corr++; });
  
  activeSheet.score = corr * 10;
  activeSheet.isSolved = true;
  await saveStorage();
  
  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('result-view').classList.remove('hidden');
  document.getElementById('final-score').textContent = corr;
  document.getElementById('final-total').textContent = activeSheet.questions.length;
};

// ==========================================
// 6. 초기화 및 이벤트 리스너 바인딩
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // 프로필 UI 렌더링
  window.renderProfileTab = function() {
    const list = document.getElementById('subject-accordion-container');
    if (!list) return;
    list.innerHTML = '';
    const keys = Object.keys(studySubjects);
    if(keys.length === 0) {
      list.innerHTML = '<div class="text-center py-8 text-slate-500 font-bold">과목이 아직 없습니다. [과목 관리] 탭에서 생성해주세요.</div>';
    } else {
      keys.forEach(k => {
        list.innerHTML += `<div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl mb-3"><h4 class="font-bold text-slate-200">${studySubjects[k].name}</h4></div>`;
      });
    }
  };

  // 탭 전환 시 프로필 렌더링 강제 실행
  window.renderProfileTab();

  // 파일 업로드 이벤트 연결
  document.getElementById('gen-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('gen-file-status').textContent = "파일 분석 중...";
    try {
      genFileContent = await extractTextFromFile(file);
      document.getElementById('gen-file-status').textContent = "업로드 성공: " + file.name;
    } catch(err) {
      alert("파일 읽기 실패: " + err.message);
      document.getElementById('gen-file-status').textContent = "파일 드래그 업로드\n(.pdf, .txt)";
    }
  });

  // API 키 연동
  const apiKeyInput = document.getElementById('api-key-input');
  if (apiKeyInput) apiKeyInput.value = getGeminiKey();
  
  document.getElementById('save-api-key-btn')?.addEventListener('click', () => {
    saveGeminiKey(document.getElementById('api-key-input').value);
    alert('✅ AI API 키가 로컬에 안전하게 저장되었습니다.');
  });

  // 구글 계정 로그인 및 상태 감지
  const authBtn = document.getElementById('auth-action-btn');
  if (authBtn) {
    authBtn.addEventListener('click', async () => {
      if (window.currentUser) {
        await logoutUser();
      } else {
        try { await loginWithGoogle(); } catch(e) { alert("로그인 에러: " + e.message); }
      }
    });
  }

  onAuthStateChanged(auth, async (user) => {
    const nameLabel = document.getElementById('profile-user-name');
    const emailLabel = document.getElementById('profile-user-email');
    const syncStatus = document.getElementById('sync-status-text');
    
    if (user) {
      window.currentUser = user;
      if (nameLabel) nameLabel.textContent = user.displayName;
      if (emailLabel) emailLabel.textContent = user.email;
      if (syncStatus) syncStatus.textContent = "클라우드 동기화 됨";
      if (authBtn) {
        authBtn.textContent = "로그아웃";
        authBtn.className = "px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-black text-xs rounded-xl transition-all shadow-md mt-2";
      }
      
      // 클라우드에서 데이터 끌어오기
      const cloudData = await loadFromCloud(user.uid, APP_ID);
      if (cloudData) {
        studySubjects = cloudData.studySubjects || {};
        studyMaterials = cloudData.studyMaterials || {};
        quizSheets = cloudData.quizSheets || [];
        window.renderProfileTab();
      }
    } else {
      window.currentUser = null;
      if (nameLabel) nameLabel.textContent = "게스트 계정";
      if (emailLabel) emailLabel.textContent = "(오프라인 모드)";
      if (syncStatus) syncStatus.textContent = "동기화 대기";
      if (authBtn) {
        authBtn.textContent = "🌐 구글 계정 연동 (클라우드 저장)";
        authBtn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all shadow-md mt-2";
      }
    }
  });
});
