import { describe, expect, it } from 'vitest';
import { generateUuid } from './uuid.util';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateUuid', () => {
  it('returns a valid UUID v4 string', () => {
    const value = generateUuid();
    expect(value).toMatch(UUID_V4_PATTERN);
  });

  it('returns unique values for sequential calls', () => {
    const first = generateUuid();
    const second = generateUuid();
    expect(first).not.toBe(second);
  });
});
