// js/gemini-engine.js
export function saveGeminiKey(key) { localStorage.setItem("custom_gemini_api_key", key.trim()); }
export function getGeminiKey() { return localStorage.getItem("custom_gemini_api_key") || ""; }

export async function callGemini(promptText, sysPrompt = "", isJson = false) {
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
                question: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } },
                answer: { type: "INTEGER" }, explanation: { type: "STRING" }
              },
              required: ["question", "options", "answer", "explanation"]
            }
          }
        },
        required: ["questions"]
      }
    };
  }

  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: API 통신 오류 발생`);
  const out = await res.json();
  return out.candidates?.[0]?.content?.parts?.[0]?.text;
}

// v3.2.1 핵심 비즈니스 로직: 파일 추출 인프라 엔진 모듈화 이식
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
