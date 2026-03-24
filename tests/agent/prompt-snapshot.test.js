import { describe, test, expect } from '@jest/globals';
import { buildSystemPrompt } from '../../../Retell-ws-server/agent-prompt.js';

describe('prompt snapshot baseline', () => {
  test('onboarding_complete=false prompt snapshot', () => {
    const prompt = buildSystemPrompt('en', {
      business_name: 'TestBiz',
      onboarding_complete: false,
      tone_preset: 'professional',
    });
    expect(prompt).toMatchSnapshot();
  });

  test('onboarding_complete=true prompt snapshot', () => {
    const prompt = buildSystemPrompt('en', {
      business_name: 'TestBiz',
      onboarding_complete: true,
      tone_preset: 'professional',
    });
    expect(prompt).toMatchSnapshot();
  });

  test('Spanish locale prompt snapshot', () => {
    const prompt = buildSystemPrompt('es', {
      business_name: 'TestBiz',
      onboarding_complete: true,
      tone_preset: 'professional',
    });
    expect(prompt).toMatchSnapshot();
  });

  test('friendly tone prompt snapshot', () => {
    const prompt = buildSystemPrompt('en', {
      business_name: 'TestBiz',
      onboarding_complete: true,
      tone_preset: 'friendly',
    });
    expect(prompt).toMatchSnapshot();
  });
});
