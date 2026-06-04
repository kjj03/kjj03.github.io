// js/app.js
const DEFAULT_APP_ID = "c_f04126b33eaae657_ai_v321_sys";

let studySubjects = {};
let studyMaterials = {};
let chaptersState = {};
let quizSheets = [];
let pocketMoney = 0;
let moneyHistory = [];
let userLevelState = { level: 1, exp: 0 };
let lastAttendedDate = "";
let schedulesState = [];
let globalMemoText = "";
let customSyncKey = DEFAULT_APP_ID;
let accumulatedStats = { winPromoteCount: 0, perfectScoreCount: 0, totalSolvedCount: 0 };

let selectedSubjectId = null;
let activeUploadedText = "";
let activeQuizSheet = null;
let currentQuestionIdx = 0;
let studentAnswers = [];
let isAdminCheatEnabled = false;

let authModule = null;
let geminiModule = null;

// ==========================================
// 1. 초기 화면 빈 탭 렌더링 에러 및 탭 이동 픽스
// ==========================================
window.changeDashboardTab = function(id) {
  const views = ["profile", "subjects", "generate", "storage", "settings"];
  views.forEach(t => {
    const view = document.getElementById('view-' + t);
    const btn = document.getElementById('tab-btn-' + t);
    const mbBtn = document.getElementById('mb-tab-' + t);
    if (view) view.classList.add('hidden');
    if (btn) btn.className = "px-3 py-1.5 rounded-lg text-xs font-black transition-all text-slate-400 hover:text-white";
    if (mbBtn) mbBtn.className = "flex flex-col items-center gap-0.5 text-[9px] font-bold text-slate-500";
  });

  document.getElementById('home-view')?.classList.remove('hidden');
  document.getElementById('quiz-view')?.classList.add('hidden');
  document.getElementById('result-view')?.classList.add('hidden');

  const activeView = document.getElementById('view-' + id);
  if (activeView) activeView.classList.remove('hidden');

  const activeBtn = document.getElementById('tab-btn-' + id);
  if (activeBtn) activeBtn.className = id === 'settings' ? "px-3 py-1.5 rounded-lg text-xs font-black transition-all text-emerald-400 bg-emerald-500/20" : "px-3 py-1.5 rounded-lg text-xs font-black transition-all text-indigo-400 bg-slate-900 shadow-inner";
  
  const activeMbBtn = document.getElementById('mb-tab-' + id);
  if (activeMbBtn) activeMbBtn.className = "flex flex-col items-center gap-0.5 text-[9px] font-bold text-indigo-400";

  if (id === 'profile' && window.renderProfileTab) window.renderProfileTab();
  if (id === 'subjects' && window.renderSubjectManageTab) window.renderSubjectManageTab();
  if (id === 'generate' && window.renderGenerateTab) window.renderGenerateTab();
  if (id === 'storage' && window.renderStorageTab) window.renderStorageTab();
};

// ==========================================
// 2. 구글 로그인 "게스트 계정" 렌더링 타임 버그 픽스
// ==========================================
function loadStorageFromLocal() {
  try {
    studySubjects = JSON.parse(localStorage.getItem('studySubjects_v7') || '{}');
    studyMaterials = JSON.parse(localStorage.getItem('studyMaterials_v7') || '{}');
    chaptersState = JSON.parse(localStorage.getItem('chaptersState_v7') || '{}');
    quizSheets = JSON.parse(localStorage.getItem('quizSheets_v7') || '[]');
    pocketMoney = parseInt(localStorage.getItem('pocketMoney_v7') || '0', 10);
    moneyHistory = JSON.parse(localStorage.getItem('moneyHistory_v7') || '[]');
    userLevelState = JSON.parse(localStorage.getItem('userLevelState_v7') || '{"level":1,"exp":0}');
    lastAttendedDate = localStorage.getItem('lastAttendedDate_v7') || "";
    schedulesState = JSON.parse(localStorage.getItem('schedulesState_v7') || '[]');
    accumulatedStats = JSON.parse(localStorage.getItem('accumulatedStats_v7') || '{"winPromoteCount":0,"perfectScoreCount":0,"totalSolvedCount":0}');
  } catch (e) { console.warn("로컬 파싱 실패"); }
}

async function writeAndSyncStorage() {
  localStorage.setItem('studySubjects_v7', JSON.stringify(studySubjects));
  localStorage.setItem('studyMaterials_v7', JSON.stringify(studyMaterials));
  localStorage.setItem('chaptersState_v7', JSON.stringify(chaptersState));
  localStorage.setItem('quizSheets_v7', JSON.stringify(quizSheets));
  localStorage.setItem('pocketMoney_v7', pocketMoney.toString());
  localStorage.setItem('moneyHistory_v7', JSON.stringify(moneyHistory));
  localStorage.setItem('userLevelState_v7', JSON.stringify(userLevelState));
  localStorage.setItem('lastAttendedDate_v7', lastAttendedDate);
  localStorage.setItem('schedulesState_v7', JSON.stringify(schedulesState));
  localStorage.setItem('accumulatedStats_v7', JSON.stringify(accumulatedStats));

  if (window.currentUser && authModule) {
    const dot = document.getElementById('sync-status-dot');
    const txt = document.getElementById('sync-status-text');
    if(dot) dot.className = "w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse";
    if(txt) txt.textContent = "동기화 중";
    try {
      const pkg = { studySubjects, studyMaterials, chaptersState, quizSheets, pocketMoney, moneyHistory, userLevelState, lastAttendedDate, schedulesState, accumulatedStats };
      await authModule.saveToCloud(window.currentUser.uid, pkg, customSyncKey);
      if(dot) dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400";
      if(txt) txt.textContent = "클라우드 됨";
    } catch (e) {
      if(txt) txt.textContent = "로컬 모드";
    }
  }
}

// ==========================================
// 3. 과목 즉시 반영 로직 (UI 먼저 그리고 나중에 저장)
// ==========================================
window.createNewSubject = function() {
  const input = document.getElementById('subj-name-input');
  if (!input || !input.value.trim()) return;
  const name = input.value.trim();
  const id = "subject_" + Date.now();
  studySubjects[id] = { id, name, chapters: {} };
  input.value = "";
  
  // 🔥 비동기 대기를 없애고 화면을 즉각적으로 갱신합니다.
  window.renderSubjectManageTab();
  writeAndSyncStorage().catch(console.error);
};

window.renderSubjectManageTab = function() {
  const list = document.getElementById('subject-manage-list');
  if (!list) return; list.innerHTML = '';
  const keys = Object.keys(studySubjects);
  if (keys.length === 0) {
    list.innerHTML = `<span class="text-[10px] text-slate-500 block">과목이 없습니다.</span>`;
    return;
  }
  keys.forEach(k => {
    const sub = studySubjects[k];
    const isSelected = selectedSubjectId === k;
    const btn = document.createElement('button');
    btn.className = `w-full text-left p-2.5 rounded-xl border text-xs transition-all ${isSelected ? 'bg-indigo-600/10 border-indigo-500 text-slate-100' : 'bg-slate-950/40 border-slate-850 text-slate-400'}`;
    btn.innerHTML = `<span class="font-bold">${sub.name}</span>`;
    btn.onclick = () => { selectedSubjectId = k; window.renderSubjectManageTab(); document.getElementById('subject-detail-fallback')?.classList.add('hidden'); document.getElementById('subject-detail-panel')?.classList.remove('hidden'); document.getElementById('detail-subject-title').textContent = sub.name; window.renderChapterListPanel(); };
    list.appendChild(btn);
  });
};

window.createNewChapter = async function() {
  if (!selectedSubjectId) return;
  const el = document.getElementById('chap-name-input');
  const name = el.value.trim();
  if (!name || !activeUploadedText) { alert("단원명 지정 및 파싱이 필요합니다."); return; }
  const sub = studySubjects[selectedSubjectId];
  const cid = "chapter_" + Date.now();
  sub.chapters[cid] = { id: cid, name: name };
  const key = `${sub.name}___${name}`;
  studyMaterials[key] = { subject: sub.name, chapter: name, contents: [activeUploadedText] };
  chaptersState[key] = { subject: sub.name, chapter: name, tier: "Unrank", exp: 0, promotionReady: false };
  activeUploadedText = ""; el.value = ""; document.getElementById('gen-file-input').value = ""; document.getElementById('gen-file-status').innerHTML = "교안 드래그 업로드";
  
  window.renderChapterListPanel();
  writeAndSyncStorage();
};

window.renderChapterListPanel = function() {
  const container = document.getElementById('chapter-manage-list');
  if (!container || !selectedSubjectId) return; container.innerHTML = '';
  const sub = studySubjects[selectedSubjectId];
  Object.keys(sub.chapters || {}).forEach(k => {
    container.innerHTML += `<div class="p-2.5 bg-slate-950/80 rounded border border-slate-850 text-[10px] text-slate-300">📖 ${sub.chapters[k].name}</div>`;
  });
};

// ==========================================
// 4. 문제지 생성 무한 로딩 멈춤 해결
// ==========================================
window.renderGenerateTab = function() {
  const sSel = document.getElementById('gen-subject-select'); if (!sSel) return;
  sSel.innerHTML = '<option value="">== 과목 선택 ==</option>';
  Object.keys(studySubjects).forEach(k => { sSel.innerHTML += `<option value="${k}">${studySubjects[k].name}</option>`; });
};
window.onGenSubjectSelectChange = function() {
  const sSel = document.getElementById('gen-subject-select');
  const cSel = document.getElementById('gen-chapter-select'); if (!sSel || !cSel) return;
  cSel.innerHTML = ''; const sid = sSel.value;
  if (sid && studySubjects[sid]) {
    Object.keys(studySubjects[sid].chapters || {}).forEach(k => { cSel.innerHTML += `<option value="${k}">${studySubjects[sid].chapters[k].name}</option>`; });
  }
  window.updateGenerateTypeLock();
};

let currentSelectedGenType = "practice";
window.setGenType = function(type) {
  currentSelectedGenType = type;
  document.getElementById('type-btn-practice').className = type === 'practice' ? "p-3 rounded-xl border-2 text-left w-full border-indigo-500 bg-indigo-500/5" : "p-3 rounded-xl border border-slate-800 text-left w-full opacity-60 text-slate-500";
  document.getElementById('type-btn-real').className = type === 'real' ? "p-3 rounded-xl border-2 text-left w-full border-indigo-500 bg-indigo-500/5" : "p-3 rounded-xl border border-slate-800 text-left w-full opacity-60 text-slate-500";
};
window.updateGenerateTypeLock = function() {
  const sId = document.getElementById('gen-subject-select').value;
  const cId = document.getElementById('gen-chapter-select').value;
  const realBtn = document.getElementById('type-btn-real');
  if (!realBtn) return;
  const sub = studySubjects[sId]; const chap = sub?.chapters[cId];
  if (!sub || !chap) { realBtn.setAttribute('disabled', true); window.setGenType('practice'); return; }
  
  const key = `${sub.name}___${chap.name}`;
  const st = chaptersState[key] || { promotionReady: false, exp: 0 };
  if (st.promotionReady) {
    document.getElementById('real-mode-title-text').textContent = "🔥 실전 승급전 개방";
    realBtn.removeAttribute('disabled');
  } else {
    document.getElementById('real-mode-title-text').textContent = `🔒 실전 승급전 (${st.exp}/10 XP)`;
    realBtn.setAttribute('disabled', true); window.setGenType('practice');
  }
};

window.handleBuildQuiz = async function() {
  const sId = document.getElementById('gen-subject-select').value;
  const cId = document.getElementById('gen-chapter-select').value;
  if (!sId || !cId) return;
  if (!geminiModule) { alert("AI 모듈 초기화 중입니다."); return; }

  const sub = studySubjects[sId]; const chap = sub.chapters[cId];
  const sourceText = studyMaterials[`${sub.name}___${chap.name}`]?.contents.join("\n") || "";
  if (!sourceText) return;

  const spinner = document.getElementById('gen-loading-spinner');
  const btn = document.getElementById('build-quiz-btn');
  btn.classList.add('hidden'); spinner.classList.remove('hidden');

  const countLimit = currentSelectedGenType === 'real' ? 20 : 10;
  const prompt = `과목:${sub.name}\n범위:${chap.name}\n문항수:${countLimit}\n[출제 규칙]: 응용 사례를 배제하고 기출 원형(정의, 수식, 참거짓)으로 균등 출제하세요.\n교안:\n${sourceText.substring(0, 16000)}`;

  try {
    const raw = await geminiModule.callGemini(prompt, "JSON 데이터 스키마 규칙만 수행하는 출제 교수입니다.", true);
    const parsed = JSON.parse(raw);
    quizSheets.push({
      id: "sheet_" + Date.now(), title: parsed.title || `${sub.name} 맞춤형 평가`,
      subject: sub.name, chapter: chap.name,
      createdDate: new Date().toISOString().split('T')[0], isSolved: false, score: null,
      questions: parsed.questions.slice(0, countLimit).map((q, i) => ({ id: i + 1, ...q })), type: currentSelectedGenType
    });
    await writeAndSyncStorage();
    
    // 🔥성공 시 에러 없이 화면 전환 수행
    btn.classList.remove('hidden'); spinner.classList.add('hidden');
    window.changeDashboardTab('storage');
  } catch (e) { 
    alert("출제 실패: API를 확인해주세요. [" + e.message + "]"); 
    // 🔥실패 시 반드시 스피너 제거
    btn.classList.remove('hidden'); spinner.classList.add('hidden');
  }
};

// ==========================================
// 5. 연습 모드 다시 풀기 & 퀴즈 초록색/빨간색 피드백 원복
// ==========================================
window.renderStorageTab = function() {
  const grid = document.getElementById('storage-sheets-grid'); if (!grid) return; grid.innerHTML = '';
  const filterList = document.getElementById('storage-subject-list');
  if (filterList) {
    filterList.innerHTML = `<button onclick="window.filterStorageScope('all')" class="w-full text-left px-2 py-1.5 text-[10px] font-bold rounded bg-indigo-500/15 text-indigo-400 mb-1">전체 보기</button>`;
    Object.keys(studySubjects).forEach(k => {
      filterList.innerHTML += `<button onclick="window.filterStorageScope('${studySubjects[k].name}')" class="w-full text-left px-2 py-1.5 text-[10px] text-slate-400 hover:bg-slate-900">${studySubjects[k].name}</button>`;
    });
  }
  window.filterStorageScope('all');
};

window.filterStorageScope = function(subjName) {
  const grid = document.getElementById('storage-sheets-grid'); if (!grid) return; grid.innerHTML = '';
  const list = subjName === 'all' ? quizSheets : quizSheets.filter(s => s.subject === subjName);
  list.forEach(sheet => {
    grid.innerHTML += `<div class="p-3.5 rounded-xl border border-slate-850 bg-slate-900/40 space-y-2">
      <div>
        <div class="flex justify-between text-[9px] text-slate-500 font-bold"><span>${sheet.createdDate}</span><button onclick="window.purgeSheetData('${sheet.id}')" class="text-rose-400">삭제</button></div>
        <h4 class="text-xs font-black text-slate-200 mt-1 truncate">${sheet.title}</h4>
      </div>
      <div class="flex justify-between items-center pt-2 border-t border-slate-850/60">
        <span class="text-[10px] font-black ${sheet.isSolved ? 'text-emerald-400' : 'text-amber-400'}">${sheet.isSolved ? `${sheet.score}점` : '미응시'}</span>
        <button onclick="window.startQuizSheetTrigger('${sheet.id}')" class="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold">${(sheet.isSolved && sheet.type === 'practice') ? '다시 풀기(XP 파밍)' : (sheet.isSolved ? '리뷰 보기' : '응시')}</button>
      </div>
    </div>`;
  });
};

window.purgeSheetData = function(id) { quizSheets = quizSheets.filter(s => s.id !== id); writeAndSyncStorage(); window.renderStorageTab(); };

window.startQuizSheetTrigger = function(id) {
  activeQuizSheet = quizSheets.find(s => s.id === id); if (!activeQuizSheet) return;
  
  // 🔥 연습 문제 무한 재수강 및 초기화 규칙 복원
  if (activeQuizSheet.isSolved && activeQuizSheet.type === 'practice') {
      if(confirm("이 연습 문제를 다시 푸시겠습니까? (기존 점수는 초기화됩니다)")) {
          activeQuizSheet.isSolved = false; activeQuizSheet.score = null;
          writeAndSyncStorage();
      } else { return; }
  }

  currentQuestionIdx = 0;
  studentAnswers = Array.from({ length: activeQuizSheet.questions.length }, () => ({ chosen: null, isSubmitted: false }));
  document.getElementById('home-view').classList.add('hidden');
  document.getElementById('quiz-view').classList.remove('hidden');
  document.getElementById('quiz-title-label').textContent = activeQuizSheet.title;
  window.loadTargetQuestion();
};

window.loadTargetQuestion = function() {
  const q = activeQuizSheet.questions[currentQuestionIdx];
  const ans = studentAnswers[currentQuestionIdx];
  document.getElementById('question-index-label').textContent = `Q. ${String(currentQuestionIdx + 1).padStart(2, '0')}`;
  document.getElementById('question-text').textContent = q.question;

  // 🔥 하단 네비게이션 그리드 빨간색/초록색 피드백 원복
  const navGrid = document.getElementById('question-navigation-grid');
  if (navGrid) {
    navGrid.innerHTML = '';
    activeQuizSheet.questions.forEach((item, i) => {
      const targetAns = studentAnswers[i];
      let stateClass = "bg-slate-950 text-slate-500 border-slate-850";
      
      if (activeQuizSheet.type === 'practice') {
          if (targetAns.isSubmitted) {
              if (targetAns.chosen === item.answer) stateClass = "bg-emerald-900/40 text-emerald-400 border-emerald-500";
              else stateClass = "bg-rose-900/40 text-rose-400 border-rose-500";
          } else if (targetAns.chosen !== null) {
              stateClass = "bg-indigo-900/30 text-indigo-400 border-indigo-800";
          }
      } else {
          if (targetAns.chosen !== null) stateClass = "bg-indigo-900/30 text-indigo-400 border-indigo-800";
      }
      if (i === currentQuestionIdx) stateClass += " ring-1 ring-white scale-110 font-black";
      
      navGrid.innerHTML += `<button onclick="window.jumpToDirectQuestion(${i})" class="w-6 h-6 rounded border text-[10px] font-bold transition-all ${stateClass}">${i+1}</button>`;
    });
  }

  // 🔥 선택지 목록 빨간색/초록색 색상 원복 및 치트 글로우 매핑
  const optContainer = document.getElementById('options-container'); optContainer.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const isCorrectIndex = idx === q.answer;
    const cheatStyle = (isAdminCheatEnabled && isCorrectIndex) ? "admin-correct-hint border-amber-500" : "border-slate-800";
    let optClass = "w-full text-left p-3 rounded-xl border text-xs transition-all hover:bg-slate-900 ";
    
    if (activeQuizSheet.type === 'practice' && ans.isSubmitted) {
        if (idx === q.answer) optClass += "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold";
        else if (ans.chosen === idx) optClass += "border-rose-500 bg-rose-500/10 text-rose-400 font-bold";
        else optClass += "border-slate-800 text-slate-500";
    } else {
        if (ans.chosen === idx) optClass += "border-indigo-500 bg-indigo-500/10 text-indigo-400 font-bold";
        else optClass += cheatStyle + " text-slate-200 font-medium";
    }

    const btn = document.createElement('button');
    btn.className = optClass; btn.innerHTML = `<span>${idx + 1}. ${opt}</span>`;
    btn.onclick = () => { if (!ans.isSubmitted && !activeQuizSheet.isSolved) { ans.chosen = idx; window.loadTargetQuestion(); } };
    optContainer.appendChild(btn);
  });

  const actBtn = document.getElementById('action-btn');
  const feedBox = document.getElementById('feedback-box');

  if (activeQuizSheet.type === 'practice' && !activeQuizSheet.isSolved) {
    if (ans.isSubmitted) {
      actBtn.textContent = "채점 완료"; actBtn.className = "px-4 py-1.5 bg-slate-800 text-slate-500 text-xs font-bold rounded-xl";
      feedBox.classList.remove('hidden');
      feedBox.className = ans.chosen === q.answer ? "rounded-xl p-3 bg-emerald-500/5 border border-emerald-500/30 text-emerald-400 text-xs mt-1" : "rounded-xl p-3 bg-rose-500/5 border border-rose-500/30 text-rose-400 text-xs mt-1";
      document.getElementById('feedback-title').textContent = ans.chosen === q.answer ? "🎉 정답입니다!" : "❌ 오답입니다.";
      document.getElementById('explanation-text').textContent = q.explanation;
    } else if (ans.chosen !== null) {
      actBtn.textContent = "🎯 즉시 채점"; actBtn.className = "px-4 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl";
      actBtn.onclick = () => { ans.isSubmitted = true; accumulatedStats.totalSolvedCount++; window.loadTargetQuestion(); };
      feedBox.classList.add('hidden');
    } else {
      actBtn.textContent = "마킹 대기"; actBtn.className = "px-4 py-1.5 bg-slate-800 text-slate-500 text-xs font-bold rounded-xl"; feedBox.classList.add('hidden');
    }
  } else {
    feedBox.classList.add('hidden');
    if (activeQuizSheet.isSolved) {
      feedBox.classList.remove('hidden'); feedBox.className = "rounded-xl p-3 bg-slate-950 border border-slate-800 text-slate-300 text-xs mt-1";
      document.getElementById('feedback-title').textContent = `[해설 리뷰]`; document.getElementById('explanation-text').textContent = q.explanation;
    }
    actBtn.textContent = (ans.chosen !== null) ? "선택 완료" : "마킹 대기";
    actBtn.className = "px-4 py-1.5 bg-slate-800 text-slate-500 text-xs font-bold rounded-xl";
  }

  const nextBtn = document.getElementById('btn-next');
  if (currentQuestionIdx === activeQuizSheet.questions.length - 1) {
    nextBtn.textContent = activeQuizSheet.isSolved ? "리포트 닫기" : "최종 제출";
    nextBtn.onclick = window.submitEntireQuizSheet;
  } else {
    nextBtn.textContent = "다음 문항"; nextBtn.onclick = window.navigateNext;
  }
};

window.jumpToDirectQuestion = function(idx) { currentQuestionIdx = idx; window.loadTargetQuestion(); };
window.navigatePrev = function() { if (currentQuestionIdx > 0) { currentQuestionIdx--; window.loadTargetQuestion(); } };
window.navigateNext = function() { if (currentQuestionIdx < activeQuizSheet.questions.length - 1) { currentQuestionIdx++; window.loadTargetQuestion(); } };

window.submitEntireQuizSheet = async function() {
  if (activeQuizSheet.isSolved) { window.changeDashboardTab('storage'); return; }
  
  let correctHits = 0;
  activeQuizSheet.questions.forEach((q, i) => {
    if (activeQuizSheet.type === 'practice') { if (studentAnswers[i].chosen === q.answer) correctHits++; }
    else { if (studentAnswers[i].chosen === q.answer) correctHits++; accumulatedStats.totalSolvedCount++; }
  });

  const finalScore = Math.round((correctHits / activeQuizSheet.questions.length) * 100);
  activeQuizSheet.score = finalScore; activeQuizSheet.isSolved = true;
  pocketMoney += correctHits * 500;
  
  if (activeQuizSheet.type === 'practice') {
    const key = `${activeQuizSheet.subject}___${activeQuizSheet.chapter}`;
    if (chaptersState[key]) {
      chaptersState[key].exp += correctHits;
      if (chaptersState[key].exp >= 10 && chaptersState[key].tier !== "마스터") chaptersState[key].promotionReady = true;
    }
    userLevelState.exp += (correctHits * 2);
  } else {
    const key = `${activeQuizSheet.subject}___${activeQuizSheet.chapter}`;
    if (chaptersState[key]) {
      if (finalScore >= 90) chaptersState[key].tier = "마스터";
      else if (finalScore >= 75) chaptersState[key].tier = "다이아";
      else chaptersState[key].tier = "실버";
      chaptersState[key].exp = 0; chaptersState[key].promotionReady = false;
    }
    userLevelState.exp += (correctHits * 5);
  }

  await writeAndSyncStorage();
  
  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('result-view').classList.remove('hidden');
  document.getElementById('final-score').textContent = correctHits;
  document.getElementById('final-total').textContent = activeQuizSheet.questions.length;
  document.getElementById('result-reward-toast').textContent = `기본 보상: +${correctHits * 500}원 지급`;

  const rList = document.getElementById('review-list'); rList.innerHTML = '';
  activeQuizSheet.questions.forEach((q, i) => {
    const isCorrect = studentAnswers[i].chosen === q.answer;
    rList.innerHTML += `<div class="py-2.5 text-[10px] border-b border-slate-900/60"><p class="font-bold text-slate-200">${i+1}. ${q.question}</p>
      <p class="mt-0.5 ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}">선택: ${q.options[studentAnswers[i].chosen] || "미응시"} | 정답: ${q.options[q.answer]}</p></div>`;
  });
  
  // 분석 리포트 초기화
  document.getElementById('analysis-report-container').classList.add('hidden');
  document.getElementById('generate-analysis-btn').classList.remove('hidden');
  document.getElementById('generate-analysis-btn').disabled = false;
  document.getElementById('generate-analysis-btn').textContent = "✨ 취약점 분석 리포트 생성";
};

// ==========================================
// 6. ✨ AI 분석결과 리포트 통신 복원
// ==========================================
window.generateAnalysisReport = async function() {
  const btn = document.getElementById('generate-analysis-btn');
  const container = document.getElementById('analysis-report-container');
  const content = document.getElementById('analysis-report-content');
  if(!geminiModule) { alert("AI 모듈이 연결되지 않았습니다."); return; }
  
  btn.textContent = "AI가 취약점을 정밀 분석 중입니다..."; btn.disabled = true;
  
  let wrongData = [];
  activeQuizSheet.questions.forEach((q, i) => {
      if(studentAnswers[i].chosen !== q.answer) wrongData.push(`문제: ${q.question}\n선택: ${q.options[studentAnswers[i].chosen]}\n정답: ${q.options[q.answer]}`);
  });
  
  const prompt = wrongData.length === 0 ? "이 학생은 만점을 받았습니다. 칭찬과 함께 다음 학습을 짧게 제안해주세요." : `다음 학생의 오답 데이터를 바탕으로 취약 개념을 심화 분석하고 학습 방향을 제시하는 '분석결과리포트'를 작성하세요.\n${wrongData.join('\n\n')}`;
  
  try {
      const res = await geminiModule.callGemini(prompt, "친절하고 전문적인 전공 핵심 AI 튜터입니다.");
      container.classList.remove('hidden');
      content.textContent = res;
      btn.classList.add('hidden');
  } catch(e) {
      alert("분석 실패: " + e.message);
      btn.textContent = "✨ 취약점 분석 리포트 생성"; btn.disabled = false;
  }
};

// ==========================================
// 7. 치트 권한 및 프로필 UI 렌더링
// ==========================================
window.toggleAdminMode = function() {
  isAdminCheatEnabled = !isAdminCheatEnabled;
  alert(`🛠️ 관리자 치트 모드가 ${isAdminCheatEnabled ? '활성화' : '비활성화'} 되었습니다.\n(퀴즈 풀이 시 정답 선지에 주황색 테두리 광채가 표시됩니다.)`);
};

window.renderProfileTab = function() {
  document.getElementById('pocket-money-balance').textContent = `${pocketMoney.toLocaleString()}원`;
  document.getElementById('profile-level-badge').textContent = `LV.${userLevelState.level}`;
  document.getElementById('profile-exp-label').textContent = `${userLevelState.exp} / 50 XP`;

  const accordion = document.getElementById('subject-accordion-container'); if (!accordion) return; accordion.innerHTML = '';
  const keys = Object.keys(studySubjects);
  if (keys.length === 0) { accordion.innerHTML = '<div class="text-center py-4 text-slate-500 text-[10px] font-bold">과목이 없습니다.</div>'; return; }
  
  keys.forEach(k => {
    const sub = studySubjects[k]; let childDOMs = "";
    Object.keys(sub.chapters || {}).forEach(cid => {
      const c = sub.chapters[cid]; const st = chaptersState[`${sub.name}___${c.name}`] || { tier: "Unrank", exp: 0 };
      childDOMs += `<div class="p-2 rounded border flex justify-between items-center text-[10px] bg-slate-950/60 border-slate-900 text-slate-400"><span>📖 ${c.name}</span><span class="font-bold">[${st.tier}: ${st.exp}/10 XP]</span></div>`;
    });
    accordion.innerHTML += `<div class="p-3 bg-slate-900/40 border border-slate-850 rounded-xl text-left space-y-1.5"><h4 class="font-black text-xs text-slate-200">📘 ${sub.name}</h4><div class="space-y-1">${childDOMs}</div></div>`;
  });
};

window.checkAttendance = function() {
  const today = new Date().toISOString().split('T')[0];
  if (lastAttendedDate === today) { alert("이미 오늘의 출석을 완료했습니다."); return; }
  pocketMoney += 500 + (userLevelState.level * 50); lastAttendedDate = today;
  writeAndSyncStorage(); window.renderProfileTab(); alert("출석 완료! 용돈이 지급되었습니다.");
};

window.spendPocketMoney = function() {
  const desc = document.getElementById('spend-desc-input').value.trim();
  const amt = parseInt(document.getElementById('spend-amount-input').value, 10);
  if(!desc || isNaN(amt)) return;
  pocketMoney -= amt; document.getElementById('spend-desc-input').value = ""; document.getElementById('spend-amount-input').value = "";
  writeAndSyncStorage(); window.renderProfileTab();
};

window.exportProgressText = function() { navigator.clipboard.writeText(btoa(encodeURIComponent(JSON.stringify({studySubjects, chaptersState, quizSheets, pocketMoney, userLevelState})))).then(()=>alert("복사됨")); };
window.importProgressText = function() {
  const code = prompt("백업 코드를 붙여넣으세요."); if(!code) return;
  try {
    const data = JSON.parse(decodeURIComponent(atob(code.trim())));
    studySubjects = data.studySubjects || {}; chaptersState = data.chaptersState || {}; quizSheets = data.quizSheets || []; pocketMoney = data.pocketMoney || 0;
    writeAndSyncStorage(); location.reload();
  } catch(e) { alert("유효하지 않은 코드입니다."); }
};
window.clearAllDataStorage = function() { if(confirm("포맷하시겠습니까?")) { localStorage.clear(); location.reload(); } };

// ==========================================
// 8. 초기화 및 빈 화면 버그 픽스
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  loadStorageFromLocal();
  
  // 🔥 하얀 빈 탭 방지용 강제 렌더링 지연 호출
  setTimeout(() => { window.changeDashboardTab('profile'); }, 50);
  
  document.getElementById('gen-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    document.getElementById('gen-file-status').textContent = "교안 파싱 중...";
    try { activeUploadedText = await geminiModule.extractTextFromFile(file); document.getElementById('gen-file-status').innerHTML = `<span class="text-emerald-400">성공! ${file.name.substring(0,10)}</span>`; } 
    catch(err) { document.getElementById('gen-file-status').innerHTML = "파싱 실패"; }
  });

  try {
    geminiModule = await import('./gemini-engine.js');
    authModule = await import('./firebase-auth.js');

    const apiInput = document.getElementById('api-key-input');
    if (apiInput) apiInput.value = geminiModule.getGeminiKey();
    window.updateCustomGeminiKey = function() { geminiModule.saveGeminiKey(apiInput.value); alert("키 저장 완료"); };

    if (authModule.isFirebaseInitialized) {
      authModule.onAuthStateChanged(authModule.auth, async (user) => {
        if (user) {
          window.currentUser = user;
          // 🔥 게스트 계정 표기 버그 완전 해결
          const nameEl = document.getElementById('profile-user-name');
          const emailEl = document.getElementById('profile-user-email');
          if(nameEl) nameEl.textContent = user.displayName || "구글 사용자";
          if(emailEl) emailEl.textContent = user.email || "(연동됨)";
          
          const cloudData = await authModule.loadFromCloud(user.uid, customSyncKey);
          if (cloudData) {
            studySubjects = cloudData.studySubjects || {}; studyMaterials = cloudData.studyMaterials || {}; chaptersState = cloudData.chaptersState || {}; quizSheets = cloudData.quizSheets || []; pocketMoney = cloudData.pocketMoney || 0; moneyHistory = cloudData.moneyHistory || []; userLevelState = cloudData.userLevelState || {level:1,exp:0}; lastAttendedDate = cloudData.lastAttendedDate || ""; schedulesState = cloudData.schedulesState || []; accumulatedStats = cloudData.accumulatedStats || {winPromoteCount:0,perfectScoreCount:0,totalSolvedCount:0};
          }
          document.getElementById('sync-status-dot').className = "w-1.5 h-1.5 rounded-full bg-emerald-400";
          document.getElementById('sync-status-text').textContent = "클라우드 됨";
        } else {
          window.currentUser = null;
        }
        window.renderProfileTab();
      });
    }

    const authBtn = document.getElementById('auth-action-btn');
    if (authBtn) {
      authBtn.textContent = window.currentUser ? "로그아웃" : "🌐 구글 연동";
      authBtn.onclick = async () => { if (window.currentUser) { await authModule.logoutUser(); location.reload(); } else { try { await authModule.loginWithGoogle(); } catch(e) { alert("로그인 오류: " + e.message); } } };
    }
  } catch (err) { console.warn("모듈 비동기 오류", err); }
});
