import { parseMessageContent } from '@/lib/parse-message-content';

describe('parseMessageContent', () => {
  test('extracts a single dashboard link', () => {
    const input = 'You can manage your jobs here.\n[Go to Jobs](/dashboard/jobs)';
    const result = parseMessageContent(input);
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toEqual({ label: 'Go to Jobs', href: '/dashboard/jobs' });
    expect(result.text).toBe('You can manage your jobs here.');
  });

  test('extracts multiple dashboard links', () => {
    const input =
      'Check these pages:\n[Go to Jobs](/dashboard/jobs)\n[Go to Calendar](/dashboard/calendar)';
    const result = parseMessageContent(input);
    expect(result.links).toHaveLength(2);
    expect(result.links[0]).toEqual({ label: 'Go to Jobs', href: '/dashboard/jobs' });
    expect(result.links[1]).toEqual({ label: 'Go to Calendar', href: '/dashboard/calendar' });
  });

  test('cleans up text after link removal (trims whitespace)', () => {
    const input = 'Here is your answer.\n\n[Go to Settings](/dashboard/more/services-pricing)\n';
    const result = parseMessageContent(input);
    expect(result.text).toBe('Here is your answer.');
    expect(result.links).toHaveLength(1);
  });

  test('ignores non-dashboard links (external URLs)', () => {
    const input =
      'Visit [Google](https://google.com) for more info.\n[Go to Jobs](/dashboard/jobs)';
    const result = parseMessageContent(input);
    expect(result.links).toHaveLength(1);
    expect(result.links[0].href).toBe('/dashboard/jobs');
    expect(result.text).toContain('[Google](https://google.com)');
  });

  test('returns empty links array when no dashboard links present', () => {
    const input = 'Just a plain text answer with no links.';
    const result = parseMessageContent(input);
    expect(result.links).toHaveLength(0);
    expect(result.text).toBe('Just a plain text answer with no links.');
  });

  test('handles content with only a link and no surrounding text', () => {
    const input = '[Go to Analytics](/dashboard/more/analytics)';
    const result = parseMessageContent(input);
    expect(result.links).toHaveLength(1);
    expect(result.text).toBe('');
  });
});
