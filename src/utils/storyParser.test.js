import { describe, it, expect } from 'vitest';
import { extractAndNormalizeAiResponse } from './storyParser';

describe('storyParser: scene/scene normalization', () => {
  it('parses scene field as prose', () => {
    const result = extractAndNormalizeAiResponse({
      choices: [{ message: { content: '{"scene": "You stand in a warehouse.", "choices": ["A", "B"]}' } }]
    });
    expect(result.prose).toBe('You stand in a warehouse.');
    expect(result.paths).toHaveLength(2);
    expect(result.paths[0]).toBe('A');
  });

  it('parses uppercase Scene field', () => {
    const result = extractAndNormalizeAiResponse({
      choices: [{ message: { content: '{"Scene": "Market square.", "Choices": ["Look"]}' } }]
    });
    expect(result.prose).toBe('Market square.');
    expect(result.paths[0]).toBe('Look');
  });

  it('prevents raw JSON as prose', () => {
    const result = extractAndNormalizeAiResponse({
      choices: [{ message: { content: '{"bad": "json without prose"}' } }]
    });
    expect(result.prose).toBe('');
  });

  it('still accepts prose field', () => {
    const result = extractAndNormalizeAiResponse({
      choices: [{ message: { content: '{"prose": "Original field", "choices": ["X"]}' } }]
    });
    expect(result.prose).toBe('Original field');
  });

  it('still accepts story field', () => {
    const result = extractAndNormalizeAiResponse({
      choices: [{ message: { content: '{"story": "Legacy field", "choices": ["Y"]}' } }]
    });
    expect(result.prose).toBe('Legacy field');
  });
});