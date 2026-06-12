/**
 * Product-box HTML generation — self-contained, insertion-safe templates.
 *
 * Design principles:
 *   1. INSERTION-SAFE: Every product box is a single self-closing <div> with
 *      no unclosed tags. It can be placed between any two HTML blocks in any
 *      blog post without breaking parent markup.
 *   2. MOBILE-FIRST: All measurements use clamp() and container queries.
 *      Stacked on mobile, editorial 2-col on wider containers.
 *   3. HOISTED STYLES: A single <style data-amzwp-styles> block is emitted
 *      once per post. Product boxes use class-based markup referencing it.
 *   4. NO NESTING HAZARDS: Uses <div> as the outermost element (not <section>
 *      or <article>) so WordPress block parsers never misinterpret structure.
 *
 * Public API:
 *   - generateProductBoxHtml(product, tag, mode)
 *   - generateComparisonTableHtml(data, products, tag)
 *   - getProductBoxStyles()  -> one <style> block; insert once per post
 *   - wrapWithProductBoxStyles(html)  -> convenience: prefixes the style
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
.amzwp-box{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;box-sizing:border-box;container-type:inline-size;max-width:960px;margin:1.5rem auto;line-height:1.5;color:#0f172a}
.amzwp-box *,.amzwp-box *::before,.amzwp-box *::after{box-sizing:border-box;margin:0;padding:0}
.amzwp-box a{text-decoration:none;color:inherit}
.amzwp-box img{max-width:100%;height:auto;display:block}
.amzwp-box ul{list-style:none}

/* Tactical Link */
.amzwp-tl{display:flex;align-items:center;gap:clamp(10px,3cqw,16px);padding:clamp(12px,3cqw,16px);padding-left:clamp(16px,4cqw,20px);background:#fff;border:1px solid #e2e8f0;border-radius:16px;position:relative;overflow:hidden;box-shadow:0 2px 12px rgba(15,23,42,.06);transition:box-shadow .3s,border-color .3s}
.amzwp-tl:hover{box-shadow:0 8px 28px rgba(15,23,42,.12);border-color:#cbd5e1}
.amzwp-tl::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px;background:linear-gradient(180deg,#10b981,#0ea5e9)}
.amzwp-tl-img{width:clamp(56px,16cqw,72px);height:clamp(56px,16cqw,72px);object-fit:contain;border-radius:12px;padding:4px;border:1px solid #f1f5f9;background:#fafafa;flex-shrink:0}
.amzwp-tl-body{flex:1;min-width:0}
.amzwp-tl-badge{display:inline-block;background:#ecfdf5;color:#059669;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;padding:3px 8px;border-radius:6px;border:1px solid #d1fae5;margin-bottom:4px}
.amzwp-tl-title{font-size:clamp(13px,3.2cqw,15px);font-weight:800;color:#0f172a;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.amzwp-tl-meta{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:11px;color:#64748b;flex-wrap:wrap}
.amzwp-tl-stars{color:#f59e0b;letter-spacing:0.5px}
.amzwp-tl-end{flex-shrink:0;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;padding-left:8px}
.amzwp-tl-price{font-size:clamp(18px,4.4cqw,22px);font-weight:900;color:#0f172a;letter-spacing:-.02em}
.amzwp-tl-cta{display:inline-flex;align-items:center;gap:4px;background:#0f172a;color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:7px 12px;border-radius:8px;transition:background .25s}
.amzwp-tl:hover .amzwp-tl-cta{background:#059669}

/* Elite Bento */
.amzwp-eb{background:#fff;border-radius:clamp(16px,3cqw,24px);box-shadow:0 4px 32px -8px rgba(15,23,42,.10);overflow:hidden;border:1px solid #e2e8f0}
.amzwp-eb-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:clamp(10px,2.5cqw,14px) clamp(16px,4cqw,24px);background:linear-gradient(135deg,#0f172a,#1e293b)}
.amzwp-eb-pill{display:inline-flex;align-items:center;gap:6px;color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.14em}
.amzwp-eb-pill svg{fill:#fbbf24}
.amzwp-eb-date{color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:.06em}
.amzwp-eb-grid{display:grid;grid-template-columns:1fr}
@container (min-width:680px){.amzwp-eb-grid{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}.amzwp-eb-imgcol{border-right:1px solid #f1f5f9}}
.amzwp-eb-imgcol{position:relative;background:linear-gradient(135deg,#fff,#f0f9ff 60%,#e0f2fe);display:flex;align-items:center;justify-content:center;padding:clamp(24px,6cqw,48px) clamp(16px,5cqw,36px);min-height:220px}
.amzwp-eb-img{position:relative;z-index:2;width:100%;max-width:clamp(160px,50cqw,280px);aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 16px 32px rgba(15,23,42,.12))}
.amzwp-eb-rating{position:absolute;z-index:3;bottom:10px;left:10px;background:rgba(255,255,255,.96);backdrop-filter:blur(6px);padding:5px 12px;border-radius:999px;box-shadow:0 4px 16px rgba(15,23,42,.08);display:inline-flex;align-items:center;gap:6px;border:1px solid #f1f5f9;font-size:11px;color:#334155;font-weight:700}
.amzwp-eb-prime{position:absolute;z-index:3;bottom:10px;right:10px;background:#232f3e;color:#fff;padding:5px 10px;border-radius:8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
.amzwp-eb-body{padding:clamp(16px,4cqw,28px);display:flex;flex-direction:column;gap:clamp(12px,3cqw,16px)}
.amzwp-eb-cat{display:inline-flex;align-items:center;gap:6px;background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;padding:4px 10px;border-radius:6px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}
.amzwp-eb-cat::before{content:"";width:6px;height:6px;border-radius:50%;background:#0ea5e9}
.amzwp-eb-brand{color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.amzwp-eb-title{font-size:clamp(18px,4.8cqw,28px);font-weight:900;color:#0f172a;line-height:1.15;letter-spacing:-.02em}
.amzwp-eb-verdict{background:linear-gradient(135deg,#f8fafc,#f0f9ff);border:1px solid #e2e8f0;padding:clamp(12px,3cqw,16px);border-radius:12px;color:#475569;font-size:clamp(13px,2.8cqw,14px);line-height:1.6;font-weight:500}
.amzwp-eb-verdict-badge{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#059669}
.amzwp-eb-verdict-badge svg{fill:#10b981}
.amzwp-eb-bullets{display:grid;grid-template-columns:1fr;gap:8px}
@container (min-width:480px){.amzwp-eb-bullets{grid-template-columns:1fr 1fr}}
.amzwp-eb-bullet{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#fff;border-radius:10px;border:1px solid #f1f5f9;font-size:clamp(12px,2.6cqw,13px);font-weight:600;color:#334155;line-height:1.5;transition:border-color .2s,background .2s}
.amzwp-eb-bullet:hover{border-color:#a7f3d0;background:#f0fdf4}
.amzwp-eb-bullet-icon{flex-shrink:0;width:18px;height:18px;border-radius:5px;background:linear-gradient(135deg,#10b981,#14b8a6);display:flex;align-items:center;justify-content:center;margin-top:1px}
.amzwp-eb-bullet-icon svg{width:10px;height:10px;stroke:#fff;stroke-width:3;fill:none;stroke-linecap:round}
.amzwp-eb-pricebar{margin-top:4px;background:linear-gradient(135deg,#0f172a,#1e293b);padding:clamp(14px,3.5cqw,20px);border-radius:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.amzwp-eb-price-label{display:block;font-size:9px;color:#94a3b8;font-weight:800;text-transform:uppercase;letter-spacing:.14em}
.amzwp-eb-price-val{display:block;margin-top:3px;font-size:clamp(24px,6cqw,36px);font-weight:900;color:#fff;line-height:1;letter-spacing:-.03em}
.amzwp-eb-price-note{color:#34d399;font-size:10px;font-weight:700;margin-left:6px}
.amzwp-eb-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:clamp(12px,3cqw,16px) clamp(18px,4.5cqw,24px);background:linear-gradient(135deg,#10b981,#0d9488);color:#fff;border-radius:12px;font-weight:800;font-size:clamp(11px,2.4cqw,12px);text-transform:uppercase;letter-spacing:.12em;box-shadow:0 10px 24px rgba(16,185,129,.22);transition:transform .25s,box-shadow .25s;min-width:clamp(140px,40cqw,180px);text-align:center}
.amzwp-eb-cta:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(16,185,129,.30)}
.amzwp-eb-cta svg{width:14px;height:14px;stroke:#fff;stroke-width:2.5;fill:none;stroke-linecap:round}
.amzwp-eb-faqs{background:#f8fafc;padding:clamp(14px,3.5cqw,24px);border-top:1px solid #f1f5f9}
.amzwp-eb-faqs-hd{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.amzwp-eb-faqs-icon{width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0ea5e9,#06b6d4);border-radius:7px}
.amzwp-eb-faqs-icon svg{width:13px;height:13px;stroke:#fff;stroke-width:2;fill:none;stroke-linecap:round}
.amzwp-eb-faqs-title{font-size:clamp(13px,2.8cqw,15px);font-weight:900;color:#0f172a}
.amzwp-eb-faq{padding:12px 14px;background:#fff;border:1px solid #f1f5f9;border-radius:10px;margin-bottom:8px}
.amzwp-eb-faq:last-child{margin-bottom:0}
.amzwp-eb-faq-q{font-weight:800;color:#0f172a;font-size:clamp(12px,2.6cqw,13px);line-height:1.4;margin-bottom:5px}
.amzwp-eb-faq-a{color:#64748b;font-size:clamp(12px,2.4cqw,13px);line-height:1.6}
.amzwp-eb-trust{background:#fff;padding:10px clamp(14px,4cqw,24px);display:flex;justify-content:center;gap:clamp(10px,3cqw,24px);flex-wrap:wrap;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
.amzwp-eb-trust span{display:inline-flex;align-items:center;gap:4px}
.amzwp-eb-disc{text-align:center;font-size:9px;color:#94a3b8;margin-top:10px;line-height:1.5}

/* Comparison table — div-based card grid, WordPress-proof */
.amzwp-ct{max-width:1100px;margin:clamp(2rem,5cqw,3.5rem) auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;container-type:inline-size;line-height:1.5;color:#0f172a}
.amzwp-ct,.amzwp-ct *,.amzwp-ct *::before,.amzwp-ct *::after{box-sizing:border-box;margin:0;padding:0;border:0;outline:0}
.amzwp-ct a{text-decoration:none!important;color:inherit}
.amzwp-ct img{max-width:100%;height:auto;display:block;border:none!important;box-shadow:none!important}

.amzwp-ct-header{text-align:center;margin-bottom:clamp(20px,4cqw,32px)}
.amzwp-ct-pill{display:inline-flex;align-items:center;gap:8px;background:#f1f5f9;border-radius:999px;padding:6px 16px;margin-bottom:12px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em}
.amzwp-ct-pill::before{content:"";width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.15)}
.amzwp-ct-header h3{margin:0!important;padding:0!important;border:none!important;color:#0f172a;font-size:clamp(20px,5cqw,32px);font-weight:900;letter-spacing:-.02em;line-height:1.2}
.amzwp-ct-header p{margin:8px 0 0!important;color:#94a3b8;font-size:13px;font-weight:500}

.amzwp-ct-grid{display:grid;grid-template-columns:1fr;gap:clamp(12px,3cqw,20px)}
@container (min-width:520px){.amzwp-ct-grid{grid-template-columns:repeat(2,1fr)}}
@container (min-width:820px){.amzwp-ct-grid{grid-template-columns:repeat(var(--ct-cols,3),1fr)}}

.amzwp-ct-card{position:relative;background:#fff;border-radius:clamp(16px,3cqw,24px);border:1px solid #e2e8f0;overflow:hidden;transition:transform .3s cubic-bezier(.4,0,.2,1),box-shadow .3s cubic-bezier(.4,0,.2,1)}
.amzwp-ct-card:hover{transform:translateY(-4px);box-shadow:0 20px 48px -12px rgba(15,23,42,.12)}
.amzwp-ct-card-top{border-color:#0ea5e9;box-shadow:0 8px 32px -8px rgba(14,165,233,.15)}
.amzwp-ct-card-top:hover{box-shadow:0 20px 48px -12px rgba(14,165,233,.2)}

.amzwp-ct-accent{height:4px;background:linear-gradient(90deg,#0ea5e9,#06b6d4)}
.amzwp-ct-badge{display:flex;justify-content:center;padding-top:14px}
.amzwp-ct-badge span{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;padding:6px 16px;border-radius:999px;box-shadow:0 4px 12px rgba(14,165,233,.25)}
.amzwp-ct-badge svg{width:12px;height:12px;fill:currentColor}

.amzwp-ct-body{padding:clamp(16px,4cqw,28px)}
.amzwp-ct-imgbox{position:relative;height:clamp(120px,18cqw,180px);display:flex;align-items:center;justify-content:center;margin-bottom:clamp(12px,3cqw,20px);background:linear-gradient(180deg,#f8fafc 0%,#fff 100%);border-radius:16px;overflow:hidden}
.amzwp-ct-imgbox img{max-height:85%;max-width:80%;object-fit:contain;transition:transform .4s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 8px 16px rgba(0,0,0,.08))}
.amzwp-ct-card:hover .amzwp-ct-imgbox img{transform:scale(1.06)}

.amzwp-ct-brand{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:6px}
.amzwp-ct-title{font-size:clamp(13px,3cqw,15px);font-weight:700;color:#0f172a;line-height:1.4;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}

.amzwp-ct-rating{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.amzwp-ct-stars{color:#f59e0b;font-size:14px;letter-spacing:1px;line-height:1}
.amzwp-ct-rating-num{font-size:13px;font-weight:800;color:#0f172a}
.amzwp-ct-rating-count{font-size:11px;color:#94a3b8;font-weight:500}

.amzwp-ct-scorebar{height:4px;background:#f1f5f9;border-radius:999px;overflow:hidden;margin-bottom:16px}
.amzwp-ct-scorebar-fill{height:100%;border-radius:999px;transition:width .6s cubic-bezier(.4,0,.2,1)}

.amzwp-ct-price{font-size:clamp(24px,5.5cqw,32px);font-weight:900;color:#0f172a;letter-spacing:-.03em;margin-bottom:4px;line-height:1.1}
.amzwp-ct-shipping{display:inline-flex;align-items:center;gap:6px;margin-bottom:16px}
.amzwp-ct-prime{background:#232f3e;color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:4px 10px;border-radius:6px;display:inline-flex;align-items:center;gap:4px}
.amzwp-ct-prime svg{width:10px;height:10px;fill:currentColor}
.amzwp-ct-standard{font-size:11px;color:#94a3b8;font-weight:500}

.amzwp-ct-cta{display:flex!important;align-items:center;justify-content:center;gap:8px;width:100%;padding:clamp(12px,3cqw,16px) 20px;border-radius:12px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#fff!important;background:#0f172a;transition:all .25s cubic-bezier(.4,0,.2,1);box-shadow:0 4px 12px rgba(15,23,42,.15)}
.amzwp-ct-cta:hover{background:#1e293b;transform:translateY(-2px);box-shadow:0 8px 24px rgba(15,23,42,.2)}
.amzwp-ct-cta svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.5;fill:none}
.amzwp-ct-cta-top{background:linear-gradient(135deg,#0ea5e9,#0284c7)!important;box-shadow:0 8px 24px rgba(14,165,233,.25)}
.amzwp-ct-cta-top:hover{background:linear-gradient(135deg,#38bdf8,#0ea5e9)!important;box-shadow:0 12px 32px rgba(14,165,233,.3)}

.amzwp-ct-specs{margin-top:clamp(20px,4cqw,32px);background:#fff;border-radius:clamp(16px,3cqw,20px);border:1px solid #e2e8f0;overflow:hidden}
.amzwp-ct-specs-head{padding:clamp(12px,3cqw,18px) clamp(16px,4cqw,24px);background:#f8fafc;border-bottom:1px solid #e2e8f0}
.amzwp-ct-specs-head h4{margin:0!important;font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.08em}
.amzwp-ct-specs-grid{display:grid;grid-template-columns:140px repeat(var(--ct-cols,3),1fr)}
@container (max-width:600px){.amzwp-ct-specs-grid{grid-template-columns:100px repeat(var(--ct-cols,3),1fr)}}
.amzwp-ct-specs-row{display:contents}
.amzwp-ct-specs-row:nth-child(even) > *{background:#f9fafb}
.amzwp-ct-specs-row > *{padding:clamp(10px,2.5cqw,14px) clamp(10px,2.5cqw,16px);border-bottom:1px solid #f1f5f9;display:flex;align-items:center}
.amzwp-ct-specs-row:last-child > *{border-bottom:0}
.amzwp-ct-spec-label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
.amzwp-ct-spec-val{font-size:13px;font-weight:600;color:#1e293b;justify-content:center;text-align:center}

.amzwp-ct-foot{text-align:center;margin-top:clamp(12px,3cqw,20px);padding:0 16px}
.amzwp-ct-foot p{margin:0!important;color:#94a3b8;font-size:11px;font-weight:500}
.amzwp-ct-foot-live{display:inline-flex;align-items:center;gap:6px;color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-top:6px}
.amzwp-ct-foot-live::before{content:"";width:6px;height:6px;border-radius:50%;background:#10b981;display:inline-block;animation:amzwp-pulse 2s infinite}
@keyframes amzwp-pulse{0%,100%{opacity:1}50%{opacity:.4}}

@media(prefers-reduced-motion:reduce){.amzwp-tl,.amzwp-eb-cta{transition:none}}
`.replace(/\n+/g, '').replace(/\s{2,}/g, ' ').trim();

export interface ProductBoxPalette {
  primary?: string;
  primary2?: string;
  primaryLight?: string;
  accentTint?: string;
  accentText?: string;
  accentBorder?: string;
}

const buildPaletteCss = (p: ProductBoxPalette): string => {
  const decl = [
    p.primary       && `--amzwp-primary:${p.primary}`,
    p.primary2      && `--amzwp-primary-2:${p.primary2}`,
    p.primaryLight  && `--amzwp-primary-light:${p.primaryLight}`,
    p.accentTint    && `--amzwp-accent-tint:${p.accentTint}`,
    p.accentText    && `--amzwp-accent-text:${p.accentText}`,
    p.accentBorder  && `--amzwp-accent-border:${p.accentBorder}`,
  ].filter(Boolean).join(';');
  if (!decl) return '';
  return `.amzwp-box{${decl}}`;
};

/** Single <style> block. Insert ONCE per post; safe to dedupe by the marker. */
export const getProductBoxStyles = (palette?: ProductBoxPalette): string => {
  const paletteCss = palette ? buildPaletteCss(palette) : '';
  return `<style ${STYLE_MARKER}>${STYLES}${paletteCss}</style>`;
};

/** Prefix a chunk of HTML with the shared style block iff not already present. */
export const wrapWithProductBoxStyles = (
  html: string,
  palette?: ProductBoxPalette,
): string =>
  html.includes(STYLE_MARKER) ? html : `${getProductBoxStyles(palette)}\n${html}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escAttr = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const escHtml = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const truncate = (s: string, n: number) =>
  s.length <= n ? s : `${s.slice(0, n - 3)}...`;

const stars = (rating?: number): number =>
  Math.min(5, Math.max(0, Math.round(rating ?? 4.5)));

const starsHtml = (rating?: number): string => {
  const s = stars(rating);
  return `<span class="amzwp-tl-stars">${'\u2605'.repeat(s)}${'\u2606'.repeat(5 - s)}</span>`;
};

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
// TACTICAL LINK template
// ---------------------------------------------------------------------------

const tacticalLink = (p: ProductDetails, url: string, s: number): string => {
  const title = escHtml(p.title);
  return `<div class="amzwp-box"><a class="amzwp-tl" href="${escAttr(url)}" target="_blank" rel="nofollow sponsored noopener">
<img class="amzwp-tl-img" src="${escAttr(p.imageUrl)}" alt="${escAttr(p.title)}" loading="lazy">
<div class="amzwp-tl-body">
<span class="amzwp-tl-badge">Recommended</span>
<div class="amzwp-tl-title">${title}</div>
<div class="amzwp-tl-meta">${starsHtml(p.rating)}<span>${(p.rating || 4.5).toFixed(1)}</span><span>(${(p.reviewCount || 0).toLocaleString()})</span>${p.prime ? '<span style="color:#059669;font-weight:700">Prime</span>' : ''}</div>
</div>
<div class="amzwp-tl-end">
<div class="amzwp-tl-price">${escHtml(p.price)}</div>
<span class="amzwp-tl-cta">View &#8594;</span>
</div>
</a></div>`;
};

// ---------------------------------------------------------------------------
// ELITE BENTO template
// ---------------------------------------------------------------------------

const eliteBento = (p: ProductDetails, url: string, s: number, date: string): string => {
  const bullets = p.evidenceClaims?.length ? p.evidenceClaims.slice(0, 4) : generateSmartClaims(p);
  const verdict = p.verdict || generateSmartVerdict(p);
  const faqs = generateProductFaqs(p);
  const title = escHtml(p.title);
  const reviewLabel = `${(p.reviewCount || 0).toLocaleString()}`;

  const bulletHtml = bullets.map(c =>
    `<li class="amzwp-eb-bullet"><span class="amzwp-eb-bullet-icon"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></span><span>${escHtml(c)}</span></li>`
  ).join('');

  const faqHtml = faqs.map(f =>
    `<div class="amzwp-eb-faq"><div class="amzwp-eb-faq-q">${escHtml(f.q)}</div><div class="amzwp-eb-faq-a">${escHtml(f.a)}</div></div>`
  ).join('');

  return `<div class="amzwp-box"><div class="amzwp-eb">
<div class="amzwp-eb-bar">
<span class="amzwp-eb-pill"><svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Editor's Choice</span>
<span class="amzwp-eb-date">Verified &#183; ${date}</span>
</div>
<div class="amzwp-eb-grid">
<div class="amzwp-eb-imgcol">
<a href="${escAttr(url)}" target="_blank" rel="nofollow sponsored noopener"><img class="amzwp-eb-img" src="${escAttr(p.imageUrl)}" alt="${escAttr(p.title)}" loading="lazy"></a>
<div class="amzwp-eb-rating">${starsHtml(p.rating)} <span>${(p.rating || 4.5).toFixed(1)}</span> <span style="color:#94a3b8">(${reviewLabel})</span></div>
${p.prime ? '<div class="amzwp-eb-prime">&#9889; Prime</div>' : ''}
</div>
<div class="amzwp-eb-body">
<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
<span class="amzwp-eb-cat">${escHtml(p.category || 'Featured')}</span>
${p.brand ? `<span class="amzwp-eb-brand">by ${escHtml(p.brand)}</span>` : ''}
</div>
<div class="amzwp-eb-title">${title}</div>
<div class="amzwp-eb-verdict">${escHtml(verdict)}<div class="amzwp-eb-verdict-badge"><svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> AI-Verified Analysis</div></div>
<ul class="amzwp-eb-bullets">${bulletHtml}</ul>
<div class="amzwp-eb-pricebar">
<div>
<span class="amzwp-eb-price-label">Best price</span>
<span class="amzwp-eb-price-val">${escHtml(p.price)}${p.prime ? '<span class="amzwp-eb-price-note">FREE delivery</span>' : ''}</span>
</div>
<a class="amzwp-eb-cta" href="${escAttr(url)}" target="_blank" rel="nofollow sponsored noopener">Check Price <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
</div>
</div>
</div>
<div class="amzwp-eb-faqs"><div class="amzwp-eb-faqs-hd"><span class="amzwp-eb-faqs-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span><span class="amzwp-eb-faqs-title">Common Questions</span></div>${faqHtml}</div>
<div class="amzwp-eb-trust"><span>&#10003; Amazon Verified</span><span>&#128274; Secure Checkout</span><span>&#8634; 30-Day Returns</span></div>
</div><div class="amzwp-eb-disc">As an Amazon Associate we earn from qualifying purchases. Prices accurate as of ${date}.</div></div>`;
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

  const cols = tableProducts.length;
  const customSpecs = (data.specs || []).filter(
    s => !['rating', 'reviews', 'prime', 'price'].includes(s.toLowerCase()),
  );

  const starsFull = (rating: number) => {
    const r = Math.min(5, Math.max(0, Math.round(rating)));
    return '\u2605'.repeat(r) + '\u2606'.repeat(5 - r);
  };

  const scoreBarColor = (idx: number) =>
    idx === 0 ? '#0ea5e9' : '#1e293b';

  const cards = tableProducts.map((p, idx) => {
    const isTop = idx === 0;
    const pct = Math.min(100, ((p.rating || 4.5) / 5) * 100);
    const brandHtml = p.brand ? `<div class="amzwp-ct-brand">${escHtml(p.brand)}</div>` : '';
    const shippingHtml = p.prime
      ? `<div class="amzwp-ct-shipping"><span class="amzwp-ct-prime"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>Prime</span></div>`
      : `<div class="amzwp-ct-shipping"><span class="amzwp-ct-standard">Standard shipping</span></div>`;

    return `<div class="amzwp-ct-card${isTop ? ' amzwp-ct-card-top' : ''}">
${isTop ? `<div class="amzwp-ct-accent"></div>
<div class="amzwp-ct-badge"><span><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Top Pick</span></div>` : ''}
<div class="amzwp-ct-body">
<div class="amzwp-ct-imgbox"><img src="${escAttr(p.imageUrl)}" alt="${escAttr(p.title)}" loading="lazy"></div>
${brandHtml}
<div class="amzwp-ct-title">${escHtml(truncate(p.title, 60))}</div>
<div class="amzwp-ct-rating">
<span class="amzwp-ct-stars">${starsFull(p.rating || 4.5)}</span>
<span class="amzwp-ct-rating-num">${(p.rating || 4.5).toFixed(1)}</span>
<span class="amzwp-ct-rating-count">(${(p.reviewCount || 0).toLocaleString()})</span>
</div>
<div class="amzwp-ct-scorebar"><div class="amzwp-ct-scorebar-fill" style="width:${pct}%;background:${scoreBarColor(idx)}"></div></div>
<div class="amzwp-ct-price">${escHtml(p.price)}</div>
${shippingHtml}
<a class="amzwp-ct-cta${isTop ? ' amzwp-ct-cta-top' : ''}" href="https://www.amazon.com/dp/${escAttr(p.asin)}?tag=${encodeURIComponent(tag)}" target="_blank" rel="nofollow sponsored noopener">
<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
Check Amazon Price
<svg viewBox="0 0 24 24"><path d="M7 17l9.2-9.2M17 17V8H8"/></svg>
</a>
</div>
</div>`;
  }).join('\n');

  const specsHtml = customSpecs.length > 0 ? `
<div class="amzwp-ct-specs">
<div class="amzwp-ct-specs-head"><h4>Detailed Specifications</h4></div>
<div class="amzwp-ct-specs-grid" style="--ct-cols:${cols}">
${customSpecs.map(spec => `<div class="amzwp-ct-specs-row">
<div class="amzwp-ct-spec-label">${escHtml(spec)}</div>
${tableProducts.map(p => `<div class="amzwp-ct-spec-val">${escHtml(p.specs?.[spec] || '\u2014')}</div>`).join('')}
</div>`).join('\n')}
${tableProducts.some(p => p.prime) ? `<div class="amzwp-ct-specs-row">
<div class="amzwp-ct-spec-label">Shipping</div>
${tableProducts.map(p => `<div class="amzwp-ct-spec-val" style="color:${p.prime ? '#059669' : '#94a3b8'}">${p.prime ? '\u26A1 Prime' : 'Standard'}</div>`).join('')}
</div>` : ''}
</div>
</div>` : '';

  return `<div class="amzwp-box"><div class="amzwp-ct">
<div class="amzwp-ct-header">
<div class="amzwp-ct-pill">Product Comparison</div>
<h3>${escHtml(data.title)}</h3>
<p>${tableProducts.length} products compared side by side</p>
</div>
<div class="amzwp-ct-grid" style="--ct-cols:${cols}">
${cards}
</div>
${specsHtml}
<div class="amzwp-ct-foot">
<p>Prices and availability are accurate as of the date/time indicated and are subject to change.</p>
<div class="amzwp-ct-foot-live">Live Prices</div>
</div>
</div></div>`;
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
