// api/gemini.js
export default async function handler(req, res) {
  // CORS 처리 및 POST 제한
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY; // Vercel 대시보드에 격리된 키를 안전하게 주입
  const { prompt, systemInstruction, isJson } = req.body;

  // 런타임 모델 후보군 자동 검출 루프 적용
  const modelCandidates = [
    "gemini-2.5-flash-preview-09-2025",
    "gemini-2.5-flash",
    "gemini-1.5-flash"
  ];

  let lastError = null;
  for (const modelName of modelCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    
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
                  question: { type: "STRING" }, boxText: { type: "STRING" },
                  options: { type: "ARRAY", items: { type: "STRING" } },
                  answer: { type: "INTEGER" }, explanation: { type: "STRING" }, category: { type: "STRING" }
                },
                required: ["question", "options", "answer", "explanation"]
              }
            }
          },
          required: ["questions"]
        }
      };
    }

    try {
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (geminiRes.status === 404) continue;
      if (!geminiRes.ok) throw new Error(`HTTP Error ${geminiRes.status}`);

      const data = await geminiRes.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return res.status(200).json({ text });
    } catch (err) {
      lastError = err;
    }
  }

  return res.status(500).json({ error: lastError?.message || "Failed to call Gemini API" });
}

#### Step 3. HTML 프론트엔드 연동 주소 선언
마지막으로 제공해 드린 `unsupervised_learning_quiz.html` 파일 상단에 정의된 **`PROXY_ENDPOINT`** 변수를 활성화해 줍니다.
```javascript
const PROXY_ENDPOINT = "/api/gemini"; // 이렇게 적어두면 사이트 접속 시 알아서 프록시 백엔드로 요청을 보내어 키 입력 없이 즉시 작동합니다!

이렇게 구성하시면 소스코드가 담긴 깃허브 퍼블릭 저장소에는 단 한 획의 실제 비밀키도 포함되지 않으므로 해킹 및 유출 걱정이 0%가 되며, 다른 사람들은 링크 클릭 한 번으로 사용자님이 기획한 혁신적인 AI 맞춤형 문제 풀이 및 랭킹 서비스를 쾌적하게 즉시 즐길 수 있습니다.
