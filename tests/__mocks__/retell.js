export function createMockRetellPayload(event, overrides = {}) {
  const base = {
    event,
    call: {
      call_id: 'call_test_123',
      from_number: '+6591234567',
      to_number: '+6598765432',
      direction: 'inbound',
      start_timestamp: Date.now() - 120000,
      end_timestamp: Date.now(),
      recording_url: 'https://retell-recording.example.com/test.wav',
      transcript: 'Hello, I need help with my plumbing.',
      transcript_object: [
        { role: 'agent', content: 'Hello, thank you for calling. How can I help you today?', words: [] },
        { role: 'user', content: 'I need help with my plumbing.', words: [] },
      ],
      call_analysis: { call_summary: 'Caller needs plumbing help.' },
      metadata: {},
      ...overrides,
    },
  };
  if (event === 'call_inbound') {
    return { event, from_number: base.call.from_number, to_number: base.call.to_number, ...overrides };
  }
  return base;
}
