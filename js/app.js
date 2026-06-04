// js/app.js
const DEFAULT_APP_ID = "c_f04126b33eaae657_ai_v321_sys";

// ===================================================================
// 1. 선제 방어막: 화면 탭 브라우징 제어 (모듈 기폭 에러와 무관하게 100% 작동 보장)
// ===================================================================
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

  // 상태 동적 리렌더링 바인딩 체인
  if (id === 'profile' && window.renderProfileTab) window.renderProfileTab();
  if (id === 'subjects' && window.renderSubjectManageTab) window.renderSubjectManageTab();
  if (id === 'generate' && window.renderGenerateTab) window.renderGenerateTab();
  if (id === 'storage' && window.renderStorageTab) window.renderStorageTab();
};

// ===================================================================
// 2. 오리지널 v3.2.1 규격 핵심 전공 데이터 구조 및 지갑 변수 원천 복원
// ===================================================================
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

// ===================================================================
// 3. 입출력 무결성 장치: 로컬 캐싱 및 클라우드 브리징 엔진
// ===================================================================
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

    const memoBox = document.getElementById('global-memo-textarea');
    if (memoBox) memoBox.value = globalMemoText;
    const syncInput = document.getElementById('sync-key-input');
    if (syncInput) syncInput.value = customSyncKey;
  } catch (e) { console.error("로컬 복원 장애", e); }
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
    window.updateSyncStatus('syncing');
    try {
      const pkg = { studySubjects, studyMaterials, chaptersState, quizSheets, pocketMoney, moneyHistory, userLevelState, lastAttendedDate, schedulesState, globalMemoText, accumulatedStats };
      await authModule.saveToCloud(window.currentUser.uid, pkg, customSyncKey);
      window.updateSyncStatus('synced');
    } catch (e) { window.updateSyncStatus('local'); }
  }
}

window.updateSyncStatus = function(state) {
  const dot = document.getElementById('sync-status-dot');
  const txt = document.getElementById('sync-status-text');
  if (!dot || !txt) return;
  if (state === 'connecting') { dot.className = "w-1.5 h-1.5 rounded-full bg-amber-400 animate-spin"; txt.textContent = "원격 접속 중"; }
  if (state === 'syncing') { dot.className = "w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"; txt.textContent = "클라우드 동기화 중"; }
  if (state === 'synced') { dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-500/50"; txt.textContent = "클라우드 동기화 됨"; }
  if (state === 'local') { dot.className = "w-1.5 h-1.5 rounded-full bg-slate-500"; txt.textContent = "로컬 단독 모드"; }
};

// ===================================================================
// 4. 서브시스템 뼈대 이식: 과목, 파일파싱, 게이미피케이션 업적, 경제
// ===================================================================
window.createNewSubject = async function() {
  const input = document.getElementById('subj-name-input');
  if (!input || !input.value.trim()) return;
  const name = input.value.trim();
  if (Object.keys(studySubjects).some(k => studySubjects[k].name === name)) { alert("동일 명칭의 개설 과목이 존재합니다."); return; }
  
  const id = "subject_" + Date.now();
  studySubjects[id] = { id, name, chapters: {} };
  input.value = "";
  
  await writeAndSyncStorage();
  window.renderSubjectManageTab();
};

window.renderSubjectManageTab = function() {
  const list = document.getElementById('subject-manage-list');
  if (!list) return; list.innerHTML = '';
  const keys = Object.keys(studySubjects);
  
  if (keys.length === 0) {
    list.innerHTML = `<span class="text-xs text-slate-500 text-center py-4 block">개설된 전공 과목 데이터가 없습니다.</span>`;
    document.getElementById('subject-detail-fallback')?.classList.remove('hidden');
    document.getElementById('subject-detail-panel')?.classList.add('hidden');
    return;
  }
  keys.forEach(k => {
    const sub = studySubjects[k];
    const isSelected = selectedSubjectId === k;
    const btn = document.createElement('button');
    btn.className = `w-full text-left p-3 rounded-xl border text-xs transition-all ${isSelected ? 'bg-indigo-600/10 border-indigo-500 text-slate-100 shadow-lg' : 'bg-slate-950/40 border-slate-850 text-slate-400'}`;
    btn.innerHTML = `<span class="font-bold block text-slate-200">${sub.name}</span><span class="text-[9px] text-slate-500 mt-0.5 block">등록 단원 수: ${Object.keys(sub.chapters||{}).length}개</span>`;
    btn.onclick = () => { selectedSubjectId = k; window.renderSubjectManageTab(); document.getElementById('subject-detail-fallback')?.classList.add('hidden'); document.getElementById('subject-detail-panel')?.classList.remove('hidden'); document.getElementById('detail-subject-title').textContent = sub.name; window.renderChapterListPanel(); };
    list.appendChild(btn);
  });
};

window.deleteCurrentSubject = async function() {
  if (!selectedSubjectId || !confirm("해당 전공 과목의 교안 리포트와 시험 챕터 기록이 영구 폐강 소멸됩니다. 진행하십니까?")) return;
  delete studySubjects[selectedSubjectId];
  selectedSubjectId = null;
  await writeAndSyncStorage();
  window.renderSubjectManageTab();
};

window.createNewChapter = async function() {
  if (!selectedSubjectId) return;
  const el = document.getElementById('chap-name-input');
  const name = el.value.trim();
  if (!name || !activeUploadedText) { alert("단원명 지정 및 교안 파싱 적재 처리가 누락되었습니다."); return; }
  
  const sub = studySubjects[selectedSubjectId];
  const cid = "chapter_" + Date.now();
  if (!sub.chapters) sub.chapters = {};
  sub.chapters[cid] = { id: cid, name: name };
  
  const key = `${sub.name}___${name}`;
  studyMaterials[key] = { subject: sub.name, chapter: name, contents: [activeUploadedText] };
  
  // v3.2.1 규격 초기 단원 등급 스페이스 바인딩
  chaptersState[key] = { subject: sub.name, chapter: name, tier: "Unrank", exp: 0, promotionReady: false };
  
  activeUploadedText = ""; el.value = "";
  document.getElementById('gen-file-input').value = "";
  document.getElementById('gen-file-status').innerHTML = `드래그 또는 클릭 업로드<br><span class="text-indigo-400 text-[9px]">(PDF, PPTX, HWP, TXT 파싱 대응)</span>`;
  
  await writeAndSyncStorage();
  window.renderChapterListPanel();
};

window.renderChapterListPanel = function() {
  const container = document.getElementById('chapter-manage-list');
  if (!container || !selectedSubjectId) return; container.innerHTML = '';
  const sub = studySubjects[selectedSubjectId];
  const keys = Object.keys(sub.chapters || {});
  
  if (keys.length === 0) { container.innerHTML = `<span class="text-xs text-slate-500 block text-center py-4">등록된 지식 단원 챕터가 없습니다.</span>`; return; }
  keys.forEach(k => {
    const c = sub.chapters[k];
    const key = `${sub.name}___${c.name}`;
    const st = chaptersState[key] || { tier: "Unrank", exp: 0 };
    container.innerHTML += `<div class="p-3 bg-slate-950/80 rounded-xl border border-slate-85px border-slate-850 text-xs flex justify-between items-center"><span class="font-bold text-slate-300">📖 ${c.name}</span><span class="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-400">🏅 ${st.tier} (${st.exp}/10 XP)</span></div>`;
  });
};

window.renderGenerateTab = function() {
  const sSel = document.getElementById('gen-subject-select'); if (!sSel) return;
  sSel.innerHTML = '<option value="">== 전공 과목 선택 ==</option>';
  Object.keys(studySubjects).forEach(k => { sSel.innerHTML += `<option value="${k}">${studySubjects[k].name}</option>`; });
  window.onGenSubjectSelectChange();
};

window.onGenSubjectSelectChange = function() {
  const sSel = document.getElementById('gen-subject-select');
  const cSel = document.getElementById('gen-chapter-select'); if (!sSel || !cSel) return;
  cSel.innerHTML = '';
  const sid = sSel.value;
  if (!sid || !studySubjects[sid]) { cSel.innerHTML = '<option value="">== 단원 없음 ==</option>'; window.updateGenerateTypeLock(); return; }
  
  const sub = studySubjects[sid];
  Object.keys(sub.chapters || {}).forEach(k => {
    cSel.innerHTML += `<option value="${k}">${sub.chapters[k].name}</option>`;
  });
  
  // v3.2.1 핵심 조건식: 해당 과목의 모든 단원이 '마스터'인 경우 🏆챌린저 통합평가 자동 확장 적재
  let chs = Object.keys(chaptersState).filter(k => chaptersState[k].subject === sub.name);
  if (chs.length > 0 && chs.every(k => chaptersState[k].tier === "마스터")) {
    cSel.innerHTML += `<option value="challenger_virtual_gateway">🏆 [통합] 챌린저 관문 최종 마스터 평가 (50문항)</option>`;
  }
  window.updateGenerateTypeLock();
};

let currentSelectedGenType = "practice";
window.setGenType = function(type) {
  if (type === 'real') {
    const sId = document.getElementById('gen-subject-select').value;
    const cId = document.getElementById('gen-chapter-select').value;
    const sub = studySubjects[sId]; const chap = sub?.chapters[cId];
    if (sub && chap) {
      const key = `${sub.name}___${chap.name}`;
      const st = chaptersState[key];
      if (!st || !st.promotionReady) return; // 락 상태 방어
    }
  }
  currentSelectedGenType = type;
  document.getElementById('type-btn-practice').className = type === 'practice' ? "p-3 rounded-xl border-2 text-left w-full transition-all border-indigo-500 bg-indigo-500/5" : "p-3 rounded-xl border border-slate-800 text-left w-full transition-all opacity-60";
  document.getElementById('type-btn-real').className = type === 'real' ? "p-3 rounded-xl border-2 text-left w-full transition-all border-indigo-500 bg-indigo-500/5" : "p-3 rounded-xl border border-slate-800 text-left w-full transition-all opacity-60";
};

window.updateGenerateTypeLock = function() {
  const sId = document.getElementById('gen-subject-select').value;
  const cId = document.getElementById('gen-chapter-select').value;
  const realBtn = document.getElementById('type-btn-real');
  const titleTxt = document.getElementById('real-mode-title-text');
  const descTxt = document.getElementById('real-mode-desc-text');
  if (!realBtn) return;

  if (cId === 'challenger_virtual_gateway') {
    titleTxt.textContent = "🏆 챌린저 무제한 최종 평가";
    descTxt.textContent = "과목 전체를 아우르는 50문항 스케일 배틀 코스";
    realBtn.removeAttribute('disabled'); realBtn.classList.remove('cursor-not-allowed', 'opacity-60');
    window.setGenType('real'); return;
  }

  const sub = studySubjects[sId]; const chap = sub?.chapters[cId];
  if (!sub || !chap) {
    titleTxt.textContent = "🔒 단원 실전 승급전 (20문항)"; descTxt.textContent = "대상을 먼저 연결하십시오.";
    realBtn.setAttribute('disabled', true); realBtn.classList.add('cursor-not-allowed', 'opacity-60');
    window.setGenType('practice'); return;
  }

  const key = `${sub.name}___${chap.name}`;
  const st = chaptersState[key] || { promotionReady: false, exp: 0 };
  if (st.promotionReady) {
    titleTxt.textContent = "🔥 단원 실전 승급전 돌입 가능"; descTxt.textContent = `현재 누적 점수 수치: ${st.exp} XP / 승급전 개방 상태`;
    realBtn.removeAttribute('disabled'); realBtn.classList.remove('cursor-not-allowed', 'opacity-60');
  } else {
    titleTxt.textContent = `🔒 승급 요건 통제 잠금 (${st.exp}/10 XP)`; descTxt.textContent = "개념 평가 모드를 완주하여 10 XP를 달성하십시오.";
    realBtn.setAttribute('disabled', true); realBtn.classList.add('cursor-not-allowed', 'opacity-60');
    window.setGenType('practice');
  }
};

window.handleBuildQuiz = async function() {
  const sId = document.getElementById('gen-subject-select').value;
  const cId = document.getElementById('gen-chapter-select').value;
  if (!sId || !cId) return;
  if (!geminiModule) { alert("AI 추론 통신망 링크를 조립 중입니다. 3초 후 시도하십시오."); return; }

  const sub = studySubjects[sId];
  const isChallengerMode = (cId === "challenger_virtual_gateway");
  
  let rangeName = "", sourceText = "";
  if (isChallengerMode) {
    rangeName = "🏆 과목 전체 챌린저 통합 관문";
    let textArr = [];
    Object.keys(sub.chapters || {}).forEach(cid => {
      const k = `${sub.name}___${sub.chapters[cid].name}`;
      if (studyMaterials[k]) textArr.push(`[단원: ${sub.chapters[cid].name}]\n` + studyMaterials[k].contents.join("\n"));
    });
    sourceText = textArr.join("\n\n");
  } else {
    const chap = sub.chapters[cId]; rangeName = chap.name;
    sourceText = studyMaterials[`${sub.name}___${chap.name}`]?.contents.join("\n") || "";
  }
  if (!sourceText) return;

  const spinner = document.getElementById('gen-loading-spinner');
  const btn = document.getElementById('build-quiz-btn');
  btn.classList.add('hidden'); spinner.classList.remove('hidden');

  const countLimit = currentSelectedGenType === 'real' ? (isChallengerMode ? 50 : 20) : 10;
  const prompt = `과목명:${sub.name}\n범위:${rangeName}\n문항수:${countLimit}문항\n[★출제 강제 수식]: 가공의 응용 실무 사례나 가상 시나리오 비즈니스 융합 유형은 '절대' 배제하고 대학교 전공 기출 원형 시험지 형태(수식 증명유도, 참거짓 판별, 특징 비교 대조)로 설계하십시오. 지식 교안 원문의 상하위 텍스트 스트림 전체를 고르게 균등분포 분산 배치하여 문제를 출제하십시오.\n교안문서 원본:\n${sourceText.substring(0, 16000)}`;

  try {
    const raw = await geminiModule.callGemini(prompt, "정확한 JSON 데이터 스키마 규칙 명령만 수행하는 명망 높은 대학교 출제 위원 교수입니다.", true);
    const parsed = JSON.parse(raw);
    
    const qid = "sheet_" + Date.now();
    quizSheets.push({
      id: qid, title: parsed.title || `${sub.name} [${rangeName}] 맞춤형 평가`,
      subject: sub.name, chapter: isChallengerMode ? "챌린저종합" : rangeName,
      createdDate: new Date().toISOString().split('T')[0], isSolved: false, score: null,
      questions: parsed.questions.slice(0, countLimit).map((q, i) => ({ id: i + 1, ...q })),
      type: currentSelectedGenType
    });
    await writeAndSyncStorage();
    alert("AI 전 영역 기출 균등 커버리지 문제지 팩이 완성되었습니다!");
    window.changeDashboardTab('storage');
  } catch (e) { alert("출제 가동 실패: Key 유효성 및 포맷 오류 [" + e.message + "]"); }
  finally { btn.classList.remove('hidden'); spinner.classList.add('hidden'); }
};

// ===================================================================
// 5. 퀴즈 풀이 및 실시간 선지 네비게이션 워프 스페이스 로직
// ===================================================================
window.renderStorageTab = function() {
  const grid = document.getElementById('storage-sheets-grid'); if (!grid) return; grid.innerHTML = '';
  const filterList = document.getElementById('storage-subject-list');
  if (filterList) {
    filterList.innerHTML = `<button onclick="window.filterStorageScope('all')" class="w-full text-left px-2.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-500/15 text-indigo-400">전체 과목 보기</button>`;
    Object.keys(studySubjects).forEach(k => {
      filterList.innerHTML += `<button onclick="window.filterStorageScope('${studySubjects[k].name}')" class="w-full text-left px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:bg-slate-900 transition-all">${studySubjects[k].name}</button>`;
    });
  }
  window.filterStorageScope('all');
};

window.filterStorageScope = function(subjName) {
  const grid = document.getElementById('storage-sheets-grid'); if (!grid) return; grid.innerHTML = '';
  const list = subjName === 'all' ? quizSheets : quizSheets.filter(s => s.subject === subjName);
  
  if (list.length === 0) { grid.innerHTML = `<div class="col-span-2 text-center py-8 text-slate-500 text-xs font-bold">보관된 문제지 패키지가 존재하지 않습니다.</div>`; return; }
  list.forEach(sheet => {
    grid.innerHTML += `<div class="p-4 rounded-2xl border border-slate-850 bg-slate-900/40 flex flex-col justify-between space-y-3 animate-fadeIn">
      <div>
        <div class="flex justify-between items-center text-[10px] text-slate-500 font-bold"><span>📅 ${sheet.createdDate}</span><button onclick="window.purgeSheetData('${sheet.id}')" class="text-rose-400 font-black hover:underline">완전 삭제</button></div>
        <h4 class="text-xs sm:text-sm font-black text-slate-200 mt-1 truncate">${sheet.title}</h4>
        <div class="flex gap-1 mt-1.5 flex-wrap">
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-850">${sheet.subject}</span>
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 font-bold">${sheet.type === 'real' ? '🔥 실전승급' : '📚 개념연습'}</span>
        </div>
      </div>
      <div class="flex justify-between items-center pt-2.5 border-t border-slate-850/60">
        <span class="text-xs font-black ${sheet.isSolved ? 'text-emerald-400' : 'text-amber-400'}">${sheet.isSolved ? `성취도: ${sheet.score}점` : '진입 대기 중'}</span>
        <button onclick="window.startQuizSheetTrigger('${sheet.id}')" class="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black transition-all">${sheet.isSolved ? '오답 검토' : '시험 응시'}</button>
      </div>
    </div>`;
  });
};

window.purgeSheetData = function(id) {
  if (!confirm("삭제하시겠습니까?")) return;
  quizSheets = quizSheets.filter(s => s.id !== id); writeAndSyncStorage(); window.renderStorageTab();
};

window.startQuizSheetTrigger = function(id) {
  activeQuizSheet = quizSheets.find(s => s.id === id); if (!activeQuizSheet) return;
  currentQuestionIdx = 0;
  studentAnswers = Array.from({ length: activeQuizSheet.questions.length }, () => ({ chosen: null, isSubmitted: false, tutorAnalysis: "" }));
  
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

  // 실시간 문항 점프 내비게이션 맵 갱신
  const navGrid = document.getElementById('question-navigation-grid');
  if (navGrid) {
    navGrid.innerHTML = '';
    activeQuizSheet.questions.forEach((item, i) => {
      const isCurrent = i === currentQuestionIdx;
      const targetAns = studentAnswers[i];
      let stateClass = "bg-slate-950 text-slate-500 border-slate-850";
      if (targetAns.chosen !== null) stateClass = "bg-indigo-900/30 text-indigo-400 border-indigo-800";
      if (targetAns.isSubmitted) stateClass = "bg-emerald-950/40 text-emerald-400 border-emerald-900";
      if (isCurrent) stateClass = "bg-indigo-600 text-white border-indigo-400 scale-105 font-black";
      
      navGrid.innerHTML += `<button onclick="window.jumpToDirectQuestion(${i})" class="w-6 h-6 rounded border text-[10px] font-bold flex items-center justify-center transition-all ${stateClass}">${i+1}</button>`;
    });
  }

  const optContainer = document.getElementById('options-container'); optContainer.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const isCorrectIndex = idx === q.answer;
    // 관리자 치트 활성화 유무 검증 바인딩 (주황색 테두리 광채 강제 발동)
    const cheatStyle = (isAdminCheatEnabled && isCorrectIndex) ? "admin-correct-hint border-amber-500" : "border-slate-800";
    
    const btn = document.createElement('button');
    btn.className = `w-full text-left p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${ans.chosen === idx ? 'border-indigo-500 bg-indigo-500/10' : cheatStyle} hover:bg-slate-900`;
    btn.innerHTML = `<span class="text-slate-200 font-medium">${idx + 1}. ${opt}</span>`;
    btn.onclick = () => { if (!ans.isSubmitted && !activeQuizSheet.isSolved) { ans.chosen = idx; window.loadTargetQuestion(); } };
    optContainer.appendChild(btn);
  });

  const actBtn = document.getElementById('action-btn');
  const feedBox = document.getElementById('feedback-box');
  const tutorZone = document.getElementById('ai-tutor-zone');
  const tutorRes = document.getElementById('ai-tutor-response');

  // 연습모드 개별 즉시 채점 장치 복원
  if (activeQuizSheet.type === 'practice' && !activeQuizSheet.isSolved) {
    if (ans.isSubmitted) {
      actBtn.textContent = "채점 반영 완료"; actBtn.className = "px-4 py-2 bg-slate-850 text-slate-600 text-xs font-bold rounded-xl cursor-default";
      feedBox.classList.remove('hidden');
      feedBox.className = ans.chosen === q.answer ? "rounded-xl p-3 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs mt-1" : "rounded-xl p-3 bg-rose-500/5 border border-rose-500/20 text-rose-400 text-xs mt-1";
      document.getElementById('feedback-title').textContent = ans.chosen === q.answer ? "🎉 정확한 매핑 정답입니다." : "❌ 내부 교안 검증 실패 (오답)";
      document.getElementById('explanation-text').textContent = q.explanation;
      tutorZone.classList.remove('hidden');
      if (ans.tutorAnalysis) { tutorRes.textContent = ans.tutorAnalysis; tutorRes.classList.remove('hidden'); } else { tutorRes.classList.add('hidden'); }
    } else if (ans.chosen !== null) {
      actBtn.textContent = "🎯 개별 즉시 채점 실행"; actBtn.className = "px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl cursor-pointer";
      actBtn.onclick = () => { ans.isSubmitted = true; accumulatedStats.totalSolvedCount++; window.loadTargetQuestion(); };
      feedBox.classList.add('hidden'); tutorZone.classList.add('hidden');
    } else {
      actBtn.textContent = "선지 마킹 대기"; actBtn.className = "px-4 py-2 bg-slate-850 text-slate-500 text-xs font-bold rounded-xl cursor-default";
      feedBox.classList.add('hidden'); tutorZone.classList.add('hidden');
    }
  } else {
    // 실전 모드 또는 기응시 종료 시트의 경우 단일 채점 차단 및 홀딩
    feedBox.classList.add('hidden'); tutorZone.classList.add('hidden');
    if (activeQuizSheet.isSolved) {
      feedBox.classList.remove('hidden');
      feedBox.className = "rounded-xl p-3 bg-slate-950 border border-slate-850 text-slate-300 text-xs mt-1";
      document.getElementById('feedback-title').textContent = `[해설 리뷰] 정답지 매핑 번호: ${q.answer + 1}번`;
      document.getElementById('explanation-text').textContent = q.explanation;
    }
    if (ans.chosen !== null) {
      actBtn.textContent = "선택 완료"; actBtn.className = "px-4 py-2 bg-slate-800 text-slate-400 text-xs font-bold rounded-xl cursor-default";
    } else {
      actBtn.textContent = "마킹 대기"; actBtn.className = "px-4 py-2 bg-slate-850 text-slate-500 text-xs font-bold rounded-xl cursor-default";
    }
  }

  const nextBtn = document.getElementById('btn-next');
  if (currentQuestionIdx === activeQuizSheet.questions.length - 1) {
    nextBtn.textContent = activeQuizSheet.isSolved ? "리포트 홈" : "종합 제출 채점";
    nextBtn.onclick = window.submitEntireQuizSheet;
  } else {
    nextBtn.textContent = "다음 문항"; nextBtn.onclick = window.navigateNext;
  }
};

window.jumpToDirectQuestion = function(idx) { currentQuestionIdx = idx; window.loadTargetQuestion(); };
window.navigatePrev = function() { if (currentQuestionIdx > 0) { currentQuestionIdx--; window.loadTargetQuestion(); } };
window.navigateNext = function() { if (currentQuestionIdx < activeQuizSheet.questions.length - 1) { currentQuestionIdx++; window.loadTargetQuestion(); } };

// ===================================================================
// 6. 게이미피케이션 및 경제학 시스템: 출석부 계산기, 지출 타임라인, 업적
// ===================================================================
window.checkAttendance = async function() {
  const today = new Date().toISOString().split('T')[0];
  if (lastAttendedDate === today) { alert("이미 오늘 날짜의 출석체크 보상 집계가 마감되었습니다."); return; }
  
  // v3.2.1 규격 수식: 500원 + (레벨 * 50원) 보너스 정밀 적재
  const reward = 500 + (userLevelState.level * 50);
  pocketMoney += reward;
  lastAttendedDate = today;
  moneyHistory.unshift({ date: today, desc: "📅 일일 출석체크 보상 보너스", amount: reward, type: "plus" });
  
  alert(`출석 완료! 지갑 자산 가산 완료: +${reward}원`);
  await writeAndSyncStorage(); window.renderProfileTab();
};

window.spendPocketMoney = async function() {
  const descEl = document.getElementById('spend-desc-input');
  const amtEl = document.getElementById('spend-amount-input');
  if (!descEl || !amtEl) return;
  const desc = descEl.value.trim(); const amt = parseInt(amtEl.value, 10);
  if (!desc || isNaN(amt) || amt <= 0) { alert("소비 내역 항목과 금액 수치를 정확히 입력하십시오."); return; }
  
  pocketMoney -= amt;
  moneyHistory.unshift({ date: new Date().toISOString().split('T')[0], desc: `💸 소비: ${desc}`, amount: amt, type: "minus" });
  descEl.value = ""; amtEl.value = "";
  
  await writeAndSyncStorage(); window.renderProfileTab();
};

function dispatchExperienceGain(amt) {
  userLevelState.exp += amt;
  // 50 EXP 당 1레벨 레벨업 무한 루프 검증 스위치
  while (userLevelState.exp >= 50) {
    userLevelState.exp -= 50; userLevelState.level++;
    alert(`🎉 학업 경험치 임계점 도달! 사용자 등급 레벨업: LV.${userLevelState.level}`);
  }
}

window.submitEntireQuizSheet = async function() {
  if (activeQuizSheet.isSolved) { window.changeDashboardTab('storage'); return; }
  
  let correctHits = 0;
  activeQuizSheet.questions.forEach((q, i) => {
    if (activeQuizSheet.type === 'practice') {
      if (studentAnswers[i].chosen === q.answer) correctHits++;
    } else {
      // 실전모드는 누적제출이 아니므로 최종 제출 시 일괄 연산 처리 수행
      if (studentAnswers[i].chosen === q.answer) correctHits++;
      accumulatedStats.totalSolvedCount++;
    }
  });

  const finalScore = Math.round((correctHits / activeQuizSheet.questions.length) * 100);
  activeQuizSheet.score = finalScore;
  activeQuizSheet.isSolved = true;

  // 경제 자산 가산: 문항당 500원 지급
  const performanceReward = correctHits * 500;
  pocketMoney += performanceReward;
  moneyHistory.unshift({ date: new Date().toISOString().split('T')[0], desc: `🎓 [평가완료] ${activeQuizSheet.title}`, amount: performanceReward, type: "plus" });

  // v3.2.1 규격: 최초 100점 만점 시 1000원 대형 성과 인센티브 융합 적재
  let rewardToastText = `기본 정답 보상 가산: +${performanceReward}원`;
  if (finalScore === 100) {
    pocketMoney += 1000; accumulatedStats.perfectScoreCount++;
    moneyHistory.unshift({ date: new Date().toISOString().split('T')[0], desc: `💯 [만점] ${activeQuizSheet.title} 인센티브`, amount: 1000, type: "plus" });
    rewardToastText += ` + 만점 보너스 1,000원 가산 돌입!`;
  }

  // 랭크 및 티어 승급 조건 연산 수식 가동
  if (activeQuizSheet.type === 'practice') {
    const key = `${activeQuizSheet.subject}___${activeQuizSheet.chapter}`;
    if (chaptersState[key]) {
      chaptersState[key].exp += correctHits;
      if (chaptersState[key].exp >= 10 && chaptersState[key].tier !== "마스터") {
        chaptersState[key].promotionReady = true;
      }
    }
    dispatchExperienceGain(correctHits * 2);
  } else if (activeQuizSheet.type === 'real' && activeQuizSheet.chapter !== "챌린저종합") {
    const key = `${activeQuizSheet.subject}___${activeQuizSheet.chapter}`;
    if (chaptersState[key]) {
      if (finalScore >= 90) { chaptersState[key].tier = "마스터"; accumulatedStats.winPromoteCount++; }
      else if (finalScore >= 75) { chaptersState[key].tier = "다이아"; }
      else if (finalScore >= 60) { chaptersState[key].tier = "플레티넘"; }
      else if (finalScore >= 45) { chaptersState[key].tier = "골드"; }
      else if (finalScore >= 30) { chaptersState[key].tier = "실버"; }
      else { chaptersState[key].tier = "브론즈"; }
      
      // 승급전 종결 후 수식 요건 초기화 리셋
      chaptersState[key].exp = 0; chaptersState[key].promotionReady = false;
    }
    dispatchExperienceGain(correctHits * 5);
  }

  // 3대 챌린지 누적 가중치 보너스 금융 장치 검증 연산
  if (accumulatedStats.winPromoteCount > 0 && accumulatedStats.winPromoteCount % 3 === 0) {
    pocketMoney += 10000; moneyHistory.unshift({ date: new Date().toISOString().split('T')[0], desc: "🎖️ 승급전 3회 달성 챌린지 팩", amount: 10000, type: "plus" });
    alert("📢 [3대 대형 챌린지] 승급 3회 누적 업적 달성 성과급 10,000원이 지급되었습니다!");
  }
  if (accumulatedStats.perfectScoreCount > 0 && accumulatedStats.perfectScoreCount % 5 === 0) {
    pocketMoney += 5000; moneyHistory.unshift({ date: new Date().toISOString().split('T')[0], desc: "💯 만점 시트 5회 점령 챌린지 팩", amount: 5000, type: "plus" });
    alert("📢 [3대 대형 챌린지] 만점 5회 누적 달성 성과급 5,000원이 지급되었습니다!");
  }
  if (accumulatedStats.totalSolvedCount >= 100 && accumulatedStats.totalSolvedCount % 100 === 0) {
    pocketMoney += 2000; moneyHistory.unshift({ date: new Date().toISOString().split('T')[0], desc: "📚 100문항 돌파 격려 챌린지 팩", amount: 2000, type: "plus" });
    alert("📢 [3대 대형 챌린지] 누적 풀이 100문항 도달 격려금 2,000원이 지급되었습니다!");
  }

  await writeAndSyncStorage();
  
  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('result-view').classList.remove('hidden');
  document.getElementById('final-score').textContent = correctHits;
  document.getElementById('final-total').textContent = activeQuizSheet.questions.length;
  document.getElementById('result-reward-toast').textContent = rewardToastText;

  const rList = document.getElementById('review-list'); rList.innerHTML = '';
  activeQuizSheet.questions.forEach((q, i) => {
    const isCorrect = studentAnswers[i].chosen === q.answer;
    rList.innerHTML += `<div class="py-3 text-xs border-b border-slate-900/60"><p class="font-bold text-slate-200">${i+1}. ${q.question}</p>
      <p class="mt-1 ${isCorrect ? 'text-emerald-400' : 'text-rose-400'} font-black">선택 답안: ${q.options[studentAnswers[i].chosen] || "미응시 공란"} | 정답 가이드: ${q.options[q.answer]}</p></div>`;
  });
};

window.callAITutorDeepAnalysis = async function() {
  if (!geminiModule) return;
  const q = activeQuizSheet.questions[currentQuestionIdx];
  const ans = studentAnswers[currentQuestionIdx];
  const tutorRes = document.getElementById('ai-tutor-response');
  
  tutorRes.textContent = "AI 튜터가 교안 패키지를 분석하고 심화 교정 데이터를 도출 중입니다...";
  tutorRes.classList.remove('hidden');

  const prompt = `질문명: ${q.question}\n선택지 목록: ${q.options.join(", ")}\n학생선택: ${q.options[ans.chosen]}\n정답: ${q.options[q.answer]}\n[주문]: 대학교 학술 기준을 충족하는 심화 해설을 도출하고 학생이 선택한 오답 원인을 학술적으로 정밀 진단 분석해 보강 설명 하십시오.`;
  try {
    const res = await geminiModule.callGemini(prompt, "컴퓨터 구조 및 전공 학술 데이터 분석 딥러닝 AI 튜터 교수입니다.");
    ans.tutorAnalysis = res;
    tutorRes.textContent = res;
  } catch (e) { tutorRes.textContent = "분석 실패: " + e.message; }
};

// ===================================================================
// 7. 부가 컴포넌트: 달력 및 시험 일정 바인딩 엔진
// ===================================================================
window.addScheduleItem = async function() {
  const el = document.getElementById('schedule-text-input');
  if (!el || !el.value.trim()) return;
  schedulesState.push({ id: "sch_" + Date.now(), text: el.value.trim() });
  el.value = "";
  await writeAndSyncStorage(); window.renderSchedulesAndCalendar();
};

window.deleteScheduleItem = async function(id) {
  schedulesState = schedulesState.filter(s => s.id !== id);
  await writeAndSyncStorage(); window.renderSchedulesAndCalendar();
};

window.renderSchedulesAndCalendar = function() {
  const container = document.getElementById('schedule-list-container');
  if (container) {
    container.innerHTML = schedulesState.length === 0 ? `<span class="text-[10px] text-slate-500 font-sans block text-center py-2">등록된 중간/기말 고사 정공 일정이 없습니다.</span>` :
      schedulesState.map(s => `<div class="flex justify-between items-center p-2 bg-slate-950 rounded-xl text-[10px] border border-slate-850"><span>📅 ${s.text}</span><button onclick="window.deleteScheduleItem('${s.id}')" class="text-rose-400 font-bold hover:underline">삭제</button></div>`).join('');
  }
  const grid = document.getElementById('calendar-days-grid');
  if (grid) {
    grid.innerHTML = '';
    for (let i = 1; i <= 30; i++) {
      // 캘린더 연동 타임라인 분석용 정규식 필터링
      const hasPlan = schedulesState.some(s => s.text.includes(`6/${i}`) || s.text.includes(`06/${i}`) || s.text.includes(`6월 ${i}일`));
      grid.innerHTML += `<div class="p-1.5 rounded-lg border text-center transition-all cursor-pointer ${hasPlan ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-black shadow-md shadow-indigo-500/10' : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-700'}" onclick="window.filterCalendarPlanToast(${i})">${i}</div>`;
    }
  }
};

window.filterCalendarPlanToast = function(day) {
  const targets = schedulesState.filter(s => s.text.includes(`6/${day}`) || s.text.includes(`06/${day}`) || s.text.includes(`6월 ${day}일`));
  if (targets.length > 0) { alert(`[2026년 06월 ${day}일 일정 목록]\n` + targets.map(t=>"- "+t.text).join("\n")); }
};

window.renderProfileTab = function() {
  document.getElementById('profile-cash-label').textContent = `💰 지갑 잔고: ${pocketMoney.toLocaleString()}원`;
  document.getElementById('profile-level-badge').textContent = `LV.${userLevelState.level}`;
  document.getElementById('profile-exp-label').textContent = `${userLevelState.exp} / 50 EXP`;

  window.renderSchedulesAndCalendar();

  // 소비 기록 트래커 렌더링
  const historyBox = document.getElementById('pocket-money-history');
  if (historyBox) {
    historyBox.innerHTML = moneyHistory.length === 0 ? `<span class="text-slate-600 text-[9px] block text-center">집계된 입출력 내역 영수증이 존재하지 않습니다.</span>` :
      moneyHistory.slice(0, 5).map(h => `<div class="flex justify-between items-center py-0.5 border-b border-slate-900"><span class="text-slate-400">[${h.date}] ${h.desc}</span><span class="${h.type === 'plus' ? 'text-emerald-400' : 'text-rose-400'} font-bold">${h.type==='plus'?'+':'-'}${h.amount}원</span></div>`).join('');
  }

  // 3대 업적 현황판 렌더링
  const achBox = document.getElementById('achievements-list-container');
  if (achBox) {
    const isA1 = Object.keys(studySubjects).length >= 1;
    const isA2 = Object.keys(studyMaterials).length >= 1;
    const isA3 = accumulatedStats.perfectScoreCount >= 1;
    const achs = [
      { t: "첫 걸음마", d: "전공 과목 개설 완성", done: isA1 },
      { t: "교안 파괴자", d: "문서 파싱 분석 연동", done: isA2 },
      { t: "학문 마스터", d: "정석 평가 100점 점령", done: isA3 }
    ];
    achBox.innerHTML = achs.map(a => `<div class="p-2 border rounded-xl text-left ${a.done ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-300' : 'bg-slate-950/20 border-slate-850 text-slate-500'}"><span class="text-[11px] font-black block">${a.done ? '✅' : '🔒'} ${a.t}</span><span class="text-[9px] block text-slate-500 mt-0.5">${a.d}</span></div>`).join('');
  }

  // 7단계 다차원 단원 아코디언 컴포넌트 복원
  const accordion = document.getElementById('subject-accordion-container'); if (!accordion) return; accordion.innerHTML = '';
  const keys = Object.keys(studySubjects);
  if (keys.length === 0) { accordion.innerHTML = '<div class="text-center py-6 text-slate-500 text-xs font-bold">등록된 전공 학업 스페이스 과목이 부재합니다.</div>'; return; }
  
  keys.forEach(k => {
    const sub = studySubjects[k];
    let childDOMs = "";
    Object.keys(sub.chapters || {}).forEach(cid => {
      const c = sub.chapters[cid];
      const st = chaptersState[`${sub.name}___${c.name}`] || { tier: "Unrank", exp: 0 };
      const isMasterTier = st.tier === "마스터";
      const masterAnimClass = isMasterTier ? "tier-master-premium-card font-black text-amber-300" : "bg-slate-950/60 border-slate-900 text-slate-400";
      childDOMs += `<div class="p-2.5 rounded-xl border flex justify-between items-center text-[11px] ${masterAnimClass}"><span>📖 ${c.name}</span><span class="font-bold text-[10px]">[${st.tier} 리그: ${st.exp}/10 XP]</span></div>`;
    });
    if (!childDOMs) childDOMs = `<span class="text-[10px] text-slate-600 block text-center py-2">등록 단원 없음</span>`;

    accordion.innerHTML += `<div class="p-3 bg-slate-900/40 border border-slate-850 rounded-2xl text-left space-y-2">
      <div class="flex justify-between items-center"><h4 class="font-black text-xs sm:text-sm text-slate-200">📘 ${sub.name}</h4><span class="text-[9px] text-indigo-400 font-bold bg-indigo-500/5 border border-indigo-900/40 px-2 py-0.5 rounded-md">종합 트래커</span></div>
      <div class="space-y-1.5 pt-1">${childDOMs}</div>
    </div>`;
  });
};

// ===================================================================
// 8. 개발 실험 디버깅용 마스터 치트 엔진 로직 매핑
// ===================================================================
window.toggleAdminMode = function() {
  isAdminCheatEnabled = !isAdminCheatEnabled;
  document.getElementById('admin-indicator-badge').className = isAdminCheatEnabled ? "px-2.5 py-1 text-[10px] rounded-lg font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse" : "hidden";
  const statusLabel = document.getElementById('cheat-toggle-status');
  if (statusLabel) statusLabel.textContent = `현재 상태: ${isAdminCheatEnabled ? "🔥 치트 작동 기동 중 (주황색 글로우 가동)" : "비활성화"}`;
};
window.adminForceChallenger = async function() {
  Object.keys(chaptersState).forEach(k => { chaptersState[k].tier = "마스터"; chaptersState[k].exp = 10; chaptersState[k].promotionReady = false; });
  await writeAndSyncStorage(); window.renderProfileTab(); alert("치트 엔진: 전체 단원이 마스터 티어로 강제 승급하여 챌린저 관문 통합 평가가 개방되었습니다.");
};
window.adminInstantPromote = async function() {
  if (!selectedSubjectId) { alert("과목 관리창에서 과목을 먼저 터치 활성화 하십시오."); return; }
  const sub = studySubjects[selectedSubjectId];
  Object.keys(sub.chapters || {}).forEach(cid => { const key = `${sub.name}___${sub.chapters[cid].name}`; if (chaptersState[key]) { chaptersState[key].exp = 10; chaptersState[key].promotionReady = true; } });
  await writeAndSyncStorage(); window.renderProfileTab(); alert("치트 엔진: 현재 선택 과목 내 모든 단원에 10 XP를 주입하여 승급전을 오픈했습니다.");
};
window.adminSubmitAllCorrect = async function() {
  if (!activeQuizSheet || activeQuizSheet.isSolved) return;
  activeQuizSheet.questions.forEach((q, i) => { studentAnswers[i].chosen = q.answer; studentAnswers[i].isSubmitted = true; });
  window.loadTargetQuestion(); await window.submitEntireQuizSheet(); alert("치트 엔진: 전 문항 정답 하이라이트 매핑 자동 제출을 완료했습니다.");
};
window.clearAllDataStorage = function() { if(confirm("클라우드 백업을 포함한 로컬 브라우저 세션 캐시가 영구 소멸 포맷됩니다. 파괴합니까?")) { localStorage.clear(); location.reload(); } };

window.exportProgressText = function() {
  const data = { studySubjects, studyMaterials, chaptersState, quizSheets, pocketMoney, moneyHistory, userLevelState, lastAttendedDate, schedulesState, globalMemoText, accumulatedStats };
  const txt = btoa(encodeURIComponent(JSON.stringify(data)));
  navigator.clipboard.writeText(txt).then(() => alert("암호화 진도 압축 텍스트가 클립보드에 카피되었습니다. 다른 PC에 주입하십시오."));
};
window.importProgressText = async function() {
  const code = prompt("이관할 백업 코드를 복사해서 붙여넣으십시오."); if (!code) return;
  try {
    const data = JSON.parse(decodeURIComponent(atob(code.trim())));
    studySubjects = data.studySubjects || {}; studyMaterials = data.studyMaterials || {}; chaptersState = data.chaptersState || {}; quizSheets = data.quizSheets || []; pocketMoney = data.pocketMoney || 0; moneyHistory = data.moneyHistory || []; userLevelState = data.userLevelState || {level:1,exp:0}; lastAttendedDate = data.lastAttendedDate || ""; schedulesState = data.schedulesState || []; globalMemoText = data.globalMemoText || ""; accumulatedStats = data.accumulatedStats || {winPromoteCount:0,perfectScoreCount:0,totalSolvedCount:0};
    await writeAndSyncStorage(); location.reload();
  } catch(e) { alert("디코딩 포맷 실패. 유효한 코드가 아닙니다."); }
};
window.manualSaveToCloud = async function() { if(window.currentUser) { await writeAndSyncStorage(); alert("클라우드 원격 동기화 완료."); } };
window.manualLoadFromCloud = async function() {
  if(!window.currentUser || !authModule) return;
  window.updateSyncStatus('connecting');
  const d = await authModule.loadFromCloud(window.currentUser.uid, customSyncKey);
  if(d) {
    studySubjects = d.studySubjects || {}; studyMaterials = d.studyMaterials || {}; chaptersState = d.chaptersState || {}; quizSheets = d.quizSheets || []; pocketMoney = d.pocketMoney || 0; moneyHistory = d.moneyHistory || []; userLevelState = d.userLevelState || {level:1,exp:0}; lastAttendedDate = d.lastAttendedDate || ""; schedulesState = d.schedulesState || []; globalMemoText = d.globalMemoText || ""; accumulatedStats = d.accumulatedStats || {winPromoteCount:0,perfectScoreCount:0,totalSolvedCount:0};
    localStorage.setItem('sub_v7', JSON.stringify(studySubjects)); localStorage.setItem('mat_v7', JSON.stringify(studyMaterials)); localStorage.setItem('chaptersState_v7', JSON.stringify(chaptersState)); localStorage.setItem('quizSheets_v7', JSON.stringify(quizSheets)); localStorage.setItem('pocketMoney_v7', pocketMoney.toString()); localStorage.setItem('moneyHistory_v7', JSON.stringify(moneyHistory)); localStorage.setItem('userLevelState_v7', JSON.stringify(userLevelState)); localStorage.setItem('lastAttendedDate_v7', lastAttendedDate); localStorage.setItem('schedulesState_v7', JSON.stringify(schedulesState)); localStorage.setItem('globalMemoText_v7', globalMemoText); localStorage.setItem('accumulatedStats_v7', JSON.stringify(accumulatedStats));
    location.reload();
  } else { alert("세션 내 적재된 클라우드 데이터 백업본이 발견되지 않았습니다."); window.updateSyncStatus('local'); }
};
window.updateCustomSyncKey = async function() {
  const el = document.getElementById('sync-key-input'); if (!el) return;
  const val = el.value.trim(); if (!val) return;
  customSyncKey = val; await writeAndSyncStorage(); alert(`동기화 전용 식별 도메인이 [${val}] 주소로 교체 바인딩되었습니다.`);
  if(window.currentUser) location.reload();
};

// ===================================================================
// 9. 리스너 초기 바인딩 및 동적 지연 임포트 통합 관제 센터
// ===================================================================
document.addEventListener('DOMContentLoaded', async () => {
  loadStorageFromLocal();
  window.renderProfileTab();
  
  document.getElementById('global-memo-textarea')?.addEventListener('input', (e) => { globalMemoText = e.target.value; localStorage.setItem('globalMemoText_v7', globalMemoText); });
  
  document.getElementById('gen-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    document.getElementById('gen-file-status').textContent = "교안 바이너리 분석 추출 중...";
    try {
      activeUploadedText = await geminiModule.extractTextFromFile(file);
      document.getElementById('gen-file-status').innerHTML = `<span class="text-emerald-400 font-black">교안 파싱 완료!</span><br><span class="text-[9px] text-slate-500">${file.name.substring(0, 18)}</span>`;
    } catch (err) {
      document.getElementById('gen-file-status').innerHTML = `드래그 또는 클릭 업로드<br><span class="text-indigo-400 text-[9px]">(PDF / TXT 파싱 대응)</span>`;
    }
  });

  // 지연 크래시 방어 동적 임포트 실행
  try {
    geminiModule = await import('./gemini-engine.js');
    authModule = await import('./firebase-auth.js');

    const apiInput = document.getElementById('api-key-input');
    if (apiInput) apiInput.value = geminiModule.getGeminiKey();
    window.updateCustomGeminiKey = function() {
      geminiModule.saveGeminiKey(apiInput.value); alert("🔑 개인 AI API 키 검증 저장 완료.");
    };

    if (authModule.isFirebaseInitialized) {
      window.updateSyncStatus('connecting');
      authModule.onAuthStateChanged(authModule.auth, async (user) => {
        if (user) {
          window.currentUser = user;
          const cloudData = await authModule.loadFromCloud(user.uid, customSyncKey);
          if (cloudData) {
            // 다른 PC 접속 시 덮어쓰기 로컬 스토리지 브리징 누락 버그 완벽 수정
            studySubjects = cloudData.studySubjects || {}; studyMaterials = cloudData.studyMaterials || {}; chaptersState = cloudData.chaptersState || {}; quizSheets = cloudData.quizSheets || []; pocketMoney = cloudData.pocketMoney || 0; moneyHistory = cloudData.moneyHistory || []; userLevelState = cloudData.userLevelState || {level:1,exp:0}; lastAttendedDate = cloudData.lastAttendedDate || ""; schedulesState = cloudData.schedulesState || []; globalMemoText = cloudData.globalMemoText || ""; accumulatedStats = cloudData.accumulatedStats || {winPromoteCount:0,perfectScoreCount:0,totalSolvedCount:0};
            localStorage.setItem('sub_v7', JSON.stringify(studySubjects)); localStorage.setItem('mat_v7', JSON.stringify(studyMaterials)); localStorage.setItem('chaptersState_v7', JSON.stringify(chaptersState)); localStorage.setItem('quizSheets_v7', JSON.stringify(quizSheets)); localStorage.setItem('pocketMoney_v7', pocketMoney.toString()); localStorage.setItem('moneyHistory_v7', JSON.stringify(moneyHistory)); localStorage.setItem('userLevelState_v7', JSON.stringify(userLevelState)); localStorage.setItem('lastAttendedDate_v7', lastAttendedDate); localStorage.setItem('schedulesState_v7', JSON.stringify(schedulesState)); localStorage.setItem('globalMemoText_v7', globalMemoText); localStorage.setItem('accumulatedStats_v7', JSON.stringify(accumulatedStats));
            const memoBox = document.getElementById('global-memo-textarea'); if (memoBox) memoBox.value = globalMemoText;
          }
          window.updateSyncStatus('synced');
        } else {
          window.currentUser = null; window.updateSyncStatus('local');
        }
        window.renderProfileTab();
      });
    } else { window.updateSyncStatus('local'); }

    const authBtn = document.getElementById('auth-action-btn');
    if (authBtn) {
      authBtn.textContent = window.currentUser ? "로그아웃" : "🌐 구글 계정 연동 (클라우드 저장)";
      authBtn.onclick = async () => {
        if (window.currentUser) { await authModule.logoutUser(); location.reload(); }
        else { try { await authModule.loginWithGoogle(); location.reload(); } catch(e) { alert("로그인 오류: " + e.message); } }
      };
    }
  } catch (err) { console.warn("모듈 비동기 백그라운드 스레드 결착 대기 중", err); }
});
