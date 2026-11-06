import type { Page } from "playwright";

/** Let the employer's own invisible verification run. Never interact with a
 * checkbox/challenge, remove a widget, or obtain/inject verification tokens.
 * https://developers.google.com/recaptcha/docs/invisible
 * https://docs.hcaptcha.com/invisible */
export async function inspectCaptchaState(page: Page): Promise<{ present: boolean; blocking: boolean }> {
  const widgets = await page.locator('[data-sitekey],.g-recaptcha,.h-captcha,#cf-challenge-running').evaluateAll(elements => elements.map(element => ({
    invisible: element.getAttribute('data-size') === 'invisible' ||
      (element.matches('button,input') && element.hasAttribute('data-callback') && element.matches('.g-recaptcha,.h-captcha')),
  })));
  let present = widgets.length > 0 || await page.locator('script[src*="recaptcha"],script[src*="hcaptcha"]').count() > 0;
  if (widgets.some(widget => !widget.invisible)) return { present: true, blocking: true };
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const known = /recaptcha|hcaptcha|captcha-delivery|challenges\.cloudflare/i.test(frame.url());
    if (known) present = true;
    if (/captcha-delivery/i.test(frame.url())) return { present, blocking: true };
    try {
      const element = await frame.frameElement();
      const state = await element.evaluate(element => {
        if (!(element instanceof Element)) return { visible: false, badge: false, title: '' };
        const rect = element.getBoundingClientRect();
        let visible = rect.width > 0 && rect.height > 0;
        for (let node: Element | null = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) visible = false;
        }
        return { visible, badge: Boolean(element.closest('.grecaptcha-badge')), title: element.getAttribute('title') ?? '' };
      });
      await element.dispose();
      if (!known && !/challenge/i.test(state.title)) continue;
      present = true;
      if (!state.visible) continue;
      const url = new URL(frame.url());
      const challenge = /\/bframe(?:[/?]|$)|[?&]role=challenge/i.test(frame.url()) || /challenge/i.test(state.title);
      if (challenge || (!state.badge && url.searchParams.get('size') !== 'invisible')) return { present, blocking: true };
    } catch {
      // Frames can detach while the provider completes its own background check.
      // A new visible challenge is checked again immediately before submission.
    }
  }
  return { present, blocking: false };
}
