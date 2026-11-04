import 'dotenv/config';
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}&pageSize=100`);
const d = await r.json();
if (!r.ok) console.log(r.status, JSON.stringify(d));
else d.models.filter((m) => m.supportedGenerationMethods?.includes('generateContent')).forEach((m) => console.log(m.name));