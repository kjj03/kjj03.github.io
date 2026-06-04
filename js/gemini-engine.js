// js/gemini-engine.js

export function saveGeminiKey(key) {
  localStorage.setItem("custom_gemini_api_key", key.trim());
}

export function getGeminiKey() {
  return localStorage.getItem("custom_gemini_api_key") || "";
}

// ⚠️ 누락되었던 핵심 AI 통신 함수 복구
export async function callGemini(promptText, sysPrompt = "", isJson = false) {
  const key = getGeminiKey();
  if (!key) throw new Error("Gemini API 키가 설정되지 않았습니다. 설정 탭에서 키를 입력해주세요.");
  
  // 최신 제미나이 모델 적용
  const modelName = "gemini-2.5-flash"; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
  
  const payload = { contents: [{ parts: [{ text: promptText }] }] };
  if (sysPrompt) payload.systemInstruction = { parts: [{ text: sysPrompt }] };
  
  // JSON 스키마 강제 출력을 위한 설정
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
                explanation: { type: "STRING" }, 
                category: { type: "STRING" }
              },
              required: ["question", "options", "answer", "explanation"]
            }
          }
        },
        required: ["questions"]
      }
    };
  }

  const res = await fetch(url, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(payload) 
  });
  
  if (!res.ok) throw new Error(`HTTP ${res.status}: API 키가 유효하지 않거나 네트워크 오류입니다.`);
  
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}
