/**
 * ============================================================================
 * PostEditor | SOTA Visual Content Editor v6.0
 * ============================================================================
 * Enterprise-Grade Features:
 * - Precision Product Detection Engine (6-layer pipeline with fallback)
 * - Flexible Comparison Tables (add / delete / reorder / edit specs)
 * - Visual Block Editor with Drag & Drop Reordering
 * - Undo / Redo with Full History Stack
 * - Auto-Save to localStorage (30s interval)
 * - Smart Product Placement (contextual relevance scoring)
 * - Manual ASIN / URL Product Addition
 * - Dual View: Visual Architect + Code Matrix
 * - Keyboard Shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
 * - Real-time Scan Progress with Stage Indicator
 * - Accessibility-first with Reduced Motion support
 * ============================================================================
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';

import {
  BlogPost,
  ProductDetails,
  AppConfig,
  DeploymentMode,
  ComparisonData,
} from '../types';

import {
  pushToWordPress,
  fetchRawPostContent,
  analyzeContentAndFindProduct,
  splitContentIntoBlocks,
  IntelligenceCache,
  generateProductBoxHtml,
  wrapWithProductBoxStyles,
  generateComparisonTableHtml,
  lookupAsin,
  hasProductLookup,
  missingProductLookupMessage,
  calculatePostPriority,
  sanitizeAppConfig,
} from '../utils';
import { extractPalette } from '../lib/html/palette';
import { splitHtmlPreservingShell } from '../lib/html/structure';

import { ProductBoxPreview } from './ProductBoxPreview';
import { PremiumProductBox } from './PremiumProductBox';
import { ProductCarousel } from './ProductCarousel';
import { ComparisonTablePreview } from './ComparisonTablePreview';
import { BlockInserter } from './BlockInserter';
import { useHistory } from '../hooks/useHistory';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { toast } from 'sonner';
import { preserveHtmlStructure, sanitizeHtml } from '../lib/sanitize';

const CONTENT_PROXY_URL = 'https://wybpgjcrmdcvnnltodgx.supabase.co/functions/v1/content-proxy';

async function verifyAsinViaProxy(asin: string): Promise<{ ok: boolean; status: number; reason: string; finalUrl: string | null }> {
  if (!/^[A-Z0-9]{10}$/i.test(asin)) {
    return { ok: false, status: 0, reason: 'invalid_format', finalUrl: null };
  }
  try {
    const resp = await fetch(`${CONTENT_PROXY_URL}?url=${encodeURIComponent(`https://www.amazon.com/dp/${asin.toUpperCase()}`)}`, {
      headers: { Accept: 'text/html, */*' },
    });
    const proxiedStatus = parseInt(resp.headers.get('X-Proxied-Status') || '0', 10);
    const finalUrl = resp.headers.get('X-Proxied-Url') || null;
    const looksLikeProductPage = finalUrl ? (/\/(dp|gp\/product)\/[A-Z0-9]{10}/i.test(finalUrl) || finalUrl.includes(`/${asin.toUpperCase()}`)) : false;

    if (proxiedStatus === 503) return { ok: true, status: 503, reason: 'amazon_throttled_assumed_ok', finalUrl };
    if (proxiedStatus >= 200 && proxiedStatus < 400 && looksLikeProductPage) return { ok: true, status: proxiedStatus, reason: 'verified', finalUrl };
    if (proxiedStatus === 404) return { ok: false, status: 404, reason: 'not_found', finalUrl };
    return { ok: false, status: proxiedStatus, reason: looksLikeProductPage ? 'bad_status' : 'redirected_off_product', finalUrl };
  } catch (err: any) {
    return { ok: false, status: 0, reason: err?.name === 'AbortError' ? 'timeout' : 'network_error', finalUrl: null };
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_INTERVAL_MS = 30_000;
const AUTO_SAVE_KEY_PREFIX = 'amzwp_autosave_';
const MIN_GAP_BETWEEN_PRODUCTS = 3;
const MAX_AUTO_PLACED_PRODUCTS = 4;

// ============================================================================
// LOCAL TYPES
// ============================================================================

interface PostEditorProps {
  post: BlogPost;
  config: AppConfig;
  onBack: () => void;
  allPosts?: BlogPost[];
}

interface EditorNode {
  id: string;
  type: 'HTML' | 'PRODUCT' | 'COMPARISON';
  content?: string;
  productId?: string;
  comparisonData?: ComparisonData;
}

interface HtmlShell {
  prefix: string;
  suffix: string;
}

interface ScanProgress {
  stage: string;
  current: number;
  total: number;
  message?: string;
  serpApiCallsUsed?: number;
  serpApiCallBudget?: number;
  candidatesEvaluated?: number;
  productsKept?: number;
  skipped?: number;
  skippedItems?: Array<{ name: string; reason: string; detail?: string }>;
}

interface ScanReportSummary {
  serpApiCallsUsed: number;
  serpApiCallBudget: number;
  budgetExhausted: boolean;
  serpApiRetries: number;
  productsKept: number;
  candidatesEvaluated: number;
  skipped: Array<{ name: string; reason: string; detail?: string }>;
}

type EditorStatus = 'idle' | 'fetching' | 'analyzing' | 'pushing' | 'error';
type ViewTab = 'visual' | 'code';

// ============================================================================
// PRECISION DETECTOR (Dynamic Import With Fallback)
// ============================================================================

/**
 * Attempt to load the Precision Product Detection Engine.
 * If the module hasn't been created yet, returns null
 * and the editor falls back to the legacy analyzeContentAndFindProduct.
 */
async function tryPrecisionDetect(
  title: string,
  html: string,
  config: AppConfig,
  onProgress?: (stage: string, current: number, total: number) => void,
): Promise<{
  products: ProductDetails[];
  comparison?: ComparisonData;
  contentType: string;
  candidateCount: number;
} | null> {
  try {
    const mod = await import('../utils/precision-detector');
    return await mod.detectProductsPrecision(title, html, config, { onProgress });
  } catch {
    // Module doesn't exist or precision scan threw — fall back to legacy
    return null;
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Real-time scan progress bar shown during analysis */
const ScanProgressOverlay: React.FC<{ progress: ScanProgress | null }> = ({ progress }) => {
  if (!progress) return null;
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="mt-4 space-y-2 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest truncate max-w-[240px]">
          {progress.stage}
        </span>
        <span className="text-[10px] font-black text-brand-400">{pct}%</span>
      </div>
      <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const ScanTelemetryPanel: React.FC<{
  progress: ScanProgress | null;
  report: ScanReportSummary | null;
}> = ({ progress, report }) => {
  const skipped = progress?.skippedItems?.length ? progress.skippedItems : report?.skipped || [];
  const callsUsed = progress?.serpApiCallsUsed ?? report?.serpApiCallsUsed ?? 0;
  const budget = progress?.serpApiCallBudget ?? report?.serpApiCallBudget ?? 0;
  const remaining = Math.max(0, budget - callsUsed);

  if (!progress && !report) return null;

  return (
    <div className="mt-4 rounded-[24px] border border-dark-700 bg-dark-950/70 p-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-dark-800 bg-dark-900 px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-gray-500">Calls used</p>
          <p className="mt-2 text-lg font-black text-white">{callsUsed}</p>
        </div>
        <div className="rounded-2xl border border-dark-800 bg-dark-900 px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-gray-500">Remaining</p>
          <p className="mt-2 text-lg font-black text-white">{remaining}</p>
        </div>
        <div className="rounded-2xl border border-dark-800 bg-dark-900 px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-gray-500">Skipped</p>
          <p className="mt-2 text-lg font-black text-white">{progress?.skipped ?? report?.skipped.length ?? 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-dark-800 bg-dark-900 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-gray-500">Live skip log</p>
          {report?.budgetExhausted && <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">Budget reached</span>}
        </div>
        {skipped.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">No products skipped yet.</p>
        ) : (
          <div className="mt-3 max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {skipped.map((item, index) => (
              <div key={`${item.name}-${item.reason}-${index}`} className="rounded-xl border border-dark-800 bg-dark-950 px-3 py-2">
                <p className="truncate text-xs font-bold text-white">{item.name}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-brand-400">{item.reason.replace(/_/g, ' ')}</p>
                {item.detail && <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{item.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Small badge showing product count in header area */
const ProductCountBadge: React.FC<{ placed: number; total: number }> = ({ placed, total }) => (
  <div className="flex items-center gap-1.5 bg-dark-800/70 px-3 py-1 rounded-full">
    <span className="text-brand-400 text-[10px] font-black">{placed}/{total}</span>
    <span className="text-dark-500 text-[9px] font-bold">placed</span>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PostEditor: React.FC<PostEditorProps> = ({ post, config, onBack }) => {
  const normalizedConfig = useMemo(() => sanitizeAppConfig(config), [config]);
  // ========================================================================
  // STATE
  // ========================================================================

  const {
    state: editorNodes,
    set: setEditorNodes,
    undo,
    redo,
    canUndo,
    canRedo,
    historyLength,
    reset: resetHistory,
  } = useHistory<EditorNode[]>([]);

  const [productMap, setProductMap] = useState<Record<string, ProductDetails>>({});
  const [currentId, setCurrentId] = useState<number>(post.id);
  const [status, setStatus] = useState<EditorStatus>('idle');
  const [viewTab, setViewTab] = useState<ViewTab>('visual');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [manualAsin, setManualAsin] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanReport, setScanReport] = useState<ScanReportSummary | null>(null);

  const prefersReducedMotion = useReducedMotion();
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSaveRef = useRef<number>(0);
  const relevanceCache = useRef<Map<string, number>>(new Map());
  const editedHtmlNodesRef = useRef<Set<string>>(new Set());
  const canvasRef = useRef<HTMLDivElement>(null);
  const htmlShellRef = useRef<HtmlShell>({ prefix: '', suffix: '' });

  // ========================================================================
  // DRAG & DROP
  // ========================================================================

  const { dragState, getDragProps, getDropProps } = useDragAndDrop<EditorNode>(
    editorNodes,
    (reorderedNodes) => setEditorNodes(reorderedNodes),
  );

  // ========================================================================
  // KEYBOARD SHORTCUTS
  // ========================================================================

  useKeyboardShortcuts(
    {
      'ctrl+z': () => { if (canUndo) { undo(); toast('Undo', { duration: 1200, style: { background: '#0ea5e9' } }); } },
      'meta+z': () => { if (canUndo) { undo(); toast('Undo', { duration: 1200, style: { background: '#0ea5e9' } }); } },
      'ctrl+shift+z': () => { if (canRedo) { redo(); toast('Redo', { duration: 1200, style: { background: '#0ea5e9' } }); } },
      'meta+shift+z': () => { if (canRedo) { redo(); toast('Redo', { duration: 1200, style: { background: '#0ea5e9' } }); } },
      'ctrl+y': () => { if (canRedo) { redo(); toast('Redo', { duration: 1200, style: { background: '#0ea5e9' } }); } },
    },
    { ignoreInputs: true },
  );

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setStatus('fetching');

      try {
        const result = await fetchRawPostContent(normalizedConfig, post.id, post.url || '');
        if (!mounted) return;

        if (!result.content || result.content.length < 10) {
          throw new Error('No content received from WordPress API');
        }

        setCurrentId(result.resolvedId);

        // Hydrate from cache
        let initialProducts = post.activeProducts || [];
        const contentHash = `v3_${post.title}_${result.content.length}`;
        const cached = IntelligenceCache.getAnalysis(contentHash);
        let initialComparison: ComparisonData | undefined;

        if (cached) {
          if (initialProducts.length === 0) initialProducts = cached.products;
          if (cached.comparison) initialComparison = cached.comparison;
        }

        const pMap: Record<string, ProductDetails> = {};
        initialProducts.forEach((p) => (pMap[p.id] = p));
        if (!mounted) return;
        setProductMap(pMap);

        // Build nodes
        const shell = splitHtmlPreservingShell(result.content);
        htmlShellRef.current = { prefix: shell.prefix, suffix: shell.suffix };
        const rawBlocks = shell.blocks.length > 0 ? shell.blocks : splitContentIntoBlocks(result.content);
        if (rawBlocks.length === 0) throw new Error('Failed to parse content into blocks');

        const nodes: EditorNode[] = rawBlocks.map((block, idx) => ({
          id: `block-${Date.now()}-${idx}`,
          type: 'HTML' as const,
          content: block,
        }));

        // Place cached products
        const placedProducts = initialProducts
          .filter((p) => p.insertionIndex > -1)
          .sort((a, b) => a.insertionIndex - b.insertionIndex);

        let offset = 0;
        placedProducts.forEach((p) => {
          const target = Math.min(p.insertionIndex + offset, nodes.length);
          nodes.splice(target, 0, { id: `prod-node-${p.id}`, type: 'PRODUCT', productId: p.id });
          offset++;
        });

        if (initialComparison) {
          nodes.splice(1, 0, {
            id: `comp-table-${Date.now()}`,
            type: 'COMPARISON',
            comparisonData: initialComparison,
          });
        }

        if (!mounted) return;
        resetHistory(nodes);
        setStatus('idle');
      } catch (e: any) {
        if (!mounted) return;
        setStatus('error');
        toast(`Failed to load content: ${e.message}`);
      }
    };

    init();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  // ========================================================================
  // AUTO-SAVE
  // ========================================================================

  const saveToLocalStorage = useCallback(() => {
    try {
      const state = { editorNodes, productMap, timestamp: Date.now() };
      localStorage.setItem(`${AUTO_SAVE_KEY_PREFIX}${post.id}`, JSON.stringify(state));
      lastSaveRef.current = Date.now();
    } catch {
      toast.warning('Auto-save failed — storage quota exceeded. Consider clearing old data.', { duration: 5000 });
    }
  }, [editorNodes, productMap, post.id]);

  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (editorNodes.length > 0) saveToLocalStorage();
    }, AUTO_SAVE_INTERVAL_MS);
    return () => { if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current); };
  }, [editorNodes, productMap, saveToLocalStorage]);

  // ========================================================================
  // RELEVANCE ENGINE (Memoized)
  // ========================================================================

  const calculateRelevance = useCallback((text: string, product: ProductDetails): number => {
    const cacheKey = `${text.slice(0, 100)}_${product.id}`;
    if (relevanceCache.current.has(cacheKey)) return relevanceCache.current.get(cacheKey)!;

    const clean = text.toLowerCase();
    let score = 0;

    // Exact mention match (highest weight)
    if (product.exactMention) {
      const words = product.exactMention.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const ratio = words.length > 0 ? words.filter((w) => clean.includes(w)).length / words.length : 0;
      if (ratio > 0.7) score += 1000;
    }

    if (clean.includes(product.title.toLowerCase())) score += 100;

    const brand = product.brand?.toLowerCase();
    if (brand && clean.includes(brand)) score += 50;

    product.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3).forEach((w) => {
      if (clean.includes(w)) score += 10;
    });

    if (text.length < 50 && score < 50) score -= 10;

    relevanceCache.current.set(cacheKey, score);
    // LRU eviction: delete least-recently-inserted entries when over limit
    if (relevanceCache.current.size > 1000) {
      // Map iterates in insertion order; delete oldest half
      const iterator = relevanceCache.current.keys();
      for (let i = 0; i < 500; i++) {
        const key = iterator.next().value;
        if (key) relevanceCache.current.delete(key);
      }
    }

    return score;
  }, []);

  // ========================================================================
  // PLACEMENT HELPERS
  // ========================================================================

  const findBestInsertionIndex = useCallback(
    (product: ProductDetails, snapshot: EditorNode[]): number => {
      if (typeof product.paragraphIndex === 'number' && product.paragraphIndex >= 0) {
        let htmlCount = 0;
        for (let i = 0; i < snapshot.length; i++) {
          if (snapshot[i].type === 'HTML') {
            if (htmlCount === product.paragraphIndex) return i + 1;
            htmlCount++;
          }
        }
      }

      let bestIdx = 0;
      let maxScore = -1;
      snapshot.forEach((node, idx) => {
        if (node.type === 'HTML' && node.content) {
          const score = calculateRelevance(node.content, product);
          if (score > maxScore) { maxScore = score; bestIdx = idx; }
        }
      });
      return bestIdx + 1;
    },
    [calculateRelevance],
  );

  const getUnplacedProducts = useCallback((): ProductDetails[] => {
    const placedIds = new Set(editorNodes.filter((n) => n.type === 'PRODUCT').map((n) => n.productId));
    return Object.values(productMap).filter((p) => !placedIds.has(p.id));
  }, [editorNodes, productMap]);

  // Precompute relevance-sorted unplaced products per node index.
  // Avoids O(N * P log P) recomputation on every hover/render of the
  // injection menu — calculateRelevance runs once per (node, product)
  // pair per editorNodes/productMap change instead of per render.
  const contextualByIndex = useMemo(() => {
    const unplaced = getUnplacedProducts();
    const map = new Map<number, ProductDetails[]>();
    editorNodes.forEach((node, idx) => {
      if (node.type !== 'HTML' || !node.content) {
        map.set(idx, unplaced);
        return;
      }
      const content = node.content;
      map.set(
        idx,
        [...unplaced].sort(
          (a, b) => calculateRelevance(content, b) - calculateRelevance(content, a),
        ),
      );
    });
    return map;
  }, [editorNodes, getUnplacedProducts, calculateRelevance]);

  const getContextualProducts = useCallback(
    (nodeIndex: number): ProductDetails[] => contextualByIndex.get(nodeIndex) ?? [],
    [contextualByIndex],
  );

  // Derived counts
  const placedCount = useMemo(
    () => editorNodes.filter((n) => n.type === 'PRODUCT').length,
    [editorNodes],
  );
  const totalProducts = Object.keys(productMap).length;
  const unplacedProducts = useMemo(() => getUnplacedProducts(), [getUnplacedProducts]);

  // ========================================================================
  // PRODUCT INJECTION
  // ========================================================================

  const injectProduct = useCallback(
    (productId: string, index: number) => {
      const newNode: EditorNode = { id: `prod-node-${productId}-${Date.now()}`, type: 'PRODUCT', productId };
      const next = [...editorNodes];
      next.splice(index, 0, newNode);
      setEditorNodes(next);
      toast('Asset Injected to Canvas');
    },
    [editorNodes, setEditorNodes],
  );

  const smartInjectProduct = useCallback(
    (productId: string) => {
      const product = productMap[productId];
      if (!product) return;
      const target = findBestInsertionIndex(product, editorNodes);
      injectProduct(productId, target);
      toast(`Auto-Placed: ${product.title.substring(0, 25)}…`, { style: { background: '#0ea5e9' } });
    },
    [productMap, editorNodes, findBestInsertionIndex, injectProduct],
  );

  const handleAutoPopulate = useCallback(() => {
    const toPlace = getUnplacedProducts();
    if (toPlace.length === 0) { toast('All Assets Already Deployed'); return; }

    const availableSlots = Math.max(0, MAX_AUTO_PLACED_PRODUCTS - editorNodes.filter((n) => n.type === 'PRODUCT').length);
    if (availableSlots === 0) {
      toast('Product limit reached for this article. Remove one before adding more.');
      return;
    }

    let newNodes = [...editorNodes];
    let injected = 0;

    const getOccupied = (nodes: EditorNode[]): Set<number> => {
      const zones = new Set<number>();
      nodes.forEach((n, i) => {
        if (n.type === 'PRODUCT' || n.type === 'COMPARISON') {
          for (let g = Math.max(0, i - MIN_GAP_BETWEEN_PRODUCTS); g <= Math.min(nodes.length - 1, i + MIN_GAP_BETWEEN_PRODUCTS); g++) {
            zones.add(g);
          }
        }
      });
      return zones;
    };

    const sorted = [...toPlace].sort((a, b) => {
      const ai = a.paragraphIndex ?? Infinity;
      const bi = b.paragraphIndex ?? Infinity;
      return ai !== bi ? bi - ai : (b.confidence ?? 0) - (a.confidence ?? 0);
    }).slice(0, availableSlots);

    sorted.forEach((p) => {
      const occupied = getOccupied(newNodes);
      let bestIdx = -1;
      let maxScore = -1;

      // Try paragraph index first
      if (typeof p.paragraphIndex === 'number' && p.paragraphIndex >= 0) {
        let htmlCount = 0;
        for (let i = 0; i < newNodes.length; i++) {
          if (newNodes[i].type === 'HTML') {
            if (htmlCount === p.paragraphIndex) {
              if (!occupied.has(i)) { bestIdx = i; maxScore = 10000; }
              else {
                for (let off = 1; off <= 4; off++) {
                  if (i + off < newNodes.length && !occupied.has(i + off) && newNodes[i + off]?.type === 'HTML') { bestIdx = i + off; maxScore = 9000; break; }
                  if (i - off >= 0 && !occupied.has(i - off) && newNodes[i - off]?.type === 'HTML') { bestIdx = i - off; maxScore = 9000; break; }
                }
              }
              break;
            }
            htmlCount++;
          }
        }
      }

      // Fallback: content matching
      if (maxScore < 9000) {
        newNodes.forEach((node, idx) => {
          if (node.type === 'HTML' && node.content && !occupied.has(idx)) {
            let score = calculateRelevance(node.content, p);
            const len = node.content.replace(/<[^>]+>/g, '').trim().length;
            if (len < 30) score -= 50;
            if (len > 200) score += 15;
            if (score > maxScore) { maxScore = score; bestIdx = idx; }
          }
        });
      }

      if (bestIdx >= 0 && maxScore > 0) {
        newNodes.splice(bestIdx + 1, 0, {
          id: `prod-node-${p.id}-${Date.now()}-${injected}`,
          type: 'PRODUCT',
          productId: p.id,
        });
        injected++;
      }
    });

    setEditorNodes(newNodes);
    toast(
      injected === toPlace.length
        ? `All ${injected} products placed`
        : `${injected}/${toPlace.length} placed (${toPlace.length - injected} need manual placement)`,
      { style: { background: '#0ea5e9' }, duration: 4000 },
    );
  }, [editorNodes, getUnplacedProducts, calculateRelevance, setEditorNodes]);

  // ========================================================================
  // DEEP SCAN (Precision Detection with Legacy Fallback)
  // ========================================================================

  const runDeepScan = useCallback(async () => {
    setStatus('analyzing');
    setScanProgress({ stage: 'Initializing scan…', current: 0, total: 6 });
    setScanReport(null);

    try {
      if (!config.aiProvider) throw new Error('AI provider not configured. Please configure AI settings.');

      const currentHtml = editorNodes
        .filter((n) => n.type === 'HTML')
        .map((n) => n.content || '')
        .join('\n\n');

      if (!currentHtml || currentHtml.trim().length < 50) {
        throw new Error('Insufficient content for analysis. Ensure the full article is loaded.');
      }

      // 1. Try Precision Detection Engine
      const precisionResult = await tryPrecisionDetect(
        post.title,
        currentHtml,
        normalizedConfig,
        (stage, current, total) => setScanProgress({ stage, current, total }),
      );

      let products: ProductDetails[] = [];
      let comparison: ComparisonData | undefined;
      let candidateCount = 0;
      let verificationUnavailable = false;
      let likelyInformationalArticle = false;

      if (precisionResult && precisionResult.products.length > 0) {
        products = precisionResult.products;
        comparison = precisionResult.comparison;
        candidateCount = precisionResult.candidateCount;
      } else {
        // 2. Fallback to legacy scan
        setScanProgress({ stage: 'Falling back to legacy scan…', current: 3, total: 6 });
        const legacy = await analyzeContentAndFindProduct(post.title, currentHtml, normalizedConfig, {
          onProgress: (event) => {
            setScanProgress((prev) => ({
              stage: event.stage,
              current: prev?.current ?? 4,
              total: prev?.total ?? 6,
              message: event.message,
              serpApiCallsUsed: event.serpApiCallsUsed,
              serpApiCallBudget: event.serpApiCallBudget,
              candidatesEvaluated: event.candidatesEvaluated,
              productsKept: event.productsKept,
              skipped: event.skipped,
              skippedItems: event.skippedItems,
            }));
          },
        });
        products = legacy.detectedProducts;
        comparison = legacy.comparison;
        candidateCount = legacy.scanReport?.candidatesEvaluated ?? products.length;
        setScanReport(
          legacy.scanReport
            ? {
                serpApiCallsUsed: legacy.scanReport.serpApiCallsUsed,
                serpApiCallBudget: legacy.scanReport.serpApiCallBudget,
                budgetExhausted: legacy.scanReport.budgetExhausted,
                serpApiRetries: legacy.scanReport.serpApiRetries,
                productsKept: legacy.scanReport.productsKept,
                candidatesEvaluated: legacy.scanReport.candidatesEvaluated,
                skipped: legacy.scanReport.skipped.map((item) => ({
                  name: item.name,
                  reason: item.reason,
                  detail: item.detail,
                })),
              }
            : null,
        );
        verificationUnavailable =
          !!legacy.scanReport?.skipped.some((item) =>
            ['serpapi_proxy_unavailable', 'serpapi_lookup_unavailable'].includes(item.reason),
          );
        const priorityAssessment = calculatePostPriority(post.title, currentHtml);
        likelyInformationalArticle =
          !verificationUnavailable &&
          products.length === 0 &&
          priorityAssessment.priority === 'low' &&
          ((legacy.scanReport?.candidatesEvaluated ?? 0) === 0 ||
            !!legacy.scanReport?.skipped.every((item) =>
              item.reason === 'invalid_query' || item.detail?.includes('editorial heading'),
            ));
      }

      // 3. Merge results into product map — dedupe by ASIN (or normalized title
      //    when no ASIN is present) so re-running the scan never inserts the
      //    same product under a fresh ID.
      if (products.length > 0) {
        const newMap = { ...productMap };
        const keyOf = (p: ProductDetails) =>
          (p.asin ? `asin:${p.asin.toUpperCase()}` : `title:${(p.title || '').trim().toLowerCase()}`);
        const existingByKey = new Map<string, string>();
        Object.values(newMap).forEach((p) => existingByKey.set(keyOf(p), p.id));

        let added = 0;
        let merged = 0;
        products.forEach((p) => {
          const k = keyOf(p);
          const existingId = existingByKey.get(k);
          if (existingId) {
            // Refresh metadata on the existing ID — keep the same node binding.
            newMap[existingId] = { ...newMap[existingId], ...p, id: existingId };
            merged++;
          } else {
            newMap[p.id] = p;
            existingByKey.set(k, p.id);
            added++;
          }
        });
        setProductMap(newMap);

        const label = added === 0
          ? `${merged} product${merged === 1 ? '' : 's'} refreshed (no new matches)`
          : merged > 0
            ? `${added} new, ${merged} refreshed (from ${candidateCount} candidates)`
            : candidateCount > added
              ? `${added} products verified (from ${candidateCount} candidates)`
              : `${added} products found`;
        toast(`Precision Scan: ${label}`, { style: { background: '#0ea5e9' }, duration: 4000 });
      } else {
        const contentLen = currentHtml.replace(/<[^>]+>/g, '').trim().length;

        if (contentLen < 200) toast('Content too short for product detection.', { duration: 5000 });
        else if (!hasProductLookup(config)) toast(missingProductLookupMessage(config), { duration: 6000 });
        else if (verificationUnavailable) {
          toast('Amazon verification is temporarily unavailable. The scan completed, but no products could be verified right now.', {
            duration: 7000,
          });
        } else if (likelyInformationalArticle) {
          toast('This article reads as informational, not product-led, so the scanner skipped weak Amazon matches.', {
            duration: 6000,
          });
        } else {
          toast('No Amazon-verifiable products found. Try adding manually via ASIN.', { duration: 5000 });
        }
      }

      // 4. Inject comparison table if detected
      if (comparison) {
        const alreadyHas = editorNodes.some((n) => n.type === 'COMPARISON');
        if (!alreadyHas) {
          const next = [...editorNodes];
          next.splice(1, 0, {
            id: `comp-table-${Date.now()}`,
            type: 'COMPARISON',
            comparisonData: comparison,
          });
          setEditorNodes(next);
          toast('Comparison Table Added', { style: { background: '#0ea5e9' } });
        }
      }
    } catch (e: any) {
      const msg = (e.message || 'Unknown error').substring(0, 120);
      const isSerpErr = msg.includes('SerpAPI');
      toast(isSerpErr ? msg : `Scan Failed: ${msg}`, {
        duration: 8000,
        style: isSerpErr ? { background: '#dc2626' } : undefined,
      });
    } finally {
      setStatus('idle');
      setScanProgress(null);
    }
  }, [editorNodes, normalizedConfig, post.title, productMap, setEditorNodes]);

  // ========================================================================
  // NODE MANIPULATION
  // ========================================================================

  const deleteNode = useCallback(
    (id: string) => {
      setEditorNodes((prev) => prev.filter((n) => n.id !== id));
      toast('Block Removed');
    },
    [setEditorNodes],
  );

  const moveNode = useCallback(
    (index: number, direction: -1 | 1) => {
      const next = [...editorNodes];
      const target = index + direction;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      setEditorNodes(next);
    },
    [editorNodes, setEditorNodes],
  );

  const updateHtmlNode = useCallback(
    (id: string, newContent: string) => {
      setEditorNodes((prev) => prev.map((n) => (n.id === id ? { ...n, content: newContent } : n)));
    },
    [setEditorNodes],
  );

  const cleanImagesFromBlock = useCallback(
    (id: string) => {
      const node = editorNodes.find((n) => n.id === id);
      if (!node?.content) return;
      updateHtmlNode(id, node.content.replace(/<img[^>]*>/g, ''));
      toast('Images Purged from Block');
    },
    [editorNodes, updateHtmlNode],
  );

  const updateProductMode = useCallback(
    (productId: string, mode: DeploymentMode) => {
      setProductMap((prev) => ({ ...prev, [productId]: { ...prev[productId], deploymentMode: mode } }));
    },
    [],
  );

  const removeProduct = useCallback(
    (productId: string) => {
      setEditorNodes((prev) => prev.filter((n) => !(n.type === 'PRODUCT' && n.productId === productId)));
      setProductMap((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      toast('Product Removed');
    },
    [setEditorNodes],
  );

  /** Update comparison data inline when user edits the table */
  const updateComparisonData = useCallback(
    (nodeId: string, updatedData: ComparisonData) => {
      setEditorNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, comparisonData: updatedData } : n)),
      );
    },
    [setEditorNodes],
  );

  // ========================================================================
  // MANUAL ASIN ADDITION
  // ========================================================================

  const extractASIN = (input: string): string | null => {
    const t = input.trim();
    if (/^[A-Z0-9]{10}$/i.test(t)) return t.toUpperCase();
    const patterns = [
      /amazon\.[a-z.]+\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})/i,
      /\/dp\/([A-Z0-9]{10})/i,
      /\/product\/([A-Z0-9]{10})/i,
      /[?&]ASIN=([A-Z0-9]{10})/i,
      /\/([A-Z0-9]{10})(?:\/|\?|$)/i,
    ];
    for (const p of patterns) {
      const m = t.match(p);
      if (m?.[1] && /^[A-Z0-9]{10}$/.test(m[1].toUpperCase())) return m[1].toUpperCase();
    }
    return null;
  };

  /**
   * Core add-by-ASIN-or-URL routine. Reused by manual sidebar input,
   * the inline BlockInserter, and the contentEditable paste handler.
   * If insertAtIndex is provided, the new product is also injected
   * into the canvas at that position.
   */
  const addProductByAsinOrUrl = useCallback(
    async (input: string, insertAtIndex?: number): Promise<ProductDetails | null> => {
      const asin = extractASIN(input);
      if (!asin) { toast('Invalid ASIN or Amazon URL.'); return null; }
      if (!hasProductLookup(config)) { toast(missingProductLookupMessage(config)); return null; }

      // Already in staging? Just inject.
      const existing = Object.values(productMap).find((p) => p.asin === asin);
      if (existing) {
        if (typeof insertAtIndex === 'number') {
          const next = [...editorNodes];
          next.splice(insertAtIndex, 0, {
            id: `prod-node-${existing.id}-${Date.now()}`,
            type: 'PRODUCT',
            productId: existing.id,
          });
          setEditorNodes(next);
          toast(`Inserted: ${existing.title.substring(0, 40)}…`);
        } else {
          toast('Product already in staging');
        }
        return existing;
      }

      setAddingProduct(true);
      try {
        const reach = await verifyAsinViaProxy(asin);
        if (!reach.ok) {
          const msg =
            reach.reason === 'not_found' ? `ASIN ${asin} returns 404 on amazon.com — not a real product.` :
            reach.reason === 'invalid_format' ? `ASIN ${asin} is not a valid Amazon ID format.` :
            reach.reason === 'timeout' ? 'Amazon reachability check timed out. Try again.' :
            reach.reason === 'redirected_off_product' ? `ASIN ${asin} redirected away from a product page.` :
            `ASIN ${asin} could not be verified on Amazon (${reach.reason}).`;
          toast(msg, { duration: 6000 });
          return null;
        }

        const product = await lookupAsin(asin, config);
        if (!product?.asin) {
          toast('ASIN reachable on Amazon, but no product metadata returned.');
          return null;
        }

        setProductMap((prev) => ({ ...prev, [product.id]: product }));

        if (typeof insertAtIndex === 'number') {
          const next = [...editorNodes];
          next.splice(insertAtIndex, 0, {
            id: `prod-node-${product.id}-${Date.now()}`,
            type: 'PRODUCT',
            productId: product.id,
          });
          setEditorNodes(next);
          toast(`Inserted: ${product.title.substring(0, 40)}…`);
        } else {
          toast(`Added & verified: ${product.title.substring(0, 40)}…`);
        }

        return product;
      } catch (e: any) {
        const m = e?.message || 'Unknown error';
        if (m.includes('timeout')) toast('Request timed out. Try again.');
        else if (m.includes('401')) toast('Invalid API credentials (SerpAPI or PA-API).');
        else if (m.includes('429')) toast('Rate limit exceeded. Wait and retry.');
        else toast(`Error: ${m.substring(0, 80)}`);
        return null;
      } finally {
        setAddingProduct(false);
      }
    },
    [config, productMap, editorNodes, setEditorNodes],
  );

  const handleAddManualProduct = useCallback(async () => {
    const product = await addProductByAsinOrUrl(manualAsin);
    if (product) setManualAsin('');
  }, [manualAsin, addProductByAsinOrUrl]);

  /**
   * Paste handler on contentEditable HTML blocks.
   * If user pastes a string containing an Amazon URL / ASIN, intercept it
   * and insert a product box right after this block instead of pasting text.
   */
  const handleEditableBlockPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>, blockIndex: number) => {
      const text = e.clipboardData.getData('text/plain').trim();
      if (!text) return;
      const asin = extractASIN(text);
      if (!asin) return; // let normal paste happen
      e.preventDefault();
      toast('Amazon URL detected — fetching product…');
      void addProductByAsinOrUrl(text, blockIndex + 1);
    },
    [addProductByAsinOrUrl],
  );

  // ========================================================================
  // HTML GENERATION & PUBLISH
  // ========================================================================

  const generateFinalHtml = useCallback((): string => {
    // Collect the raw post HTML separately so we can sample its colors and
    // theme the product boxes to match the surrounding article.
    const htmlOnly: string[] = [];
    const body = editorNodes
      .map((node) => {
        if (node.type === 'HTML') {
          const h = preserveHtmlStructure(node.content || '');
          htmlOnly.push(h);
          return h;
        }
        if (node.type === 'PRODUCT' && node.productId && productMap[node.productId]) {
          return generateProductBoxHtml(
            productMap[node.productId],
            config.amazonTag,
            productMap[node.productId].deploymentMode,
          );
        }
        if (node.type === 'COMPARISON' && node.comparisonData) {
          return generateComparisonTableHtml(
            node.comparisonData,
            Object.values(productMap),
            config.amazonTag,
          );
        }
        return '';
      })
      .join('\n\n');

    const hasBoxes = editorNodes.some(
      (n) => (n.type === 'PRODUCT' && n.productId && productMap[n.productId]) ||
        (n.type === 'COMPARISON' && n.comparisonData),
    );
    const wrappedBody = `${htmlShellRef.current.prefix}${body}${htmlShellRef.current.suffix}`;
    if (!hasBoxes) return wrappedBody;

    // Derive a palette from the post's own HTML so every product box adopts
    // the blog's brand color automatically. Safe-fail: undefined keeps defaults.
    const palette = extractPalette(htmlOnly.join('\n'));
    return wrapWithProductBoxStyles(wrappedBody, palette);
  }, [editorNodes, productMap, config.amazonTag]);

  const handlePush = useCallback(async () => {
    setStatus('pushing');
    try {
      const html = generateFinalHtml();
      const link = await pushToWordPress(normalizedConfig, currentId, html);
      toast('Production Sync Successful');
      window.open(link, '_blank');
    } catch (e: any) {
      toast(e.message?.substring(0, 100) || 'Push failed', { duration: 5000 });
    } finally {
      setStatus('idle');
    }
  }, [generateFinalHtml, normalizedConfig, currentId]);

  // ========================================================================
  // RENDER
  // ========================================================================

  const isWorking = status !== 'idle';

  return (
    <div className="flex h-full bg-dark-950 flex-col md:flex-row overflow-hidden animate-fade-in font-sans">

      {/* ================================================================== */}
      {/* LEFT CONTROL PANEL                                                 */}
      {/* ================================================================== */}
      <div className="w-full md:w-[420px] bg-[#0b1121] border-r border-dark-800 flex flex-col h-full z-40 shadow-[10px_0_30px_rgba(0,0,0,0.3)]">

        {/* ---- HEADER ---- */}
        <div className="p-8 border-b border-dark-800 bg-dark-950/50 backdrop-blur-md">
          <button
            onClick={onBack}
            className="text-gray-500 text-[10px] font-black uppercase tracking-[4px] hover:text-white transition-all flex items-center gap-3 group mb-6"
          >
            <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform" /> Return to Command
          </button>

          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-white tracking-tight">
              Assets <span className="text-brand-500">deck</span>
            </h1>

            <div className="flex gap-2 items-center">
              <ProductCountBadge placed={placedCount} total={totalProducts} />

              {/* Undo / Redo */}
              <div className="flex items-center gap-1 bg-dark-800/50 rounded-full px-2 py-1">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${canUndo ? 'hover:bg-dark-700 text-white' : 'text-dark-600 cursor-not-allowed'}`}
                  title="Undo (Ctrl+Z)"
                >
                  <i className="fa-solid fa-rotate-left text-xs" />
                </button>
                <span className="text-[10px] font-bold text-dark-500 min-w-[2ch] text-center">{historyLength}</span>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${canRedo ? 'hover:bg-dark-700 text-white' : 'text-dark-600 cursor-not-allowed'}`}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <i className="fa-solid fa-rotate-right text-xs" />
                </button>
              </div>

              <button
                onClick={() => { IntelligenceCache.clear(); window.location.reload(); }}
                className="w-8 h-8 rounded-full bg-dark-800 hover:bg-red-500/20 text-gray-400 hover:text-red-500 flex items-center justify-center transition-all"
                title="Clear Cache"
              >
                <i className="fa-solid fa-trash-can text-xs" />
              </button>
            </div>
          </div>
        </div>

        {/* ---- SCROLLABLE CONTENT ---- */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">

          {/* ---- PRECISION SCAN CARD ---- */}
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-900/20 to-dark-900 border border-brand-500/20 p-8 group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 blur-[60px] rounded-full" />
            <h3 className="text-brand-400 font-black uppercase tracking-[4px] text-[11px] mb-2">Precision Intelligence</h3>
            <p className="text-slate-400 text-xs mb-4 leading-relaxed">
              6-layer detection: structural → NLP → contextual → AI → cross-validation → Amazon verification.
            </p>

            <button
              onClick={runDeepScan}
              disabled={isWorking}
              className="w-full py-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {status === 'analyzing' ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-bolt" />}
              <span>{status === 'analyzing' ? 'Scanning…' : 'Precision Scan'}</span>
            </button>

            <ScanProgressOverlay progress={scanProgress} />
            <ScanTelemetryPanel progress={scanProgress} report={scanReport} />
          </div>

          {/* ---- MANUAL ADD CARD ---- */}
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-orange-900/20 to-dark-900 border border-orange-500/20 p-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-[60px] rounded-full" />
            <h3 className="text-orange-400 font-black uppercase tracking-[4px] text-[11px] mb-2">Manual Add</h3>
            <p className="text-slate-400 text-xs mb-4 leading-relaxed">Add any Amazon product by ASIN or URL.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualAsin}
                onChange={(e) => setManualAsin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddManualProduct()}
                placeholder="ASIN or Amazon URL"
                className="flex-1 px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white text-xs placeholder-dark-500 focus:outline-none focus:border-orange-500 transition-all"
              />
              <button
                onClick={handleAddManualProduct}
                disabled={addingProduct || !manualAsin.trim()}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {addingProduct ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-plus" />}
              </button>
            </div>
          </div>

          {/* ---- STAGING AREA ---- */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-gray-500 font-black uppercase tracking-[4px] text-[10px]">Staging Area</h3>
              <span className="bg-dark-800 text-gray-400 px-3 py-1 rounded-full text-[10px] font-bold">
                {unplacedProducts.length}
              </span>
            </div>

            <div className="space-y-4">
              {unplacedProducts.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-dark-800 rounded-3xl text-center">
                  <div className="text-dark-700 mb-2 text-2xl"><i className="fa-brands fa-dropbox" /></div>
                  <div className="text-dark-600 text-[10px] font-black uppercase tracking-widest">Queue Empty</div>
                </div>
              ) : (
                unplacedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="bg-dark-900 border border-dark-700 p-4 rounded-2xl flex items-center gap-4 group hover:border-brand-500 transition-all"
                  >
                    {p.imageUrl && (
                      <img src={p.imageUrl} className="w-12 h-12 object-contain bg-white rounded-lg p-1" alt="" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-sm truncate">{p.title}</div>
                      <div className="text-brand-400 text-[10px] font-black tracking-wider">{p.price}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => smartInjectProduct(p.id)}
                        className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform hover:bg-white hover:text-brand-600"
                        title="Smart Auto-Inject"
                      >
                        <i className="fa-solid fa-wand-magic-sparkles text-xs" />
                      </button>
                      <button
                        onClick={() => removeProduct(p.id)}
                        className="w-8 h-8 rounded-full bg-dark-800 text-gray-500 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                        title="Remove Product"
                      >
                        <i className="fa-solid fa-times text-xs" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ---- DEPLOY BUTTON ---- */}
        <div className="p-8 bg-dark-950 border-t border-dark-800">
          <button
            onClick={handlePush}
            disabled={isWorking}
            className="w-full py-6 bg-white text-dark-950 rounded-[20px] font-black uppercase tracking-[4px] text-sm shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {status === 'pushing' ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-cloud-arrow-up" />}
            <span>Deploy Live</span>
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* RIGHT VISUAL ARCHITECT                                             */}
      {/* ================================================================== */}
      <div className="flex-1 bg-slate-50 relative flex flex-col h-full overflow-hidden">

        {/* ---- FLOATING TOOLBAR ---- */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
          {/* View Toggles */}
          <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-full p-1.5 flex gap-2">
            {(['visual', 'code'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewTab(v)}
                className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[3px] transition-all ${
                  viewTab === v ? 'bg-dark-950 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
              >
                {v === 'visual' ? 'Visual Architect' : 'Code Matrix'}
              </button>
            ))}
          </div>

          {/* Auto-Deploy */}
          <button
            onClick={handleAutoPopulate}
            disabled={unplacedProducts.length === 0}
            className="h-[46px] px-8 bg-brand-600 text-white rounded-full text-[10px] font-black uppercase tracking-[3px] shadow-2xl hover:bg-brand-500 hover:scale-105 disabled:opacity-50 disabled:scale-100 transition-all flex items-center gap-2"
            title="Automatically place ALL products based on context"
          >
            <i className="fa-solid fa-wand-magic-sparkles" /> Auto-Deploy All
          </button>

          {/* Insert Carousel */}
          {Object.keys(productMap).length >= 2 && (
            <button
              onClick={() => {
                // Group all products into a carousel node at the best position
                const allProducts = Object.values(productMap);
                const carouselNode: EditorNode = {
                  id: `carousel-${Date.now()}`,
                  type: 'PRODUCT' as const,
                  productId: `__carousel__${allProducts.map(p => p.id).join(',')}`,
                };
                const next = [...editorNodes];
                // Find first product node position or insert after first HTML block
                const firstProdIdx = next.findIndex(n => n.type === 'PRODUCT');
                const insertAt = firstProdIdx >= 0 ? firstProdIdx : Math.min(2, next.length);
                // Remove existing product nodes
                const cleaned = next.filter(n => n.type !== 'PRODUCT');
                cleaned.splice(insertAt, 0, carouselNode);
                setEditorNodes(cleaned);
                toast('Carousel created with all products!');
              }}
              className="h-[46px] px-6 bg-violet-600 text-white rounded-full text-[10px] font-black uppercase tracking-[3px] shadow-2xl hover:bg-violet-500 hover:scale-105 transition-all flex items-center gap-2"
              title="Group all products into a swipeable carousel"
            >
              <i className="fa-solid fa-layer-group" /> Carousel
            </button>
          )}
        </div>

        {/* ---- CANVAS ---- */}
        <div ref={canvasRef} className="flex-1 overflow-y-auto overflow-x-hidden p-8 md:p-20 custom-scrollbar">
          {viewTab === 'visual' ? (
            <div className="max-w-[1000px] mx-auto min-h-screen bg-white rounded-[60px] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.08)] border border-slate-100 p-12 md:p-24 relative">

              {/* Document Title */}
              <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-16 leading-tight border-b border-slate-100 pb-10">
                {post.title}
              </h1>

              <div className="space-y-4">
                {editorNodes.map((node, index) => {
                  const isDragged = dragState.isDragging && dragState.draggedItemId === node.id;
                  const isDropTarget = dragState.dropTargetId === node.id;

                  return (
                    <div
                      key={node.id}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      {...getDropProps(node.id)}
                      className={`relative group/node transition-all duration-300 rounded-[32px] border-2 ${
                        isDragged
                          ? 'opacity-40 scale-[0.98]'
                          : hoveredNode === node.id
                          ? 'border-brand-100 bg-brand-50/10'
                          : isDropTarget
                          ? 'border-indigo-300 bg-indigo-50/10'
                          : 'border-transparent'
                      }`}
                    >

                      {/* ---- DROP ZONE INDICATOR (above) ---- */}
                      {isDropTarget && dragState.dropPosition === 'before' && (
                        <div className="absolute -top-3 inset-x-0 h-1.5 bg-indigo-500 rounded-full z-30 animate-pulse" />
                      )}

                      {/* ---- FLOATING BLOCK CONTROLS ---- */}
                      <div
                        className={`absolute -right-14 top-4 flex flex-col gap-2 transition-all duration-300 z-30 ${
                          hoveredNode === node.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
                        }`}
                      >
                        {/* Drag Handle */}
                        <div
                          {...getDragProps(node.id, node.type === 'PRODUCT' ? 'product' : 'block')}
                          className="w-10 h-10 rounded-full bg-white text-slate-400 hover:text-indigo-500 shadow-xl border border-slate-100 flex items-center justify-center cursor-grab active:cursor-grabbing transition-all hover:scale-110"
                          title="Drag to reorder"
                        >
                          <i className="fa-solid fa-grip-vertical text-xs" />
                        </div>
                        <button onClick={() => moveNode(index, -1)} className="w-10 h-10 rounded-full bg-white text-slate-400 hover:text-brand-500 shadow-xl border border-slate-100 flex items-center justify-center transition-all hover:scale-110" title="Move Up"><i className="fa-solid fa-arrow-up text-xs" /></button>
                        <button onClick={() => moveNode(index, 1)} className="w-10 h-10 rounded-full bg-white text-slate-400 hover:text-brand-500 shadow-xl border border-slate-100 flex items-center justify-center transition-all hover:scale-110" title="Move Down"><i className="fa-solid fa-arrow-down text-xs" /></button>
                        <button onClick={() => deleteNode(node.id)} className="w-10 h-10 rounded-full bg-white text-slate-400 hover:text-red-500 shadow-xl border border-slate-100 flex items-center justify-center transition-all hover:scale-110" title="Delete"><i className="fa-solid fa-trash-can text-xs" /></button>

                        {node.type === 'HTML' && node.content && /<img/.test(node.content) && (
                          <button onClick={() => cleanImagesFromBlock(node.id)} className="w-10 h-10 rounded-full bg-white text-orange-400 hover:text-orange-600 shadow-xl border border-slate-100 flex items-center justify-center transition-all hover:scale-110" title="Remove Images"><i className="fa-solid fa-image text-xs" /></button>
                        )}
                      </div>

                      {/* ---- NODE TYPE BADGE ---- */}
                      {node.type !== 'HTML' && hoveredNode === node.id && (
                        <div className="absolute -left-14 top-4 z-30">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg ${
                            node.type === 'PRODUCT' ? 'bg-brand-600 text-white' : 'bg-purple-600 text-white'
                          }`}>
                            {node.type === 'PRODUCT' ? '📦 Product' : '📊 Table'}
                          </span>
                        </div>
                      )}

                     {/* ---- RENDER NODE CONTENT ---- */}
<div className="p-2 md:p-6">
  {node.type === 'HTML' ? (
    <div
      className="prose prose-xl prose-slate max-w-none focus:outline-none focus:ring-2 focus:ring-brand-100 rounded-xl p-2 transition-all"
      contentEditable
      suppressContentEditableWarning
      onInput={() => { editedHtmlNodesRef.current.add(node.id); }}
      onPaste={(e) => handleEditableBlockPaste(e, index)}
      onBlur={(e) => {
        if (!editedHtmlNodesRef.current.has(node.id)) return;
        editedHtmlNodesRef.current.delete(node.id);
        updateHtmlNode(node.id, preserveHtmlStructure(e.currentTarget.innerHTML));
      }}
      dangerouslySetInnerHTML={{ __html: preserveHtmlStructure(node.content || '') }}
    />
  ) : node.type === 'COMPARISON' && node.comparisonData ? (
    <ComparisonTablePreview
      data={node.comparisonData}
      products={Object.values(productMap)}
      affiliateTag={config.amazonTag}
      allProducts={Object.values(productMap)}
      editable={true}
      onUpdate={(updatedData) => {
        setEditorNodes((prev) =>
          prev.map((n) =>
            n.id === node.id
              ? { ...n, comparisonData: updatedData }
              : n
          )
        );
      }}
    />
  ) : node.productId?.startsWith('__carousel__') ? (
    /* ── Carousel Mode ── */
    <div className="relative">
      <ProductCarousel
        products={node.productId.replace('__carousel__', '').split(',').map(id => productMap[id]).filter(Boolean)}
        affiliateTag={config.amazonTag}
        mode={productMap[Object.keys(productMap)[0]]?.deploymentMode}
        variant={config.boxStyle === 'PREMIUM' ? 'production' : 'preview'}
      />
    </div>
  ) : node.productId && productMap[node.productId] ? (
    <div className="relative">
      {config.boxStyle === 'PREMIUM' ? (
        <PremiumProductBox
          product={productMap[node.productId]}
          affiliateTag={config.amazonTag}
          mode={productMap[node.productId].deploymentMode}
        />
      ) : (
        <ProductBoxPreview
          product={productMap[node.productId]}
          affiliateTag={config.amazonTag}
          mode={productMap[node.productId].deploymentMode}
        />
      )}

      {/* Product Mode Switcher */}
      {hoveredNode === node.id && (
        <div className="absolute top-6 right-6 flex gap-3 z-30 animate-fade-in">
          {(['ELITE_BENTO', 'TACTICAL_LINK'] as DeploymentMode[]).map((m) => (
            <button
              key={m}
              onClick={() => updateProductMode(node.productId!, m)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg transition-all ${
                productMap[node.productId!]?.deploymentMode === m
                  ? 'bg-dark-950 text-white'
                  : 'bg-white text-slate-500'
              }`}
            >
              {m === 'ELITE_BENTO' ? 'Bento' : 'Tactical'}
            </button>
          ))}
        </div>
      )}
    </div>
  ) : (
    <div className="p-8 bg-red-50 text-red-400 font-mono text-xs text-center border border-red-100 rounded-2xl">
      Asset Data Missing — Product may have been removed
    </div>
  )}
</div>


                      {/* ---- DROP ZONE INDICATOR (below) ---- */}
                      {isDropTarget && dragState.dropPosition === 'after' && (
                        <div className="absolute -bottom-3 inset-x-0 h-1.5 bg-indigo-500 rounded-full z-30 animate-pulse" />
                      )}

                      {/* ---- ALWAYS-VISIBLE INLINE INSERTER ---- */}
                      <BlockInserter
                        contextualProducts={getContextualProducts(index)}
                        onInsertText={() => {
                          const next = [...editorNodes];
                          next.splice(index + 1, 0, {
                            id: `html-${Date.now()}`,
                            type: 'HTML',
                            content: '<p>Write something brilliant…</p>',
                          });
                          setEditorNodes(next);
                        }}
                        onInsertProduct={(productId) => injectProduct(productId, index + 1)}
                        onInsertByAsin={(input) => addProductByAsinOrUrl(input, index + 1).then(() => undefined)}
                        hasComparison={editorNodes.some((n) => n.type === 'COMPARISON')}
                        onInsertComparison={() => {
                          const productsArr = Object.values(productMap);
                          if (productsArr.length < 2) {
                            toast('Need at least 2 staged products to build a comparison table.');
                            return;
                          }
                          const next = [...editorNodes];
                          next.splice(index + 1, 0, {
                            id: `comp-table-${Date.now()}`,
                            type: 'COMPARISON',
                            comparisonData: {
                              title: 'Compare top picks',
                              productIds: productsArr.slice(0, 4).map((p) => p.id),
                              specs: ['price', 'rating', 'brand'],
                            },
                          });
                          setEditorNodes(next);
                          toast('Comparison table inserted');
                        }}
                      />
                    </div>
                  );
                })}


                {/* Empty State */}
                {editorNodes.length === 0 && (
                  <div className="py-40 text-center border-2 border-dashed border-slate-200 rounded-[40px]">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4">Canvas Empty</p>
                    <button
                      onClick={() => setEditorNodes([{ id: 'init', type: 'HTML', content: '<p>Start writing…</p>' }])}
                      className="text-brand-500 font-black underline"
                    >
                      Initialize Block
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ---- CODE VIEW ---- */
            <div className="max-w-4xl mx-auto h-full">
              <div className="bg-[#1e1e1e] text-blue-300 p-10 rounded-[40px] shadow-2xl font-mono text-sm leading-relaxed overflow-auto min-h-[80vh] border border-white/10 whitespace-pre-wrap break-words">
                {generateFinalHtml()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostEditor;
