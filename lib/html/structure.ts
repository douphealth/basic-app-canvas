const WRAPPER_TAGS = new Set([
  'div',
  'section',
  'article',
  'main',
  'aside',
  'header',
  'footer',
  'nav',
]);

const NON_CONTENT_TAGS = new Set(['style', 'link', 'meta']);

export interface HtmlShellSplit {
  prefix: string;
  blocks: string[];
  suffix: string;
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const serializeOpeningTag = (element: Element) => {
  const attrs = Array.from(element.attributes)
    .map((attr) => (attr.value === ''
      ? ` ${attr.name}`
      : ` ${attr.name}="${escapeHtml(attr.value)}"`))
    .join('');

  return `<${element.tagName.toLowerCase()}${attrs}>`;
};

const serializeNode = (node: ChildNode) => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  return (node as HTMLElement).outerHTML || node.textContent || '';
};

const isMeaningfulTextNode = (node: ChildNode) =>
  node.nodeType === Node.TEXT_NODE && (node.textContent?.trim().length || 0) > 0;

const isRelevantContentNode = (node: ChildNode) => {
  if (isMeaningfulTextNode(node)) return true;
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = (node as Element).tagName.toLowerCase();
  return !NON_CONTENT_TAGS.has(tag);
};

const toBlocks = (nodes: ChildNode[]): string[] => nodes
  .map((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() || '';
      return text ? `<p>${escapeHtml(text)}</p>` : '';
    }

    return (node as HTMLElement).outerHTML || node.textContent || '';
  })
  .filter((block) => block.trim().length > 0);

export const splitHtmlPreservingShell = (html: string): HtmlShellSplit => {
  if (!html || html.trim().length === 0) {
    return { prefix: '', blocks: [], suffix: '' };
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return { prefix: '', blocks: [html], suffix: '' };
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  let prefix = Array.from(doc.head?.querySelectorAll('style') || [])
    .map((style) => style.outerHTML)
    .join('');
  let suffix = '';
  let container: ParentNode = doc.body;

  while (true) {
    const children = Array.from(container.childNodes);
    const contentNodes = children.filter(isRelevantContentNode);

    if (contentNodes.length !== 1 || contentNodes[0].nodeType !== Node.ELEMENT_NODE) {
      break;
    }

    const onlyChild = contentNodes[0] as Element;
    if (!WRAPPER_TAGS.has(onlyChild.tagName.toLowerCase())) {
      break;
    }

    const childIndex = children.indexOf(onlyChild);
    prefix += children.slice(0, childIndex).map(serializeNode).join('') + serializeOpeningTag(onlyChild);
    suffix = `</${onlyChild.tagName.toLowerCase()}>${children.slice(childIndex + 1).map(serializeNode).join('')}${suffix}`;
    container = onlyChild;
  }

  return {
    prefix,
    blocks: toBlocks(Array.from(container.childNodes)),
    suffix,
  };
};