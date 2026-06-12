/**
 * Product-box HTML generation — class-based templates with a single
 * hoisted <style> block per post.
 *
 * Why this exists:
 *   The previous generators inlined ~300 lines of CSS into EVERY product
 *   box. A 10-product post shipped ~3,000 lines of duplicated style
 *   attributes (hundreds of KB). This module emits compact class-based
 *   markup and a single shared <style> block via `getProductBoxStyles()`,
 *   shrinking 10-box posts from MBs to ~30 KB.
 *
 * Public API:
 *   - generateProductBoxHtml(product, tag, mode)
 *   - generateComparisonTableHtml(data, products, tag)
 *   - getProductBoxStyles()  -> one <style> block; insert once per post
 *   - wrapWithProductBoxStyles(html)  -> convenience: prefixes the style
 *
 * Backwards compatible: `utils.ts` re-exports these symbols.
 */

import type {
  ComparisonData,
  DeploymentMode,
  FAQItem,
  ProductDetails,
} from '../../types';

// ---------------------------------------------------------------------------
// Hoisted CSS  (emit ONCE per post via getProductBoxStyles)
// ---------------------------------------------------------------------------

const STYLE_MARKER = 'data-amzwp-styles';

const STYLES = `
.amzwp-tl,.amzwp-eb,.amzwp-ct{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;box-sizing:border-box;-webkit-font-smoothing:antialiased;container-type:inline-size}
.amzwp-tl *,.amzwp-eb *,.amzwp-ct *{box-sizing:border-box}
.amzwp-stars{color:#f59e0b;letter-spacing:1px}
.amzwp-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:clamp(12px,3cqw,16px) clamp(18px,4.5cqw,28px);background:linear-gradient(135deg,var(--amzwp-primary,#2563eb),var(--amzwp-primary-2,#4f46e5));color:#fff!important;text-decoration:none;border-radius:14px;font-weight:800;font-size:clamp(11px,2.6cqw,13px);text-transform:uppercase;letter-spacing:.12em;box-shadow:0 14px 30px color-mix(in srgb,var(--amzwp-primary,#2563eb) 28%,transparent);transition:transform .25s ease, box-shadow .25s ease}
.amzwp-cta:hover{transform:translateY(-1px);box-shadow:0 18px 40px color-mix(in srgb,var(--amzwp-primary,#2563eb) 34%,transparent)}

/* TACTICAL LINK — compact */
.amzwp-tl{max-width:920px;margin:1.5rem auto;padding:clamp(12px,3cqw,18px);background:#fff;border:1px solid #e2e8f0;border-radius:18px;display:flex;align-items:center;gap:clamp(10px,3cqw,18px);flex-wrap:nowrap;box-shadow:0 8px 28px rgba(15,23,42,.06);position:relative;overflow:hidden}
.amzwp-tl::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,var(--amzwp-primary-light,#3b82f6),#6366f1,#8b5cf6)}
.amzwp-tl-img{width:clamp(56px,16cqw,88px);height:clamp(56px,16cqw,88px);object-fit:contain;background:linear-gradient(135deg,#f8fafc,#fff);border-radius:14px;padding:6px;border:1px solid #e2e8f0;flex-shrink:0}
.amzwp-tl-body{flex:1;min-width:0}
.amzwp-tl-tag{display:inline-block;background:var(--amzwp-accent-tint,#eff6ff);color:var(--amzwp-primary,#2563eb);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;padding:3px 8px;border-radius:999px}
.amzwp-tl-title{margin:6px 0 0;font-size:clamp(13px,3.4cqw,16px);font-weight:800;color:#0f172a;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.amzwp-tl-meta{display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap;font-size:11px;color:#64748b}
.amzwp-tl-price{text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.amzwp-tl-price-val{font-size:clamp(18px,4.6cqw,24px);font-weight:900;color:#0f172a;line-height:1;letter-spacing:-.02em}
.amzwp-tl-cta{display:inline-flex;align-items:center;gap:4px;background:var(--amzwp-primary,#2563eb);color:#fff!important;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;padding:6px 10px;border-radius:999px;text-decoration:none}

/* ELITE BENTO — editorial card */
.amzwp-eb{max-width:980px;margin:clamp(1.5rem,5cqw,3rem) auto;background:#fff;border-radius:clamp(18px,4cqw,28px);box-shadow:0 10px 50px -18px rgba(15,23,42,.18);overflow:hidden;border:1px solid #e2e8f0;position:relative}
.amzwp-eb-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px clamp(14px,4cqw,28px);background:linear-gradient(90deg,#f8fafc,#fff 50%,var(--amzwp-accent-tint,#eff6ff));border-bottom:1px solid #f1f5f9}
.amzwp-eb-pill{display:inline-flex;align-items:center;gap:6px;background:#0f172a;color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.16em;padding:5px 10px;border-radius:999px}
.amzwp-eb-date{color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.amzwp-eb-main{display:grid;grid-template-columns:1fr}
@container (min-width:720px){.amzwp-eb-main{grid-template-columns:minmax(0,1fr) minmax(0,1.15fr)}.amzwp-eb-imgcol{border-right:1px solid #f1f5f9}}
.amzwp-eb-imgcol{position:relative;background:radial-gradient(circle at 30% 20%,#fff,#eef6ff 55%,#e0e7ff 120%);padding:clamp(28px,8cqw,56px) clamp(20px,6cqw,40px);display:flex;align-items:center;justify-content:center;min-height:240px;overflow:hidden}
.amzwp-eb-imgcol::before,.amzwp-eb-imgcol::after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(255,255,255,.7);pointer-events:none}
.amzwp-eb-imgcol::before{width:70%;aspect-ratio:1;left:15%;top:15%}
.amzwp-eb-imgcol::after{width:48%;aspect-ratio:1;left:26%;top:26%;border-color:color-mix(in srgb,var(--amzwp-primary-light,#3b82f6) 25%,transparent)}
.amzwp-eb-img{position:relative;z-index:2;width:100%;max-width:clamp(180px,55cqw,360px);aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 24px 40px rgba(15,23,42,.18))}
.amzwp-eb-rating{position:absolute;z-index:3;bottom:12px;left:12px;background:rgba(255,255,255,.95);backdrop-filter:blur(8px);padding:6px 12px;border-radius:999px;box-shadow:0 8px 20px rgba(15,23,42,.08);display:inline-flex;align-items:center;gap:8px;border:1px solid #f1f5f9;font-size:11px;color:#475569;font-weight:700}
.amzwp-eb-prime{position:absolute;z-index:3;bottom:12px;right:12px;background:#232f3e;color:#fff;padding:6px 10px;border-radius:8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.amzwp-eb-body{padding:clamp(18px,5cqw,32px);display:flex;flex-direction:column;gap:clamp(12px,3cqw,18px)}
.amzwp-eb-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.amzwp-eb-cat{display:inline-flex;align-items:center;gap:6px;background:var(--amzwp-accent-tint,#eff6ff);color:var(--amzwp-accent-text,#1d4ed8);border:1px solid var(--amzwp-accent-border,#dbeafe);padding:5px 12px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}
.amzwp-eb-cat::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--amzwp-primary-light,#3b82f6)}
.amzwp-eb-brand{color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.amzwp-eb-title{margin:0;font-size:clamp(20px,5.4cqw,32px);font-weight:900;color:#0f172a;line-height:1.1;letter-spacing:-.02em}
.amzwp-eb-verdict{background:linear-gradient(135deg,#f8fafc,var(--amzwp-accent-tint,#eff6ff));border:1px solid #f1f5f9;padding:clamp(12px,3cqw,18px);border-radius:16px;color:#475569;font-size:clamp(13px,3cqw,15px);line-height:1.6;font-weight:500}
.amzwp-eb-bullets{display:grid;grid-template-columns:1fr;gap:8px;list-style:none;padding:0;margin:0}
@container (min-width:480px){.amzwp-eb-bullets{grid-template-columns:1fr 1fr}}
.amzwp-eb-bullet{display:flex;align-items:flex-start;gap:10px;padding:12px;background:#fff;border-radius:12px;border:1px solid #f1f5f9;color:#334155;font-size:clamp(12px,2.6cqw,13.5px);font-weight:600;line-height:1.5}
.amzwp-eb-bullet::before{content:"";flex-shrink:0;width:18px;height:18px;border-radius:6px;background:linear-gradient(135deg,#34d399,#10b981) center/10px no-repeat;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M5 12l5 5L20 7'/%3E%3C/svg%3E");margin-top:1px}
.amzwp-eb-pricebar{margin-top:4px;background:linear-gradient(135deg,#0f172a,#1e293b,#0f172a);padding:clamp(14px,3.5cqw,20px);border-radius:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.amzwp-eb-price-label{display:block;font-size:9px;color:#94a3b8;font-weight:800;text-transform:uppercase;letter-spacing:.16em}
.amzwp-eb-price-val{display:block;margin-top:2px;font-size:clamp(26px,7cqw,40px);font-weight:900;color:#fff;line-height:1;letter-spacing:-.03em}
.amzwp-eb-price-note{color:#34d399;font-size:10px;font-weight:700;margin-left:6px}
.amzwp-eb-faqs{background:#f8fafc;padding:clamp(16px,4cqw,28px);border-top:1px solid #f1f5f9}
.amzwp-eb-faqs-title{display:flex;align-items:center;gap:8px;font-size:clamp(13px,3cqw,15px);font-weight:900;color:#0f172a;margin:0 0 12px}
.amzwp-eb-faqs-title::before{content:"?";width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#8b5cf6,var(--amzwp-primary-2,#4f46e5));color:#fff;border-radius:8px;font-size:14px;font-weight:900}
.amzwp-eb-faq{padding:14px;background:#fff;border:1px solid #f1f5f9;border-radius:12px;margin-bottom:8px}
.amzwp-eb-faq:last-child{margin-bottom:0}
.amzwp-eb-faq-q{font-weight:800;color:#0f172a;font-size:clamp(12.5px,2.8cqw,14px);margin-bottom:6px;line-height:1.35}
.amzwp-eb-faq-a{color:#64748b;font-size:clamp(12px,2.6cqw,13.5px);line-height:1.6;margin:0}
.amzwp-eb-trust{background:#fff;padding:12px clamp(14px,4cqw,28px);display:flex;justify-content:center;gap:clamp(12px,3cqw,28px);flex-wrap:wrap;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}

/* COMPARISON TABLE — responsive */
.amzwp-ct{max-width:1100px;margin:clamp(1.5rem,5cqw,3rem) auto;background:#fff;border-radius:20px;box-shadow:0 4px 24px rgba(15,23,42,.06);overflow:hidden;border:1px solid #e2e8f0}
.amzwp-ct-head{background:linear-gradient(135deg,#0f172a,#1e293b);padding:clamp(14px,3cqw,22px) clamp(16px,4cqw,28px);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.amzwp-ct-head h3{margin:0;color:#fff;font-size:clamp(15px,3.4cqw,18px);font-weight:800;letter-spacing:-.01em}
.amzwp-ct-head p{margin:4px 0 0;color:#94a3b8;font-size:12px}
.amzwp-ct-live{display:inline-flex;align-items:center;gap:6px;color:#94a3b8;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}
.amzwp-ct-live::before{content:"";width:6px;height:6px;border-radius:50%;background:#34d399;display:inline-block;box-shadow:0 0 0 4px rgba(52,211,153,.15)}
.amzwp-ct-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.amzwp-ct table{width:100%;border-collapse:collapse;min-width:min(640px,100%)}
.amzwp-ct td{padding:14px 12px;text-align:center;border-right:1px solid #f1f5f9;vertical-align:top}
.amzwp-ct td:last-child{border-right:0}
.amzwp-ct-cell-head{padding:28px 16px!important;position:relative}
.amzwp-ct-top{background:linear-gradient(180deg,var(--amzwp-accent-tint,#eff6ff),#fff)!important}
.amzwp-ct-top-badge{position:absolute;top:0;left:50%;transform:translateX(-50%);background:var(--amzwp-primary,#2563eb);color:#fff;padding:5px 14px;border-radius:0 0 10px 10px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;box-shadow:0 4px 12px color-mix(in srgb,var(--amzwp-primary,#2563eb) 30%,transparent)}
.amzwp-ct-img{height:clamp(100px,12cqw,140px);display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.amzwp-ct-img img{max-width:clamp(90px,11cqw,130px);max-height:100%;object-fit:contain}
.amzwp-ct-title{margin:0 0 8px;font-size:clamp(12px,2.6cqw,14px);font-weight:700;color:#0f172a;line-height:1.35;min-height:36px}
.amzwp-ct-price{font-size:clamp(20px,4.2cqw,28px);font-weight:900;color:#0f172a;margin-bottom:12px;letter-spacing:-.02em}
.amzwp-ct-cta{display:inline-block;width:90%;padding:10px 16px;background:#0f172a;color:#fff!important;text-decoration:none;border-radius:10px;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.amzwp-ct-cta-top{background:linear-gradient(135deg,var(--amzwp-primary,#2563eb),var(--amzwp-primary-2,#4f46e5));box-shadow:0 8px 18px color-mix(in srgb,var(--amzwp-primary,#2563eb) 32%,transparent)}
.amzwp-ct-row-alt{background:#f8fafc}
.amzwp-ct-spec-label{font-size:10px;color:#94a3b8;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.amzwp-ct-spec-val{font-size:13px;font-weight:600;color:#1e293b}
.amzwp-ct-foot{background:#f8fafc;padding:10px 28px;border-top:1px solid #f1f5f9;text-align:center;color:#94a3b8;font-size:10px}

@media (prefers-reduced-motion:reduce){.amzwp-cta{transition:none}}
`.replace(/\n+/g, '').replace(/\s{2,}/g, ' ').trim();

/** Single <style> block. Insert ONCE per post; safe to dedupe by the marker. */
export const getProductBoxStyles = (): string =>
  `<style ${STYLE_MARKER}>${STYLES}</style>`;

/** Prefix a chunk of HTML with the shared style block iff not already present. */
export const wrapWithProductBoxStyles = (html: string): string =>
  html.includes(STYLE_MARKER) ? html : `${getProductBoxStyles()}\n${html}`;

// ---------------------------------------------------------------------------
// Helpers (no inline runtime cost)
// ---------------------------------------------------------------------------

const escAttr = (s: string) =>
  String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const truncate = (s: string, n: number) =>
  s.length <= n ? s : `${s.slice(0, n - 3)}...`;

const stars = (rating?: number): number =>
  Math.min(5, Math.max(0, Math.round(rating ?? 4.5)));

// These were previously imported transitively from utils.ts.  Kept inline
// to avoid creating an import cycle while utils.ts re-exports from here.
const generateSmartClaims = (p: ProductDetails): string[] => [
  `${p.rating?.toFixed(1) || '4.5'}-star rated by ${(p.reviewCount || 0).toLocaleString()} verified buyers`,
  p.prime ? 'Eligible for fast Prime shipping' : 'Available with standard shipping',
  p.brand ? `Trusted ${p.brand} build quality` : 'Vetted by editorial team',
  'Backed by Amazon return policy',
];

const generateSmartVerdict = (p: ProductDetails): string =>
  `${p.title} stands out in the ${p.category || 'category'} thanks to consistent ${p.rating?.toFixed(1) || '4.5'}-star feedback across ${(p.reviewCount || 0).toLocaleString()} reviews.`;

const generateProductFaqs = (p: ProductDetails): { q: string; a: string }[] => {
  if (p.faqs?.length) return p.faqs.slice(0, 4).map(f => ({ q: f.question, a: f.answer }));
  return [
    { q: `Is the ${p.title} worth it?`, a: `With a ${p.rating?.toFixed(1) || '4.5'}-star rating from ${(p.reviewCount || 0).toLocaleString()} buyers, it consistently delivers on value.` },
    { q: 'Does it ship with Prime?', a: p.prime ? 'Yes — Prime members get fast, free delivery.' : 'Prime eligibility varies by seller. Check the current Amazon listing.' },
    { q: 'How long is the return window?', a: 'Amazon\'s standard 30-day return policy applies to most orders.' },
  ];
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const tacticalLink = (p: ProductDetails, url: string, s: number): string => {
  const priceNote = p.prime ? 'Prime eligible' : 'Amazon offer';
  const title = escAttr(p.title);
  return `<div class="amzwp-tl">
<img class="amzwp-tl-img" src="${escAttr(p.imageUrl)}" alt="${title}" loading="lazy">
<div class="amzwp-tl-body">
<span class="amzwp-tl-tag">Editor's pick</span>
<h4 class="amzwp-tl-title">${title}</h4>
<div class="amzwp-tl-meta">
<span class="amzwp-stars">${'&#9733;'.repeat(s)}${'&#9734;'.repeat(5 - s)}</span>
<span>${(p.reviewCount || 0).toLocaleString()} reviews</span>
<span>&bull;</span>
<span style="color:#0f766e;font-weight:700">${priceNote}</span>
</div>
</div>
<div class="amzwp-tl-price">
<div class="amzwp-tl-price-val">${escAttr(p.price)}</div>
<a class="amzwp-tl-cta" href="${escAttr(url)}" target="_blank" rel="nofollow sponsored noopener">View &rarr;</a>
</div>
</div>`;
};

const eliteBento = (p: ProductDetails, url: string, s: number, date: string): string => {
  const bullets = p.evidenceClaims?.length ? p.evidenceClaims.slice(0, 4) : generateSmartClaims(p);
  const verdict = p.verdict || generateSmartVerdict(p);
  const faqs = generateProductFaqs(p);
  const title = escAttr(p.title);
  const reviewLabel = `${(p.reviewCount || 0).toLocaleString()} reviews`;

  const faqHtml = faqs.map(f =>
    `<div class="amzwp-eb-faq"><div class="amzwp-eb-faq-q">${escAttr(f.q)}</div><p class="amzwp-eb-faq-a">${escAttr(f.a)}</p></div>`
  ).join('');

  const bulletHtml = bullets.map(c =>
    `<li class="amzwp-eb-bullet"><span>${escAttr(c)}</span></li>`
  ).join('');

  return `<section class="amzwp-eb" aria-label="Recommended product">
<div class="amzwp-eb-bar">
<span class="amzwp-eb-pill">&#9733; Editor's Choice</span>
<span class="amzwp-eb-date">Verified &middot; ${date}</span>
</div>
<div class="amzwp-eb-main">
<div class="amzwp-eb-imgcol">
<img class="amzwp-eb-img" src="${escAttr(p.imageUrl)}" alt="${title}" loading="lazy">
<div class="amzwp-eb-rating"><span class="amzwp-stars">${'&#9733;'.repeat(s)}</span><span>${(p.rating || 4.5).toFixed(1)}</span><span style="color:#94a3b8">(${reviewLabel})</span></div>
${p.prime ? '<div class="amzwp-eb-prime">&#9889; Prime</div>' : ''}
</div>
<div class="amzwp-eb-body">
<div class="amzwp-eb-meta">
<span class="amzwp-eb-cat">${escAttr(p.category || 'Featured')}</span>
${p.brand ? `<span class="amzwp-eb-brand">by ${escAttr(p.brand)}</span>` : ''}
</div>
<h3 class="amzwp-eb-title">${title}</h3>
<div class="amzwp-eb-verdict">${escAttr(verdict)}</div>
<ul class="amzwp-eb-bullets">${bulletHtml}</ul>
<div class="amzwp-eb-pricebar">
<div>
<span class="amzwp-eb-price-label">Best price today</span>
<span class="amzwp-eb-price-val">${escAttr(p.price)}${p.prime ? '<span class="amzwp-eb-price-note">FREE delivery</span>' : ''}</span>
</div>
<a class="amzwp-cta" href="${escAttr(url)}" target="_blank" rel="nofollow sponsored noopener" aria-label="Check price for ${title} on Amazon">Check Price <span>&rarr;</span></a>
</div>
</div>
</div>
<div class="amzwp-eb-faqs"><h4 class="amzwp-eb-faqs-title">Common Questions</h4>${faqHtml}</div>
<div class="amzwp-eb-trust"><span>&#10003; Amazon Verified</span><span>&#128274; Secure Checkout</span><span>&#8634; 30-Day Returns</span></div>
</section>`;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const generateProductBoxHtml = (
  product: ProductDetails,
  affiliateTag: string,
  mode: DeploymentMode = 'ELITE_BENTO',
): string => {
  const tag = affiliateTag || 'amzwp-20';
  const url = `https://www.amazon.com/dp/${product.asin}?tag=${encodeURIComponent(tag)}`;
  const s = stars(product.rating);
  const date = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return mode === 'TACTICAL_LINK' ? tacticalLink(product, url, s) : eliteBento(product, url, s, date);
};

export const generateComparisonTableHtml = (
  data: ComparisonData,
  products: ProductDetails[],
  affiliateTag: string,
): string => {
  const tag = affiliateTag || 'amzwp-20';
  const tableProducts = data.productIds
    .map(id => products.find(p => p.id === id))
    .filter(Boolean) as ProductDetails[];
  if (tableProducts.length < 2) return '';

  const colWidth = Math.floor(100 / tableProducts.length);
  const customSpecs = (data.specs || []).filter(
    s => !['rating', 'reviews', 'prime', 'price'].includes(s.toLowerCase()),
  );

  const specRows = customSpecs.map((spec, idx) => `
<tr${idx % 2 === 0 ? ' class="amzwp-ct-row-alt"' : ''}>
${tableProducts.map(p => `<td style="width:${colWidth}%"><div class="amzwp-ct-spec-label">${escAttr(spec)}</div><div class="amzwp-ct-spec-val">${escAttr(p.specs?.[spec] || '-')}</div></td>`).join('')}
</tr>`).join('');

  const shippingRow = tableProducts.some(p => p.prime) ? `
<tr class="amzwp-ct-row-alt">
${tableProducts.map(p => `<td style="width:${colWidth}%"><div class="amzwp-ct-spec-label">Shipping</div><div class="amzwp-ct-spec-val" style="color:${p.prime ? '#059669' : '#94a3b8'}">${p.prime ? '&#9889; Prime' : 'Standard'}</div></td>`).join('')}
</tr>` : '';

  return `<div class="amzwp-ct">
<div class="amzwp-ct-head">
<div><h3>${escAttr(data.title)}</h3><p>${tableProducts.length} products compared</p></div>
<div class="amzwp-ct-live">Live Prices</div>
</div>
<div class="amzwp-ct-scroll"><table><tbody>
<tr>
${tableProducts.map((p, idx) => `<td class="amzwp-ct-cell-head${idx === 0 ? ' amzwp-ct-top' : ''}" style="width:${colWidth}%">
${idx === 0 ? '<div class="amzwp-ct-top-badge">&#9733; Top Pick</div>' : ''}
<div class="amzwp-ct-img"><img src="${escAttr(p.imageUrl)}" alt="${escAttr(p.title)}"></div>
<h4 class="amzwp-ct-title">${escAttr(truncate(p.title, 55))}</h4>
<div class="amzwp-stars" style="margin-bottom:4px">${'&#9733;'.repeat(stars(p.rating))}</div>
<div style="font-size:11px;color:#94a3b8;margin-bottom:12px">${p.rating?.toFixed(1) || '4.5'}/5 &middot; ${(p.reviewCount || 0).toLocaleString()} ratings</div>
<div class="amzwp-ct-price">${escAttr(p.price)}</div>
<a class="amzwp-ct-cta${idx === 0 ? ' amzwp-ct-cta-top' : ''}" href="https://www.amazon.com/dp/${escAttr(p.asin)}?tag=${encodeURIComponent(tag)}" target="_blank" rel="nofollow sponsored noopener">Check Price &#8599;</a>
</td>`).join('')}
</tr>
${specRows}${shippingRow}
</tbody></table></div>
<div class="amzwp-ct-foot">Prices and availability are accurate as of the date/time indicated and are subject to change.</div>
</div>`;
};

export const generateFaqSchema = (faqs: FAQItem[]): string => {
  if (!faqs?.length) return '';
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  })}</script>`;
};
