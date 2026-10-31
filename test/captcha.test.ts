import { describe, it, expect, vi, afterEach } from 'vitest';
import { HCaptchaVerifier } from '@/captcha.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

function stubSiteverify(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status }));
}

describe('HCaptchaVerifier', () => {
  it('posts the secret and token form-encoded to siteverify', async () => {
    // given
    const fetchSpy = stubSiteverify({ success: true });
    // when
    await new HCaptchaVerifier('the-secret').verify('the-token');
    // then
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.hcaptcha.com/siteverify');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    expect((init?.body as URLSearchParams).toString()).toBe('secret=the-secret&response=the-token');
  });

  it('passes only when success is exactly true', async () => {
    for (const [body, expected] of [
      [{ success: true }, true],
      [{ success: false }, false],
      [{ success: 'true' }, false],
      [{}, false],
    ] as const) {
      stubSiteverify(body);
      expect(await new HCaptchaVerifier('s').verify('t')).toBe(expected);
    }
  });

  it('throws when the secret is missing, without calling hCaptcha', async () => {
    const fetchSpy = stubSiteverify({ success: true });
    await expect(new HCaptchaVerifier(undefined).verify('t')).rejects.toThrow('HCAPTCHA_SECRET');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws when siteverify returns an error status', async () => {
    stubSiteverify({}, 503);
    await expect(new HCaptchaVerifier('s').verify('t')).rejects.toThrow('503');
  });
});
