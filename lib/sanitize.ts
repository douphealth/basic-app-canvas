import createDOMPurify from 'dompurify';

const SAFE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
    'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr',
    'th', 'td', 'div', 'span', 'section', 'article', 'aside', 'header',
    'footer', 'nav', 'sup', 'sub', 'hr', 'dl', 'dt', 'dd',
    // Preserve <style> blocks so embedded CSS (e.g. .gutf-* layout styles)
    // round-trips into WordPress instead of being unwrapped into raw text.
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
  // Belt-and-suspenders: if a disallowed tag ever slips through, drop its
  // text content too instead of dumping raw CSS/JS into the document.
  FORBID_TAGS: ['script'],
  FORBID_CONTENTS: ['script'],
  RETURN_TRUSTED_TYPE: false,
};

function sanitizeFallback(dirty: string): string {
  return dirty.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
}

function getSanitizer() {
  if (typeof window === 'undefined') return null;
  return createDOMPurify(window);
}

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  const purifier = getSanitizer();
  if (!purifier) return sanitizeFallback(dirty);
  return purifier.sanitize(dirty, SAFE_CONFIG) as string;
}

export function sanitizePlainText(dirty: string): string {
  if (!dirty) return '';
  const purifier = getSanitizer();
  if (!purifier) return dirty.replace(/<[^>]+>/g, '');
  return purifier.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [], RETURN_TRUSTED_TYPE: false }) as string;
}
