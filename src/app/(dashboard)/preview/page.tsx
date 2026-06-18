'use client';

import React, { useState, useEffect } from 'react';
import { 
  Film, 
  RefreshCw, 
  AlertTriangle, 
  Eye, 
  Heart, 
  MessageSquare,
  Clock,
  ExternalLink,
  Search,
  User,
  Calendar
} from 'lucide-react';

interface ReelPreviewData {
  thumbnail: string | null;
  previewVideoUrl: string | null;
  caption: string | null;
  author: string | null;
  durationSec: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  postedAt: string | null;
}

export default function PreviewerPage() {
  const [sourceUrl, setSourceUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  
  // Preview states
  const [previewData, setPreviewData] = useState<ReelPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // Debounce input changes or fetch on button click/enter
  useEffect(() => {
    if (!activeUrl) {
      setPreviewData(null);
      setPreviewError('');
      setPreviewLoading(false);
      return;
    }

    if (!activeUrl.includes('instagram.com')) {
      setPreviewError('Invalid URL. Must be a valid instagram.com link.');
      setPreviewData(null);
      setPreviewLoading(false);
      return;
    }

    setPreviewError('');
    setPreviewLoading(true);

    async function fetchPreview() {
      try {
        const res = await fetch('/api/reel/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: activeUrl }),
        });

        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch preview.');
        }

        setPreviewData(data);
      } catch (err: any) {
        console.error('Previewer page fetch error:', err);
        setPreviewError(err.message || 'Could not fetch this reel metadata.');
        setPreviewData(null);
      } finally {
        setPreviewLoading(false);
      }
    }

    fetchPreview();
  }, [activeUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveUrl(sourceUrl);
  };

  // Format compact numbers (e.g. 12.3K, 1.2M)
  const formatCompact = (num: number | null) => {
    if (num === null || num === undefined) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  };

  // Format exact numbers (for tooltips/details)
  const formatExact = (num: number | null) => {
    if (num === null || num === undefined) return 'Not shared publicly';
    return num.toLocaleString();
  };

  const formatDuration = (sec: number | null) => {
    if (sec === null || sec === undefined) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatFullDate = (isoStr: string | null) => {
    if (!isoStr) return null;
    return new Date(isoStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-4xl font-black text-foreground uppercase tracking-wide">Reel Previewer</h1>
        <p className="text-zinc-600 font-medium mt-1">
          Paste an Instagram Reel URL to inspect high-clarity video and analytics.
        </p>
      </div>

      {/* Input URL composer */}
      <form onSubmit={handleSubmit} className="glass-panel rounded-none p-6 space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <Film size={22} className="stroke-[2.5]" />
          <h2 className="font-black text-xl text-foreground uppercase tracking-wide">Analyze Instagram Video</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="url"
              required
              placeholder="https://www.instagram.com/reel/DZjioneuzSL/..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="w-full bg-white border-2 border-border rounded-none py-3.5 pl-4 pr-10 text-foreground font-semibold outline-none transition-all placeholder-zinc-500 text-sm"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          </div>
          <button
            type="submit"
            disabled={previewLoading}
            className="px-8 py-3.5 bg-primary text-primary-foreground font-black border-2 border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--shadow-color)] transition-all cursor-pointer uppercase tracking-wider text-sm flex items-center justify-center gap-2 disabled:opacity-50 min-w-[150px]"
          >
            {previewLoading ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                <span>Fetching...</span>
              </>
            ) : (
              <span>Load Video</span>
            )}
          </button>
        </div>
      </form>

      {/* Main Preview Container */}
      {(previewLoading || previewData || previewError) && (
        <div className="glass-panel rounded-none p-8 min-h-[50vh]">
          {/* Loading Skeleton */}
          {previewLoading && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-pulse">
              <div className="md:col-span-5 flex justify-center">
                <div className="w-full max-w-[340px] aspect-[9/16] bg-muted border-2 border-dashed border-border flex items-center justify-center">
                  <RefreshCw className="animate-spin text-zinc-400" size={36} />
                </div>
              </div>
              <div className="md:col-span-7 space-y-6">
                <div className="h-8 bg-muted w-1/3"></div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-24 bg-muted border-2 border-border"></div>
                  <div className="h-24 bg-muted border-2 border-border"></div>
                  <div className="h-24 bg-muted border-2 border-border"></div>
                </div>
                <div className="space-y-3 pt-4">
                  <div className="h-4 bg-muted w-full"></div>
                  <div className="h-4 bg-muted w-5/6"></div>
                  <div className="h-4 bg-muted w-4/5"></div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {previewError && !previewLoading && (
            <div className="text-center py-12 max-w-md mx-auto space-y-4">
              <AlertTriangle className="text-destructive mx-auto" size={48} />
              <h3 className="text-xl font-black text-foreground uppercase tracking-wide">Analysis Failed</h3>
              <p className="text-zinc-600 font-semibold text-sm">
                {previewError}
              </p>
              <button
                type="button"
                onClick={() => setActiveUrl(sourceUrl)}
                className="px-6 py-2 border-2 border-border bg-card font-bold hover:bg-muted transition-all uppercase tracking-wide text-xs"
              >
                Retry Fetch
              </button>
            </div>
          )}

          {/* Render Result (Big Screen Layout) */}
          {previewData && !previewLoading && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Left Column: Big 9:16 Video Box */}
              <div className="md:col-span-5 flex flex-col items-center">
                <div className="relative w-full max-w-[340px] aspect-[9/16] bg-black border-2 border-border shadow-[6px_6px_0px_0px_var(--shadow-color)] overflow-hidden">
                  {previewData.previewVideoUrl ? (
                    <video
                      src={previewData.previewVideoUrl}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : previewData.thumbnail ? (
                    <img
                      src={previewData.thumbnail}
                      alt="Reel Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">
                      No Media Preview
                    </div>
                  )}

                  {/* Duration Badge */}
                  {formatDuration(previewData.durationSec) && (
                    <div className="absolute bottom-4 right-4 bg-black/85 text-white border-2 border-white/20 px-2.5 py-1 text-xs font-black font-mono">
                      <Clock size={12} className="inline mr-1" />
                      {formatDuration(previewData.durationSec)}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Full Details */}
              <div className="md:col-span-7 space-y-6">
                {/* Author Info */}
                <div className="border-b-2 border-border pb-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 border-2 border-border flex items-center justify-center rounded-none">
                      <User size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-foreground">
                        {previewData.author ? `@${previewData.author}` : 'Unknown Creator'}
                      </h3>
                      <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                        Instagram Creator
                      </p>
                    </div>
                  </div>

                  {previewData.postedAt && (
                    <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-semibold">
                      <Calendar size={13} />
                      <span>Published on {formatFullDate(previewData.postedAt)}</span>
                    </div>
                  )}
                </div>

                {/* Big Stats Box Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Views */}
                  <div className="border-2 border-border bg-card p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)] relative group">
                    <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                      <Eye size={16} className="stroke-[2.5]" />
                      <span className="text-[10px] font-black uppercase">Views</span>
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {formatCompact(previewData.viewCount)}
                    </div>
                    <div className="absolute top-1 right-2 text-[8px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatExact(previewData.viewCount)}
                    </div>
                  </div>

                  {/* Likes */}
                  <div className="border-2 border-border bg-card p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)] relative group">
                    <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                      <Heart size={16} className="stroke-[2.5]" />
                      <span className="text-[10px] font-black uppercase">Likes</span>
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {formatCompact(previewData.likeCount)}
                    </div>
                    <div className="absolute top-1 right-2 text-[8px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatExact(previewData.likeCount)}
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="border-2 border-border bg-card p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)] relative group">
                    <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                      <MessageSquare size={16} className="stroke-[2.5]" />
                      <span className="text-[10px] font-black uppercase">Comments</span>
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {formatCompact(previewData.commentCount)}
                    </div>
                    <div className="absolute top-1 right-2 text-[8px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatExact(previewData.commentCount)}
                    </div>
                  </div>
                </div>

                {/* Caption / Description Box */}
                {previewData.caption && (
                  <div className="space-y-2">
                    <h4 className="font-black text-sm uppercase text-foreground tracking-wider">
                      Reel Caption
                    </h4>
                    <div className="bg-muted border-2 border-border p-4 rounded-none max-h-60 overflow-y-auto font-medium text-sm text-zinc-700 whitespace-pre-wrap">
                      {previewData.caption}
                    </div>
                  </div>
                )}

                {/* External link */}
                <div className="pt-4">
                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-card border-2 border-border text-foreground font-black text-xs uppercase tracking-wider hover:bg-muted shadow-[3px_3px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--shadow-color)] transition-all"
                  >
                    <span>View original on Instagram</span>
                    <ExternalLink size={14} className="stroke-[2.5]" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
