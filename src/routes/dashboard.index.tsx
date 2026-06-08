import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';

export const Route = createFileRoute('/dashboard/')({
  head: () => ({
    meta: [{ title: 'Overview — AmzWP Studio' }],
  }),
  component: DashboardHome,
  errorComponent: ({ error, reset }) => (
    <div className="card-edit p-8 text-center max-w-lg mx-auto mt-10">
      <h2 className="font-display text-xl font-bold mb-2">Couldn't load overview</h2>
      <p className="text-ink-3 text-sm mb-5">{error.message}</p>
      <button onClick={reset} className="btn-primary">Retry</button>
    </div>
  ),
});

function DashboardHome() {
  const [stats, setStats] = useState({ sites: 0, posts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { supabase } = await import('../integrations/supabase/client');
      const db = supabase as any;
      const [sites, posts] = await Promise.all([
        db.from('sites').select('id', { count: 'exact', head: true }),
        db.from('generated_blog_posts').select('id', { count: 'exact', head: true }),
      ]);
      if (cancelled) return;
      setStats({
        sites: sites.error ? 0 : sites.count ?? 0,
        posts: posts.error ? 0 : posts.count ?? 0,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const onboardingComplete = stats.sites > 0 && stats.posts > 0;

  return (
    <div className="px-5 md:px-10 py-8 md:py-12 max-w-6xl mx-auto space-y-10 animate-fade-in-up">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-rule bg-white">
        <div className="absolute inset-0 bg-dotted opacity-60 pointer-events-none" />
        <div className="absolute -top-24 -right-16 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative px-7 md:px-12 py-10 md:py-14">
          <div className="eyebrow text-accent-2 mb-3">Welcome back</div>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-ink leading-[1.05]">
            Your affiliate studio,<br/>
            <span className="gradient-text">precision-engineered.</span>
          </h1>
          <p className="mt-4 max-w-xl text-ink-3 text-[15px] leading-relaxed">
            Connect WordPress sites, scan for monetization gaps, and ship pixel-perfect Amazon
            product boxes — anywhere in any post, in a single click.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/dashboard/generator" className="btn-accent">
              Open generator
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link to="/dashboard/sites" className="btn-ghost">Manage sites</Link>
            <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-ink-4">
              <span className="kbd">⌘</span><span className="kbd">K</span>
              <span>quick actions</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="WordPress sites" value={stats.sites} loading={loading} accent="bg-accent" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18"/></svg>} />
        <StatCard label="Generated posts" value={stats.posts} loading={loading} accent="bg-ink" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>} />
        <StatCard label="Auto-refreshes" value={0} loading={loading} hint="Pro · coming soon" accent="bg-emerald-500" muted icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>} />
      </section>

      {/* Onboarding */}
      {!onboardingComplete && (
        <section className="card-edit p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="eyebrow text-ink-4 mb-1">Get set up</div>
              <h2 className="font-display text-xl md:text-2xl font-bold text-ink">Ship your first published post</h2>
              <p className="text-sm text-ink-3 mt-1">Two steps. About five minutes.</p>
            </div>
            <div className="text-xs font-bold text-accent-2 bg-accent-soft border border-accent/20 px-3 py-1.5 rounded-full">
              {[stats.sites > 0, stats.posts > 0].filter(Boolean).length} / 2
            </div>
          </div>
          <div className="space-y-3">
            <ChecklistItem done={stats.sites > 0} title="Connect a WordPress site" desc="Add the site you want to publish to." href="/dashboard/sites" cta="Add site" step={1} />
            <ChecklistItem done={stats.posts > 0} title="Generate your first post" desc="Open the generator and run your first scan." href="/dashboard/generator" cta="Open generator" step={2} />
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          title="Manage WordPress sites"
          desc="Add, remove, or configure the sites you publish to."
          to="/dashboard/sites"
          cta="Manage sites"
        />
        <ActionCard
          title="Open the generator"
          desc="Scan a sitemap and ship Amazon-affiliate content."
          to="/dashboard/generator"
          cta="Open generator"
          highlight
        />
      </section>

      <footer className="pt-6 border-t border-rule text-[11px] text-ink-4 flex items-center justify-between flex-wrap gap-2">
        <span>AmzWP Studio · v2.0 Editorial</span>
        <span>Crafted for affiliate publishers</span>
      </footer>
    </div>
  );
}

function StatCard({
  label, value, loading, hint, icon, accent, muted,
}: { label: string; value: number; loading: boolean; hint?: string; icon: ReactNode; accent: string; muted?: boolean }) {
  return (
    <div className={`card-edit p-6 ${muted ? 'opacity-80' : ''}`}>
      <div className="flex items-start justify-between mb-5">
        <p className="eyebrow">{label}</p>
        <div className={`w-9 h-9 rounded-xl ${accent} ${muted ? 'opacity-50' : ''} text-white grid place-items-center shadow-sm`}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div className="h-10 w-24 skeleton" />
      ) : (
        <p className="font-display text-4xl font-bold tracking-tight text-ink">{value.toLocaleString()}</p>
      )}
      {hint && <p className="text-[11px] text-ink-4 mt-2 font-semibold">{hint}</p>}
    </div>
  );
}

function ChecklistItem({
  done, title, desc, href, cta, step,
}: { done: boolean; title: string; desc: string; href: '/dashboard/sites' | '/dashboard/generator'; cta: string; step: number }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition ${
      done ? 'bg-emerald-50 border-emerald-200' : 'bg-paper border-rule hover:border-rule-strong'
    }`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
        done ? 'bg-emerald-500 text-white' : 'bg-white border border-rule text-ink-3'
      }`}>
        {done ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12l5 5L20 7" /></svg>
        ) : (
          step
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm ${done ? 'text-ink-3 line-through' : 'text-ink'}`}>{title}</p>
        <p className="text-xs text-ink-3">{desc}</p>
      </div>
      {!done && (
        <Link to={href} className="btn-primary !py-2 !px-4 !text-xs flex-shrink-0">{cta}</Link>
      )}
    </div>
  );
}

function ActionCard({
  title, desc, to, cta, highlight,
}: { title: string; desc: string; to: '/dashboard/sites' | '/dashboard/generator'; cta: string; highlight?: boolean }) {
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-2xl p-7 border transition ${
        highlight
          ? 'bg-ink text-white border-ink hover:shadow-[0_30px_60px_-30px_rgba(15,23,42,.6)]'
          : 'bg-white border-rule hover:border-rule-strong hover:shadow-[var(--shadow-pop)]'
      }`}
    >
      {highlight && (
        <div className="absolute -top-20 -right-10 w-72 h-72 bg-accent/30 rounded-full blur-3xl pointer-events-none" />
      )}
      <div className="relative">
        <div className={`eyebrow mb-3 ${highlight ? 'text-accent' : 'text-ink-4'}`}>{highlight ? 'Primary action' : 'Workspace'}</div>
        <h3 className={`font-display text-2xl font-bold mb-2 tracking-tight ${highlight ? 'text-white' : 'text-ink'}`}>{title}</h3>
        <p className={`text-sm mb-6 max-w-md ${highlight ? 'text-white/70' : 'text-ink-3'}`}>{desc}</p>
        <span className={`inline-flex items-center gap-2 text-sm font-bold ${highlight ? 'text-white' : 'text-accent-2'}`}>
          {cta}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="group-hover:translate-x-1 transition-transform">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
