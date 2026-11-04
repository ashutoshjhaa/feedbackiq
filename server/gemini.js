const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Gemini ko call karke JSON wapas leta hai. Fail ho to 3 baar retry.
async function askJson(prompt, tries = 3) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      });
      if (!res.ok) throw new Error('Gemini error ' + res.status);
      const data = await res.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
}

export const TOPICS = ['delivery', 'price', 'quality', 'support', 'app', 'other'];

// Ek batch (10-15 reviews) ek hi call me analyze hota hai
export async function analyzeBatch(texts) {
  const list = texts.map((t, i) => `${i}: ${t}`).join('\n');
  const prompt = `Analyze these customer reviews. For each one return sentiment (positive, negative or neutral), topic (one of: ${TOPICS.join(', ')}) and a summary of max 12 words.
Reply ONLY as a JSON array: [{"i":0,"sentiment":"...","topic":"...","summary":"..."}]
Reviews:
${list}`;
  const out = await askJson(prompt);
  return Array.isArray(out) ? out : [];
}

// Negative reviews ko issues me group karta hai
export async function clusterIssues(items) {
  const list = items.map((r, i) => `${i}: [${r.topic}] ${r.summary}`).join('\n');
  const prompt = `These are negative customer reviews. Group the ones describing the same problem into issues.
For each issue give: title (short), topic, suggestion (one practical fix, one sentence), reviews (array of review numbers in the group).
Every review number should appear in at most one issue. Reply ONLY as a JSON array:
[{"title":"...","topic":"...","suggestion":"...","reviews":[0,3]}]
Reviews:
${list}`;
  const out = await askJson(prompt);
  return Array.isArray(out) ? out : [];
}
