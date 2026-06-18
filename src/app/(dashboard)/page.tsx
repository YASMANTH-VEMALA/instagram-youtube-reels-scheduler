'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  PlusCircle, 
  Calendar, 
  Film, 
  CheckSquare, 
  Square, 
  RefreshCw, 
  AlertTriangle, 
  Eye, 
  Heart, 
  MessageSquare,
  Clock,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface Channel {
  id: string;
  name: string;
  igUserId: string;
  captionTemplate: string;
  hashtags: string;
  watermarkUrl: string | null;
  watermarkEnabledDefault: boolean;
}

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

export default function ComposerPage() {
  const router = useRouter();

  // Channels state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);

  // Form states
  const [sourceUrl, setSourceUrl] = useState('');
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [watermark, setWatermark] = useState(true);
  const [caption, setCaption] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  // Preview states
  const [previewData, setPreviewData] = useState<ReelPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [expandCaption, setExpandCaption] = useState(false);

  // UI status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch channels on mount
  useEffect(() => {
    async function fetchChannels() {
      try {
        const res = await fetch('/api/channels');
        if (res.ok) {
          const data = await res.json();
          setChannels(data);
          
          // Pre-select first channel by default if available
          if (data.length > 0) {
            setSelectedChannelIds([data[0].id]);
            setWatermark(data[0].watermarkEnabledDefault);
            const initialCaption = `${data[0].captionTemplate || ''}\n\n${data[0].hashtags || ''}`.trim();
            setCaption(initialCaption);
          }
        } else {
          setError('Failed to load channels.');
        }
      } catch (err) {
        console.error('Fetch channels error:', err);
        setError('Error loading channels.');
      } finally {
        setLoadingChannels(false);
      }
    }

    fetchChannels();
  }, []);

  // Debounced fetch for Instagram Reel preview
  useEffect(() => {
    if (!sourceUrl || !sourceUrl.includes('instagram.com')) {
      setPreviewData(null);
      setPreviewError('');
      setPreviewLoading(false);
      return;
    }

    setPreviewError('');
    setPreviewLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/reel/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: sourceUrl }),
        });

        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch preview.');
        }

        setPreviewData(data);
        
        // Auto-populate caption if empty
        if (data.caption && !caption) {
          setCaption(data.caption);
        }
      } catch (err: any) {
        console.error('Preview fetch error:', err);
        setPreviewError(err.message || 'Could not fetch this reel metadata.');
        setPreviewData(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [sourceUrl]);

  // Update caption and watermark default when selected channels change
  const handleChannelToggle = (channelId: string) => {
    let updatedSelection = [...selectedChannelIds];
    if (updatedSelection.includes(channelId)) {
      updatedSelection = updatedSelection.filter((id) => id !== channelId);
    } else {
      updatedSelection.push(channelId);
    }
    
    setSelectedChannelIds(updatedSelection);

    if (updatedSelection.length > 0) {
      const primaryChannel = channels.find((c) => c.id === updatedSelection[0]);
      if (primaryChannel) {
        setWatermark(primaryChannel.watermarkEnabledDefault);
        
        if (!caption.trim()) {
          const initialCaption = `${primaryChannel.captionTemplate || ''}\n\n${primaryChannel.hashtags || ''}`.trim();
          setCaption(initialCaption);
        }
      }
    }
  };

  const handleSourceUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSourceUrl(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    if (selectedChannelIds.length === 0) {
      setError('Please select at least one channel.');
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        sourceUrl,
        channelIds: selectedChannelIds,
        caption,
        watermark,
        scheduledAt: isScheduled ? scheduledAt : null,
      };

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to queue post.');
      }

      setSuccess(`Successfully queued ${selectedChannelIds.length} post(s)! Redirecting to queue...`);
      setSourceUrl('');
      
      setTimeout(() => {
        router.push('/queue');
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Error occurred while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper formats
  const formatCompact = (num: number | null) => {
    if (num === null) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  const formatDuration = (sec: number | null) => {
    if (sec === null || sec === undefined) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (isoStr: string | null) => {
    if (!isoStr) return null;
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHr > 0) return `${diffHr}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'just now';
  };

  if (loadingChannels) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <RefreshCw className="animate-spin text-primary mb-2" size={36} />
        <span className="font-bold text-foreground">Loading channels...</span>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="glass-panel rounded-none p-8 max-w-xl mx-auto text-center">
        <AlertTriangle size={48} className="text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-black text-foreground uppercase tracking-wide">No Channels Found</h2>
        <p className="text-zinc-600 mt-2 mb-6 font-medium">
          You need to add at least one Instagram channel before you can schedule posts.
        </p>
        <Link
          href="/channels"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-black border-2 border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--shadow-color)] transition-all uppercase tracking-wider text-sm"
        >
          <PlusCircle size={18} />
          Add Channel
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-foreground uppercase tracking-wide">Create Clip Post</h1>
        <p className="text-zinc-600 font-medium mt-1">Cross-post and schedule Reels across your clipping channels.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {error && (
            <div className="bg-red-500/10 border-2 border-destructive text-destructive rounded-none p-4 font-bold text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border-2 border-green-600 text-green-700 rounded-none p-4 font-bold text-sm">
              {success}
            </div>
          )}

          {/* URL Input */}
          <div className="glass-panel rounded-none p-6 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Film size={20} className="stroke-[2.5]" />
              <h2 className="font-black text-lg text-foreground uppercase tracking-wide">Source Instagram Reel</h2>
            </div>
            <div className="space-y-2">
              <label className="block text-foreground text-xs uppercase font-bold tracking-wider">Reel Link</label>
              <input
                type="url"
                required
                placeholder="https://www.instagram.com/reel/C7xYZ..."
                value={sourceUrl}
                onChange={handleSourceUrlChange}
                className="w-full bg-white border-2 border-border rounded-none py-3 px-4 text-foreground font-semibold outline-none transition-all placeholder-zinc-500"
                disabled={submitting}
              />
              {previewError && (
                <div className="text-destructive font-bold text-xs flex items-center gap-1.5 pt-1">
                  <AlertTriangle size={14} />
                  <span>{previewError} (You can still manually submit this post)</span>
                </div>
              )}
            </div>
          </div>

          {/* Caption Composer */}
          <div className="glass-panel rounded-none p-6 space-y-4">
            <h2 className="font-black text-lg text-foreground uppercase tracking-wide">Caption & Hashtags</h2>
            <div>
              <textarea
                rows={6}
                placeholder="Write caption here... (supports emojis)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full bg-white border-2 border-border rounded-none py-3 px-4 text-foreground font-semibold outline-none transition-all placeholder-zinc-500 resize-none font-sans"
                disabled={submitting}
              />
              <p className="text-zinc-500 font-medium text-xs mt-2">
                Pre-filled from the first selected channel's template and hashtags.
              </p>
            </div>
          </div>

          {/* Watermark Toggle */}
          <div className="glass-panel rounded-none p-6 flex items-center justify-between">
            <div>
              <h3 className="font-black text-foreground uppercase text-sm tracking-wider">Apply Watermark</h3>
              <p className="text-zinc-500 font-medium text-xs mt-0.5">Overlay channel logo (highly recommended for original branding)</p>
            </div>
            <button
              type="button"
              onClick={() => setWatermark(!watermark)}
              className={`relative inline-flex h-6.5 w-12 items-center rounded-none border-2 border-border transition-colors cursor-pointer outline-none ${
                watermark ? 'bg-primary' : 'bg-muted'
              }`}
              disabled={submitting}
            >
              <span
                className={`inline-block h-4 w-4 border-2 border-border transform rounded-none bg-white transition-transform ${
                  watermark ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Schedule settings */}
          <div className="glass-panel rounded-none p-6 space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <Calendar size={20} className="stroke-[2.5]" />
              <h2 className="font-black text-lg text-foreground uppercase tracking-wide">Scheduling Options</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setIsScheduled(false)}
                className={`py-3 rounded-none border-2 text-sm font-black transition-all cursor-pointer uppercase tracking-wider ${
                  !isScheduled
                    ? 'border-border bg-primary text-primary-foreground shadow-[3px_3px_0px_0px_var(--shadow-color)] translate-x-[-1px] translate-y-[-1px]'
                    : 'border-border bg-muted text-foreground/75 hover:bg-muted/80'
                }`}
                disabled={submitting}
              >
                Publish Now
              </button>
              <button
                type="button"
                onClick={() => setIsScheduled(true)}
                className={`py-3 rounded-none border-2 text-sm font-black transition-all cursor-pointer uppercase tracking-wider ${
                  isScheduled
                    ? 'border-border bg-accent text-accent-foreground shadow-[3px_3px_0px_0px_var(--shadow-color)] translate-x-[-1px] translate-y-[-1px]'
                    : 'border-border bg-muted text-foreground/75 hover:bg-muted/80'
                }`}
                disabled={submitting}
              >
                Schedule for Later
              </button>
            </div>

            {isScheduled && (
              <div className="pt-2 animate-fadeIn space-y-2">
                <label className="block text-foreground text-xs uppercase font-bold tracking-wider">Publish Time</label>
                <input
                  type="datetime-local"
                  required={isScheduled}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full bg-white border-2 border-border rounded-none py-3 px-4 text-foreground font-semibold outline-none transition-all"
                  disabled={submitting}
                />
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-primary text-primary-foreground font-black border-2 border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--shadow-color)] transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="animate-spin" size={18} />
                <span>Queuing Posts...</span>
              </>
            ) : (
              <span>Queue Post(s)</span>
            )}
          </button>
        </form>

        {/* Side Info / Channels picker & Metadata Preview */}
        <div className="space-y-6">
          {/* Target Channels */}
          <div className="glass-panel rounded-none p-6 space-y-4">
            <h2 className="font-black text-lg text-foreground uppercase tracking-wide">Target Channels</h2>
            <p className="text-zinc-500 font-medium text-xs">
              Select one or multiple channels. We will create one post job per selected channel.
            </p>
            <div className="space-y-3">
              {channels.map((channel) => {
                const isSelected = selectedChannelIds.includes(channel.id);
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => handleChannelToggle(channel.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-none border-2 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-border bg-primary/10 text-foreground font-bold shadow-[2px_2px_0px_0px_var(--shadow-color)] translate-x-[-1px] translate-y-[-1px]'
                        : 'border-border bg-card text-zinc-600 hover:border-border hover:shadow-[2px_2px_0px_0px_var(--shadow-color)] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">{channel.name}</span>
                      <span className="text-zinc-500 font-semibold text-xs mt-0.5">ID: {channel.igUserId}</span>
                    </div>
                    <div>
                      {isSelected ? (
                        <CheckSquare className="text-primary" size={20} />
                      ) : (
                        <Square className="text-zinc-400" size={20} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reel Metadata Preview Card */}
          {(previewLoading || previewData) && (
            <div className="glass-panel rounded-none p-6 space-y-4">
              <h2 className="font-black text-lg text-foreground uppercase tracking-wide">Reel Preview</h2>

              {/* Skeleton Loader */}
              {previewLoading && (
                <div className="space-y-4 animate-pulse">
                  <div className="w-full aspect-[9/16] bg-muted border-2 border-dashed border-border flex items-center justify-center">
                    <Film size={32} className="text-zinc-400 animate-bounce" />
                  </div>
                  <div className="h-4 bg-muted w-1/3"></div>
                  <div className="space-y-2">
                    <div className="h-3.5 bg-muted w-full"></div>
                    <div className="h-3.5 bg-muted w-5/6"></div>
                  </div>
                  <div className="h-10 bg-muted w-full"></div>
                </div>
              )}

              {/* Preview Content */}
              {!previewLoading && previewData && (
                <div className="space-y-4">
                  {/* Media player (constrained to 9:16) */}
                  <div className="relative w-full aspect-[9/16] bg-black border-2 border-border overflow-hidden">
                    {previewData.previewVideoUrl ? (
                      <video
                        src={previewData.previewVideoUrl}
                        controls
                        muted
                        playsInline
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
                        No Preview Available
                      </div>
                    )}

                    {/* Duration Badge */}
                    {formatDuration(previewData.durationSec) && (
                      <div className="absolute bottom-3 right-3 bg-black/80 text-white border border-white/20 px-2 py-0.5 text-xs font-bold font-mono">
                        <Clock size={10} className="inline mr-1" />
                        {formatDuration(previewData.durationSec)}
                      </div>
                    )}
                  </div>

                  {/* Metadata header */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-black text-sm text-foreground">
                        {previewData.author ? `@${previewData.author}` : 'Instagram Creator'}
                      </div>
                      {formatRelativeTime(previewData.postedAt) && (
                        <span className="text-zinc-500 text-xs font-bold">
                          {formatRelativeTime(previewData.postedAt)}
                        </span>
                      )}
                    </div>

                    {/* Expandable Caption */}
                    {previewData.caption && (
                      <div className="text-xs font-medium text-zinc-600 space-y-1">
                        <p className={expandCaption ? 'whitespace-pre-wrap' : 'line-clamp-2'}>
                          {previewData.caption}
                        </p>
                        {previewData.caption.length > 80 && (
                          <button
                            type="button"
                            onClick={() => setExpandCaption(!expandCaption)}
                            className="text-primary font-bold hover:underline cursor-pointer"
                          >
                            {expandCaption ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Reach Stats Row */}
                  <div className="grid grid-cols-3 gap-2 border-2 border-border bg-muted p-3">
                    <div className="text-center group relative cursor-help">
                      <div className="flex items-center justify-center gap-1.5 text-zinc-500 mb-0.5">
                        <Eye size={14} className="stroke-[2.5]" />
                        <span className="text-[10px] font-black uppercase">Views</span>
                      </div>
                      <div className="text-xs font-black text-foreground">
                        {formatCompact(previewData.viewCount)}
                      </div>
                      {previewData.viewCount === null && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-36 bg-black text-white text-[9px] p-2 font-bold shadow-[2px_2px_0px_0px_#000] border border-white opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                          Not shared publicly by Instagram
                        </div>
                      )}
                    </div>

                    <div className="text-center group relative cursor-help">
                      <div className="flex items-center justify-center gap-1.5 text-zinc-500 mb-0.5">
                        <Heart size={14} className="stroke-[2.5]" />
                        <span className="text-[10px] font-black uppercase">Likes</span>
                      </div>
                      <div className="text-xs font-black text-foreground">
                        {formatCompact(previewData.likeCount)}
                      </div>
                      {previewData.likeCount === null && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-36 bg-black text-white text-[9px] p-2 font-bold shadow-[2px_2px_0px_0px_#000] border border-white opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                          Not shared publicly by Instagram
                        </div>
                      )}
                    </div>

                    <div className="text-center group relative cursor-help">
                      <div className="flex items-center justify-center gap-1.5 text-zinc-500 mb-0.5">
                        <MessageSquare size={14} className="stroke-[2.5]" />
                        <span className="text-[10px] font-black uppercase">Comments</span>
                      </div>
                      <div className="text-xs font-black text-foreground">
                        {formatCompact(previewData.commentCount)}
                      </div>
                      {previewData.commentCount === null && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-36 bg-black text-white text-[9px] p-2 font-bold shadow-[2px_2px_0px_0px_#000] border border-white opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                          Not shared publicly by Instagram
                        </div>
                      )}
                    </div>
                  </div>

                  {/* External Link */}
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-foreground hover:underline uppercase tracking-wide"
                  >
                    <span>View original on Instagram</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
