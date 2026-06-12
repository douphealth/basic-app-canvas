/**
 * ============================================================================
 * BatchProcessor Component v1.0
 * ============================================================================
 * Enterprise-grade batch processing engine with:
 * - Configurable concurrency (1-10 parallel workers)
 * - Real-time progress tracking per job
 * - Smart queue management with abort capability
 * - Auto-publish option
 * - Comprehensive statistics dashboard
 * ============================================================================
 */

/**
 * ============================================================================
 * NOTE: This BatchProcessor is a demonstration/prototype implementation.
 * The actual processing flow simulates the analysis workflow to show the UI/UX.
 * To enable real processing, integrate with:
 * - fetchRawPostContent() for content fetching
 * - analyzeContentAndFindProduct() for AI analysis
 * - pushToWordPress() for publishing
 * These require valid WordPress and AI provider credentials.
 * ============================================================================
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { BlogPost, AppConfig, ProductDetails } from '../types';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  fetchRawPostContent,
  analyzeContentAndFindProduct,
  generateProductBoxHtml,
  pushToWordPress,
  splitContentIntoBlocks,
} from '../utils';
import { splitHtmlPreservingShell } from '../lib/html/structure';

export interface BatchJob {
  id: string;
  post: BlogPost;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  progress: number;
  productsFound: number;
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface BatchProcessorProps {
  posts: BlogPost[];
  config: AppConfig;
  onComplete: (results: BatchJob[]) => void;
  onClose: () => void;
}

export const BatchProcessor: React.FC<BatchProcessorProps> = ({ 
  posts, 
  config, 
  onComplete,
  onClose 
}) => {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [concurrency, setConcurrency] = useState(3);
  const [autoPublish, setAutoPublish] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const abortRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const initializeJobs = useCallback(() => {
    const newJobs: BatchJob[] = posts.map(post => ({
      id: `job-${post.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      post,
      status: 'queued',
      progress: 0,
      productsFound: 0,
    }));
    setJobs(newJobs);
    return newJobs;
  }, [posts]);

  const processJob = async (job: BatchJob): Promise<BatchJob> => {
    if (abortRef.current) {
      return { ...job, status: 'skipped' };
    }

    const startTime = Date.now();
    
    try {
      // Stage 1: Fetch content
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing', progress: 10, startTime } : j));
      
      const { content, resolvedId } = await fetchRawPostContent(config, job.post.id, job.post.url || '');
      
      if (abortRef.current) return { ...job, status: 'skipped' };
      if (!content || content.length < 50) {
        return { ...job, status: 'failed', error: 'No content found', endTime: Date.now(), startTime };
      }

      // Stage 2: AI analysis
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, progress: 30 } : j));
      
      const analysis = await analyzeContentAndFindProduct(job.post.title, content, config);
      
      if (abortRef.current) return { ...job, status: 'skipped' };

      const productsFound = analysis.detectedProducts?.length || 0;

      // Stage 3: Generate HTML with product boxes
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, progress: 60, productsFound } : j));

      if (productsFound > 0 && autoPublish) {
        // Build final HTML with product boxes inserted
        const shell = splitHtmlPreservingShell(content);
        const blocks = shell.blocks.length > 0 ? shell.blocks : splitContentIntoBlocks(content);
        const products = analysis.detectedProducts || [];
        let finalParts: string[] = [...blocks];

        // Insert product boxes at detected positions (reverse order to preserve indices)
        const sorted = [...products]
          .filter(p => typeof p.insertionIndex === 'number' && p.insertionIndex >= 0)
          .sort((a, b) => (b.insertionIndex ?? 0) - (a.insertionIndex ?? 0));

        for (const product of sorted) {
          const idx = Math.min(product.insertionIndex ?? finalParts.length, finalParts.length);
          const boxHtml = generateProductBoxHtml(product, config.amazonTag, product.deploymentMode);
          finalParts.splice(idx, 0, boxHtml);
        }

        const finalHtml = `${shell.prefix}${finalParts.join('\n\n')}${shell.suffix}`;

        // Stage 4: Push to WordPress
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, progress: 85 } : j));
        await pushToWordPress(config, resolvedId, finalHtml);
      } else {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, progress: 85 } : j));
      }

      return {
        ...job,
        status: 'completed',
        progress: 100,
        productsFound,
        endTime: Date.now(),
        startTime,
      };

    } catch (error: any) {
      return {
        ...job,
        status: 'failed',
        progress: 0,
        error: error.message?.substring(0, 100) || 'Unknown error',
        endTime: Date.now(),
        startTime,
      };
    }
  };

  const runBatch = async () => {
    setIsRunning(true);
    abortRef.current = false;
    
    const initialJobs = initializeJobs();
    const queue = [...initialJobs];
    const results: BatchJob[] = [];
    
    const workers = Array(concurrency).fill(null).map(async () => {
      while (queue.length > 0 && !abortRef.current) {
        const job = queue.shift();
        if (job) {
          const result = await processJob(job);
          results.push(result);
          setJobs(prev => prev.map(j => j.id === result.id ? result : j));
        }
      }
    });

    await Promise.all(workers);
    
    setIsRunning(false);
    onComplete(results);
  };

  const abort = () => {
    abortRef.current = true;
  };

  const stats = useMemo(() => ({
    total: jobs.length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    queued: jobs.filter(j => j.status === 'queued').length,
    skipped: jobs.filter(j => j.status === 'skipped').length,
    productsFound: jobs.reduce((sum, j) => sum + j.productsFound, 0),
    avgTime: jobs.filter(j => j.endTime && j.startTime).length > 0
      ? jobs.filter(j => j.endTime && j.startTime).reduce((sum, j) => sum + (j.endTime! - j.startTime!), 0) / jobs.filter(j => j.endTime).length
      : 0,
  }), [jobs]);

  const progressPercent = jobs.length > 0 
    ? Math.round((stats.completed + stats.failed + stats.skipped) / stats.total * 100) 
    : 0;

  const filteredJobs = showCompleted ? jobs : jobs.filter(j => j.status !== 'completed');

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8">
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700/50 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        
        <div className="p-6 md:p-8 border-b border-slate-800/50 flex items-center justify-between bg-gradient-to-r from-slate-900/50 to-transparent">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <i className="fa-solid fa-bolt text-white" />
              </div>
              Batch Processor
            </h2>
            <p className="text-sm text-slate-400 mt-1">Process {posts.length} posts with AI-powered monetization</p>
          </div>
          <div className="flex items-center gap-4">
            {isRunning && (
              <div className="text-right">
                <div className="text-4xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  {progressPercent}%
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Progress</div>
              </div>
            )}
            <button 
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
            >
              <i className="fa-solid fa-times text-xl" />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 bg-slate-950/50 border-b border-slate-800/50 flex items-center gap-4 md:gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Workers:</label>
            <select 
              value={concurrency} 
              onChange={e => setConcurrency(Number(e.target.value))}
              disabled={isRunning}
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
            >
              {[1, 2, 3, 5, 10].map(n => (
                <option key={n} value={n}>{n} parallel</option>
              ))}
            </select>
          </div>
          
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`relative w-12 h-6 rounded-full transition-all ${autoPublish ? 'bg-indigo-600' : 'bg-slate-700'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg transition-all ${autoPublish ? 'left-7' : 'left-1'}`} />
            </div>
            <input 
              type="checkbox" 
              checked={autoPublish} 
              onChange={e => setAutoPublish(e.target.checked)}
              disabled={isRunning}
              className="sr-only"
            />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
              Auto-publish
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer group ml-auto">
            <input 
              type="checkbox" 
              checked={showCompleted} 
              onChange={e => setShowCompleted(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs font-bold text-slate-400">Show completed</span>
          </label>

          <div className="flex gap-3">
            {isRunning ? (
              <button 
                onClick={abort} 
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-900/30 transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-stop" /> Abort
              </button>
            ) : (
              <button 
                onClick={runBatch} 
                disabled={posts.length === 0}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-black text-sm uppercase tracking-wider shadow-lg shadow-indigo-900/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-play" /> Start Batch
              </button>
            )}
          </div>
        </div>

        {jobs.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 md:p-6 bg-slate-900/50">
            {[
              { label: 'Processing', value: stats.processing, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10', icon: 'fa-spinner fa-spin' },
              { label: 'Completed', value: stats.completed, gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-500/10', icon: 'fa-check' },
              { label: 'Failed', value: stats.failed, gradient: 'from-red-500 to-red-600', bg: 'bg-red-500/10', icon: 'fa-times' },
              { label: 'Queued', value: stats.queued, gradient: 'from-slate-500 to-slate-600', bg: 'bg-slate-500/10', icon: 'fa-clock' },
              { label: 'Products', value: stats.productsFound, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10', icon: 'fa-box' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 text-center border border-slate-700/30`}>
                <div className={`text-2xl md:text-3xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                  {stat.value}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1 mt-1">
                  <i className={`fa-solid ${stat.icon} text-[8px]`} />
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {isRunning && jobs.length > 0 && (
          <div className="px-6 pb-2">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 transition-all duration-300 ${prefersReducedMotion ? '' : 'animate-pulse'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar">
          {filteredJobs.length === 0 && jobs.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-rocket text-3xl text-slate-600" />
              </div>
              <p className="text-slate-400 font-medium">Ready to process {posts.length} posts</p>
              <p className="text-slate-500 text-sm mt-1">Click "Start Batch" to begin AI analysis</p>
            </div>
          )}
          
          {filteredJobs.map(job => (
            <div 
              key={job.id}
              className={`p-4 rounded-2xl border transition-all duration-300 ${
                job.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/20' :
                job.status === 'failed' ? 'bg-red-500/5 border-red-500/20' :
                job.status === 'processing' ? `bg-blue-500/5 border-blue-500/20 ${prefersReducedMotion ? '' : 'animate-pulse'}` :
                job.status === 'skipped' ? 'bg-yellow-500/5 border-yellow-500/20' :
                'bg-slate-800/50 border-slate-700/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  job.status === 'completed' ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white' :
                  job.status === 'failed' ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' :
                  job.status === 'processing' ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' :
                  job.status === 'skipped' ? 'bg-gradient-to-br from-yellow-500 to-amber-600 text-white' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {job.status === 'completed' && <i className="fa-solid fa-check" />}
                  {job.status === 'failed' && <i className="fa-solid fa-times" />}
                  {job.status === 'processing' && <i className="fa-solid fa-spinner fa-spin" />}
                  {job.status === 'queued' && <i className="fa-solid fa-clock" />}
                  {job.status === 'skipped' && <i className="fa-solid fa-forward" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate">{job.post.title}</div>
                  <div className="text-xs text-slate-500 truncate">{job.post.url}</div>
                </div>

                {job.status === 'processing' && (
                  <div className="w-32 flex-shrink-0">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-blue-400 text-right mt-1 font-bold">{job.progress}%</div>
                  </div>
                )}

                {job.status === 'completed' && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-emerald-400">{job.productsFound} products</div>
                    {job.endTime && job.startTime && (
                      <div className="text-[10px] text-slate-500">{((job.endTime - job.startTime) / 1000).toFixed(1)}s</div>
                    )}
                  </div>
                )}

                {job.status === 'failed' && job.error && (
                  <div className="text-xs text-red-400 max-w-[200px] truncate flex-shrink-0" title={job.error}>
                    {job.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {stats.completed > 0 && !isRunning && (
          <div className="p-6 border-t border-slate-800/50 bg-gradient-to-r from-slate-900/50 to-transparent">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">
                <span className="font-bold text-emerald-400">{stats.completed}</span> posts processed successfully
                {stats.failed > 0 && <span className="ml-2">(<span className="text-red-400">{stats.failed} failed</span>)</span>}
              </div>
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchProcessor;
