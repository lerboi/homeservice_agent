/**
 * Chatbot knowledge base RAG retrieval.
 * Server-only module — never import from client components.
 *
 * Matches relevant knowledge docs to the user's message using two signals:
 * 1. Current dashboard route → priority doc for the page the user is on
 * 2. Keyword matching → up to 1 additional doc from message content
 *
 * Returns at most 2 doc sections joined with --- separator.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Maps dashboard routes to their primary knowledge doc.
 * Order matters — more specific routes first.
 */
const ROUTE_DOC_MAP = {
  '/dashboard/leads': 'leads.md',
  '/dashboard/calendar': 'calendar.md',
  '/dashboard/calls': 'calls.md',
  '/dashboard/invoices': 'invoices.md',
  '/dashboard/estimates': 'estimates.md',
  '/dashboard/more/analytics': 'analytics.md',
  '/dashboard/more/billing': 'billing.md',
  '/dashboard/more/services-pricing': 'settings.md',
  '/dashboard/more/working-hours': 'settings.md',
  '/dashboard/more/service-zones': 'settings.md',
  '/dashboard/more/notifications': 'settings.md',
  '/dashboard/more/ai-voice-settings': 'settings.md',
  '/dashboard/more/call-routing': 'call-routing.md',
  '/dashboard/more/integrations': 'integrations.md',
  '/dashboard/more/invoice-settings': 'settings.md',
  '/dashboard': 'getting-started.md',
};

/**
 * Maps keyword groups to knowledge docs.
 * Each entry covers one dashboard area.
 * Checked in order — first match wins (breaks after 1 additional doc).
 */
const KEYWORD_DOC_MAP = [
  { keywords: ['lead', 'leads', 'crm', 'customer', 'caller', 'pipeline'], doc: 'leads.md' },
  { keywords: ['routing', 'route', 'forward', 'pickup', 'priority', 'vip', 'sms forward', 'forwarding'], doc: 'call-routing.md' },
  { keywords: ['calendar', 'appointment', 'booking', 'schedule', 'slot', 'time block', 'vacation', 'lunch'], doc: 'calendar.md' },
  { keywords: ['call', 'calls', 'transcript', 'recording', 'voicemail'], doc: 'calls.md' },
  // billing before invoices so 'billing' matches here, not the 'bill' keyword in invoices
  { keywords: ['billing', 'subscription', 'plan', 'upgrade', 'usage', 'trial'], doc: 'billing.md' },
  { keywords: ['invoice', 'invoices', 'payment', 'bill', 'pdf', 'send invoice'], doc: 'invoices.md' },
  { keywords: ['estimate', 'estimates', 'quote'], doc: 'estimates.md' },
  { keywords: ['analytics', 'revenue', 'chart', 'stats', 'report'], doc: 'analytics.md' },
  { keywords: ['setting', 'settings', 'service', 'working hours', 'zone', 'notification', 'ai voice'], doc: 'settings.md' },
  { keywords: ['integration', 'quickbooks', 'xero', 'connect', 'sync'], doc: 'integrations.md' },
];

/**
 * Retrieve relevant knowledge docs for the given message and current route.
 *
 * @param {string} message - The user's chat message
 * @param {string} currentRoute - The current dashboard route (e.g. '/dashboard/leads')
 * @returns {Promise<string>} Concatenated markdown content (max 2 docs, joined with ---)
 */
export async function getRelevantKnowledge(message, currentRoute) {
  const docs = new Set();
  const msgLower = (message || '').toLowerCase();

  // 1. Route-matched doc gets priority — fallback to getting-started.md for unknown routes
  const routeDoc = ROUTE_DOC_MAP[currentRoute] || 'getting-started.md';
  docs.add(routeDoc);

  // 2. Keyword match — add up to 1 additional doc that differs from the route doc
  for (const { keywords, doc } of KEYWORD_DOC_MAP) {
    if (keywords.some((k) => msgLower.includes(k)) && doc !== routeDoc) {
      docs.add(doc);
      break; // max 1 additional doc
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
