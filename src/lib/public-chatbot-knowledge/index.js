/**
 * Public chatbot knowledge base RAG retrieval.
 * Server-only module — never import from client components.
 *
 * Matches relevant knowledge docs to the visitor's message using two signals:
 * 1. Current page route → priority doc for the page the visitor is on
 * 2. Keyword matching → up to 1 additional doc from message content
 *
 * Returns at most 2 doc sections joined with --- separator.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Maps public routes to their primary knowledge doc.
 */
const ROUTE_DOC_MAP = {
  '/': 'overview.md',
  '/pricing': 'pricing.md',
  '/about': 'overview.md',
  '/contact': 'contact.md',
};

/**
 * Maps keyword groups to knowledge docs.
 * Checked in order — first match wins (breaks after 1 additional doc).
 */
const KEYWORD_DOC_MAP = [
  { keywords: ['price', 'pricing', 'cost', 'plan', 'tier', 'starter', 'growth', 'scale', 'enterprise', 'trial', 'cancel', 'discount', 'annual', 'monthly', 'overage', 'upgrade'], doc: 'pricing.md' },
  { keywords: ['feature', 'booking', 'triage', 'sms', 'alert', 'crm', 'lead', 'invoice', 'estimate', 'calendar', 'sync', 'analytics', 'language', 'recording', 'notification', 'priority', 'vip', 'forward', 'forwarding', 'route', 'routing', 'pickup', 'voice', 'time block', 'vacation', 'block off'], doc: 'features.md' },
  { keywords: ['setup', 'start', 'how', 'work', 'install', 'configure', 'sign up', 'onboard', 'get started', 'demo'], doc: 'how-it-works.md' },
  { keywords: ['faq', 'question', 'confused', 'data', 'security', 'privacy', 'support', 'trade', 'plumb', 'hvac', 'electric', 'roofer', 'handyman'], doc: 'faq.md' },
  { keywords: ['contact', 'talk', 'reach', 'email', 'sales', 'enterprise'], doc: 'contact.md' },
];

/**
 * Retrieve relevant knowledge docs for the given message and current route.
 *
 * @param {string} message - The visitor's chat message
 * @param {string} currentRoute - The current page route (e.g. '/pricing')
 * @returns {Promise<string>} Concatenated markdown content (max 2 docs, joined with ---)
 */
export async function getPublicKnowledge(message, currentRoute) {
  const docs = new Set();
  const msgLower = (message || '').toLowerCase();

  // 1. Route-matched doc gets priority — fallback to overview.md for unknown routes
  const routeDoc = ROUTE_DOC_MAP[currentRoute] || 'overview.md';
  docs.add(routeDoc);

  // 2. Keyword match — add up to 1 additional doc that differs from the route doc
  for (const { keywords, doc } of KEYWORD_DOC_MAP) {
    if (keywords.some((k) => msgLower.includes(k)) && doc !== routeDoc) {
      docs.add(doc);
      break;
    }
  }

  // 3. Read matched docs, cap at 2, join with separator
  const sections = [];
  for (const docFile of Array.from(docs).slice(0, 2)) {
    try {
      const content = readFileSync(join(__dirname, docFile), 'utf-8');
      sections.push(content);
    } catch {
      // silently skip missing docs
    }
  }

  return sections.join('\n\n---\n\n');
}
