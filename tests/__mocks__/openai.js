/**
 * Mock for the openai package.
 * Uses jest.unstable_mockModule pattern — shared mutable mock for configurable responses.
 * Tests can override mockChatCompletionsCreate.mockResolvedValueOnce to control behavior.
 */

export const mockChatCompletionsCreate = jest.fn();

const MockOpenAI = jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: mockChatCompletionsCreate,
    },
  },
}));

export default MockOpenAI;
