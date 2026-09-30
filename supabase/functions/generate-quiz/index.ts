// Supabase Edge Function: generate-quiz
// Uses Groq (OpenAI-compatible API, model: Qwen) to turn study material into practice questions, flashcards, or clean lesson notes.
// The Groq key lives in a Supabase secret (GROQ_API_KEY), never in the app. Only signed-in users can call this.
//
// Request  (POST, JSON):  { mode: 'questions' | 'cards' | 'notes', text: string, count?: number, types?: ('mc'|'tf'|'id'|'enum')[],
//                           title?: string, subject?: string, part?: number, parts?: number }
// Response (JSON):        { questions: [...] } | { cards: [...] } | { notes: string }   (or { error, retryAfter? } with a non-200 status)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DEFAULT_MODEL = 'qwen/qwen3-32b';
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

/** Qwen can put its reasoning in <think> tags; drop it. */
export function stripThink(s: string) {
  return String(s ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim();
}
/** Parse JSON even if the model wrapped it in text or code fences. */
export function parseJsonLoose(content: string) {
  const s = stripThink(content);
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no json');
  return JSON.parse(s.slice(a, b + 1));
}
/** Plain-text notes: remove markdown the model may add, normalise bullets. */
export function cleanNotes(s: string) {
  const t = stripThink(s)
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^[ 	]{0,3}#{1,6}[ 	]+/gm, '')
    .replace(/^[ 	]*[-*+][ 	]+/gm, '• ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return /^NO_LESSON_CONTENT\b/i.test(t) ? '' : t;
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
    const idx = Number.isInteger(q.answer) ? q.answer : choices.findIndex((c: string) => key(c) === key(str(q.answer)));
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
- Never ask about the title of the document, the course or subject name, the school, the author or the file.
- Multiple choice: one clearly correct choice and three plausible but clearly wrong choices taken from the same topic. Do not use "all of the above" or "none of the above".
- True or false: make about half of them false by changing one key fact; a false statement must be plainly wrong according to the material.
- Identification: the question must have one unambiguous answer and must not contain the answer.
- Spread the questions across different parts of the material and do not repeat a fact.
- Use the same language as the material. Ignore headers, footers, page numbers and file names.`;

const SYSTEM_CARDS = `You are an experienced teacher making flashcards for a student. Use ONLY the study material you are given. Reply with a single JSON object: {"cards":[{"front":"...","back":"..."}]}.
Each card covers one important idea. "front" is a short term, concept or question. "back" is a clear, concise answer or definition (under 30 words). Cover different parts of the material, never mention "the text" or "the material", never make a card about the document title, course or subject name, school or author, do not repeat cards, and use the same language as the material. Ignore headers, footers, page numbers and file names.`;

const SYSTEM_NOTES = `You turn raw text extracted from a student's file (PDF, slides or document) into clean lesson notes for studying. Reply with the notes only, as plain text. No introduction, no commentary and no markdown symbols (no #, *, ** or backticks).

KEEP the lessons themselves: topics, explanations, definitions, key points, steps, lists, formulas, examples, dates and numbers, exactly as the source states them. Stay faithful and accurate: never add outside information, never guess, never change a fact. Fix broken line breaks and hyphenation and merge fragments into complete sentences.

REMOVE everything that is not lesson content: the reviewer, course or subject title and course code, the school or institution, author, instructor or student names, document dates, labels such as "Reviewer" or "Lesson 1 of 5", cover pages, tables of contents, learning-objective boilerplate, instructions to students, headers, footers, page numbers, watermarks, file names, reference-only links and repeated text. Do not repeat the provided title or subject anywhere in the notes.

FORMAT (plain text): each topic starts on its own short heading line (no bullet). Under it write the content as short lines: a definition as "Term: meaning", a list item as "• item", and an ordinary explanation as a complete sentence. Keep related items together under their heading and leave a blank line between topics. If the text has no lesson content at all, reply with exactly: NO_LESSON_CONTENT`;

/** Call Groq. Qwen3 "thinks" by default, which is slow and eats the rate limit, so ask it not to (and retry without if the model rejects that). */
async function askGroq(apiKey: string, messages: unknown[], opts: { json: boolean; temperature: number; maxTokens: number }) {
  const model = Deno.env.get('GROQ_MODEL') || DEFAULT_MODEL;
  const build = (reasoning: boolean) => JSON.stringify({
    model,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
    messages,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    ...(reasoning && /qwen/i.test(model) ? { reasoning_effort: 'none' } : {}),
  });
  const post = (body: string) => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body,
  });
  let res = await post(build(true));
  if (res.status === 400 && /reasoning/i.test(await res.clone().text())) res = await post(build(false));
  return res;
}

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
  const mode = body?.mode === 'cards' ? 'cards' : body?.mode === 'notes' ? 'notes' : 'questions';
  const count = clamp(Math.floor(Number(body?.count)) || 10, 1, MAX_COUNT);
  let types: string[] = (Array.isArray(body?.types) ? body.types : TYPES).filter((t: string) => TYPES.includes(t));
  if (!types.length) types = TYPES;

  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) return json({ error: 'AI isn’t set up yet (the GROQ_API_KEY secret is missing).' }, 500);

  let system = SYSTEM_QUESTIONS;
  let user = `Write ${count} questions using only these types: ${types.join(', ')}. Mix the types fairly evenly.\n\nSTUDY MATERIAL:\n"""\n${text}\n"""`;
  if (mode === 'cards') {
    system = SYSTEM_CARDS;
    user = `Make ${count} flashcards from this study material.\n\nSTUDY MATERIAL:\n"""\n${text}\n"""`;
  } else if (mode === 'notes') {
    const part = Number(body?.part) || 1;
    const parts = Number(body?.parts) || 1;
    system = SYSTEM_NOTES;
    user = `Reviewer title: "${str(body?.title, 120)}"\nSubject: "${str(body?.subject, 80)}"\n${parts > 1 ? `This is part ${part} of ${parts} of the file.\n` : ''}\nRAW TEXT FROM THE FILE:\n"""\n${text}\n"""`;
  }

  let res: Response;
  try {
    res = await askGroq(apiKey, [{ role: 'system', content: system }, { role: 'user', content: user }], {
      json: mode !== 'notes', temperature: mode === 'notes' ? 0.2 : 0.7, maxTokens: mode === 'notes' ? 4096 : 4000,
    });
  } catch {
    return json({ error: 'Could not reach the AI service.' }, 502);
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after')) || undefined;
    return json({ error: 'The AI is busy right now. Try again in a minute.', retryAfter }, 429);
  }
  if (!res.ok) return json({ error: `The AI service returned an error (${res.status}).` }, 502);

  let content = '';
  try { content = (await res.json())?.choices?.[0]?.message?.content ?? ''; } catch { /* handled below */ }

  if (mode === 'notes') return json({ notes: cleanNotes(content) });

  let parsed: any;
  try { parsed = parseJsonLoose(content); } catch { return json({ error: 'The AI sent back something unreadable. Try again.' }, 502); }
  const seen = new Set<string>();
  if (mode === 'cards') {
    const cards = (Array.isArray(parsed?.cards) ? parsed.cards : []).map(cleanCard)
      .filter((c: any) => c && !seen.has(key(c.front)) && seen.add(key(c.front))).slice(0, count);
    return json({ cards });
  }
  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : []).map((q: unknown) => cleanQuestion(q, types))
    .filter((q: any) => q && !seen.has(key(q.text)) && seen.add(key(q.text))).slice(0, count);
  return json({ questions });
});
