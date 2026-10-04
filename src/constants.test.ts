import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OPENROUTER_MODELS, APP_THEMES } from './constants.ts';

describe('constants and theme definitions', () => {
  it('has free Llama 3.3 70B as default first OpenRouter model', () => {
    assert.ok(OPENROUTER_MODELS.length > 0);
    assert.equal(OPENROUTER_MODELS[0].id, 'meta-llama/llama-3.3-70b-instruct:free');
    assert.equal(OPENROUTER_MODELS[0].isFree, true);
  });

  it('has Warm Sepia theme as default and preserved', () => {
    assert.ok(APP_THEMES.sepia);
    assert.equal(APP_THEMES.sepia.name, 'Warm Sepia');
    assert.equal(APP_THEMES.sepia.pageBg, 'bg-[#fbf7ee]');
    assert.equal(APP_THEMES.sepia.cardBg, 'bg-[#f5edd9]');
  });

  it('contains categorized daylight and dark themes with valid color definitions', () => {
    for (const [key, theme] of Object.entries(APP_THEMES)) {
      assert.equal(key, theme.id);
      assert.ok(theme.name, `Theme ${key} must have name`);
      assert.ok(theme.category === 'daylight' || theme.category === 'dark', `Theme ${key} must have valid category`);
      assert.ok(theme.pageBg, `Theme ${key} must have pageBg`);
      assert.ok(theme.cardBg, `Theme ${key} must have cardBg`);
      assert.ok(theme.textPrimary, `Theme ${key} must have textPrimary`);
    }
  });
});
