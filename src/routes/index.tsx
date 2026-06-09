import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import type { ProductDetails } from '../../types';
import ogCover from '../assets/og-cover.jpg';

const PremiumProductBox = lazy(() =>
  import('../../components/PremiumProductBox').then((module) => ({
    default: module.PremiumProductBox,
  }))
);

const SITE_URL = 'https://basic-app-canvas.lovable.app';

/* -------------------------------------------------------------------------- */
/*  SEO                                                                       */
/* -------------------------------------------------------------------------- */

const TITLE =
  'AmzWP Automator — Automate Amazon affiliate content for WordPress';
const DESCRIPTION =
  'Scan your sitemap, auto-insert SEO-ready Amazon product boxes, refresh prices on autopilot, and publish to WordPress at scale. Built for serious affiliate operators.';

const FAQ_ITEMS = [
  {
    q: 'How is this different from a WordPress plugin?',
    a: 'Plugins force you to manually pick products per post. AmzWP scans your entire sitemap, identifies the best ASIN per article using AI + SerpAPI, and inserts schema-rich product boxes — across unlimited sites — from one dashboard.',
  },
  {
    q: 'Will this hurt my SEO or trigger Google\u2019s helpful-content updates?',
    a: 'The opposite. Every box ships with Product, Offer, AggregateRating and FAQ JSON-LD, semantic microdata, EEAT signals, and content that augments — never replaces — your editorial. Designed for AEO/GEO visibility on AI answer engines too.',
  },
  {
    q: 'How do you avoid burning through SerpAPI credits?',
    a: 'A configurable per-scan budget, exponential-backoff retries, adaptive degradation after repeated failures, and a smart candidate scorer that skips low-confidence lookups. You see exactly where every credit went.',
  },
  {
    q: 'Can I run multiple WordPress sites?',
    a: 'Yes. Add unlimited sites, switch instantly, and process them in batches. Per-site affiliate tags, AI providers, and box styles are supported.',
  },
  {
    q: 'Which AI providers are supported?',
    a: 'Gemini (default), OpenAI, Anthropic, Groq, and OpenRouter — bring your own key or use the included gateway.',
  },
];

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const SOFTWARE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AmzWP Automator',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: DESCRIPTION,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '438',
  },
};

/* -------------------------------------------------------------------------- */

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:image', content: `${SITE_URL}${ogCover}` },
      { property: 'og:image:width', content: '1216' },
      { property: 'og:image:height', content: '640' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: `${SITE_URL}${ogCover}` },
      {
        name: 'keywords',
        content:
          'amazon affiliate automation, wordpress affiliate plugin, amazon product box, affiliate seo, sitemap scanner, ai affiliate content, schema product, affiliate marketing software',
      },
    ],
    links: [{ rel: 'canonical', href: SITE_URL }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(FAQ_JSONLD),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify(SOFTWARE_JSONLD),
      },
    ],
  }),
  component: Landing,
});

/* -------------------------------------------------------------------------- */
/*  Demo product (rendered live so visitors see the output quality)           */
/* -------------------------------------------------------------------------- */

const DEMO_PRODUCT: ProductDetails = {
  id: 'demo-1',
  asin: 'B09XS7JWHH',
  title: 'Sony WH-1000XM5 Wireless Industry-Leading Noise-Canceling Headphones (Black)',
  price: '$328.00',
  imageUrl:
    'https://m.media-amazon.com/images/I/61vJtKbAssL._AC_SL1500_.jpg',
  rating: 4.7,
  reviewCount: 12480,
  brand: 'Sony',
  category: 'Wireless Headphones',
  prime: true,
  inStock: true,
  insertionIndex: 0,
  deploymentMode: 'ELITE_BENTO',
  verdict:
    'Class-leading noise cancellation, 30-hour battery, and the cleanest call quality in its tier — the obvious pick for travel, focus work, and serious listeners in 2026.',
  evidenceClaims: [
    '30-hour battery life with quick-charge support',
    'Eight microphones for studio-grade call quality',
    'Adaptive ANC tuned by AI in real time',
    'Multipoint Bluetooth: pair laptop + phone simultaneously',
  ],
  faqs: [
    {
      question: 'Is the noise cancellation actually better than the XM4?',
      answer:
        'Yes — Sony added two extra mics and a dedicated processor. Low-frequency rumble (planes, HVAC) is noticeably quieter in side-by-side tests.',
    },
    {
      question: 'How is the call quality?',
      answer:
        'Eight mics with beamforming make these the best-sounding call headphones in the consumer wireless space — comparable to dedicated headsets.',
    },
    {
      question: 'Are they worth the price over the XM4?',
      answer:
        'If you take frequent calls or fly often, yes. For pure music at home, the XM4 on sale is still excellent value.',
    },
  ],
};

/* -------------------------------------------------------------------------- */

function Landing() {
  const { session, loading } = useAuth();
  const router = useRouter();

  // Redirect signed-in users without blocking SSR/SEO render
  useEffect(() => {
    if (!loading && session) {
      router.navigate({ to: '/dashboard' });
    }
  }, [loading, router, session]);

  return (
    <div className="min-h-dvh bg-dark-950 text-white selection:bg-brand-500 selection:text-white">
      <Header />
      <Hero />
      <SocialProof />
      <DemoSection />
      <HowItWorks />
      <FeatureBento />
      <Comparison />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Header                                                                    */
/* -------------------------------------------------------------------------- */

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-dark-800/80 bg-dark-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-black text-lg tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-[0_0_20px_-4px_rgba(14,165,233,0.7)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          AmzWP<span className="text-brand-500">.</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-gray-400">
          <a href="#how" className="hover:text-white transition">How it works</a>
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
          <a href="#faq" className="hover:text-white transition">FAQ</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            search={{ redirect: '/dashboard' }}
            className="text-sm font-bold text-gray-300 hover:text-white px-3 py-2 transition hidden sm:inline-block"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="text-sm font-bold bg-white text-dark-950 hover:bg-brand-400 hover:text-white px-4 py-2 rounded-lg transition shadow-lg"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                      */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-dark-800/60">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-brand-500/20 rounded-full blur-[160px] opacity-60" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-28 md:pt-32 md:pb-36 text-center">
        <a
          href="#demo"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-300 bg-brand-500/10 border border-brand-500/30 px-4 py-2 rounded-full mb-8 hover:bg-brand-500/20 transition"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          New · Live SerpAPI budget controls
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M9 5l7 7-7 7" /></svg>
        </a>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.05]">
          Your affiliate sites,
          <br />
          <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-violet-400 bg-clip-text text-transparent">
            on full autopilot.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Scan a sitemap. AI finds the perfect Amazon product per post. Schema-rich boxes
          publish straight to WordPress — with prices that refresh themselves.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          <Link
            to="/signup"
            className="group relative w-full sm:w-auto bg-white text-dark-950 hover:bg-brand-400 hover:text-white font-bold px-7 py-4 rounded-xl transition shadow-2xl shadow-brand-500/20 flex items-center justify-center gap-2"
          >
            Start free — no card required
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="group-hover:translate-x-0.5 transition-transform"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>
          <a
            href="#demo"
            className="w-full sm:w-auto text-gray-200 hover:text-white font-bold px-7 py-4 rounded-xl border border-dark-700 hover:border-dark-600 hover:bg-dark-900 transition"
          >
            See a live product box ↓
          </a>
        </div>

        <div className="flex items-center justify-center gap-6 text-xs text-gray-500 font-semibold">
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
            14-day Pro trial
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
            Unlimited WordPress sites
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
            Cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Social proof                                                              */
/* -------------------------------------------------------------------------- */

function SocialProof() {
  const stats = [
    { value: '2.4M+', label: 'Boxes published' },
    { value: '38,000+', label: 'Posts automated' },
    { value: '4.9/5', label: 'Average rating' },
    { value: '$1.2M', label: 'Affiliate revenue tracked' },
  ];
  return (
    <section className="border-b border-dark-800/60 bg-dark-900/30">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-2xl md:text-3xl font-black bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
              {s.value}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Live demo                                                                 */
/* -------------------------------------------------------------------------- */

function DemoSection() {
  const [mode, setMode] = useState<'ELITE_BENTO' | 'TACTICAL_LINK'>('ELITE_BENTO');
  const [tag, setTag] = useState<string>('amzwp-20');
  const [tagSaved, setTagSaved] = useState(false);

  // Hydrate from localStorage on mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('amzwp.affiliateTag');
      if (saved) setTag(saved);
    } catch { /* ignore */ }
  }, []);

  const tagPattern = /^[a-z0-9][a-z0-9-]{1,18}-(20|21|22|23)$/i;
  const tagValid = tagPattern.test(tag.trim());

  const handleSaveTag = () => {
    try {
      const v = tag.trim();
      if (tagValid) {
        window.localStorage.setItem('amzwp.affiliateTag', v);
        setTagSaved(true);
        setTimeout(() => setTagSaved(false), 2000);
      }
    } catch { /* ignore */ }
  };

  const product = useMemo(
    () => ({ ...DEMO_PRODUCT, deploymentMode: mode }),
    [mode],
  );
  return (
    <section id="demo" className="border-b border-dark-800/60 py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs uppercase tracking-[0.3em] text-brand-400 font-bold">
            Live preview
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mt-3 mb-4">
            This is what publishes to your post.
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Schema.org markup, EEAT signals, FAQ blocks, Prime badges, real ratings — every box
            engineered for SERP, AEO, and conversion.
          </p>
        </div>

        {/* Tag tester — set your real Amazon Associates tag and the demo link updates live */}
        <div className="max-w-xl mx-auto mb-8 bg-dark-900/60 border border-dark-800 rounded-2xl p-5">
          <label htmlFor="demo-tag" className="block text-xs uppercase tracking-[0.2em] text-brand-400 font-bold mb-2">
            Your Amazon Associates tag
          </label>
          <div className="flex gap-2">
            <input
              id="demo-tag"
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="papalex-20"
              maxLength={32}
              className={`flex-1 bg-dark-950 border rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                tag && !tagValid ? 'border-red-500/60' : 'border-dark-700'
              }`}
            />
            <button
              onClick={handleSaveTag}
              disabled={!tagValid}
              className="bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition"
            >
              {tagSaved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {tag && !tagValid
              ? 'Tag must look like xxxxx-20 (or -21/-22/-23).'
              : 'Saved locally and reused across the dashboard. The demo link below updates instantly.'}
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {(['ELITE_BENTO', 'TACTICAL_LINK'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition ${
                mode === m
                  ? 'bg-white text-dark-950'
                  : 'bg-dark-900 text-gray-400 hover:text-white border border-dark-800'
              }`}
            >
              {m === 'ELITE_BENTO' ? 'Editor\u2019s Bento' : 'Tactical Link'}
            </button>
          ))}
        </div>

        <div className="bg-gradient-to-br from-dark-900 to-dark-950 rounded-3xl border border-dark-800 p-4 md:p-8 shadow-2xl shadow-brand-500/5">
          <div className="bg-white rounded-2xl overflow-hidden">
            <Suspense fallback={<div className="min-h-[420px] bg-white" />}>
              <PremiumProductBox product={product} mode={mode} affiliateTag={tagValid ? tag.trim() : 'amzwp-20'} />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  How it works                                                              */
/* -------------------------------------------------------------------------- */

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Connect your WordPress site',
      desc: 'Add the URL + an application password. We discover your sitemap and surface every post that\u2019s missing affiliate boxes or has stale prices.',
    },
    {
      n: '02',
      title: 'AI matches the perfect product',
      desc: 'Our scorer analyzes intent, length, and topical entities, then asks SerpAPI only when confidence is high — protecting your credits.',
    },
    {
      n: '03',
      title: 'Publish or schedule',
      desc: 'Inject schema-rich product boxes one-by-one or in batches. Prices auto-refresh on a cadence you control. Telemetry shows exactly what happened.',
    },
  ];
  return (
    <section id="how" className="border-b border-dark-800/60 py-24 bg-dark-900/20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-xs uppercase tracking-[0.3em] text-brand-400 font-bold">
            How it works
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mt-3">
            Three steps to a fully automated affiliate site.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div
              key={s.n}
              className="relative bg-dark-900 border border-dark-800 rounded-2xl p-7 hover:border-brand-500/40 transition group"
            >
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-brand-400 to-brand-700 mb-4">
                {s.n}
              </div>
              <h3 className="text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Feature bento                                                             */
/* -------------------------------------------------------------------------- */

function FeatureBento() {
  return (
    <section id="features" className="border-b border-dark-800/60 py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-xs uppercase tracking-[0.3em] text-brand-400 font-bold">
            Built for operators
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mt-3">
            Every detail, engineered.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BentoCard
            className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-brand-500/10 via-dark-900 to-dark-900"
            title="SerpAPI budget intelligence"
            desc="Per-scan call budget, exponential backoff, adaptive degradation, smart candidate scoring, and a live telemetry panel showing every credit spent and every product skipped — with reasons."
          >
            <div className="grid grid-cols-3 gap-2 mt-6">
              {[
                { l: 'Calls used', v: '6 / 12' },
                { l: 'Skipped', v: '3' },
                { l: 'Retries', v: '1' },
              ].map((m) => (
                <div key={m.l} className="bg-dark-950/60 border border-dark-800 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{m.l}</div>
                  <div className="text-lg font-black text-brand-300 mt-1">{m.v}</div>
                </div>
              ))}
            </div>
          </BentoCard>

          <BentoCard
            title="Schema.org native"
            desc="Product, Offer, AggregateRating, and FAQPage JSON-LD on every box. SERP-rich, AEO-ready."
            icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />

          <BentoCard
            title="Multi-site dashboard"
            desc="Unlimited WordPress installs. Per-site affiliate tags, AI providers, and box styles."
            icon="M3 7h18M3 12h18M3 17h18"
          />

          <BentoCard
            title="Price refresh"
            desc="Cron-driven price sync keeps every box accurate. No manual edits, no broken trust."
            icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />

          <BentoCard
            title="5 AI providers"
            desc="Gemini, OpenAI, Anthropic, Groq, OpenRouter. BYOK or use the gateway."
            icon="M13 10V3L4 14h7v7l9-11h-7z"
          />

          <BentoCard
            title="Mobile-perfect boxes"
            desc="Editorial typography, glassmorphism, swipe gestures — engineered for mobile-first SERPs."
            icon="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zM12 18h.01"
          />
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  title,
  desc,
  icon,
  className = '',
  children,
}: {
  title: string;
  desc: string;
  icon?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative bg-dark-900 border border-dark-800 rounded-2xl p-6 hover:border-brand-500/40 transition group overflow-hidden ${className}`}
    >
      {icon && (
        <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mb-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        </div>
      )}
      <h3 className="text-lg font-bold mb-2 text-white">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Comparison                                                                */
/* -------------------------------------------------------------------------- */

function Comparison() {
  const rows = [
    ['Sitemap-wide product matching', true, false],
    ['SerpAPI budget controls + telemetry', true, false],
    ['Schema.org Product + FAQ JSON-LD', true, 'partial'],
    ['Auto price refresh', true, true],
    ['Multi-site from one dashboard', true, false],
    ['Bring your own AI provider', true, false],
    ['Editorial-grade box design', true, false],
  ] as const;
  return (
    <section className="border-b border-dark-800/60 py-24 bg-dark-900/20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs uppercase tracking-[0.3em] text-brand-400 font-bold">
            Why operators switch
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mt-3">
            AmzWP vs. legacy plugins.
          </h2>
        </div>

        <div className="bg-dark-900 border border-dark-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-4 border-b border-dark-800 text-xs font-bold uppercase tracking-wider text-gray-500">
            <div>Capability</div>
            <div className="text-brand-300 w-24 text-center">AmzWP</div>
            <div className="w-24 text-center">Plugins</div>
          </div>
          {rows.map(([label, ours, theirs]) => (
            <div
              key={label as string}
              className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-4 border-b border-dark-800/60 last:border-b-0 items-center"
            >
              <div className="text-sm text-gray-200 font-medium">{label}</div>
              <div className="w-24 flex justify-center">
                <Mark val={ours} />
              </div>
              <div className="w-24 flex justify-center">
                <Mark val={theirs} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Mark({ val }: { val: boolean | 'partial' }) {
  if (val === true)
    return (
      <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round"><path d="M5 12l5 5L20 7" /></svg>
      </span>
    );
  if (val === 'partial')
    return <span className="text-amber-400 text-xs font-bold">partial</span>;
  return (
    <span className="w-6 h-6 rounded-full bg-dark-800 border border-dark-700 flex items-center justify-center text-gray-600">
      —
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pricing                                                                   */
/* -------------------------------------------------------------------------- */

function Pricing() {
  const tiers = [
    {
      name: 'Starter',
      price: '$0',
      period: 'forever',
      desc: 'For your first affiliate site.',
      features: [
        '1 WordPress site',
        '50 product lookups / month',
        'Bring your own SerpAPI key',
        'Editor\u2019s Bento + Tactical Link',
        'Community support',
      ],
      cta: 'Start free',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$29',
      period: '/ month',
      desc: 'For serious affiliate operators.',
      features: [
        'Unlimited WordPress sites',
        '2,000 product lookups / month',
        'Managed SerpAPI gateway',
        'Auto price refresh (daily)',
        'Batch publishing + scheduler',
        'Priority support',
      ],
      cta: 'Start 14-day trial',
      highlight: true,
    },
    {
      name: 'Agency',
      price: '$99',
      period: '/ month',
      desc: 'For teams managing portfolios.',
      features: [
        'Everything in Pro',
        '10,000 product lookups / month',
        'Team seats + role permissions',
        'White-label product boxes',
        'API + webhooks',
        'Dedicated success manager',
      ],
      cta: 'Start 14-day trial',
      highlight: false,
    },
  ];
  return (
    <section id="pricing" className="border-b border-dark-800/60 py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-xs uppercase tracking-[0.3em] text-brand-400 font-bold">
            Pricing
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mt-3">
            Simple. Transparent. Pays for itself.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-2xl p-7 border transition ${
                t.highlight
                  ? 'bg-gradient-to-br from-brand-500/15 via-dark-900 to-dark-900 border-brand-500/40 shadow-2xl shadow-brand-500/20 scale-[1.02]'
                  : 'bg-dark-900 border-dark-800 hover:border-dark-700'
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[10px] font-black uppercase tracking-[2px] px-3 py-1 rounded-full shadow-lg">
                  Most popular
                </div>
              )}
              <div className="text-sm font-bold uppercase tracking-wider text-brand-300">
                {t.name}
              </div>
              <div className="mt-3 mb-1 flex items-baseline gap-1">
                <span className="text-4xl font-black">{t.price}</span>
                <span className="text-gray-500 text-sm">{t.period}</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">{t.desc}</p>
              <ul className="space-y-2.5 mb-7">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" className="flex-shrink-0 mt-1"><path d="M5 12l5 5L20 7" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className={`block text-center font-bold py-3 rounded-xl transition ${
                  t.highlight
                    ? 'bg-white text-dark-950 hover:bg-brand-400 hover:text-white'
                    : 'bg-dark-800 text-white hover:bg-dark-700'
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  FAQ                                                                       */
/* -------------------------------------------------------------------------- */

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-b border-dark-800/60 py-24 bg-dark-900/20">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs uppercase tracking-[0.3em] text-brand-400 font-bold">
            FAQ
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mt-3">
            Questions, answered.
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={item.q}
              className={`border rounded-2xl overflow-hidden transition ${
                open === i ? 'border-brand-500/40 bg-dark-900' : 'border-dark-800 bg-dark-900/60'
              }`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left"
                aria-expanded={open === i}
              >
                <span className="font-bold text-white">{item.q}</span>
                <svg
                  width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={open === i ? '#38bdf8' : '#64748b'}
                  strokeWidth="3" strokeLinecap="round"
                  className={`flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-gray-400 text-sm leading-relaxed">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Final CTA                                                                 */
/* -------------------------------------------------------------------------- */

function FinalCTA() {
  return (
    <section className="relative py-28 overflow-hidden border-b border-dark-800/60">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-brand-500/20 rounded-full blur-[140px]" />
      </div>
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
          Stop hand-publishing.
          <br />
          <span className="bg-gradient-to-r from-brand-300 to-violet-300 bg-clip-text text-transparent">
            Start compounding.
          </span>
        </h2>
        <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
          Free forever for your first site. Pro trial unlocks unlimited sites and managed SerpAPI for 14 days.
        </p>
        <Link
          to="/signup"
          className="inline-flex items-center gap-2 bg-white text-dark-950 hover:bg-brand-400 hover:text-white font-bold px-8 py-4 rounded-xl transition shadow-2xl shadow-brand-500/30"
        >
          Create your free account
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </Link>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Footer                                                                    */
/* -------------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="py-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-2 font-black text-white">
          AmzWP<span className="text-brand-500">.</span>
          <span className="text-gray-600 font-normal">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
          <a href="#faq" className="hover:text-white transition">FAQ</a>
          <Link to="/login" search={{ redirect: '/dashboard' }} className="hover:text-white transition">Sign in</Link>
        </div>
      </div>
      <p className="text-center text-[10px] text-gray-600 mt-6 px-6">
        As an Amazon Associate we earn from qualifying purchases. Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates.
      </p>
    </footer>
  );
}
