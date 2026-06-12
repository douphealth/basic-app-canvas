/**
 * ComparisonTablePreview | Editorial-Grade Product Comparison v10.0
 * Magazine-style layout with rich visual hierarchy, micro-interactions, and
 * smooth animations. Designed to feel premium and drive conversions.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ComparisonData, ProductDetails } from '../types';
import { toast } from 'sonner';

type HighlightBadge = 'top-pick' | 'authors-favorite' | 'best-value' | 'best-budget' | null;

interface ProductHighlight {
  badge: HighlightBadge;
  standoutSpecs: Array<{ label: string; value: string }>;
}

interface ComparisonTablePreviewProps {
  data: ComparisonData;
  products: ProductDetails[];
  affiliateTag: string;
  allProducts?: ProductDetails[];
  onUpdate?: (updatedData: ComparisonData) => void;
  editable?: boolean;
}

const BADGE_CONFIG: Record<
  NonNullable<HighlightBadge>,
  { label: string; icon: string; gradient: string; textColor: string; bgColor: string; borderColor: string; accentLight: string }
> = {
  'top-pick': {
    label: 'Top Pick',
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    gradient: 'from-blue-600 via-blue-500 to-cyan-500',
    textColor: 'text-white',
    bgColor: 'bg-gradient-to-b from-blue-50/80 to-white',
    borderColor: 'border-blue-200',
    accentLight: 'bg-blue-500',
  },
  'authors-favorite': {
    label: "Editor's Choice",
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
    textColor: 'text-white',
    bgColor: 'bg-gradient-to-b from-rose-50/80 to-white',
    borderColor: 'border-rose-200',
    accentLight: 'bg-rose-500',
  },
  'best-value': {
    label: 'Best Value',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    textColor: 'text-white',
    bgColor: 'bg-gradient-to-b from-emerald-50/80 to-white',
    borderColor: 'border-emerald-200',
    accentLight: 'bg-emerald-500',
  },
  'best-budget': {
    label: 'Best Budget',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    textColor: 'text-white',
    bgColor: 'bg-gradient-to-b from-amber-50/80 to-white',
    borderColor: 'border-amber-200',
    accentLight: 'bg-amber-500',
  },
};

const ALL_BADGES: Array<{ id: HighlightBadge; label: string }> = [
  { id: 'top-pick', label: 'Top Pick' },
  { id: 'authors-favorite', label: "Editor's Choice" },
  { id: 'best-value', label: 'Best Value' },
  { id: 'best-budget', label: 'Best Budget' },
  { id: null, label: 'No Badge' },
];

const StarRating: React.FC<{ rating: number; size?: 'sm' | 'md' }> = ({ rating, size = 'sm' }) => {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  const uid = useMemo(() => `ct-${Math.random().toString(36).slice(2, 8)}`, []);
  const cls = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: full }, (_, i) => (
        <svg key={`f${i}`} className={`${cls} text-amber-400`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
      {hasHalf && (
        <svg className={cls} viewBox="0 0 20 20">
          <defs><linearGradient id={uid}><stop offset="50%" stopColor="#fbbf24" /><stop offset="50%" stopColor="#e5e7eb" /></linearGradient></defs>
          <path fill={`url(#${uid})`} d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      )}
      {Array.from({ length: empty }, (_, i) => (
        <svg key={`e${i}`} className={`${cls} text-gray-200`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </div>
  );
};

const PrimeBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-[#232F3E] to-[#374151] text-white text-[9px] font-black uppercase tracking-wider rounded-full shadow-sm">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
    Prime
  </span>
);

const ProductPicker: React.FC<{
  availableProducts: ProductDetails[];
  onSelect: (productId: string) => void;
  onClose: () => void;
}> = ({ availableProducts, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return availableProducts;
    const q = search.toLowerCase();
    return availableProducts.filter(p => p.title.toLowerCase().includes(q) || (p.brand != null && p.brand.toLowerCase().includes(q)) || p.asin.toLowerCase().includes(q));
  }, [availableProducts, search]);

  return (
    <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden w-72 sm:w-80 max-h-80 flex flex-col" style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
      <div className="p-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" autoFocus />
      </div>
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">{availableProducts.length === 0 ? 'No products available.' : 'No matching products.'}</div>
        ) : filtered.map((p) => (
          <button key={p.id} onClick={() => onSelect(p.id)} className="w-full p-3 flex items-center gap-3 hover:bg-blue-50/60 transition-colors text-left border-b border-gray-50 last:border-0">
            {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-10 h-10 object-contain rounded-lg bg-gray-50 p-0.5 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><span className="text-gray-300 text-[8px]">IMG</span></div>}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{p.title}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-gray-500">{p.price}</span>
                {p.rating != null && <span className="text-xs text-amber-500">{"\u2605"} {p.rating.toFixed(1)}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="p-2 border-t border-gray-100 bg-gray-50 flex justify-end">
        <button onClick={onClose} className="px-4 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
      </div>
    </div>
  );
};

const SpecEditor: React.FC<{ specs: string[]; onUpdate: (specs: string[]) => void; onClose: () => void }> = ({ specs, onUpdate, onClose }) => {
  const [newSpec, setNewSpec] = useState('');
  const addSpec = () => { const t = newSpec.trim(); if (!t || specs.includes(t)) return; onUpdate([...specs, t]); setNewSpec(''); };
  return (
    <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden w-64 sm:w-72" style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
      <div className="p-4 border-b border-gray-100">
        <h4 className="text-sm font-bold text-gray-900 mb-3">Comparison Specs</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {specs.map((spec) => (
            <div key={spec} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
              <span className="text-xs font-medium text-gray-700">{spec}</span>
              <button onClick={() => onUpdate(specs.filter(x => x !== spec))} className="w-5 h-5 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="p-3 flex gap-2">
        <input type="text" value={newSpec} onChange={(e) => setNewSpec(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSpec()} placeholder="Add new spec..." className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
        <button onClick={addSpec} disabled={!newSpec.trim()} className="px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-all">Add</button>
      </div>
      <div className="p-2 border-t border-gray-100 flex justify-end">
        <button onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700">Done</button>
      </div>
    </div>
  );
};

const BadgePicker: React.FC<{ currentBadge: HighlightBadge; onSelect: (badge: HighlightBadge) => void; onClose: () => void }> = ({ currentBadge, onSelect, onClose }) => (
  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden w-52" style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
    <div className="p-2 border-b border-gray-100"><h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-2 py-1">Set Badge</h4></div>
    <div className="p-2 space-y-1">
      {ALL_BADGES.map((b) => (
        <button key={b.id ?? 'none'} onClick={() => { onSelect(b.id); onClose(); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${currentBadge === b.id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 hover:bg-gray-50'}`}>
          {b.id != null ? (
            <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${BADGE_CONFIG[b.id].gradient} flex items-center justify-center`}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={BADGE_CONFIG[b.id].icon} /></svg>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-md bg-gray-200 flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </div>
          )}
          <span>{b.label}</span>
          {currentBadge === b.id && <svg className="ml-auto w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12l5 5L20 7" /></svg>}
        </button>
      ))}
    </div>
  </div>
);

const StandoutSpecEditor: React.FC<{
  specs: Array<{ label: string; value: string }>;
  onUpdate: (specs: Array<{ label: string; value: string }>) => void;
  onClose: () => void;
}> = ({ specs, onUpdate, onClose }) => {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const addSpec = () => { if (!label.trim() || !value.trim()) return; if (specs.length >= 2) { toast('Maximum 2 standout specs'); return; } onUpdate([...specs, { label: label.trim(), value: value.trim() }]); setLabel(''); setValue(''); };
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden w-64 sm:w-72" style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
      <div className="p-4 border-b border-gray-100">
        <h4 className="text-sm font-bold text-gray-900 mb-1">Standout Specs</h4>
        <p className="text-[10px] text-gray-400">Up to 2 highlight specs</p>
      </div>
      {specs.length > 0 && (
        <div className="p-3 space-y-2 border-b border-gray-100">
          {specs.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200/60 rounded-xl">
              <div><span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">{s.label}</span><span className="text-xs font-semibold text-gray-700 ml-2">{s.value}</span></div>
              <button onClick={() => onUpdate(specs.filter((_, j) => j !== i))} className="w-5 h-5 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {specs.length < 2 && (
        <div className="p-3 space-y-2">
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Spec name" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs placeholder-gray-400 focus:outline-none focus:border-amber-400" />
          <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" onKeyDown={(e) => e.key === 'Enter' && addSpec()} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs placeholder-gray-400 focus:outline-none focus:border-amber-400" />
          <button onClick={addSpec} disabled={!label.trim() || !value.trim()} className="w-full px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-all">Add Spec</button>
        </div>
      )}
      <div className="p-2 border-t border-gray-100 flex justify-end"><button onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700">Done</button></div>
    </div>
  );
};

const ScoreBar: React.FC<{ value: number; max?: number; color?: string }> = ({ value, max = 5, color = 'bg-blue-500' }) => {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export const ComparisonTablePreview: React.FC<ComparisonTablePreviewProps> = ({
  data,
  products,
  affiliateTag,
  allProducts,
  onUpdate,
  editable = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [showSpecEditor, setShowSpecEditor] = useState(false);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [badgePickerFor, setBadgePickerFor] = useState<string | null>(null);
  const [standoutEditorFor, setStandoutEditorFor] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Record<string, ProductHighlight>>({});

  const finalTag = (affiliateTag || 'tag-20').trim();

  const sortedProducts = useMemo(
    () => data.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as ProductDetails[],
    [data.productIds, products],
  );

  const addableProducts = useMemo(() => {
    const inTable = new Set(data.productIds);
    return (allProducts || products).filter((p) => !inTable.has(p.id));
  }, [allProducts, products, data.productIds]);

  const handleAddProduct = useCallback((productId: string) => {
    if (data.productIds.includes(productId)) { toast('Product already in comparison'); return; }
    onUpdate?.({ ...data, productIds: [...data.productIds, productId] });
    setShowPicker(false);
    toast('Product added');
  }, [data, onUpdate]);

  const handleRemoveProduct = useCallback((productId: string) => {
    if (data.productIds.length <= 2) { toast('Need at least 2 products'); return; }
    const newIds = data.productIds.filter((id) => id !== productId);
    onUpdate?.({ ...data, productIds: newIds, winnerId: data.winnerId === productId ? newIds[0] : data.winnerId });
    setHighlights((prev) => { const next = { ...prev }; delete next[productId]; return next; });
    toast('Product removed');
  }, [data, onUpdate]);

  const handleMoveProduct = useCallback((productId: string, direction: -1 | 1) => {
    const idx = data.productIds.indexOf(productId);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= data.productIds.length) return;
    const newIds = [...data.productIds];
    [newIds[idx], newIds[newIdx]] = [newIds[newIdx], newIds[idx]];
    onUpdate?.({ ...data, productIds: newIds });
  }, [data, onUpdate]);

  const handleSetBadge = useCallback((productId: string, badge: HighlightBadge) => {
    if (badge != null) onUpdate?.({ ...data, winnerId: productId });
    setHighlights((prev) => ({ ...prev, [productId]: { ...(prev[productId] || { badge: null, standoutSpecs: [] }), badge } }));
    setBadgePickerFor(null);
    if (badge != null) toast(`Badge: ${BADGE_CONFIG[badge].label}`);
  }, [data, onUpdate]);

  const handleUpdateStandoutSpecs = useCallback((productId: string, specs: Array<{ label: string; value: string }>) => {
    setHighlights((prev) => ({ ...prev, [productId]: { ...(prev[productId] || { badge: null, standoutSpecs: [] }), standoutSpecs: specs } }));
  }, []);

  const handleUpdateSpecs = useCallback((newSpecs: string[]) => { onUpdate?.({ ...data, specs: newSpecs }); }, [data, onUpdate]);
  const handleUpdateTitle = useCallback((newTitle: string) => { onUpdate?.({ ...data, title: newTitle }); }, [data, onUpdate]);

  const customSpecs = (data.specs || []).filter(s => !['rating', 'reviews', 'price', 'prime'].includes(s.toLowerCase()));

  const getSpecValue = (product: ProductDetails, spec: string): React.ReactNode => {
    const key = spec.toLowerCase();
    if (key === 'rating') return <StarRating rating={product.rating || 0} />;
    if (key === 'reviews') return <span className="font-semibold text-gray-700">{(product.reviewCount || 0).toLocaleString()}</span>;
    if (key === 'price') return <span className="text-base font-black text-gray-900">{product.price}</span>;
    if (key === 'prime') return product.prime ? <PrimeBadge /> : <span className="text-gray-400 text-xs">N/A</span>;
    const val = product.specs != null ? product.specs[spec] : undefined;
    if (val != null) return <span className="font-semibold text-gray-700">{val}</span>;
    return <span className="text-gray-300">{"\u2014"}</span>;
  };

  if (sortedProducts.length === 0) {
    return (
      <div className="w-full max-w-[1100px] mx-auto my-10 p-10 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </div>
        <p className="text-gray-500 font-bold mb-1">No products in comparison</p>
        <p className="text-gray-400 text-sm mb-5">Add products to create a side-by-side comparison</p>
        {editable && onUpdate && (
          <div className="relative inline-block">
            <button onClick={() => setShowPicker(true)} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">Add Products</button>
            {showPicker && <ProductPicker availableProducts={addableProducts} onSelect={handleAddProduct} onClose={() => setShowPicker(false)} />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1100px] mx-auto my-8 sm:my-12 font-sans antialiased px-3 sm:px-0">
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .comparison-card { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .comparison-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.12); }
        .comparison-card .product-image { transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .comparison-card:hover .product-image { transform: scale(1.08); }
        .cta-button { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.2); }
        .cta-button:active { transform: translateY(0); }
        .spec-row { transition: background-color 0.15s ease; }
        .spec-row:hover { background-color: rgba(249, 250, 251, 0.8); }
      `}</style>

      {/* Title Section */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1.5 mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Product Comparison</span>
        </div>
        {editable && onUpdate ? (
          <input type="text" value={data.title} onChange={(e) => handleUpdateTitle(e.target.value)} className="block mx-auto bg-transparent text-gray-900 font-black text-xl sm:text-2xl lg:text-3xl tracking-tight border-none outline-none text-center w-full max-w-lg placeholder-gray-300 focus:ring-0" placeholder="Enter comparison title..." />
        ) : (
          <h3 className="text-gray-900 font-black text-xl sm:text-2xl lg:text-3xl tracking-tight">{data.title}</h3>
        )}
        <p className="text-gray-400 text-sm mt-2">{sortedProducts.length} products compared side by side</p>
      </div>

      {/* Editor Toolbar */}
      {editable && onUpdate && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="relative">
            <button onClick={() => { setShowPicker(!showPicker); setShowSpecEditor(false); }} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-gray-300 hover:shadow-sm transition-all">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Add Product
            </button>
            {showPicker && <ProductPicker availableProducts={addableProducts} onSelect={handleAddProduct} onClose={() => setShowPicker(false)} />}
          </div>
          <div className="relative">
            <button onClick={() => { setShowSpecEditor(!showSpecEditor); setShowPicker(false); }} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-gray-300 hover:shadow-sm transition-all">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
              Edit Specs
            </button>
            {showSpecEditor && <SpecEditor specs={data.specs || []} onUpdate={handleUpdateSpecs} onClose={() => setShowSpecEditor(false)} />}
          </div>
        </div>
      )}

      {/* Product Cards Grid */}
      <div className="grid gap-4 sm:gap-5" style={{ gridTemplateColumns: `repeat(${Math.min(sortedProducts.length, 4)}, 1fr)` }}>
        {sortedProducts.map((p, idx) => {
          const highlight = highlights[p.id] || { badge: null, standoutSpecs: [] };
          const badgeCfg = highlight.badge != null ? BADGE_CONFIG[highlight.badge] : null;
          const isHighlighted = badgeCfg != null;
          const isHovered = hoveredCol === p.id;

          return (
            <div
              key={p.id}
              className={`comparison-card relative rounded-2xl sm:rounded-3xl border overflow-hidden ${
                isHighlighted
                  ? `${badgeCfg.bgColor} ${badgeCfg.borderColor} shadow-lg`
                  : 'bg-white border-gray-200 shadow-sm hover:border-gray-300'
              }`}
              onMouseEnter={() => setHoveredCol(p.id)}
              onMouseLeave={() => { setHoveredCol(null); setBadgePickerFor(null); setStandoutEditorFor(null); }}
            >
              {/* Top accent bar */}
              {isHighlighted && (
                <div className={`h-1 bg-gradient-to-r ${badgeCfg.gradient}`} />
              )}

              {/* Badge ribbon */}
              {isHighlighted && (
                <div className="flex justify-center pt-3 pb-0">
                  <span className={`inline-flex items-center gap-1.5 bg-gradient-to-r ${badgeCfg.gradient} ${badgeCfg.textColor} text-[9px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full shadow-md`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={badgeCfg.icon} /></svg>
                    {badgeCfg.label}
                  </span>
                </div>
              )}

              {/* Edit controls */}
              {editable && onUpdate && isHovered && (
                <div className="absolute top-2 right-2 z-20 flex flex-col gap-1" style={{ animation: 'fadeSlideIn 0.15s ease-out' }}>
                  <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setBadgePickerFor(badgePickerFor === p.id ? null : p.id); setStandoutEditorFor(null); }} className="w-7 h-7 rounded-lg bg-white/90 border border-gray-200 text-amber-500 hover:bg-amber-50 flex items-center justify-center transition-all shadow-sm backdrop-blur-sm" title="Set badge">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    </button>
                    {badgePickerFor === p.id && <BadgePicker currentBadge={highlight.badge} onSelect={(b) => handleSetBadge(p.id, b)} onClose={() => setBadgePickerFor(null)} />}
                  </div>
                  {isHighlighted && (
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setStandoutEditorFor(standoutEditorFor === p.id ? null : p.id); setBadgePickerFor(null); }} className="w-7 h-7 rounded-lg bg-white/90 border border-gray-200 text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-all shadow-sm backdrop-blur-sm" title="Standout specs">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                      {standoutEditorFor === p.id && <StandoutSpecEditor specs={highlight.standoutSpecs} onUpdate={(s) => handleUpdateStandoutSpecs(p.id, s)} onClose={() => setStandoutEditorFor(null)} />}
                    </div>
                  )}
                  {idx > 0 && (
                    <button onClick={() => handleMoveProduct(p.id, -1)} className="w-7 h-7 rounded-lg bg-white/90 border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center transition-all shadow-sm backdrop-blur-sm" title="Move left">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 19l-7-7 7-7" /></svg>
                    </button>
                  )}
                  {idx < sortedProducts.length - 1 && (
                    <button onClick={() => handleMoveProduct(p.id, 1)} className="w-7 h-7 rounded-lg bg-white/90 border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center transition-all shadow-sm backdrop-blur-sm" title="Move right">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                  )}
                  <button onClick={() => handleRemoveProduct(p.id)} className="w-7 h-7 rounded-lg bg-white/90 border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm backdrop-blur-sm" title="Remove">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              {/* Product content */}
              <div className="p-5 sm:p-6">
                {/* Product Image */}
                <div className="h-36 sm:h-40 flex items-center justify-center mb-5 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-gray-50/50 to-transparent rounded-2xl" />
                  {p.imageUrl ? (
                    <img src={p.imageUrl} className="product-image relative max-h-full max-w-[80%] object-contain drop-shadow-lg" alt={p.title} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center"><span className="text-gray-300 text-xs">No image</span></div>
                  )}
                </div>

                {/* Brand */}
                {p.brand && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{p.brand}</p>
                )}

                {/* Title */}
                <h4 className="text-sm font-bold text-gray-900 leading-snug mb-3 line-clamp-2 min-h-[40px]">{p.title}</h4>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  <StarRating rating={p.rating || 0} size="md" />
                  <span className="text-xs font-bold text-gray-900">{(p.rating || 0).toFixed(1)}</span>
                  <span className="text-[10px] text-gray-400">({(p.reviewCount || 0).toLocaleString()})</span>
                </div>

                {/* Rating visual bar */}
                <div className="mb-4">
                  <ScoreBar value={p.rating || 0} color={isHighlighted ? badgeCfg!.accentLight : 'bg-gray-900'} />
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">{p.price}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {p.prime && <PrimeBadge />}
                    {!p.prime && <span className="text-[10px] text-gray-400 font-medium">Standard shipping</span>}
                  </div>
                </div>

                {/* Standout specs */}
                {highlight.standoutSpecs.length > 0 && (
                  <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    {highlight.standoutSpecs.map((s, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{s.label}</span>
                        <span className="text-xs font-bold text-gray-900">{s.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA Button */}
                <a
                  href={`https://www.amazon.com/dp/${p.asin}?tag=${finalTag}`}
                  target="_blank"
                  rel="nofollow sponsored noopener"
                  className={`cta-button flex items-center justify-center w-full gap-2 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-md ${
                    isHighlighted && badgeCfg != null
                      ? `bg-gradient-to-r ${badgeCfg.gradient} text-white`
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" /></svg>
                  Check Amazon Price
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M7 17l9.2-9.2M17 17V8H8" /></svg>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Spec Comparison Table */}
      {customSpecs.length > 0 && (
        <div className="mt-8 bg-white border border-gray-200 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider">Detailed Specifications</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-5 text-left text-[10px] font-black uppercase tracking-wider text-gray-400 w-[140px]">Spec</th>
                  {sortedProducts.map((p) => (
                    <th key={p.id} className="py-3 px-4 text-center">
                      <span className="text-[10px] font-bold text-gray-500 truncate block max-w-[120px] mx-auto">{p.title.split(' ').slice(0, 3).join(' ')}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customSpecs.map((spec, sIdx) => (
                  <tr key={spec} className={`spec-row border-b border-gray-50 last:border-0 ${sIdx % 2 === 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="py-3.5 px-5 text-xs font-bold text-gray-500 uppercase tracking-wide">{spec}</td>
                    {sortedProducts.map((p) => {
                      const hl = highlights[p.id];
                      const isHl = hl != null && hl.badge != null;
                      const cfg = isHl ? BADGE_CONFIG[hl.badge!] : null;
                      return (
                        <td key={p.id} className={`py-3.5 px-4 text-center text-sm ${isHl ? 'bg-gradient-to-b from-transparent to-transparent' : ''}`}>
                          {isHl && <div className={`absolute inset-0 ${cfg!.bgColor} opacity-30`} />}
                          <span className="relative">{getSpecValue(p, spec)}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {sortedProducts.some((p) => p.prime) && (
                  <tr className="spec-row border-t border-gray-100">
                    <td className="py-3.5 px-5 text-xs font-bold text-gray-500 uppercase tracking-wide">Shipping</td>
                    {sortedProducts.map((p) => (
                      <td key={p.id} className="py-3.5 px-4 text-center">
                        {p.prime ? <div className="flex justify-center"><PrimeBadge /></div> : <span className="text-gray-400 text-xs">Standard</span>}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between px-2">
        <p className="text-[10px] text-gray-400">Prices and availability subject to change. Last updated today.</p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Live Prices</span>
        </div>
      </div>
    </div>
  );
};

export default ComparisonTablePreview;
