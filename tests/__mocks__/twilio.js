/**
 * Mock for the twilio package.
 * Uses jest factory pattern — exports a mock constructor with a shared mockCreate reference.
 * Tests can call mockTwilio._mockCreate.mockResolvedValueOnce() to control responses.
 */

const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM_test_123' });

const mockTwilio = jest.fn(() => ({
  messages: { create: mockCreate },
}));

mockTwilio._mockCreate = mockCreate;

export default mockTwilio;
