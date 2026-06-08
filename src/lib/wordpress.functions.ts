import { createServerFn } from '@tanstack/react-start';

type WordPressFetchInput = {
  postId: number;
  postUrl?: string;
  wpUrl?: string;
  wpUser?: string;
  wpAppPassword?: string;
};

type FetchedPost = {
  content: string;
  resolvedId: number;
  source: 'wordpress-api';
};

type WordPressEntity = {
  id?: number;
  content?: { rendered?: string; raw?: string };
};

const REQUEST_TIMEOUT_MS = 15000;

const fetchWithTimeout = async (url: string, timeout: number, init: RequestInit = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
};

const getWordPressSiteBaseUrl = (input: string) => input.trim().replace(/\/$/, '').replace(/\/wp-json(?:\/wp\/v2|\/v2)?$/i, '');

const getWordPressApiBaseUrl = (input: string) => `${getWordPressSiteBaseUrl(input)}/wp-json/wp/v2`;

const normalizeContent = (entity?: WordPressEntity | null) => {
  const content = entity?.content?.raw || entity?.content?.rendered || '';
  return typeof content === 'string' ? content.trim() : '';
};

const cleanHtmlContent = (html: string) => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractMainContent = (html: string) => {
  const selectors = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*(?:class|id)=["'][^"']*(?:entry-content|post-content|article-content|td-post-content|content|single-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*(?:class|id)=["'][^"']*(?:entry-content|post-content|article-content|content)[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
  ];

  for (const selector of selectors) {
    const match = html.match(selector);
    if (match?.[1] && match[1].length > 200) {
      return cleanHtmlContent(match[1]);
    }
  }

  return cleanHtmlContent(html);
};

const getSlugFromUrl = (postUrl?: string) => {
  if (!postUrl) return null;

  try {
    const url = new URL(postUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.at(-1) || null;
  } catch {
    return null;
  }
};

const getPostIdFromUrl = (postUrl?: string) => {
  if (!postUrl) return null;

  try {
    const url = new URL(postUrl);
    const p = url.searchParams.get('p');
    if (p && /^\d+$/.test(p)) return Number(p);
    return null;
  } catch {
    return null;
  }
};

const buildApiCandidates = (wpUrl?: string, postUrl?: string) => {
  const bases = new Set<string>();

  if (wpUrl?.trim()) bases.add(getWordPressApiBaseUrl(wpUrl));

  if (postUrl?.trim()) {
    try {
      const postBase = new URL(postUrl).origin;
      bases.add(getWordPressApiBaseUrl(postBase));
    } catch {
      // ignore bad URL here; validation happens later
    }
  }

  return [...bases];
};

const buildAuthHeader = (wpUser?: string, wpAppPassword?: string) => {
  if (!wpUser?.trim() || !wpAppPassword?.trim()) return null;
  return `Basic ${Buffer.from(`${wpUser}:${wpAppPassword}`).toString('base64')}`;
};

const fetchJson = async <T>(url: string, authHeader: string | null) => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; AmzWP-Importer/1.0)',
  };

  if (authHeader) headers.Authorization = authHeader;

  let response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS, { headers });

  if ((response.status === 401 || response.status === 403) && authHeader) {
    response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; AmzWP-Importer/1.0)',
      },
    });
  }

  if (!response.ok) return null;
  return (await response.json()) as T;
};

const withEditContext = (url: string, authHeader: string | null) => {
  if (!authHeader) return url;
  const next = new URL(url);
  next.searchParams.set('context', 'edit');
  return next.toString();
};

const tryFetchFromApi = async (
  apiBase: string,
  postId: number,
  slug: string | null,
  urlPostId: number | null,
  authHeader: string | null,
): Promise<FetchedPost | null> => {
  const idsToTry = Array.from(
    new Set(
      [postId, urlPostId].filter(
        (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
      ),
    ),
  );

  for (const id of idsToTry) {
    const post = await fetchJson<WordPressEntity>(withEditContext(`${apiBase}/posts/${id}`, authHeader), authHeader);
    const postContent = normalizeContent(post);
    if (postContent.length > 50) {
      return { content: postContent, resolvedId: post?.id ?? id, source: 'wordpress-api' };
    }

    const page = await fetchJson<WordPressEntity>(withEditContext(`${apiBase}/pages/${id}`, authHeader), authHeader);
    const pageContent = normalizeContent(page);
    if (pageContent.length > 50) {
      return { content: pageContent, resolvedId: page?.id ?? id, source: 'wordpress-api' };
    }
  }

  if (!slug) return null;

  const posts = await fetchJson<WordPressEntity[]>(withEditContext(`${apiBase}/posts?slug=${encodeURIComponent(slug)}`, authHeader), authHeader);
  const matchedPost = Array.isArray(posts) ? posts.find((item) => normalizeContent(item).length > 50) : null;
  if (matchedPost) {
    return {
      content: normalizeContent(matchedPost),
      resolvedId: matchedPost.id ?? postId,
      source: 'wordpress-api',
    };
  }

  const pages = await fetchJson<WordPressEntity[]>(withEditContext(`${apiBase}/pages?slug=${encodeURIComponent(slug)}`, authHeader), authHeader);
  const matchedPage = Array.isArray(pages) ? pages.find((item) => normalizeContent(item).length > 50) : null;
  if (matchedPage) {
    return {
      content: normalizeContent(matchedPage),
      resolvedId: matchedPage.id ?? postId,
      source: 'wordpress-api',
    };
  }

  return null;
};

export const fetchWordPressPostContent = createServerFn({ method: 'POST' })
  .inputValidator((input: WordPressFetchInput) => ({
    postId: Number(input?.postId ?? 0),
    postUrl: String(input?.postUrl ?? '').trim(),
    wpUrl: String(input?.wpUrl ?? '').trim(),
    wpUser: String(input?.wpUser ?? '').trim(),
    wpAppPassword: String(input?.wpAppPassword ?? '').trim(),
  }))
  .handler(async ({ data }) => {
    const { postId, postUrl, wpUrl, wpUser, wpAppPassword } = data;
    const errors: string[] = [];
    const slug = getSlugFromUrl(postUrl);
    const urlPostId = getPostIdFromUrl(postUrl);
    const authHeader = buildAuthHeader(wpUser, wpAppPassword);
    const apiBases = buildApiCandidates(wpUrl, postUrl);

    for (const apiBase of apiBases) {
      try {
        const result = await tryFetchFromApi(apiBase, postId, slug, urlPostId, authHeader);
        if (result) return result;
      } catch (error: any) {
        errors.push(`${apiBase}: ${error?.message || 'api fetch failed'}`);
      }
    }

    const detail = errors.length > 0 ? ` (${errors.slice(0, 2).join(' | ')})` : '';
    throw new Error(`Could not load editable post content from WordPress${detail}`);
  });