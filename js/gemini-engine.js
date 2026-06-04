// js/gemini-engine.js
export function saveGeminiKey(key) { localStorage.setItem("custom_gemini_api_key", key.trim()); }
export function getGeminiKey() { return localStorage.getItem("custom_gemini_api_key") || ""; }

export async function callGemini(promptText, sysPrompt = "", isJson = false) {
  const key = getGeminiKey();
  if (!key) throw new Error("API 키가 누락되었습니다. 설정 창에서 키를 등록해 주세요.");
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
  if (!res.ok) throw new Error("Gemini API 서버 통신 장애가 발생했습니다.");
  const out = await res.json();
  return out.candidates?.[0]?.content?.parts?.[0]?.text;
}
