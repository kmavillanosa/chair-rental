import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMediaUrl } from './media';

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  it('normalizes backslash upload paths', () => {
    const result = resolveMediaUrl('uploads\\item.jpg');
    expect(new URL(result).pathname).toBe('/uploads/item.jpg');
  });

  it('normalizes /api/uploads paths to /uploads', () => {
    const result = resolveMediaUrl('/api/uploads/item.jpg');
    expect(new URL(result).pathname).toBe('/uploads/item.jpg');
  });

  it('remaps localhost absolute upload URLs to app/api origin', () => {
    const result = resolveMediaUrl('http://127.0.0.1:3999/uploads/item.jpg');
    const parsed = new URL(result);

    expect(parsed.pathname).toBe('/uploads/item.jpg');
    expect(parsed.port).not.toBe('3999');
  });

  it('falls back to window origin when VITE_API_URL is invalid', () => {
    vi.stubEnv('VITE_API_URL', 'http://%');

    const result = resolveMediaUrl('uploads/item.jpg');
    const parsed = new URL(result);

    expect(parsed.origin).toBe(window.location.origin);
    expect(parsed.pathname).toBe('/uploads/item.jpg');
  });

  it('returns original invalid absolute URL when URL parsing fails', () => {
    const invalidAbsolute = 'http://%';
    expect(resolveMediaUrl(invalidAbsolute)).toBe(invalidAbsolute);
  });
});
