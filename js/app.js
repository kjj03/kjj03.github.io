// js/app.js
const APP_ID = 'ai_study_platform_v26b';

// 상태 제어 데이터 구조
let studySubjects = {};
let studyMaterials = {};
let quizSheets = [];
let globalMemo = "";
let schedules = [];
let userStats = { exp: 0, cash: 0, rank: "브론즈" };
let achievements = [
  { id: "ach_1", title: "첫 걸음마", desc: "첫 번째 전공 과목 개설 성공", done: false },
  { id: "ach_2", title: "교안 파괴자", desc: "첫 번째 교수 교안 문서 업로드", done: false },
  { id: "ach_3", title: "학문 마스터", desc: "특정 과목 퀴즈 100점 달성", done: false }
];

let selectedManageSubjectId = null;
let genFileContent = "";
let activeSheet = null;
let currentQuestionIndex = 0;
let tempAnswers = [];
let isCheatEnabled = false;

let authModule = null;
let geminiModule = null;

// ===================================================================
// 1. 코어 인프라: 화면 탭 전환 제어 (에러 무관 100% 무조건 보장)
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

  if (id === 'profile') window.renderProfileTab();
  if (id === 'subjects') window.renderSubjectManageTab();
  if (id === 'generate') window.renderGenerateTab();
  if (id === 'storage') window.renderStorageTab();
};

document.addEventListener('DOMContentLoaded', () => { window.changeDashboardTab('profile'); });

// ===================================================================
// 2. 동기화 핵심 엔진 (비동기 데이터 쓰기/불러오기 무결성 보장)
// ===================================================================
function loadLocalAll() {
  try {
    studySubjects = JSON.parse(localStorage.getItem('sub_v26') || '{}');
    studyMaterials = JSON.parse(localStorage.getItem('mat_v26') || '{}');
    quizSheets = JSON.parse(localStorage.getItem('quiz_v26') || '[]');
    globalMemo = localStorage.getItem('memo_v26') || "";
    schedules = JSON.parse(localStorage.getItem('sch_v26') || '[]');
    userStats = JSON.parse(localStorage.getItem('stats_v26') || '{"exp":0,"cash":0,"rank":"브론즈"}');
    achievements = JSON.parse(localStorage.getItem('ach_v26') || JSON.stringify(achievements));
    
    const memoEl = document.getElementById('global-memo-textarea');
    if (memoEl) memoEl.value = globalMemo;
  } catch(e) { console.warn("로컬 파싱 리셋"); }
}

async function saveStorage() {
  localStorage.setItem('sub_v26', JSON.stringify(studySubjects));
  localStorage.setItem('mat_v26', JSON.stringify(studyMaterials));
  localStorage.setItem('quiz_v26', JSON.stringify(quizSheets));
  localStorage.setItem('memo_v26', globalMemo);
  localStorage.setItem('sch_v26', JSON.stringify(schedules));
  localStorage.setItem('stats_v26', JSON.stringify(userStats));
  localStorage.setItem('ach_v26', JSON.stringify(achievements));
  
  if (window.currentUser && authModule) {
    const syncText = document.getElementById('sync-status-text');
    if (syncText) syncText.textContent = "클라우드 백업 중...";
    try {
      await authModule.saveToCloud(window.currentUser.uid, { studySubjects, studyMaterials, quizSheets, globalMemo, schedules, userStats, achievements }, APP_ID);
      if (syncText) syncText.textContent = "클라우드 동기화 됨";
    } catch (e) { if (syncText) syncText.textContent = "동기화 실각"; }
  }
}

// ===================================================================
// 3. 서브 비즈니스 로직 (과목, 단원, 퀴즈, 경험치, 용돈, 치트)
// ===================================================================
window.createNewSubject = async function() {
  const input = document.getElementById('subj-name-input');
  if (!input || !input.value.trim()) return;
  const name = input.value.trim();
  if (Object.keys(studySubjects).some(k => studySubjects[k].name === name)) { alert("동일 과목 존재"); return; }
  
  const id = "sub_" + Date.now();
  studySubjects[id] = { id, name, chapters: {}, exp: 0, rank: "브론즈" };
  input.value = ""; 
  
  checkAchievement("ach_1");
  gainExperience(15);
  await saveStorage();
  window.renderSubjectManageTab();
};

window.renderSubjectManageTab = function() {
  const list = document.getElementById('subject-manage-list');
  if (!list) return; list.innerHTML = '';
  const ids = Object.keys(studySubjects);
  
  if (ids.length === 0) {
    list.innerHTML = `<span class="text-xs text-slate-500 block text-center py-4">과목을 먼저 개설해 주세요.</span>`;
    document.getElementById('subject-detail-fallback')?.classList.remove('hidden');
    document.getElementById('subject-detail-panel')?.classList.add('hidden');
    return;
  }
  ids.forEach(id => {
    const sub = studySubjects[id];
    const isSelected = selectedManageSubjectId === id;
    const btn = document.createElement('button');
    btn.className = `w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm transition-all ${isSelected ? 'bg-indigo-600/10 border-indigo-500 text-slate-200 shadow-lg' : 'bg-slate-950/40 border-slate-850 text-slate-400'}`;
    btn.innerHTML = `<span class="font-bold block text-slate-100">${sub.name}</span><span class="text-[10px] text-slate-500">단원 ${Object.keys(sub.chapters||{}).length}개 | 랭크: ${sub.rank||"브론즈"}</span>`;
    btn.onclick = () => { selectedManageSubjectId = id; window.renderSubjectManageTab(); document.getElementById('subject-detail-fallback')?.classList.add('hidden'); document.getElementById('subject-detail-panel')?.classList.remove('hidden'); document.getElementById('detail-subject-title').textContent = sub.name; window.renderSubjectChapters(); };
    list.appendChild(btn);
  });
};

async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'txt' || ext === 'html') return await file.text();
  if (ext === 'pdf') {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let txt = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      txt += content.items.map(item => item.str).join(" ") + "\n";
    }
    return txt;
  }
  return "";
}

window.createNewChapter = async function() {
  if (!selectedManageSubjectId) return;
  const el = document.getElementById('chap-name-input');
  if (!el.value.trim() || !genFileContent) { alert("단원명 입력 및 파일 분석 성공이 선행되어야 합니다."); return; }
  
  const sub = studySubjects[selectedManageSubjectId];
  const id = "chap_" + Date.now();
  sub.chapters[id] = { id, name: el.value.trim() };
  studyMaterials[`${sub.name}___${el.value.trim()}`] = { subject: sub.name, chapter: el.value.trim(), contents: [genFileContent] };
  
  genFileContent = ""; el.value = '';
  document.getElementById('gen-file-status').innerHTML = `드래그 또는 클릭 업로드<br><span class="text-indigo-400 text-[10px]">(PDF / TXT 파일 대응)</span>`;
  document.getElementById('gen-file-input').value = "";
  
  checkAchievement("ach_2");
  gainExperience(25);
  await saveStorage();
  window.renderSubjectChapters();
};

window.renderSubjectChapters = function() {
  const container = document.getElementById('chapter-manage-list');
  if (!container) return; container.innerHTML = '';
  const sub = studySubjects[selectedManageSubjectId];
  const keys = Object.keys(sub.chapters || {});
  if (keys.length === 0) { container.innerHTML = `<span class="text-xs text-slate-500 block py-4 text-center">등록된 단원이 없습니다.</span>`; return; }
  keys.forEach(k => {
    container.innerHTML += `<div class="p-3 bg-slate-950/80 rounded-xl border border-slate-850 text-xs text-slate-300 font-bold flex justify-between items-center"><span>📖 ${sub.chapters[k].name}</span><span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">분석 완료</span></div>`;
  });
};

window.renderGenerateTab = function() {
  const sSel = document.getElementById('gen-subject-select'); if (!sSel) return;
  sSel.innerHTML = '<option value="">== 과목 선택 ==</option>';
  Object.keys(studySubjects).forEach(k => { sSel.innerHTML += `<option value="${k}">${studySubjects[k].name}</option>`; });
  
  sSel.onchange = () => {
    const cSel = document.getElementById('gen-chapter-select'); if (!cSel) return;
    cSel.innerHTML = '';
    const sub = studySubjects[sSel.value];
    if (sub) {
      Object.keys(sub.chapters || {}).forEach(k => { cSel.innerHTML += `<option value="${k}">${sub.chapters[k].name}</option>`; });
    }
  };
};

window.handleBuildQuiz = async function() {
  const sId = document.getElementById('gen-subject-select').value;
  const cId = document.getElementById('gen-chapter-select').value;
  if (!sId || !cId) { alert("대상을 지정해 주십시오."); return; }
  if (!geminiModule) { alert("AI 연결망 초기화 중입니다."); return; }

  const sub = studySubjects[sId]; const chap = sub.chapters[cId];
  const text = studyMaterials[`${sub.name}___${chap.name}`]?.contents.join("\n") || "";
  if (!text) return;

  const spinner = document.getElementById('gen-loading-spinner');
  const btn = document.getElementById('build-quiz-btn');
  btn.classList.add('hidden'); spinner.classList.remove('hidden');

  const prompt = `과목명:${sub.name}\n단원명:${chap.name}\n출제수:10문항\n[★핵심 지침]: 실무 시나리오나 비즈니스 가공 사례는 '절대' 배제하고 실제 대학 전공 정석 시험 양식(핵심 정의, 참거짓 판별, 수식 구조)으로 추출하십시오. 지식 전 영역을 고르게 분산해 출제하세요.\n교안소스:\n${text.substring(0, 15000)}`;

  try {
    const res = await geminiModule.callGemini(prompt, "JSON 데이터 스키마 형태로만 정확히 답변하는 대학교 전공 출제 교수입니다.", true);
    const data = JSON.parse(res);
    quizSheets.push({
      id: "sheet_" + Date.now(), title: data.title || `${sub.name} 기출 모사 평가`,
      subject: sub.name, chapter: chap.name, createdDate: new Date().toISOString().split('T')[0],
      questions: data.questions.slice(0,10).map((q,i)=>({id:i+1, ...q})), isSolved: false
    });
    await saveStorage();
    alert("AI 정석 문제지 패키지 조립이 완료되었습니다.");
    window.changeDashboardTab('storage');
  } catch(e) { alert("출제 오류: " + e.message); }
  finally { btn.classList.remove('hidden'); spinner.classList.add('hidden'); }
};

window.renderStorageTab = function() {
  const grid = document.getElementById('storage-sheets-grid'); if (!grid) return; grid.innerHTML = '';
  const listContainer = document.getElementById('storage-subject-list'); if (listContainer) listContainer.innerHTML = '<button onclick="window.filterStorage(\'all\')" class="w-full text-left px-2.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-500/10 text-indigo-400">전체 보기</button>';
  
  Object.keys(studySubjects).forEach(k => {
    if (listContainer) listContainer.innerHTML += `<button onclick="window.filterStorage('${studySubjects[k].name}')" class="w-full text-left px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:bg-slate-900">${studySubjects[k].name}</button>`;
  });

  if (quizSheets.length === 0) { grid.innerHTML = '<div class="col-span-2 text-center py-6 text-slate-500 text-xs font-bold">출제된 문제지가 없습니다.</div>'; return; }
  window.filterStorage('all');
};

window.filterStorage = function(subjName) {
  const grid = document.getElementById('storage-sheets-grid'); if(!grid) return; grid.innerHTML = '';
  const targets = subjName === 'all' ? quizSheets : quizSheets.filter(s => s.subject === subjName);
  
  if(targets.length === 0) { grid.innerHTML = '<div class="col-span-2 text-center py-6 text-slate-500 text-xs font-bold">해당 과목의 문제지가 없습니다.</div>'; return; }
  targets.forEach(sheet => {
    grid.innerHTML += `<div class="p-4 rounded-xl border border-slate-850 bg-slate-900/40 flex flex-col justify-between space-y-3">
      <div>
        <div class="flex justify-between items-center text-[10px] text-slate-500 font-bold"><span>📅 ${sheet.createdDate}</span><button onclick="window.deleteSheet('${sheet.id}')" class="text-rose-400 hover:underline">삭제</button></div>
        <h4 class="text-xs sm:text-sm font-black text-slate-200 mt-1">${sheet.title}</h4>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 mt-1.5 inline-block border border-slate-850">${sheet.subject}</span>
      </div>
      <div class="flex justify-between items-center pt-2 border-t border-slate-850/60">
        <span class="text-xs font-extrabold ${sheet.isSolved ? 'text-emerald-400' : 'text-amber-400'}">${sheet.isSolved ? `점수: ${sheet.score}점` : '미응시'}</span>
        <button onclick="window.startQuizSheet('${sheet.id}')" class="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold">${sheet.isSolved?'다시 풀기':'응시하기'}</button>
      </div>
    </div>`;
  });
};

window.deleteSheet = async function(id) {
  if (!confirm("삭제하시겠습니까?")) return;
  quizSheets = quizSheets.filter(s => s.id !== id); await saveStorage(); window.renderStorageTab();
};

window.startQuizSheet = function(id) {
  activeSheet = quizSheets.find(s => s.id === id); if(!activeSheet) return;
  currentQuestionIndex = 0;
  tempAnswers = Array.from({ length: activeSheet.questions.length }, () => ({ chosen: null, isSubmitted: false }));
  
  document.getElementById('home-view').classList.add('hidden');
  document.getElementById('quiz-view').classList.remove('hidden');
  document.getElementById('quiz-title-label').textContent = activeSheet.title;
  window.loadQuestion();
};

window.loadQuestion = function() {
  const q = activeSheet.questions[currentQuestionIndex];
  const ans = tempAnswers[currentQuestionIndex];
  document.getElementById('question-index-label').textContent = `Q. ${String(currentQuestionIndex + 1).padStart(2, '0')}`;
  document.getElementById('question-text').textContent = q.question;

  const optContainer = document.getElementById('options-container'); optContainer.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const isCorrectChoice = idx === q.answer;
    const btn = document.createElement('button');
    // 관리자 모드 치트가 활성화된 경우 정답 선지에 주황색 테두리 광채 부여
    const cheatClass = (isCheatEnabled && isCorrectChoice) ? "admin-correct-hint-glow border-amber-500" : "border-slate-800";
    
    btn.className = `w-full text-left p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${ans.chosen === idx ? 'border-indigo-500 bg-indigo-500/10' : cheatClass} hover:bg-slate-900`;
    btn.innerHTML = `<span class="text-slate-200 font-bold">${idx+1}. ${opt}</span>`;
    btn.onclick = () => { if (!ans.isSubmitted) { ans.chosen = idx; window.loadQuestion(); } };
    optContainer.appendChild(btn);
  });

  const actBtn = document.getElementById('action-btn');
  const feedBox = document.getElementById('feedback-box');
  if (ans.isSubmitted) {
    actBtn.textContent = "확인 완료"; actBtn.className = "px-4 py-2 bg-slate-800 text-slate-500 text-xs font-bold rounded-xl cursor-default";
    feedBox.classList.remove('hidden');
    feedBox.className = ans.chosen === q.answer ? "rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs mt-2" : "rounded-xl p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs mt-2";
    document.getElementById('feedback-title').textContent = ans.chosen === q.answer ? "🎉 정답입니다!" : "❌ 오답입니다. 교정값을 확인하십시오.";
    document.getElementById('explanation-text').textContent = q.explanation;
  } else if (ans.chosen !== null) {
    actBtn.textContent = "확인 및 채점"; actBtn.className = "px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl";
    actBtn.onclick = () => { ans.isSubmitted = true; window.loadQuestion(); };
    feedBox.classList.add('hidden');
  } else {
    actBtn.textContent = "선택 대기"; actBtn.className = "px-4 py-2 bg-slate-800 text-slate-500 text-xs font-bold rounded-xl cursor-default";
    feedBox.classList.add('hidden');
  }

  document.getElementById('btn-next').onclick = (currentQuestionIndex === activeSheet.questions.length - 1) ? window.calculateFinalQuizReport : window.navigateNext;
  document.getElementById('btn-next').textContent = (currentQuestionIndex === activeSheet.questions.length - 1) ? "평가 종료" : "다음";
};

window.navigatePrev = function() { if (currentQuestionIndex > 0) { currentQuestionIndex--; window.loadQuestion(); } };
window.navigateNext = function() { if (currentQuestionIndex < activeSheet.questions.length - 1) { currentQuestionIndex++; window.loadQuestion(); } };

window.calculateFinalQuizReport = async function() {
  let correctCount = 0;
  activeSheet.questions.forEach((q, i) => { if(tempAnswers[i].chosen === q.answer) correctCount++; });
  
  activeSheet.score = correctCount * 10;
  activeSheet.isSolved = true;

  // 용돈 및 경험치 보상 시스템 연산
  const rewardCash = correctCount * 500;
  userStats.cash += rewardCash;
  gainExperience(correctCount * 10);
  if(correctCount === activeSheet.questions.length) checkAchievement("ach_3");

  // 과목 학업 랭크 시스템 산정
  Object.keys(studySubjects).forEach(k => {
    if(studySubjects[k].name === activeSheet.subject) {
      if(activeSheet.score >= 90) studySubjects[k].rank = "마스터";
      else if(activeSheet.score >= 70) studySubjects[k].rank = "다이아";
      else studySubjects[k].rank = "실버";
    }
  });

  await saveStorage();
  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('result-view').classList.remove('hidden');
  document.getElementById('final-score').textContent = correctCount;
  document.getElementById('final-total').textContent = activeSheet.questions.length;
  document.getElementById('result-reward-toast').textContent = `💰 점수 보상 용돈 지급: +${rewardCash}원 (보유 중인 총 재화: ${userStats.cash}원)`;
  
  // 오답노트 디테일 대조표 매핑
  const revList = document.getElementById('review-list'); revList.innerHTML = '';
  activeSheet.questions.forEach((q, i) => {
    const isCorrect = tempAnswers[i].chosen === q.answer;
    revList.innerHTML += `<div class="py-2.5 text-xs"><p class="font-bold text-slate-200">${i+1}. ${q.question}</p>
      <p class="mt-1 ${isCorrect?'text-emerald-400':'text-rose-400'} font-medium">선택한 답안: ${q.options[tempAnswers[i].chosen] || "미선택"} | 정답: ${q.options[q.answer]}</p></div>`;
  });
};

// ===================================================================
// 5. 부가 엔진: 경험치, 랭크, 일정, 업적, 치트 스위치
// ===================================================================
function gainExperience(amount) {
  userStats.exp += amount;
  if(userStats.exp >= 100) { userStats.exp -= 100; userStats.rank = userStats.rank === '브론즈' ? '골드' : '플래티넘'; alert(`🎉 종합 학업 등급 상승: ${userStats.rank}!`); }
}
function checkAchievement(id) {
  const ach = achievements.find(a => a.id === id); if(ach && !ach.done) { ach.done = true; alert(`🎖️ 업적 달성: [${ach.title}] - ${ach.desc}`); }
}
window.addScheduleItem = async function() {
  const input = document.getElementById('schedule-input'); if(!input || !input.value.trim()) return;
  schedules.push({ id: Date.now(), text: input.value.trim() }); input.value = '';
  await saveStorage(); window.renderSchedulesAndCalendar();
};
window.deleteSchedule = async function(id) {
  schedules = schedules.filter(s => s.id !== id); await saveStorage(); window.renderSchedulesAndCalendar();
};
window.renderSchedulesAndCalendar = function() {
  const c = document.getElementById('schedule-list-container'); if(c) {
    c.innerHTML = schedules.length === 0 ? '<span class="text-[11px] text-slate-500 font-sans block text-center">등록된 일정이 없습니다.</span>' : schedules.map(s => `<div class="flex justify-between items-center p-2 bg-slate-950 rounded-xl text-[11px] border border-slate-850"><span>📅 ${s.text}</span><button onclick="window.deleteSchedule(${s.id})" class="text-rose-400 font-bold">X</button></div>`).join('');
  }
  const grid = document.getElementById('calendar-days-grid'); if(grid) {
    grid.innerHTML = '';
    for(let i=1; i<=30; i++) {
      const hasPlan = schedules.some(s => s.text.includes(`6/${i}`) || s.text.includes(`06/${i}`) || s.text.includes(`6월 ${i}일`));
      grid.innerHTML += `<div class="p-1.5 rounded-lg border ${hasPlan?'bg-indigo-600/20 border-indigo-500 font-black text-indigo-300':'bg-slate-950/40 border-slate-900 text-slate-400'}">${i}</div>`;
    }
  }
};
window.toggleAdminCheatMode = function() {
  isCheatEnabled = !isCheatEnabled;
  document.getElementById('cheat-toggle-status').textContent = `현재 상태: ${isCheatEnabled ? '🔥 활성화(정답 하이라이팅 작동)' : '비활성화'}`;
  document.getElementById('admin-cheat-indicator-btn').className = isCheatEnabled ? "px-2.5 py-1 text-[10px] rounded-lg font-black bg-amber-500/20 text-amber-400 border border-amber-500 animate-pulse" : "hidden";
};
window.clearAllDataStorage = function() {
  if(confirm("모든 데이터를 영구 삭제하고 포맷하시겠습니까?")) { localStorage.clear(); location.reload(); }
};

window.renderProfileTab = function() {
  document.getElementById('profile-cash-label').textContent = `💰 ${userStats.cash}원`;
  document.getElementById('profile-tier-badge').textContent = `${userStats.rank} 레벨`;
  document.getElementById('profile-tier-emoji').textContent = userStats.rank === '브론즈' ? '🥉' : userStats.rank === '골드' ? '🥇' : '💎';
  document.getElementById('profile-exp-text').textContent = `${userStats.exp} / 100 EXP`;
  document.getElementById('profile-exp-bar').style.width = `${userStats.exp}%`;

  window.renderSchedulesAndCalendar();
  const achBox = document.getElementById('achievements-list-container'); if(achBox) {
    achBox.innerHTML = achievements.map(a => `<div class="p-2.5 border rounded-xl text-left ${a.done?'bg-emerald-500/5 border-emerald-500/30 text-slate-300':'bg-slate-950/20 border-slate-850 text-slate-500'}"><span class="text-xs font-bold block">${a.done?'✅':'🔒'} ${a.title}</span><span class="text-[10px] block mt-0.5">${a.desc}</span></div>`).join('');
  }

  const list = document.getElementById('subject-accordion-container'); if (!list) return; list.innerHTML = '';
  const keys = Object.keys(studySubjects);
  if(keys.length === 0) { list.innerHTML = '<div class="text-center py-6 text-slate-500 text-xs font-bold">등록된 과목이 없습니다.</div>'; }
  else {
    keys.forEach(k => {
      const sub = studySubjects[k];
      const isMaster = sub.rank === "마스터";
      list.innerHTML += `<div class="p-3 bg-slate-900/40 border rounded-xl flex justify-between items-center ${isMaster?'tier-master-card': 'border-slate-850'}"><div class="text-left"><h4 class="font-black text-xs sm:text-sm text-slate-200">${sub.name}</h4><span class="text-[10px] text-slate-500 block mt-0.5">보유 단원 수: ${Object.keys(sub.chapters||{}).length}개</span></div><span class="px-2 py-0.5 text-[10px] font-bold rounded-md ${isMaster?'bg-amber-500 text-slate-950 animate-pulse':'bg-slate-950 text-indigo-400 border border-slate-850'}">🏅 ${sub.rank||"브론즈"}</span></div>`;
    });
  }
};

// ===================================================================
// 6. 어플리케이션 구동 전용 지연 바인딩 센터
// ===================================================================
document.addEventListener('DOMContentLoaded', async () => {
  loadLocalAll();
  window.renderProfileTab();
  
  document.getElementById('create-subj-btn')?.addEventListener('click', window.createNewSubject);
  document.getElementById('create-chap-btn')?.addEventListener('click', window.createNewChapter);
  document.getElementById('build-quiz-btn')?.addEventListener('click', window.handleBuildQuiz);
  document.getElementById('btn-prev')?.addEventListener('click', window.navigatePrev);
  
  // 실시간 글로벌 메모 텍스트 동기화
  document.getElementById('global-memo-textarea')?.addEventListener('input', (e) => {
    globalMemo = e.target.value; saveStorage();
  });

  document.getElementById('gen-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    document.getElementById('gen-file-status').textContent = "교안 구조 해독 중...";
    try {
      genFileContent = await extractTextFromFile(file);
      document.getElementById('gen-file-status').innerHTML = `<span class="text-emerald-400">교안 적재 성공!</span><br><span class="text-[10px] text-slate-400">${file.name.substring(0,20)}</span>`;
    } catch(err) {
      document.getElementById('gen-file-status').innerHTML = `드래그 또는 클릭 업로드<br><span class="text-indigo-400 text-[10px]">(PDF / TXT 파일 대응)</span>`;
    }
  });

  try {
    geminiModule = await import('./gemini-engine.js');
    const apiInput = document.getElementById('api-key-input'); if (apiInput) apiInput.value = geminiModule.getGeminiKey();
    document.getElementById('save-api-key-btn')?.addEventListener('click', () => { geminiModule.saveGeminiKey(apiInput.value); alert('🔑 API 하드웨어 바인딩 완료.'); });

    authModule = await import('./firebase-auth.js');
    const authBtn = document.getElementById('auth-action-btn');
    authBtn?.addEventListener('click', async () => { if (window.currentUser) { await authModule.logoutUser(); } else { try { await authModule.loginWithGoogle(); } catch(e) { alert("로그인 실패: " + e.message); } } });

    authModule.onAuthStateChanged(authModule.auth, async (user) => {
      window.currentUser = user;
      document.getElementById('profile-user-name').textContent = user ? user.displayName : "게스트 계정";
      document.getElementById('profile-user-email').textContent = user ? user.email : "(오프라인 모드)";
      document.getElementById('sync-status-text').textContent = user ? "클라우드 동기화 됨" : "동기화 대기";
      document.getElementById('sync-status-dot').className = user ? "w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/50" : "w-1.5 h-1.5 rounded-full bg-slate-500";
      if (authBtn) { authBtn.textContent = user ? "로그아웃" : "🌐 구글 계정 연동 (클라우드 저장)"; authBtn.className = user ? "px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] rounded-lg font-black transition-all" : "px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] rounded-lg font-black transition-all"; }
      
      if (user) {
        const cloudData = await authModule.loadFromCloud(user.uid, APP_ID);
        if (cloudData) {
          // 클라우드 데이터를 최우선 복원한 뒤, 즉시 로컬 스토리지에 동기화 브리징 수행
          studySubjects = cloudData.studySubjects || {};
          studyMaterials = cloudData.studyMaterials || {};
          quizSheets = cloudData.quizSheets || [];
          globalMemo = cloudData.globalMemo || "";
          schedules = cloudData.schedules || [];
          userStats = cloudData.userStats || { exp: 0, cash: 0, rank: "브론즈" };
          achievements = cloudData.achievements || achievements;

          localStorage.setItem('sub_v26', JSON.stringify(studySubjects));
          localStorage.setItem('mat_v26', JSON.stringify(studyMaterials));
          localStorage.setItem('quiz_v26', JSON.stringify(quizSheets));
          localStorage.setItem('memo_v26', globalMemo);
          localStorage.setItem('sch_v26', JSON.stringify(schedules));
          localStorage.setItem('stats_v26', JSON.stringify(userStats));
          localStorage.setItem('ach_v26', JSON.stringify(achievements));

          const mEl = document.getElementById('global-memo-textarea'); if(mEl) mEl.value = globalMemo;
          window.renderProfileTab();
        }
      }
    });
  } catch (error) { console.warn("모듈 바인딩 대기 중", error); }
});
