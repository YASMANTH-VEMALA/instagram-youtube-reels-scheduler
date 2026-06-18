'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RefreshCw, ExternalLink, AlertCircle, Calendar, CheckCircle2, 
  Play, AlertOctagon, RotateCcw, HelpCircle, ChevronDown, ChevronUp,
  Terminal, Download, Cog, Upload, Send, Sparkles, XCircle, Clock,
  Copy, Check
} from 'lucide-react';

interface Channel {
  name: string;
}

interface PostLogEntry {
  id: string;
  step: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
  createdAt: string;
}

interface Post {
  id: string;
  channelId: string;
  channel: Channel;
  sourceUrl: string;
  status: 'queued' | 'downloading' | 'processing' | 'uploading' | 'publishing' | 'published' | 'failed';
  caption: string;
  watermark: boolean;
  processedVideoUrl: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  start: <Sparkles size={12} className="stroke-[2.5]" />,
  downloading: <Download size={12} className="stroke-[2.5]" />,
  processing: <Cog size={12} className="stroke-[2.5] animate-spin" />,
  uploading: <Upload size={12} className="stroke-[2.5]" />,
  publishing: <Send size={12} className="stroke-[2.5]" />,
  published: <CheckCircle2 size={12} className="stroke-[2.5]" />,
  failed: <XCircle size={12} className="stroke-[2.5]" />,
  cleanup: <RefreshCw size={12} className="stroke-[2.5]" />,
};

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-zinc-600',
  warn: 'text-amber-600',
  error: 'text-red-600',
  success: 'text-emerald-600',
};

const LEVEL_DOT_COLORS: Record<string, string> = {
  info: 'bg-zinc-400',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
  success: 'bg-emerald-500',
};

function LiveLogPanel({ postId, isActive }: { postId: string; isActive: boolean }) {
  const [logs, setLogs] = useState<PostLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    const text = logs
      .map((e) => {
        const time = new Date(e.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const prefix = e.level === 'error' ? '✗' : e.level === 'success' ? '✓' : e.level === 'warn' ? '⚠' : '→';
        return `[${time}] ${prefix} [${e.step.toUpperCase()}] ${e.message}`;
      })
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (!isActive) return;

    const es = new EventSource(`/api/posts/${postId}/logs`);
    eventSourceRef.current = es;
    setConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'log') {
          setLogs((prev) => {
            // Deduplicate by ID
            if (prev.some((l) => l.id === data.log.id)) return prev;
            return [...prev, data.log];
          });
        } else if (data.type === 'done') {
          es.close();
          setConnected(false);
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [postId, isActive]);

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-zinc-950 border-2 border-border rounded-none overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b-2 border-border">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-400" />
          <span className="text-xs font-black text-zinc-300 uppercase tracking-wider">Live Worker Logs</span>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              STREAMING
            </span>
          )}
          {!connected && logs.length > 0 && (
            <span className="text-[10px] font-bold text-zinc-500">CLOSED</span>
          )}
          {/* Copy Logs Button */}
          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            title="Copy all logs to clipboard"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              copied
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
            }`}
          >
            {copied ? <Check size={11} className="stroke-[2.5]" /> : <Copy size={11} className="stroke-[2.5]" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Logs area */}
      <div className="max-h-64 overflow-y-auto p-3 space-y-1 font-mono text-xs scrollbar-thin">
        {logs.length === 0 && (
          <div className="text-zinc-600 italic py-4 text-center">
            {connected ? 'Waiting for worker logs...' : 'No logs yet. Click to connect.'}
          </div>
        )}
        {logs.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2 group hover:bg-zinc-900/50 px-1 py-0.5 -mx-1 rounded-sm transition-colors">
            <span className="text-zinc-600 shrink-0 select-none">{formatTime(entry.createdAt)}</span>
            <span className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${LEVEL_DOT_COLORS[entry.level] || LEVEL_DOT_COLORS.info}`} />
            <span className="shrink-0 text-zinc-500">{STEP_ICONS[entry.step] || STEP_ICONS.start}</span>
            <span className="text-zinc-500 font-bold uppercase shrink-0 text-[10px] mt-px w-20">{entry.step}</span>
            <span className={`${LEVEL_COLORS[entry.level] || LEVEL_COLORS.info} break-all`}>{entry.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

export default function QueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  
  // Keep reference of current filter to use inside interval callback
  const filterRef = useRef(filter);
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  // Fetch queue function
  const fetchQueue = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const url = filterRef.current !== 'all' 
        ? `/api/posts?status=${filterRef.current}&limit=50` 
        : '/api/posts?limit=50';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      } else {
        setErrorMsg('Failed to load queue.');
      }
    } catch (err) {
      console.error('Fetch queue error:', err);
      setErrorMsg('Error loading queue.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Fetch on mount and setup polling
  useEffect(() => {
    fetchQueue(true);
    
    // Poll queue every 5 seconds for real-time status updates
    const interval = setInterval(() => {
      fetchQueue(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [filter]);

  const handleRetry = async (postId: string) => {
    setRetryingId(postId);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/posts/${postId}/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to retry post.');
      }
      await fetchQueue(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retry post.');
    } finally {
      setRetryingId(null);
    }
  };

  const toggleLogs = (postId: string) => {
    setExpandedPostId(expandedPostId === postId ? null : postId);
  };

  const isActiveStatus = (status: string) => {
    return ['downloading', 'processing', 'uploading', 'publishing'].includes(status);
  };

  const getStatusBadge = (status: Post['status']) => {
    const base = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none text-xs font-black uppercase tracking-wider border-2 border-border ";
    switch (status) {
      case 'queued':
        return <span className={`${base} bg-muted text-foreground`}><Calendar size={12} className="stroke-[2.5]" /> Queued</span>;
      case 'downloading':
        return <span className={`${base} bg-accent text-accent-foreground`}><RefreshCw size={12} className="animate-spin" /> Downloading</span>;
      case 'processing':
        return <span className={`${base} bg-secondary text-secondary-foreground`}><RefreshCw size={12} className="animate-spin" /> Processing</span>;
      case 'uploading':
        return <span className={`${base} bg-accent text-accent-foreground`}><RefreshCw size={12} className="animate-spin" /> Uploading</span>;
      case 'publishing':
        return <span className={`${base} bg-primary text-primary-foreground`}><RefreshCw size={12} className="animate-spin" /> Publishing</span>;
      case 'published':
        return <span className={`${base} bg-green-500/10 text-green-700 border-green-600`}><CheckCircle2 size={12} /> Published</span>;
      case 'failed':
        return <span className={`${base} bg-destructive text-destructive-foreground`}><AlertCircle size={12} /> Failed</span>;
      default:
        return <span className={base}>{status}</span>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground uppercase tracking-wide">Queue & Posts</h1>
          <p className="text-zinc-600 font-medium mt-1">Monitor the live status of your video clipping jobs.</p>
        </div>
        <button
          onClick={() => fetchQueue(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-card text-foreground font-black border-2 border-border shadow-[3px_3px_0px_0px_var(--shadow-color)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--shadow-color)] transition-all cursor-pointer text-sm uppercase tracking-wider"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50/80 border-2 border-destructive text-destructive rounded-none p-4 font-bold text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}

      {/* Filter tab bar */}
      <div className="flex flex-wrap gap-2.5 p-2 bg-white border-2 border-border rounded-none max-w-xl shadow-[3px_3px_0px_0px_var(--shadow-color)]">
        {['all', 'queued', 'downloading', 'publishing', 'published', 'failed'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-none text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              filter === tab
                ? 'bg-primary text-primary-foreground border-2 border-border shadow-[2px_2px_0px_0px_var(--shadow-color)] translate-x-[-1px] translate-y-[-1px]'
                : 'text-zinc-500 hover:text-foreground hover:bg-muted border-2 border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh]">
          <RefreshCw className="animate-spin text-primary mb-2" size={36} />
          <span className="text-foreground font-black">Loading queue items...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-panel rounded-none p-12 text-center border-2 border-border">
          <HelpCircle size={40} className="text-primary mx-auto mb-3" />
          <h3 className="text-xl font-black text-foreground uppercase tracking-wide">No posts found</h3>
          <p className="text-zinc-600 font-semibold text-sm mt-1">
            {filter === 'all' 
              ? "You haven't queued any clips yet." 
              : `No posts with status "${filter}" found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {/* Table header */}
          <div className="glass-panel rounded-none overflow-hidden border-2 border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-border bg-muted text-foreground text-xs font-black uppercase tracking-wider">
                    <th className="px-6 py-4">Channel</th>
                    <th className="px-6 py-4">Source URL</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Scheduled For</th>
                    <th className="px-6 py-4">Published At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-border text-sm font-semibold">
                  {posts.map((post) => (
                    <React.Fragment key={post.id}>
                      <tr 
                        className={`hover:bg-muted/50 transition-colors cursor-pointer ${expandedPostId === post.id ? 'bg-muted/30' : ''}`}
                        onClick={() => toggleLogs(post.id)}
                      >
                        <td className="px-6 py-4 font-black text-foreground">
                          {post.channel.name}
                        </td>
                        <td className="px-6 py-4 text-zinc-700 max-w-[200px] truncate font-bold">
                          <a
                            href={post.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 hover:text-primary hover:underline transition-colors inline-flex"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>View Source</span>
                            <ExternalLink size={12} className="stroke-[2.5]" />
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(post.status)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-600 font-mono">
                          {formatDate(post.scheduledAt)}
                        </td>
                        <td className="px-6 py-4 text-zinc-600 font-mono">
                          {formatDate(post.publishedAt)}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {/* Logs toggle */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleLogs(post.id); }}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 border-2 border-border shadow-[2px_2px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                              expandedPostId === post.id 
                                ? 'bg-zinc-900 text-white' 
                                : 'bg-card hover:bg-zinc-100 text-foreground'
                            }`}
                          >
                            <Terminal size={12} className="stroke-[2.5]" />
                            Logs
                            {expandedPostId === post.id 
                              ? <ChevronUp size={12} className="stroke-[2.5]" /> 
                              : <ChevronDown size={12} className="stroke-[2.5]" />
                            }
                          </button>

                          {post.status === 'failed' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRetry(post.id); }}
                              disabled={retryingId === post.id}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-card hover:bg-primary hover:text-primary-foreground text-foreground border-2 border-border shadow-[2px_2px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                            >
                              {retryingId === post.id ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : (
                                <RotateCcw size={12} className="stroke-[2.5]" />
                              )}
                              Retry
                            </button>
                          )}
                          {post.processedVideoUrl && (
                            <a
                              href={post.processedVideoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-card hover:bg-muted text-foreground border-2 border-border shadow-[2px_2px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-xs font-black uppercase tracking-wider transition-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Play size={12} className="fill-current stroke-[2.5]" />
                              Video
                            </a>
                          )}
                        </td>
                      </tr>

                      {/* Error breakdown row */}
                      {post.status === 'failed' && post.error && expandedPostId !== post.id && (
                        <tr className="bg-red-500/5">
                          <td colSpan={6} className="px-6 py-3 border-t-0 text-xs text-destructive font-bold">
                            <div className="flex items-start gap-2 max-w-4xl">
                              <AlertOctagon size={14} className="flex-shrink-0 mt-0.5" />
                              <span>
                                <strong>Error (Attempts: {post.attempts}):</strong> {post.error}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Expandable live log panel */}
                      {expandedPostId === post.id && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="p-4 bg-zinc-50 border-t-0">
                              <LiveLogPanel postId={post.id} isActive={expandedPostId === post.id} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
