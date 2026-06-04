// js/gemini-engine.js
export function saveGeminiKey(key) {
  localStorage.setItem("custom_gemini_api_key", key.trim());
}

export function getGeminiKey() {
  return localStorage.getItem("custom_gemini_api_key") || "";
}
