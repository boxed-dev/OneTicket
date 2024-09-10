const API_BASE_URL = "https://one-lang-api.vercel.app"; // Update this to your FastAPI server URL

export async function detectAndTranslate(text: string) {
  const response = await fetch(`${API_BASE_URL}/detect-and-translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  return response.json();
}

export async function translate(text: string, targetLanguage: string) {
  const response = await fetch(`${API_BASE_URL}/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, target_language: targetLanguage }),
  });
  return response.json();
}
