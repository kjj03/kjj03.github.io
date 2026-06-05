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
// 글로벌 뷰 라우터 (윈도우 선제 바인딩)
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

  if (id === 'profile') window.renderProfileTab();
  if (id === 'subjects') window.renderSubjectManageTab();
  if (id === 'generate') window.renderGenerateTab();
  if (id === 'storage') window.renderStorageTab();
};

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
    globalMemoText = localStorage.getItem('globalMemoText_v7') || "";
    customSyncKey = localStorage.getItem('customSyncKey_v7') || DEFAULT_APP_ID;
    accumulatedStats = JSON.parse(localStorage.getItem('accumulatedStats_v7') || '{"winPromoteCount":0,"perfectScoreCount":0,"totalSolvedCount":0}');
    
    const memoArea = document.getElementById('global-memo-area');
    if (memoArea) memoArea.value = globalMemoText;
    const keyInput = document.getElementById('custom-sync-key-input');
    if (keyInput) keyInput.value = customSyncKey;
  } catch (e) { console.warn("로컬 스토리지 캐시 로드 우회"); }
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
  localStorage.setItem('globalMemoText_v7', globalMemoText);
  localStorage.setItem('customSyncKey_v7', customSyncKey);
  localStorage.setItem('accumulatedStats_v7', JSON.stringify(accumulatedStats));

  if (window.currentUser && authModule) {
    try {
      const pkg = { studySubjects, studyMaterials, chaptersState, quizSheets, pocketMoney, moneyHistory, userLevelState, lastAttendedDate, schedulesState, globalMemoText, accumulatedStats };
      await authModule.saveToCloud(window.currentUser.uid, pkg, customSyncKey).catch(() => {});
    } catch (e) {}
  }
}

window.saveGlobalMemoText = function() {
  const area = document.getElementById('global-memo-area');
  if (area) {
    globalMemoText = area.value;
    localStorage.setItem('globalMemoText_v7', globalMemoText);
  }
};

// ==========================================
// 🛠️ 오리지널 치트 인프라 맵 유효화
// ==========================================
window.toggleAdminMode = function() {
  isAdminCheatEnabled = !isAdminCheatEnabled;
  const panel = document.getElementById('admin-cheat-panel');
  const macros = document.getElementById('admin-quiz-macros');
  if (panel) panel.className = isAdminCheatEnabled ? "bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl text-left space-y-2 block" : "hidden";
  if (macros) macros.className = isAdminCheatEnabled ? "p-2 bg-amber-950/10 border border-dashed border-amber-500/20 rounded-lg flex gap-2 block" : "hidden";
  alert(`🛠️ 치트 디버깅 패널 인터페이스 상태: ${isAdminCheatEnabled ? '활성화' : '비활성화'}`);
};

window.adminForceChallenger = function() {
  if (!isAdminCheatEnabled) return;
  Object.keys(chaptersState).forEach(k => {
    chaptersState[k].tier = "마스터";
    chaptersState[k].exp = 0;
    chaptersState[k].promotionReady = false;
  });
  accumulatedStats.winPromoteCount = 3;
  writeAndSyncStorage().then(() => { window.renderProfileTab(); alert("🔮 전 과목의 단원 티어가 '마스터' 등급으로 강제 갱신되었습니다."); });
};

window.adminInstantPromote = function() {
  if (!isAdminCheatEnabled) return;
  const sId = document.getElementById('gen-subject-select').value;
  const cId = document.getElementById('gen-chapter-select').value;
  if (!sId || !cId) { alert("상단 생성 설정 탭에서 대상 과목과 단원을 먼저 선택하십시오."); return; }
  const sub = studySubjects[sId]; const chap = sub.chapters[cId];
  const key = `${sub.name}___${chap.name}`;
  if (!chaptersState[key]) chaptersState[key] = { tier: "Unrank", exp: 0 };
  chaptersState[key].exp = 10;
  chaptersState[key].promotionReady = true;
  writeAndSyncStorage().then(() => { window.updateGenerateTypeLock(); alert("⚡ 선택한 챕터 범위의 승급전 요건(10 XP)이 즉시 마운트되었습니다."); });
};

window.adminSubmitAllCorrect = function() {
  if (!isAdminCheatEnabled || !activeQuizSheet) return;
  activeQuizSheet.questions.forEach((q, i) => {
    studentAnswers[i] = { chosen: q.answer, isSubmitted: true };
  });
  window.loadTargetQuestion();
  alert("🎯 마킹 가이드 정답 자동 동기화 처리가 완료되었습니다. 최종 제출을 클릭하십시오.");
};

window.updateCustomSyncKey = function() {
  const input = document.getElementById('custom-sync-key-input');
  if (!input || !input.value.trim()) return;
  customSyncKey = input.value.trim();
  localStorage.setItem('customSyncKey_v7', customSyncKey);
  alert(`🔒 클라우드 저장 분기 식별 키 자산이 [ ${customSyncKey} ] (으)로 업데이트되었습니다.`);
};

window.manualSaveToCloud = async function() {
  if (!window.currentUser || !authModule) { alert("구글 계정 연동 상태가 아닙니다."); return; }
  try {
    const pkg = { studySubjects, studyMaterials, chaptersState, quizSheets, pocketMoney, moneyHistory, userLevelState, lastAttendedDate, schedulesState, globalMemoText, accumulatedStats };
    await authModule.saveToCloud(window.currentUser.uid, pkg, customSyncKey);
    alert("📤 로컬 진도 데이터 스냅샷이 지정된 싱크 스페이스에 영구 백업 기입되었습니다.");
  } catch (e) { alert("동기화 통신 에러: " + e.message); }
};

window.manualLoadFromCloud = async function() {
  if (!window.currentUser || !authModule) { alert("구글 계정 연동 상태가 아닙니다."); return; }
  try {
    const cloudData = await authModule.loadFromCloud(window.currentUser.uid, customSyncKey);
    if (cloudData) {
      studySubjects = cloudData.studySubjects || {}; studyMaterials = cloudData.studyMaterials || {}; chaptersState = cloudData.chaptersState || {}; quizSheets = cloudData.quizSheets || []; pocketMoney = cloudData.pocketMoney || 0; moneyHistory = cloudData.moneyHistory || []; userLevelState = cloudData.userLevelState || {level:1,exp:0}; lastAttendedDate = cloudData.lastAttendedDate || ""; schedulesState = cloudData.schedulesState || []; globalMemoText = cloudData.globalMemoText || ""; accumulatedStats = cloudData.accumulatedStats || {winPromoteCount:0,perfectScoreCount:0,totalSolvedCount:0};
      await writeAndSyncStorage();
      location.reload();
    } else { alert("해당 동기화 스페이스 내에 백업 Progress 데이터를 찾을 수 없습니다."); }
  } catch (e) { alert("데이터 수신 장애: " + e.message); }
};

// ==========================================
// 과목 관리 및 단원 빌더
// ==========================================
window.createNewSubject = function() {
  const input = document.getElementById('subj-name-input');
  if (!input || !input.value.trim()) return;
  const name = input.value.trim();
  const id = "subject_" + Date.now();
  studySubjects[id] = { id, name, chapters: {} };
  input.value = "";
  window.renderSubjectManageTab();
  writeAndSyncStorage().catch(() => {});
};

window.renderSubjectManageTab = function() {
  const list = document.getElementById('subject-manage-list');
  if (!list) return; list.innerHTML = '';
  const keys = Object.keys(studySubjects);
  if (keys.length === 0) { list.innerHTML = `<span class="text-[10px] text-slate-500 block text-center py-2">과목이 없습니다.</span>`; return; }
  
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

window.createNewChapter = function() {
  if (!selectedSubjectId) return;
  const el = document.getElementById('chap-name-input');
  const name = el.value.trim();
  if (!name || !activeUploadedText) { alert("단원명 지정 및 파싱 파일 적재가 완료되지 않았습니다."); return; }
  
  const sub = studySubjects[selectedSubjectId];
  const cid = "chapter_" + Date.now();
  sub.chapters[cid] = { id: cid, name: name };
  const key = `${sub.name}___${name}`;
  studyMaterials[key] = { subject: sub.name, chapter: name, contents: [activeUploadedText] };
  chaptersState[key] = { subject: sub.name, chapter: name, tier: "Unrank", exp: 0, promotionReady: false };
  
  activeUploadedText = ""; el.value = ""; document.getElementById('gen-file-input').value = ""; document.getElementById('gen-file-status').innerHTML = "교안 문서 업로드";
  window.renderChapterListPanel();
  writeAndSyncStorage().catch(() => {});
};

window.renderChapterListPanel = function() {
  const container = document.getElementById('chapter-manage-list');
  if (!container || !selectedSubjectId) return; container.innerHTML = '';
  const sub = studySubjects[selectedSubjectId];
  Object.keys(sub.chapters || {}).forEach(k => {
    container.innerHTML += `<div class="p-2.5 bg-slate-950/80 rounded border border-slate-850 text-[10px] text-slate-300">📖 ${sub.chapters[k].name}</div>`;
  });
};

window.deleteCurrentSubject = function() {
  if (!selectedSubjectId || !confirm("완전 폐강하시겠습니까?")) return;
  delete studySubjects[selectedSubjectId]; selectedSubjectId = null;
  window.renderSubjectManageTab(); writeAndSyncStorage().catch(() => {});
};

// ==========================================
// 📚 보관함 및 오리지널 정오 대조 리포트 복원 구역
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
    let buttonCluster = "";
    if (sheet.isSolved) {
      buttonCluster = `
        <div class="flex gap-1.5">
          <button onclick="window.viewQuizAnalysisReport('${sheet.id}')" class="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-black">📊 분석 결과 보기</button>
          ${sheet.type === 'practice' ? `<button onclick="window.startQuizSheetTrigger('${sheet.id}')" class="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[10px] font-bold">🔄 다시 풀기</button>` : ''}
        </div>
      `;
    } else {
      buttonCluster = `<button onclick="window.startQuizSheetTrigger('${sheet.id}')" class="px-3 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold">📝 시험 응시</button>`;
    }

    grid.innerHTML += `<div class="p-3.5 rounded-xl border border-slate-850 bg-slate-900/40 space-y-2">
      <div>
        <div class="flex justify-between text-[9px] text-slate-500 font-bold"><span>📅 ${sheet.createdDate}</span><button onclick="window.purgeSheetData('${sheet.id}')" class="text-rose-400">삭제</button></div>
        <h4 class="text-xs font-black text-slate-200 mt-1 truncate">${sheet.title}</h4>
      </div>
      <div class="flex justify-between items-center pt-2 border-t border-slate-850/60">
        <span class="text-[10px] font-black ${sheet.isSolved ? 'text-emerald-400' : 'text-amber-400'}">${sheet.isSolved ? `${sheet.score}점` : '진입 대기'}</span>
        ${buttonCluster}
      </div>
    </div>`;
  });
};

window.purgeSheetData = function(id) { quizSheets = quizSheets.filter(s => s.id !== id); writeAndSyncStorage(); window.renderStorageTab(); };

// [요구사항 구현] 이미 풀린 시험지의 정오표 및 해설을 완벽하게 동기화해 여는 분석 함수
window.viewQuizAnalysisReport = function(id) {
  activeQuizSheet = quizSheets.find(s => s.id === id); if (!activeQuizSheet) return;
  
  // 라우터 수동 스위칭 격리 개방
  document.getElementById('home-view').classList.add('hidden');
  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('result-view').classList.remove('hidden');
  
  let tempHits = 0;
  activeQuizSheet.questions.forEach((q, i) => {
    if (studentAnswers[i] && studentAnswers[i].chosen === q.answer) tempHits++;
  });
  
  document.getElementById('final-score').textContent = activeQuizSheet.score !== null ? Math.round(activeQuizSheet.score * (activeQuizSheet.questions.length / 100)) : tempHits;
  document.getElementById('final-total').textContent = activeQuizSheet.questions.length;
  document.getElementById('result-reward-toast').textContent = `과거 완료된 제출 이력 분석 대조표 모드입니다.`;

  // 📝 [요구사항 원복] 선택지 매칭 및 실제 정답 해설 정밀 인젝션 구현
  const rList = document.getElementById('review-list'); rList.innerHTML = '';
  activeQuizSheet.questions.forEach((q, i) => {
    const isCorrect = studentAnswers[i] && studentAnswers[i].chosen === q.answer;
    const studentChoiceText = (studentAnswers[i] && studentAnswers[i].chosen !== null) ? q.options[studentAnswers[i].chosen] : "미응시 오답";
    rList.innerHTML += `
      <div class="py-3 text-[11px] border-b border-slate-900/80">
        <p class="font-bold text-slate-200">${i+1}. ${q.question}</p>
        <p class="mt-1 ${isCorrect ? 'text-emerald-400' : 'text-rose-400'} font-medium">
          ❌ 내가 선택한 선지: ${studentChoiceText} | 🎯 실제 정답: ${q.options[q.answer]}
        </p>
        <p class="text-[10px] text-slate-400 mt-1.5 leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-900">
          💡 문항 해설: ${q.explanation}
        </p>
      </div>`;
  });
  
  document.getElementById('analysis-report-container').classList.add('hidden');
  document.getElementById('generate-analysis-btn').classList.remove('hidden');
  document.getElementById('generate-analysis-btn').disabled = false;
};

window.startQuizSheetTrigger = function(id) {
  activeQuizSheet = quizSheets.find(s => s.id === id); if (!activeQuizSheet) return;
  
  // 🔥 [연습 과제 격리 다시풀기 룰 충족] 맞춘 문제는 유지하고 틀린 번호 세션만 초기화
  if (activeQuizSheet.isSolved && activeQuizSheet.type === 'practice') {
    if(confirm("맞춘 문제는 초록색 정답 상태로 보존하고 오답 문항만 초기화하여 다시 풀이하시겠습니까?")) {
        activeQuizSheet.isSolved = false; activeQuizSheet.score = null;
        activeQuizSheet.questions.forEach((q, i) => {
            if (studentAnswers[i] && studentAnswers[i].chosen !== q.answer) {
                studentAnswers[i].chosen = null;
                studentAnswers[i].isSubmitted = false;
            }
        });
        writeAndSyncStorage().catch(() => {});
    } else { return; }
  } else if (!activeQuizSheet.isSolved) {
    if (!studentAnswers || studentAnswers.length !== activeQuizSheet.questions.length) {
      studentAnswers = Array.from({ length: activeQuizSheet.questions.length }, () => ({ chosen: null, isSubmitted: false }));
    }
  }

  currentQuestionIdx = 0;
  for(let i=0; i<studentAnswers.length; i++){
    if(!studentAnswers[i] || !studentAnswers[i].isSubmitted) { currentQuestionIdx = i; break; }
  }

  document.getElementById('home-view').className = "hidden";
  document.getElementById('quiz-view').className = "space-y-4 block";
  document.getElementById('quiz-title-label').textContent = activeQuizSheet.title;
  window.loadTargetQuestion();
};

window.loadTargetQuestion = function() {
  const q = activeQuizSheet.questions[currentQuestionIdx];
  const ans = studentAnswers[currentQuestionIdx] || { chosen: null, isSubmitted: false };
  studentAnswers[currentQuestionIdx] = ans;
  
  document.getElementById('question-index-label').textContent = `Q. ${String(currentQuestionIdx + 1).padStart(2, '0')}`;
  document.getElementById('question-text').textContent = q.question;

  const navGrid = document.getElementById('question-navigation-grid');
  if (navGrid) {
    navGrid.innerHTML = '';
    activeQuizSheet.questions.forEach((item, i) => {
      const targetAns = studentAnswers[i];
      let stateClass = "bg-slate-950 text-slate-500 border-slate-850";
      
      if (targetAns && targetAns.isSubmitted) {
        if (targetAns.chosen === item.answer) stateClass = "bg-emerald-900/40 text-emerald-400 border-emerald-500";
        else stateClass = "bg-rose-900/40 text-rose-400 border-rose-500";
      } else if (targetAns && targetAns.chosen !== null) {
        stateClass = "bg-indigo-900/30 text-indigo-400 border-indigo-800";
      }
      if (i === currentQuestionIdx) stateClass += " ring-1 ring-white scale-110 font-black";
      
      navGrid.innerHTML += `<button onclick="window.jumpToDirectQuestion(${i})" class="w-6 h-6 rounded border text-[10px] font-bold transition-all ${stateClass}">${i+1}</button>`;
    });
  }

  const optContainer = document.getElementById('options-container'); optContainer.innerHTML = '';
  q.options.forEach((opt, idx) => {
    let optClass = "w-full text-left p-3 rounded-xl border text-xs transition-all hover:bg-slate-900 border-slate-850 ";
    
    if (ans.isSubmitted) {
      if (idx === q.answer) optClass += "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold";
      else if (ans.chosen === idx) optClass += "border-rose-500 bg-rose-500/10 text-rose-400 font-bold";
      else optClass += "text-slate-500 border-slate-900";
    } else {
      if (ans.chosen === idx) optClass += "border-indigo-500 bg-indigo-500/10 text-indigo-400 font-bold";
      else optClass += "text-slate-200";
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
      actBtn.textContent = "🎯 즉시 채점"; actBtn.className = "px-4 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl cursor-pointer";
      actBtn.onclick = () => { ans.isSubmitted = true; window.loadTargetQuestion(); };
      feedBox.classList.add('hidden');
    } else {
      actBtn.textContent = "마킹 대기"; actBtn.className = "px-4 py-1.5 bg-slate-800 text-slate-500 text-xs font-bold rounded-xl"; feedBox.classList.add('hidden');
    }
  } else {
    feedBox.classList.add('hidden');
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

// ==========================================
// 최종 제출 연산 (용돈 보상 규칙 위반 버그 차단 완료)
// ==========================================
window.submitEntireQuizSheet = async function() {
  if (activeQuizSheet.isSolved) { window.changeDashboardTab('storage'); return; }
  
  let correctHits = 0;
  activeQuizSheet.questions.forEach((q, i) => {
    if (studentAnswers[i] && studentAnswers[i].chosen === q.answer) correctHits++;
  });

  const finalScore = Math.round((correctHits / activeQuizSheet.questions.length) * 100);
  
  // 📝 [버그 픽스] 다시 풀기가 아닌 "최초 풀이 단계"일 때만 누적 문항 수 업적 스택 가산
  if (activeQuizSheet.score === null || activeQuizSheet.score === undefined) {
    accumulatedStats.totalSolvedCount += activeQuizSheet.questions.length;
  }

  // 📝 [버그 픽스 및 규칙 강제] 문제지 최초 100점 도달 시에만 현실 용돈 1,000원 정액 적립 제한 필터
  let earnedMoneyToast = "최초 100점 미달 또는 다시풀기 상태이므로 추가 용돈 보상이 보류되었습니다.";
  if (finalScore === 100 && (!activeQuizSheet.hasReachedPerfect)) {
    pocketMoney += 1000;
    activeQuizSheet.hasReachedPerfect = true; // 완벽 보상 트리거 락
    accumulatedStats.perfectScoreCount++;
    earnedMoneyToast = "🎯 축하합니다! 문제지 최초 100점 달성 성과금 +1,000원이 지갑에 예치되었습니다!";
  }

  activeQuizSheet.score = finalScore; 
  activeQuizSheet.isSolved = true;
  
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
      if (finalScore >= 90) { chaptersState[key].tier = "마스터"; accumulatedStats.winPromoteCount++; }
      else if (finalScore >= 75) chaptersState[key].tier = "다이아";
      else chaptersState[key].tier = "실버";
      chaptersState[key].exp = 0; chaptersState[key].promotionReady = false;
    }
    userLevelState.exp += (correctHits * 5);
  }

  while (userLevelState.exp >= 50) { userLevelState.exp -= 50; userLevelState.level++; }

  await writeAndSyncStorage().catch(() => {});
  
  // 🔥 [버그 픽스 및 전이 강제] 제출 클릭 즉시 풀이창을 닫고 진단 리포트 뷰(result)로 강제 화면 점프
  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('result-view').classList.remove('hidden');
  
  document.getElementById('final-score').textContent = correctHits;
  document.getElementById('final-total').textContent = activeQuizSheet.questions.length;
  document.getElementById('result-reward-toast').textContent = earnedMoneyToast;

  // 오답 매칭 결과표 실시간 주입
  const rList = document.getElementById('review-list'); rList.innerHTML = '';
  activeQuizSheet.questions.forEach((q, i) => {
    const isCorrect = studentAnswers[i] && studentAnswers[i].chosen === q.answer;
    rList.innerHTML += `
      <div class="py-2.5 text-[10px] border-b border-slate-900/60">
        <p class="font-bold text-slate-200">${i+1}. ${q.question}</p>
        <p class="mt-0.5 ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}">
          선택 마킹 선지: ${q.options[studentAnswers[i].chosen] || "미응시"} | 정답 가이드라인: ${q.options[q.answer]}
        </p>
      </div>`;
  });
  
  document.getElementById('analysis-report-container').classList.add('hidden');
  document.getElementById('generate-analysis-btn').classList.remove('hidden');
  document.getElementById('generate-analysis-btn').disabled = false;
  document.getElementById('generate-analysis-btn').textContent = "✨ 틀린 오답 기반 취약점 분석 리포트 생성";
};

window.generateAnalysisReport = async function() {
  const btn = document.getElementById('generate-analysis-btn');
  const container = document.getElementById('analysis-report-container');
  const content = document.getElementById('analysis-report-content');
  if(!geminiModule) return;
  
  btn.textContent = "오답 데이터 기반 정밀 패턴 분석 중..."; btn.disabled = true;
  let wrongData = [];
  activeQuizSheet.questions.forEach((q, i) => {
    if(studentAnswers[i] && studentAnswers[i].chosen !== q.answer) wrongData.push(`문제:${q.question}\n선택:${q.options[studentAnswers[i].chosen]}\n정답:${q.options[q.answer]}`);
  });
  
  const prompt = wrongData.length === 0 ? "만점 도달 진단서 코멘트를 도출하세요." : `틀린 오답의 개념 보정 레포트를 학술적으로 도출하세요.\n${wrongData.join('\n\n')}`;
  
  try {
    const res = await geminiModule.callGemini(prompt, "대학 학술 AI 지도교수 튜터입니다.");
    container.classList.remove('hidden');
    content.textContent = res;
    btn.classList.add('hidden');
  } catch(e) {
    alert("오답 분석 지연: " + e.message);
    btn.textContent = "✨ 취약점 분석 리포트 생성"; btn.disabled = false;
  }
};

// ==========================================
// 📅 오리지널 플래너 및 캘린더 드로잉 매퍼
// ==========================================
window.renderSchedulesAndCalendar = function() {
  const container = document.getElementById('schedule-list-container');
  if (container) {
    container.innerHTML = schedulesState.length === 0 ? `<span class="text-[10px] text-slate-500 block text-center py-2">등록 일정이 없습니다.</span>` :
      schedulesState.map(s => `<div class="flex justify-between items-center p-2 bg-slate-950 rounded border border-slate-850 text-[10px]"><span>📅 ${s.text}</span><button onclick="window.deleteScheduleItem('${s.id}')" class="text-rose-400 font-bold">삭제</button></div>`).join('');
  }
  const grid = document.getElementById('calendar-days-grid');
  if (grid) {
    grid.innerHTML = '';
    for (let i = 1; i <= 30; i++) {
      const hasPlan = schedulesState.some(s => s.text.includes(`6/${i}`) || s.text.includes(`06/${i}`) || s.text.includes(`6월 ${i}일`));
      grid.innerHTML += `<div class="p-1.5 rounded border text-center transition-all ${hasPlan ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-black shadow-md' : 'bg-slate-950/40 border-slate-900 text-slate-400'}">${i}</div>`;
    }
  }
};

window.renderProfileTab = function() {
  document.getElementById('pocket-money-balance').textContent = `${pocketMoney.toLocaleString()}원`;
  document.getElementById('user-level-badge').textContent = `LV.${userLevelState.level}`;
  document.getElementById('user-xp-label').textContent = `${userLevelState.exp} / 50 XP`;
  document.getElementById('user-xp-bar').style.width = `${(userLevelState.exp / 50) * 100}%`;

  document.getElementById('achievement-prom-count').textContent = `${accumulatedStats.winPromoteCount}/3`;
  document.getElementById('achievement-prom-bar').style.width = `${Math.min((accumulatedStats.winPromoteCount / 3) * 100, 100)}%`;
  
  document.getElementById('achievement-perfect-count').textContent = `${accumulatedStats.perfectScoreCount}/5`;
  document.getElementById('achievement-perfect-bar').style.width = `${Math.min((accumulatedStats.perfectScoreCount / 5) * 100, 100)}%`;
  
  document.getElementById('achievement-solved-count').textContent = `${accumulatedStats.totalSolvedCount}/100`;
  document.getElementById('achievement-solved-bar').style.width = `${Math.min((accumulatedStats.totalSolvedCount / 100) * 100, 100)}%`;

  const accordion = document.getElementById('subject-accordion-container'); if (!accordion) return; accordion.innerHTML = '';
  const keys = Object.keys(studySubjects);
  if (keys.length === 0) { accordion.innerHTML = '<div class="text-center py-4 text-slate-500 text-[10px] font-bold">등록된 과목이 없습니다.</div>'; return; }
  
  keys.forEach(k => {
    const sub = studySubjects[k]; let childDOMs = "";
    Object.keys(sub.chapters || {}).forEach(cid => {
      const c = sub.chapters[cid]; const st = chaptersState[`${sub.name}___${c.name}`] || { tier: "Unrank", exp: 0 };
      childDOMs += `<div class="p-2 rounded border flex justify-between items-center text-[10px] bg-slate-950/60 border-slate-900 text-slate-400"><span>📖 ${c.name}</span><span class="font-bold">[${st.tier}: ${st.exp}/10 XP]</span></div>`;
    });
    accordion.innerHTML += `<div class="p-3 bg-slate-900/40 border border-slate-850 rounded-xl text-left space-y-1.5"><h4 class="font-black text-xs text-slate-200">📘 ${sub.name}</h4><div class="space-y-1">${childDOMs}</div></div>`;
  });
  window.renderSchedulesAndCalendar();
};

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

window.updateGenerateTypeLock = function() {
  const sId = document.getElementById('gen-subject-select').value;
  const cId = document.getElementById('gen-chapter-select').value;
  const realBtn = document.getElementById('type-btn-real'); if (!realBtn) return;
  const sub = studySubjects[sId]; const chap = sub?.chapters[cId];
  if (!sub || !chap) { realBtn.setAttribute('disabled', true); window.setGenType('practice'); return; }
  
  const key = `${sub.name}___${chap.name}`;
  const st = chaptersState[key] || { promotionReady: false, exp: 0 };
  if (st.promotionReady) {
    document.getElementById('real-mode-title-text').textContent = "🔥 실전 승급전 개방"; realBtn.removeAttribute('disabled');
  } else {
    document.getElementById('real-mode-title-text').textContent = `🔒 실전 승급전 (${st.exp}/10 XP)`; realBtn.setAttribute('disabled', true); window.setGenType('practice');
  }
};

let currentSelectedGenType = "practice";
window.setGenType = function(type) {
  currentSelectedGenType = type;
  document.getElementById('type-btn-practice').className = type === 'practice' ? "p-3 rounded-xl border-2 text-left w-full border-indigo-500 bg-indigo-500/5" : "p-3 rounded-xl border border-slate-800 text-left w-full opacity-60 text-slate-500";
  document.getElementById('type-btn-real').className = type === 'real' ? "p-3 rounded-xl border-2 text-left w-full border-indigo-500 bg-indigo-500/5" : "p-3 rounded-xl border border-slate-800 text-left w-full opacity-60 text-slate-500";
};

window.handleBuildQuiz = async function() {
  const sId = document.getElementById('gen-subject-select').value;
  const cId = document.getElementById('gen-chapter-select').value;
  if (!sId || !cId) return;
  const sub = studySubjects[sId]; const chap = sub.chapters[cId];
  const sourceText = studyMaterials[`${sub.name}___${chap.name}`]?.contents.join("\n") || "";
  if (!sourceText) return;

  const spinner = document.getElementById('gen-loading-spinner');
  const btn = document.getElementById('build-quiz-btn');
  btn.classList.add('hidden'); spinner.classList.remove('hidden');

  const countLimit = currentSelectedGenType === 'real' ? 20 : 10;
  const prompt = `과목:${sub.name}\n범위:${chap.name}\n문항수:${countLimit}\nJSON 데이터 규격 균등 출제.\n교안:\n${sourceText.substring(0, 15000)}`;

  try {
    const raw = await geminiModule.callGemini(prompt, "JSON 교수입니다.", true);
    const parsed = JSON.parse(raw);
    quizSheets.push({
      id: "sheet_" + Date.now(), title: parsed.title || `${sub.name} 맞춤형 평가`,
      subject: sub.name, chapter: chap.name,
      createdDate: new Date().toISOString().split('T')[0], isSolved: false, score: null,
      questions: parsed.questions.slice(0, countLimit).map((q, i) => ({ id: i + 1, ...q })), type: currentSelectedGenType,
      hasReachedPerfect: false
    });
    await writeAndSyncStorage();
    window.changeDashboardTab('storage');
  } catch (e) { 
    alert("출제 예외: " + e.message); 
  } finally {
    btn.classList.remove('hidden'); spinner.classList.add('hidden');
  }
};

window.checkAttendance = function() {
  const today = new Date().toISOString().split('T')[0];
  if (lastAttendedDate === today) { alert("오늘의 출석 마감 상태입니다."); return; }
  pocketMoney += 500 + (userLevelState.level * 50); lastAttendedDate = today;
  writeAndSyncStorage().catch(() => {}); window.renderProfileTab(); alert("출석 성과금 가산 완료!");
};

window.spendPocketMoney = function() {
  const desc = document.getElementById('spend-desc-input').value.trim();
  const amt = parseInt(document.getElementById('spend-amount-input').value, 10);
  if(!desc || isNaN(amt)) return;
  pocketMoney -= amt; document.getElementById('spend-desc-input').value = ""; document.getElementById('spend-amount-input').value = "";
  writeAndSyncStorage().catch(() => {}); window.renderProfileTab();
};

window.exportProgressText = function() { navigator.clipboard.writeText(btoa(encodeURIComponent(JSON.stringify({studySubjects, chaptersState, quizSheets, pocketMoney, userLevelState, schedulesState, globalMemoText, accumulatedStats})))).then(()=>alert("복사 완료")); };
window.importProgressText = function() {
  const code = prompt("백업 구문을력하세요."); if(!code) return;
  try {
    const data = JSON.parse(decodeURIComponent(atob(code.trim())));
    studySubjects = data.studySubjects || {}; chaptersState = data.chaptersState || {}; quizSheets = data.quizSheets || []; pocketMoney = data.pocketMoney || 0; schedulesState = data.schedulesState || []; globalMemoText = data.globalMemoText || ""; accumulatedStats = data.accumulatedStats || {winPromoteCount:0,perfectScoreCount:0,totalSolvedCount:0};
    writeAndSyncStorage().catch(() => {}); location.reload();
  } catch(e) { alert("해독 실패"); }
};
window.clearAllDataStorage = function() { if(confirm("포맷하시겠습니까?")) { localStorage.clear(); location.reload(); } };

document.addEventListener('DOMContentLoaded', async () => {
  loadStorageFromLocal();
  window.changeDashboardTab('profile');
  
  document.getElementById('gen-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    document.getElementById('gen-file-status').textContent = "파싱 가동 중...";
    try { activeUploadedText = await geminiModule.extractTextFromFile(file); document.getElementById('gen-file-status').innerHTML = `<span class="text-emerald-400">성공! ${file.name.substring(0,10)}</span>`; } 
    catch(err) { document.getElementById('gen-file-status').innerHTML = "파싱 실패"; }
  });

  try {
    geminiModule = await import('./gemini-engine.js');
    authModule = await import('./firebase-auth.js');

    const apiInput = document.getElementById('api-key-input');
    if (apiInput) apiInput.value = geminiModule.getGeminiKey();
    window.updateCustomGeminiKey = function() { geminiModule.saveGeminiKey(apiInput.value); alert("인프라 연결 완료"); };

    if (authModule.isFirebaseInitialized) {
      authModule.onAuthStateChanged(authModule.auth, async (user) => {
        if (user) {
          window.currentUser = user;
          const nameEl = document.getElementById('profile-user-name');
          const emailEl = document.getElementById('profile-user-email');
          if(nameEl) nameEl.textContent = user.displayName || "구글 연동 계정";
          if(emailEl) emailEl.textContent = user.email ? `(${user.email})` : "(클라우드 연결 상태)";
          
          const cloudData = await authModule.loadFromCloud(user.uid, customSyncKey).catch(() => null);
          if (cloudData) {
            studySubjects = cloudData.studySubjects || {}; studyMaterials = cloudData.studyMaterials || {}; chaptersState = cloudData.chaptersState || {}; quizSheets = cloudData.quizSheets || []; pocketMoney = cloudData.pocketMoney || 0; moneyHistory = cloudData.moneyHistory || []; userLevelState = cloudData.userLevelState || {level:1,exp:0}; lastAttendedDate = cloudData.lastAttendedDate || ""; schedulesState = cloudData.schedulesState || []; globalMemoText = cloudData.globalMemoText || ""; accumulatedStats = cloudData.accumulatedStats || {winPromoteCount:0,perfectScoreCount:0,totalSolvedCount:0};
            
            localStorage.setItem('studySubjects_v7', JSON.stringify(studySubjects));
            localStorage.setItem('quizSheets_v7', JSON.stringify(quizSheets));
            localStorage.setItem('pocketMoney_v7', pocketMoney.toString());
            localStorage.setItem('userLevelState_v7', JSON.stringify(userLevelState));
            localStorage.setItem('schedulesState_v7', JSON.stringify(schedulesState));
            localStorage.setItem('globalMemoText_v7', globalMemoText);
            
            const memoArea = document.getElementById('global-memo-area');
            if (memoArea) memoArea.value = globalMemoText;
          }
          document.getElementById('sync-status-dot').className = "w-1.5 h-1.5 rounded-full bg-emerald-400";
          document.getElementById('sync-status-text').textContent = "클라우드 동기화 됨";
        } else {
          window.currentUser = null;
          document.getElementById('sync-status-text').textContent = "로컬 모드";
        }
        window.renderProfileTab();
      });
    }
    const authBtn = document.getElementById('auth-action-btn');
    if (authBtn) {
      authBtn.textContent = window.currentUser ? "로그아웃" : "🌐 구글 계정 연동";
      authBtn.onclick = async () => { if (window.currentUser) { await authModule.logoutUser(); location.reload(); } else { try { await authModule.loginWithGoogle(); location.reload(); } catch(e) { alert("인증 오류: " + e.message); } } };
    }
  } catch (err) { console.warn("비동기 모듈 로딩 대기", err); }
});
