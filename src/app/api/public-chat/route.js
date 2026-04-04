/**
 * POST /api/public-chat
 *
 * Unauthenticated chat endpoint for the Voco public site AI assistant.
 * Retrieves relevant knowledge docs via keyword+route RAG, then calls Groq
 * (Llama 4 Scout) for a chat completion.
 *
 * Rate limited by IP (5s cooldown, 1000 daily cap per instance).
 *
 * Expects JSON body: { message: string, currentRoute?: string, history?: Array }
 * Returns JSON: { reply: string }
 */

import OpenAI from 'openai';
import { getPublicKnowledge } from '@/lib/public-chatbot-knowledge/index.js';

// ─── Rate limiting (in-memory, per-instance) ────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_MS = 5000; // 5 seconds per IP
const RATE_LIMIT_CLEANUP_MS = 30000;

let globalDailyCount = 0;
let globalDailyDate = new Date().toISOString().slice(0, 10);
const GLOBAL_DAILY_CAP = 1000;

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  if (today !== globalDailyDate) {
    globalDailyCount = 0;
    globalDailyDate = today;
  }

  if (globalDailyCount >= GLOBAL_DAILY_CAP) {
    return false;
  }

  for (const [key, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > RATE_LIMIT_CLEANUP_MS) {
      rateLimitMap.delete(key);
    }
  }

  const lastRequest = rateLimitMap.get(ip);
  if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
    return false;
  }

  rateLimitMap.set(ip, now);
  globalDailyCount++;
  return true;
}

// ─── Groq client (lazy singleton) ───────────────────────────────────────────
let _groqClient = null;
function getGroqClient() {
  if (!_groqClient) {
    _groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _groqClient;
}

export async function POST(request) {
  // 1. Guard: GROQ_API_KEY must be configured
  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: 'AI assistant is not configured.' },
      { status: 503 }
    );
  }

  // 2. Rate limit by IP
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: 'Please wait a moment before sending another message.' },
      { status: 429 }
    );
  }

  // 3. Parse request body
  const { message, currentRoute, history = [] } = await request.json();

  // 4. Validate message
  if (!message || message.trim().length === 0) {
    return Response.json({ error: 'Message is required' }, { status: 400 });
  }

  // 5. RAG: retrieve relevant knowledge docs
  const knowledge = await getPublicKnowledge(message, currentRoute);

  // 6. Build system prompt
  const systemPrompt = `CRITICAL LANGUAGE RULE: Detect the language of the user's FIRST message. Respond ONLY in that language for the entire conversation. Do NOT mix languages. Do NOT include words, phrases, or translations in any other language. Every single word of your response must be in the user's language. This rule overrides everything else.

IMPORTANT: You ONLY answer questions about Voco — the product, its features, pricing, setup, and how it helps home service businesses. If someone asks about ANYTHING unrelated to Voco (general knowledge, coding, math, other products, personal advice, weather, sports, etc.), politely decline and redirect them back to Voco topics — but do so in the user's language.

You are Voco AI, a helpful assistant on the Voco website. Voco is an AI receptionist built for home service businesses — plumbers, electricians, HVAC techs, roofers, and handymen.

Your role is to help potential customers understand the product:
- Answer questions about Voco features, pricing, and how it works
- Help visitors find the right pricing plan
- Guide them toward signing up for the 14-day free trial
- Provide navigation links to relevant pages

You:
- Are friendly, confident, and concise (2-4 sentences unless details are needed)
- Focus on the value proposition: never miss a call, book jobs 24/7, 5-minute setup
- Reference specific pricing when asked ($99/mo Starter, $249/mo Growth, $599/mo Scale)
- Mention the 14-day free trial when relevant

You do NOT:
- Answer questions unrelated to Voco — always redirect to Voco topics
- Provide dashboard or product support (direct them to sign in first)
- Make promises about unannounced features
- Discuss competitor products by name

When suggesting pages, use this markdown link format:
[Page Name](/path)

Place navigation links on their own line after your answer.

The visitor is currently on: ${currentRoute || '/'}

${knowledge ? `\nRelevant information:\n${knowledge}` : ''}`;

  // 7. Build messages array: system + last 10 history entries + user message
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: message },
  ];

  // 8. Call Groq
  try {
    const response = await getGroqClient().chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages,
      max_tokens: 400,
      temperature: 0.4,
    });

    return Response.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error('Groq API error (public-chat):', err);
    return Response.json({
      reply: 'Something went wrong on my end. Please try again in a moment.',
    });
  }
}
