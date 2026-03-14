import { describe, expect, it } from 'vitest';
import { resolveMediaUrl } from './media';

describe('resolveMediaUrl', () => {
  it('returns empty string for empty values', () => {
    expect(resolveMediaUrl()).toBe('');
    expect(resolveMediaUrl('   ')).toBe('');
  });

  it('keeps absolute URLs unchanged', () => {
    const absolute = 'https://cdn.example.com/image.png';
    expect(resolveMediaUrl(absolute)).toBe(absolute);
  });

  it('keeps data/blob URLs unchanged', () => {
    const dataUrl = 'data:image/png;base64,ABC123';
    const blobUrl = 'blob:http://localhost:3000/abc';
    expect(resolveMediaUrl(dataUrl)).toBe(dataUrl);
    expect(resolveMediaUrl(blobUrl)).toBe(blobUrl);
  });

  it('resolves relative URLs against app origin', () => {
    const result = resolveMediaUrl('uploads/item.jpg');
    expect(new URL(result).pathname).toBe('/uploads/item.jpg');
    expect(result.startsWith('http://')).toBe(true);
  });
});
