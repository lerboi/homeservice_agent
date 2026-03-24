/**
 * Mock for the resend package.
 * Exports a mock Resend class with a shared static _mockSend reference.
 * Tests can call Resend._mockSend.mockResolvedValueOnce() to control responses.
 */

const mockSend = jest.fn().mockResolvedValue({ id: 'email_test_123' });

export class Resend {
  constructor() {}
  emails = { send: mockSend };
  static _mockSend = mockSend;
}
