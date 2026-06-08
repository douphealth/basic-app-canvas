import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

interface Site {
  id: string;
  name: string;
  url: string;
  status: string;
  created_at: string;
}

export const Route = createFileRoute('/dashboard/sites')({
  head: () => ({
    meta: [{ title: 'Sites — AmzWP Studio' }],
  }),
  component: SitesPage,
  errorComponent: ({ error, reset }) => (
    <div className="card-edit p-8 text-center max-w-lg mx-auto mt-10">
      <h2 className="font-display text-xl font-bold mb-2">Couldn't load sites</h2>
      <p className="text-ink-3 text-sm mb-5">{error.message}</p>
      <button onClick={reset} className="btn-primary">Retry</button>
    </div>
  ),
});

function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { supabase } = await import('../integrations/supabase/client');
    const db = supabase as any;
    const { data, error } = await db
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setSites((data as Site[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter((s) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
  }, [sites, search]);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || !url.trim()) {
      toast.error('Name and URL are required');
      return;
    }
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
    try { new URL(normalized); } catch { toast.error('Invalid URL'); return; }

    setBusy(true);
    const { supabase } = await import('../integrations/supabase/client');
    const db = supabase as any;
    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp.user?.id;
    if (!userId) { toast.error('Not authenticated'); setBusy(false); return; }

    const { error } = await db.from('sites').insert({ name: name.trim(), url: normalized, user_id: userId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setName(''); setUrl('');
    toast.success('Site added');
    load();
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this site?')) return;
    const { supabase } = await import('../integrations/supabase/client');
    const db = supabase as any;
    const { error } = await db.from('sites').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Deleted'); load();
  };

  return (
    <div className="px-5 md:px-10 py-8 md:py-12 max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-ink-4 mb-2">Connected</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">WordPress sites</h1>
          <p className="text-ink-3 mt-1.5 text-sm">Connect the WP sites you want to publish to. RLS-isolated by account.</p>
        </div>
        <div className="text-xs text-ink-4">
          <span className="font-bold text-ink">{sites.length}</span> total
        </div>
      </header>

      {/* Add form */}
      <form onSubmit={onAdd} className="card-edit p-5 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-3 items-end">
          <label className="block">
            <span className="eyebrow block mb-2">Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Affiliate Blog"
              className="input-edit"
            />
          </label>
          <label className="block">
            <span className="eyebrow block mb-2">Site URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://myblog.com"
              className="input-edit"
            />
          </label>
          <button type="submit" disabled={busy} className="btn-accent disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? 'Adding…' : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Add site
              </>
            )}
          </button>
        </div>
      </form>

      {/* Search */}
      {sites.length > 0 && (
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-4" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sites by name or URL…"
            className="input-edit pl-11"
          />
        </div>
      )}

      {/* Sites list */}
      <div className="card-edit overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[0,1,2].map((i) => <div key={i} className="h-16 skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-paper-2 border border-rule mx-auto mb-4 grid place-items-center text-ink-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18"/></svg>
            </div>
            <p className="font-display text-lg font-bold text-ink">{sites.length === 0 ? 'No sites yet' : 'No matches'}</p>
            <p className="text-sm text-ink-3 mt-1">{sites.length === 0 ? 'Add your first WordPress site above to get started.' : 'Try a different search.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {filtered.map((s) => (
              <li key={s.id} className="group flex items-center gap-4 px-5 md:px-6 py-4 hover:bg-paper-2/60 transition">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-soft to-white border border-rule grid place-items-center text-accent-2 shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink truncate">{s.name}</p>
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-ink-3 hover:text-accent-2 truncate inline-flex items-center gap-1">
                    {s.url}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M9 7h8v8"/></svg>
                  </a>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {s.status || 'active'}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  className="p-2 rounded-lg text-ink-4 hover:text-red-600 hover:bg-red-50 transition"
                  title="Delete site"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
