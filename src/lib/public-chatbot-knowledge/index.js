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
  '/voice': 'features.md',
  '/agent': 'agent.md',
  '/demo': 'how-it-works.md',
  '/use-cases': 'features.md',
  '/integrations': 'integrations.md',
  '/pricing': 'pricing.md',
  '/about': 'overview.md',
  '/contact': 'contact.md',
};

/** Section pages share their index page's doc: /use-cases/x -> /use-cases. */
function routeDoc(route) {
  if (!route) return 'overview.md';
  if (ROUTE_DOC_MAP[route]) return ROUTE_DOC_MAP[route];
  const section = '/' + route.split('/').filter(Boolean)[0];
  return ROUTE_DOC_MAP[section] || 'overview.md';
}

/**
 * Maps keyword groups to knowledge docs.
 * Checked in order — first match wins (breaks after 1 additional doc).
 */
const KEYWORD_DOC_MAP = [
  { keywords: ['price', 'pricing', 'cost', 'plan', 'tier', 'trial', 'cancel', 'discount', 'annual', 'monthly', 'how much', 'fee', 'quote'], doc: 'pricing.md' },
  { keywords: ['voco agent', 'ai agent', 'review', 'feedback', 'seo', 'search data', 'inbox', 'telegram', 'weekly', 'report', 'summary'], doc: 'agent.md' },
  { keywords: ['integrat', 'connect', 'calendar', 'crm', 'hubspot', 'salesforce', 'pipedrive', 'zoho', 'jobber', 'servicetitan', 'housecall', 'slack', 'whatsapp', 'stripe', 'xero', 'quickbooks', 'zapier', 'make.com', 'webhook', 'api', 'calendly', 'cal.com', 'outlook', 'google'], doc: 'integrations.md' },
  { keywords: ['setup', 'set up', 'start', 'install', 'configure', 'onboard', 'get started', 'demo', 'how does it work', 'how it works', 'number', 'forward'], doc: 'how-it-works.md' },
  { keywords: ['feature', 'booking', 'book', 'appointment', 'lead', 'task', 'callback', 'order', 'lookup', 'sms', 'alert', 'language', 'recording', 'transcript', 'transfer', 'escalat', 'after hours', 'after-hours', 'voice', 'fast', 'latency'], doc: 'features.md' },
  { keywords: ['faq', 'question', 'data', 'security', 'privacy', 'secure', 'ai', 'human', 'cannot help', "can't help"], doc: 'faq.md' },
  { keywords: ['contact', 'talk', 'reach', 'email', 'sales', 'support', 'partner'], doc: 'contact.md' },
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

  // 1. Route-matched doc gets priority; unknown routes fall back to overview.md
  const primaryDoc = routeDoc(currentRoute);
  docs.add(primaryDoc);

  // 2. Keyword match — add up to 1 additional doc that differs from the route doc
  for (const { keywords, doc } of KEYWORD_DOC_MAP) {
    if (keywords.some((k) => msgLower.includes(k)) && doc !== primaryDoc) {
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
