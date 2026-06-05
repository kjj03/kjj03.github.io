// js/gemini-engine.js
export function saveGeminiKey(key) { localStorage.setItem("custom_gemini_api_key", key.trim()); }
export function getGeminiKey() { return localStorage.getItem("custom_gemini_api_key") || ""; }

/**
 * Gemini API 통신 코어 함수 (503 과부하 및 429 초과 요청 발생 시 자동 지수 재시도 메커니즘 탑재)
 */
export async function callGemini(promptText, sysPrompt = "", isJson = false, retries = 3, delay = 1500) {
  const key = getGeminiKey();
  if (!key) throw new Error("API 키가 누락되었습니다. 시스템 정보 탭에서 키를 입력하십시오.");
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  const payload = { contents: [{ parts: [{ text: promptText }] }] };
  if (sysPrompt) payload.systemInstruction = { parts: [{ text: sysPrompt }] };
  
  if (isJson) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          questions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                question: { type: "STRING" }, 
                options: { type: "ARRAY", items: { type: "STRING" } },
                answer: { type: "INTEGER" }, 
                explanation: { type: "STRING" }
              },
              required: ["question", "options", "answer", "explanation"]
            }
          }
        },
        required: ["questions"]
      }
    };
  }

  // 루프를 돌며 지정된 횟수만큼 재시도 수행
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });

      // 구글 서버 과부하(503) 또는 일시적 트래픽 제한(429) 감지 시 재시도 트리거
      if (res.status === 503 || res.status === 429) {
        if (i === retries - 1) {
          throw new Error(`HTTP ${res.status}: 구글 AI 서버가 현재 요청이 너무 많아 지연되고 있습니다. 잠시 후 다시 생성 버튼을 눌러주세요.`);
        }
        console.warn(`Gemini API 가동 일시 지연 (${res.status}). ${delay}ms 후 백그라운드 재시도를 수행합니다. (시도 ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // 다음 시도 시 대기 시간 2배 증가 (지수 백오프 기법)
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}: API 통신 장애가 식별되었습니다.`);
      
      const out = await res.json();
      const outputText = out.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!outputText) throw new Error("구글 응답 데이터 텍스트가 비어있습니다.");
      
      return outputText;

    } catch (err) {
      // 마지막 시도마저 실패하면 에러를 밖으로 던짐
      if (i === retries - 1) throw err;
      console.warn(`네트워크 가동 실패로 인한 지연 재실행 중...: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

/**
 * 확장자별 파싱 서브엔정 
 */
export async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'txt' || ext === 'html') return await file.text();
  
  if (ext === 'pdf') {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let textStream = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      textStream += textContent.items.map(item => item.str).join(" ") + "\n";
    }
    return textStream;
  }
  return "";
}
