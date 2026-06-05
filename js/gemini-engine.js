export function saveGeminiKey(key) { localStorage.setItem("custom_gemini_api_key", key.trim()); }
export function getGeminiKey() { return localStorage.getItem("custom_gemini_api_key") || ""; }

export async function callGemini(promptText, sysPrompt = "", isJson = false, retries = 3, delay = 1500) {
  const key = getGeminiKey();
  if (!key) throw new Error("API 키가 누락되었습니다.");
  
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

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });

      if (res.status === 503 || res.status === 429) {
        if (i === retries - 1) throw new Error(`HTTP ${res.status}: 구글 AI 서버 부하 과중 상태입니다.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const out = await res.json();
      const outputText = out.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!outputText) throw new Error("데이터 수신 공란 오류");
      
      return outputText;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

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
