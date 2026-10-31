// Captcha check for the public signup endpoints. Behind an interface so
// endpoint tests can use a fake instead of calling hCaptcha.

export interface CaptchaVerifier {
  /** True only if the captcha provider accepts the token. Throws if it can't be reached. */
  verify(token: string): Promise<boolean>;
}

const SITEVERIFY_URL = 'https://api.hcaptcha.com/siteverify';

export class HCaptchaVerifier implements CaptchaVerifier {
  constructor(private readonly secret: string | undefined) {}

  async verify(token: string): Promise<boolean> {
    // A missing secret is a deploy mistake, not a bad token, so it surfaces as a server error.
    if (!this.secret) throw new Error('HCAPTCHA_SECRET is not set.');

    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret: this.secret, response: token }),
    });
    if (!res.ok) throw new Error(`hCaptcha siteverify returned ${String(res.status)}.`);

    const result = await res.json<{ success?: unknown }>();
    return result.success === true;
  }
}
