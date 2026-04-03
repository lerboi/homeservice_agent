/**
 * POST /api/chat
 *
 * Tenant-authenticated chat endpoint for the Voco AI dashboard assistant.
 * Retrieves relevant knowledge docs via keyword+route RAG, then calls Groq
 * (Llama 4 Scout) for a chat completion.
 *
 * Expects JSON body: { message: string, currentRoute?: string, history?: Array }
 * Returns JSON: { reply: string }
 *
 * Does NOT run on Edge runtime — Node.js runtime required for fs (getRelevantKnowledge).
 */

import OpenAI from 'openai';
import { getTenantId } from '@/lib/get-tenant-id';
import { getRelevantKnowledge } from '@/lib/chatbot-knowledge/index.js';

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
      { error: 'AI assistant is not configured. Please set GROQ_API_KEY.' },
      { status: 503 }
    );
  }

  // 2. Tenant auth guard
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 3. Parse request body
  const { message, currentRoute, history = [] } = await request.json();

  // 4. Validate message
  if (!message || message.trim().length === 0) {
    return Response.json({ error: 'Message is required' }, { status: 400 });
  }

  // 5. RAG: retrieve relevant knowledge docs for this message and route
  const knowledge = await getRelevantKnowledge(message, currentRoute);

  // 6. Build system prompt
  const systemPrompt = `You are Voco AI, an expert assistant for the Voco dashboard — a platform that helps home service contractors (plumbers, HVAC, electricians, handymen) manage calls, leads, bookings, and invoices.

Your role is to help business owners understand and use the dashboard. You:
- Answer questions about features and how they work
- Explain dashboard sections and their purpose
- Provide navigation links when the user needs to go somewhere
- Give short, practical answers (2-4 sentences unless a step-by-step is needed)

You do NOT:
- Create, edit, or delete any data
- Access the user's specific data or account information
- Make promises about features that don't exist

The user is currently on: ${currentRoute || '/dashboard'}

When you want to suggest navigation, use this format exactly:
[Go to Page Name](/dashboard/path)

Place navigation links on their own line after your answer.

${knowledge ? `\nRelevant documentation:\n${knowledge}` : ''}`;

  // 7. Build messages array: system + last 10 history entries + user message
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: message },
  ];

  // 8. Call Groq with error handling
  try {
    const response = await getGroqClient().chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages,
      max_tokens: 500,
      temperature: 0.3,
    });

    return Response.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error('Groq API error:', err);
    return Response.json({
      reply: 'Something went wrong on my end. Please try again in a moment.',
    });
  }
}
