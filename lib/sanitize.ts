import createDOMPurify from 'dompurify';

const SAFE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
    'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr',
    'th', 'td', 'div', 'span', 'section', 'article', 'aside', 'header',
    'footer', 'nav', 'sup', 'sub', 'hr', 'dl', 'dt', 'dd',
    // Preserve <style> blocks so embedded CSS round-trips into WordPress
    // instead of being unwrapped into raw text.
    'style', 'iframe',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id', 'style', 'target',
    'rel', 'width', 'height', 'loading', 'decoding', 'colspan', 'rowspan',
    'scope', 'type', 'media', 'allow', 'allowfullscreen', 'frameborder',
    'referrerpolicy', 'srcset', 'sizes',
  ],
  ALLOW_DATA_ATTR: true,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['script'],
  FORBID_CONTENTS: ['script'],
  RETURN_TRUSTED_TYPE: false,
};

/**
 * Remove orphan CSS that's leaked into the document body as plain text
 * (a legacy of earlier deploys that stripped <style> tags but kept their text).
 * We mask real <style>/<script>/<pre>/<code> blocks first so their contents
 * are never touched.
 */
function stripOrphanCss(html: string): string {
  if (!html) return html;
  const masks: string[] = [];
  const MASK = (s: string) => {
    masks.push(s);
    return `\u0000MASK${masks.length - 1}\u0000`;
  };

  // Mask blocks whose contents must not be altered.
  let masked = html
    .replace(/<style\b[\s\S]*?<\/style>/gi, (m) => MASK(m))
    .replace(/<script\b[\s\S]*?<\/script>/gi, (m) => MASK(m))
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, (m) => MASK(m))
    .replace(/<code\b[\s\S]*?<\/code>/gi, (m) => MASK(m));

  // 1. Strip /* … */ CSS comments that appear outside any tag.
  masked = masked.replace(/(^|>)([^<]*?)\/\*[\s\S]*?\*\/([^<]*?)(?=<|$)/g,
    (_m, pre, before, after) => `${pre}${before}${after}`);

  // 2. Strip @-rule blocks (e.g. @media, @keyframes) including nested braces.
  masked = masked.replace(/@[a-zA-Z-]+[^{<>]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');

  // 3. Strip plain CSS rules: selector { declarations }
  //    Require a CSS-looking selector (., #, or known tag) and at least one
  //    "property: value" declaration so we don't eat JSX/template text.
  masked = masked.replace(
    /(?:^|[\s>])((?:[.#]?[a-zA-Z][\w\-]*[^{<>;]*?)\{[^{}<>]*?:[^{}<>]*?\})/g,
    (m, _rule, offset, src) => {
      // Keep the leading boundary char.
      const lead = m[0] === '\n' || m[0] === ' ' || m[0] === '\t' || m[0] === '>' ? m[0] : '';
      return lead;
    },
  );

  // Unmask.
  return masked.replace(/\u0000MASK(\d+)\u0000/g, (_m, i) => masks[Number(i)] ?? '');
}

function sanitizeFallback(dirty: string): string {
  return dirty.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
}

function getSanitizer() {
  if (typeof window === 'undefined') return null;
  return createDOMPurify(window);
}

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  const cleaned = stripOrphanCss(dirty);
  const purifier = getSanitizer();
  if (!purifier) return sanitizeFallback(cleaned);
  return purifier.sanitize(cleaned, SAFE_CONFIG) as string;
}

export function sanitizePlainText(dirty: string): string {
  if (!dirty) return '';
  const purifier = getSanitizer();
  if (!purifier) return dirty.replace(/<[^>]+>/g, '');
  return purifier.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [], RETURN_TRUSTED_TYPE: false }) as string;
}
