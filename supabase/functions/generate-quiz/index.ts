// Supabase Edge Function: generate-quiz
// Turns study material into practice questions or flashcards using Groq (an OpenAI-compatible API).
// The Groq key lives in a Supabase secret (GROQ_API_KEY), never in the app. Only signed-in users can call this.
//
// Request  (POST, JSON):  { mode: 'questions' | 'cards', text: string, count: number, types?: ('mc'|'tf'|'id'|'enum')[] }
// Response (JSON):        { questions: [...] }  or  { cards: [...] }   (or { error: string } with a non-200 status)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const TYPES = ['mc', 'tf', 'id', 'enum'];
const MAX_TEXT = 15000;
const MAX_COUNT = 20;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const str = (v: unknown, max = 600) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Keep only well-formed questions, in exactly the shape the app stores. */
export function cleanQuestion(q: any, allowed: string[]) {
  if (!q || typeof q !== 'object') return null;
  const type = str(q.type, 10).toLowerCase();
  if (!allowed.includes(type)) return null;
  const text = str(q.text, 500);
  if (text.length < 8) return null;
  const explanation = str(q.explanation, 240);
  const base = { type, text, ...(explanation ? { explanation } : {}) };

  if (type === 'mc') {
    const choices = Array.isArray(q.choices) ? q.choices.map((c: unknown) => str(c, 200)) : [];
    if (choices.length !== 4 || choices.some((c: string) => !c) || new Set(choices.map(key)).size !== 4) return null;
    let idx = Number.isInteger(q.answer) ? q.answer : choices.findIndex((c: string) => key(c) === key(str(q.answer)));
    if (!(idx >= 0 && idx < 4)) return null;
    const right = choices[idx];
    const mixed = shuffle(choices); // don't let the model decide where the right answer sits
    return { ...base, choices: mixed, answer: mixed.indexOf(right) };
  }
  if (type === 'tf') {
    const a = q.answer === true || String(q.answer).toLowerCase() === 'true';
    const b = q.answer === false || String(q.answer).toLowerCase() === 'false';
    if (!a && !b) return null;
    return { ...base, answer: a };
  }
  if (type === 'id') {
    const answer = Array.isArray(q.answer) ? q.answer.map((x: unknown) => str(x, 80)).filter(Boolean).join(' | ') : str(q.answer, 120);
    if (!answer || answer.split(' ').length > 8) return null;
    if (key(text).includes(key(answer)) && answer.length > 3) return null; // answer given away in the question
    return { ...base, answer };
  }
  // enum
  const items: string[] = (Array.isArray(q.answer) ? q.answer : []).map((x: unknown) => str(x, 80)).filter(Boolean);
  const unique = items.filter((x, i) => items.findIndex((y) => key(y) === key(x)) === i);
  if (unique.length < 3 || unique.length > 10) return null;
  const withCount = /\d|\b(three|four|five|six|seven|eight|nine|ten|all)\b/i.test(text) ? text : `${text} (${unique.length} items)`;
  return { ...base, text: withCount, answer: unique };
}
export function cleanCard(c: any) {
  const front = str(c?.front, 300);
  const back = str(c?.back, 500);
  return front.length >= 2 && back.length >= 1 ? { front, back } : null;
}

const SYSTEM_QUESTIONS = `You are an experienced teacher writing practice questions for a student. Use ONLY the study material you are given. Reply with a single JSON object.

Output format: {"questions":[ ... ]}. Every question has "type", "text" and a short "explanation" (one sentence saying why the answer is right). The types are:
- "mc": multiple choice. Fields: "choices" (exactly 4 different strings) and "answer" (the index 0-3 of the correct choice).
- "tf": true or false. "text" is a statement. "answer" is true or false.
- "id": identification. "answer" is a short specific term, name or number (1 to 4 words). You may list accepted alternatives separated by " | ".
- "enum": enumeration. "text" asks the student to list ALL N items (put the number N in the question). "answer" is an array of 3 to 8 short strings.

Rules:
- Write natural, self-contained questions that test understanding of the ideas, not trivia about wording or layout.
- Never mention "the text", "the passage", "the material", "the notes", "the document", "the slide" or "the reviewer". Never refer to page numbers.
- Multiple choice: one clearly correct choice and three plausible but clearly wrong choices taken from the same topic. Do not use "all of the above" or "none of the above".
- True or false: make about half of them false by changing one key fact; a false statement must be plainly wrong according to the material.
- Identification: the question must have one unambiguous answer and must not contain the answer.
- Spread the questions across different parts of the material and do not repeat a fact.
- Use the same language as the material. Ignore headers, footers, page numbers and file names.`;

const SYSTEM_CARDS = `You are an experienced teacher making flashcards for a student. Use ONLY the study material you are given. Reply with a single JSON object: {"cards":[{"front":"...","back":"..."}]}.
Each card covers one important idea. "front" is a short term, concept or question. "back" is a clear, concise answer or definition (under 30 words). Cover different parts of the material, never mention "the text" or "the material", do not repeat cards, and use the same language as the material. Ignore headers, footers, page numbers and file names.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  // Only signed-in users may spend the Groq quota.
  const who = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: req.headers.get('Authorization') || '', apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' },
  }).catch(() => null);
  if (!who || !who.ok) return json({ error: 'Please sign in to use AI.' }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const text = String(body?.text ?? '').trim().slice(0, MAX_TEXT);
  if (text.length < 40) return json({ error: 'There isn’t enough text to work from.' }, 400);
  const mode = body?.mode === 'cards' ? 'cards' : 'questions';
  const count = clamp(Math.floor(Number(body?.count)) || 10, 1, MAX_COUNT);
  let types: string[] = (Array.isArray(body?.types) ? body.types : TYPES).filter((t: string) => TYPES.includes(t));
  if (!types.length) types = TYPES;

  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) return json({ error: 'AI isn’t set up yet (the GROQ_API_KEY secret is missing).' }, 500);

  const user = mode === 'cards'
    ? `Make ${count} flashcards from this study material.\n\nSTUDY MATERIAL:\n"""\n${text}\n"""`
    : `Write ${count} questions using only these types: ${types.join(', ')}. Mix the types fairly evenly.\n\nSTUDY MATERIAL:\n"""\n${text}\n"""`;

  let res: Response;
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: mode === 'cards' ? SYSTEM_CARDS : SYSTEM_QUESTIONS },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch {
    return json({ error: 'Could not reach the AI service.' }, 502);
  }
  if (res.status === 429) return json({ error: 'The AI is busy right now. Try again in a minute.' }, 429);
  if (!res.ok) return json({ error: `The AI service returned an error (${res.status}).` }, 502);

  let parsed: any;
  try {
    const data = await res.json();
    parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
  } catch {
    return json({ error: 'The AI sent back something unreadable. Try again.' }, 502);
  }

  if (mode === 'cards') {
    const seen = new Set<string>();
    const cards = (Array.isArray(parsed?.cards) ? parsed.cards : []).map(cleanCard)
      .filter((c: any) => c && !seen.has(key(c.front)) && seen.add(key(c.front))).slice(0, count);
    return json({ cards });
  }
  const seen = new Set<string>();
  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : []).map((q: unknown) => cleanQuestion(q, types))
    .filter((q: any) => q && !seen.has(key(q.text)) && seen.add(key(q.text))).slice(0, count);
  return json({ questions });
});
