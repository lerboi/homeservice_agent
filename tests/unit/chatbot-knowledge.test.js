/**
 * Unit tests for getRelevantKnowledge RAG retrieval function.
 * Tests route-matching, keyword-matching, fallback behavior, and doc count cap.
 */

import { getRelevantKnowledge } from '@/lib/chatbot-knowledge/index.js';

describe('getRelevantKnowledge', () => {
  // Test 1: Route match — specific dashboard page
  it('returns route-matched doc when currentRoute matches ROUTE_DOC_MAP', async () => {
    const result = await getRelevantKnowledge('how do I filter leads?', '/dashboard/leads');
    expect(result).toContain('# Leads');
  });

  // Test 2: Keyword match overrides route when keyword is for different doc
  it('returns keyword-matched doc when message contains a mapped keyword', async () => {
    const result = await getRelevantKnowledge('how do invoices work?', '/dashboard');
    expect(result).toContain('# Invoices');
  });

  // Test 3: Fallback to getting-started.md when no keyword match on /dashboard
  it('returns getting-started.md as fallback when no keyword match and route is /dashboard', async () => {
    const result = await getRelevantKnowledge('hello', '/dashboard');
    expect(result).toContain('# Getting Started');
  });

  // Test 4: Returns both route doc AND keyword-matched doc
  it('returns both route-matched doc and keyword-matched doc when both apply', async () => {
    const result = await getRelevantKnowledge('tell me about billing', '/dashboard/leads');
    expect(result).toContain('# Leads');
    expect(result).toContain('# Billing');
  });

  // Test 5: Never returns more than 2 doc sections
  it('returns at most 2 doc sections', async () => {
    // Message has multiple keyword matches across many docs
    const result = await getRelevantKnowledge(
      'tell me about leads invoices calendar billing analytics',
      '/dashboard/leads'
    );
    // Count doc section separators (each doc beyond first is separated by ---)
    const separatorCount = (result.match(/\n\n---\n\n/g) || []).length;
    // At most 1 separator = at most 2 docs
    expect(separatorCount).toBeLessThanOrEqual(1);
  });

  // Test 6: Fallback to getting-started.md for unknown/nonexistent route
  it('returns getting-started.md as fallback for unknown route with no keyword match', async () => {
    const result = await getRelevantKnowledge('xyz gibberish', '/dashboard/nonexistent');
    expect(result).toContain('# Getting Started');
  });
});
