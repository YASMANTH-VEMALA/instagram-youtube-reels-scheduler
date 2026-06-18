'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit2, Trash2, ShieldAlert, Radio, Upload, X, RefreshCw, Check } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  igUserId: string;
  captionTemplate: string;
  hashtags: string;
  watermarkUrl: string | null;
  watermarkPosition: string;
  watermarkEnabledDefault: boolean;
  monsterlabCampaignId: string | null;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Form modal state
  const [isOpen, setIsOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  
  // Form field states
  const [name, setName] = useState('');
  const [igUserId, setIgUserId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [captionTemplate, setCaptionTemplate] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [watermarkUrl, setWatermarkUrl] = useState('');
  const [watermarkPosition, setWatermarkPosition] = useState('bottom-right');
  const [watermarkEnabledDefault, setWatermarkEnabledDefault] = useState(true);
  const [monsterlabCampaignId, setMonsterlabCampaignId] = useState('');
  
  // Upload and connection states
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Parse query parameters for OAuth results
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const success = searchParams.get('success');
      const error = searchParams.get('error');

      if (success) {
        setSuccessMsg(success);
        window.history.replaceState({}, '', '/channels');
      }
      if (error) {
        setErrorMsg(error);
        window.history.replaceState({}, '', '/channels');
      }
    }
  }, []);

  // Fetch channels
  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
      } else {
        setErrorMsg('Failed to load channels.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error loading channels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleConnectInstagram = async () => {
    setConnecting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/instagram/oauth/auth-url');
      const data = await res.json();
      if (res.ok && data.url) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          data.url,
          'Instagram Connection',
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
        );
        
        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (event.data?.type === 'INSTAGRAM_AUTH_SUCCESS') {
            setSuccessMsg(event.data.message || 'Successfully connected account!');
            fetchChannels();
            setConnecting(false);
            window.removeEventListener('message', handleMessage);
          } else if (event.data?.type === 'INSTAGRAM_AUTH_ERROR') {
            setErrorMsg(event.data.message || 'Failed to connect account.');
            setConnecting(false);
            window.removeEventListener('message', handleMessage);
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        const timer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(timer);
            setConnecting(false);
            window.removeEventListener('message', handleMessage);
          }
        }, 1000);
      } else {
        throw new Error(data.error || 'Failed to generate connection URL.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start Instagram connection.');
      setConnecting(false);
    }
  };

  const openAddModal = () => {
    setEditingChannel(null);
    setName('');
    setIgUserId('');
    setAccessToken('');
    setCaptionTemplate('');
    setHashtags('');
    setWatermarkUrl('');
    setWatermarkPosition('bottom-right');
    setWatermarkEnabledDefault(true);
    setMonsterlabCampaignId('');
    setIsOpen(true);
  };

  const openEditModal = (channel: Channel) => {
    setEditingChannel(channel);
    setName(channel.name);
    setIgUserId(channel.igUserId);
    setAccessToken(''); // Don't expose token
    setCaptionTemplate(channel.captionTemplate);
    setHashtags(channel.hashtags);
    setWatermarkUrl(channel.watermarkUrl || '');
    setWatermarkPosition(channel.watermarkPosition);
    setWatermarkEnabledDefault(channel.watermarkEnabledDefault);
    setMonsterlabCampaignId(channel.monsterlabCampaignId || '');
    setIsOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed.');
      }

      setWatermarkUrl(data.url);
    } catch (err: any) {
      setErrorMsg(`Watermark upload error: ${err.message}`);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this channel? All queued and published posts for this channel will also be affected.')) {
      return;
    }

    try {
      const res = await fetch(`/api/channels/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchChannels();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to delete channel.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error deleting channel.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload: any = {
        name,
        igUserId,
        captionTemplate,
        hashtags,
        watermarkUrl: watermarkUrl || null,
        watermarkPosition,
        watermarkEnabledDefault,
        monsterlabCampaignId: monsterlabCampaignId || null,
      };

      if (accessToken) {
        payload.accessToken = accessToken;
      }

      const url = editingChannel ? `/api/channels/${editingChannel.id}` : '/api/channels';
      const method = editingChannel ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save channel.');
      }

      setIsOpen(false);
      fetchChannels();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while saving channel.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground uppercase tracking-wide">Clipping Channels</h1>
          <p className="text-zinc-600 font-medium mt-1">Connect your Instagram Business accounts to post and schedule clips.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-card text-foreground font-bold border-2 border-border shadow-[3px_3px_0px_0px_var(--shadow-color)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer text-xs uppercase tracking-wider"
          >
            Manual Setup
          </button>
          <button
            onClick={handleConnectInstagram}
            disabled={connecting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-black border-2 border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--shadow-color)] transition-all cursor-pointer text-sm uppercase tracking-wider disabled:opacity-50"
          >
            {connecting ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Radio size={16} className="stroke-[2.5]" />
            )}
            Connect with Instagram
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50/80 border-2 border-destructive text-destructive rounded-none p-4 font-bold text-sm flex items-center gap-2">
          <ShieldAlert size={16} className="flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50/80 border-2 border-green-600 text-green-700 rounded-none p-4 font-bold text-sm flex items-center gap-2">
          <Check size={16} className="flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh]">
          <RefreshCw className="animate-spin text-primary mb-2" size={36} />
          <span className="text-foreground font-black">Loading channels...</span>
        </div>
      ) : channels.length === 0 ? (
        <div className="glass-panel rounded-none p-12 text-center border-2 border-border bg-white shadow-[4px_4px_0px_0px_var(--shadow-color)]">
          <Radio size={40} className="text-primary mx-auto mb-3" />
          <h3 className="text-xl font-black text-foreground uppercase tracking-wide">No channels added yet</h3>
          <p className="text-zinc-600 font-semibold text-sm mt-1 mb-6">
            Connect your Instagram Creator or Business account to start publishing.
          </p>
          <button
            onClick={handleConnectInstagram}
            disabled={connecting}
            className="px-6 py-3 bg-primary text-primary-foreground font-black border-2 border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer text-sm uppercase tracking-wider"
          >
            {connecting ? 'Connecting...' : 'Connect with Instagram'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map((channel) => (
            <div key={channel.id} className="glass-card rounded-none border-2 border-border bg-white p-6 flex flex-col justify-between h-full relative overflow-hidden shadow-[4px_4px_0px_0px_var(--shadow-color)]">
              <div>
                <div className="flex items-center justify-between mb-5 border-b-2 border-border pb-3">
                  <h3 className="font-black text-lg text-foreground uppercase tracking-wide">{channel.name}</h3>
                  <div className="flex gap-2 z-10">
                    <button
                      onClick={() => openEditModal(channel)}
                      className="p-2 bg-card border-2 border-border text-foreground hover:bg-muted transition-all cursor-pointer"
                    >
                      <Edit2 size={14} className="stroke-[2.5]" />
                    </button>
                    <button
                      onClick={() => handleDelete(channel.id)}
                      className="p-2 bg-card border-2 border-border text-destructive hover:bg-red-50 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-zinc-500 font-black uppercase tracking-wider block text-[9px]">Instagram ID</span>
                    <span className="text-foreground font-bold font-mono text-sm">{channel.igUserId}</span>
                  </div>

                  <div>
                    <span className="text-zinc-500 font-black uppercase tracking-wider block text-[9px]">Default Template</span>
                    <div className="bg-muted border-2 border-border p-3 mt-1 text-zinc-700 font-semibold line-clamp-3 font-sans">
                      {channel.captionTemplate || <em className="text-zinc-400">No template configured</em>}
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-500 font-black uppercase tracking-wider block text-[9px]">Default Hashtags</span>
                    <span className="text-foreground font-bold mt-1 block truncate">
                      {channel.hashtags || <em className="text-zinc-400">None</em>}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-500 font-black uppercase tracking-wider block text-[9px]">MonsterLab Campaign ID</span>
                    <span className="text-foreground font-bold mt-1 block truncate">
                      {channel.monsterlabCampaignId || <em className="text-zinc-400">None</em>}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    {channel.watermarkUrl ? (
                      <div className="relative w-12 h-12 bg-white border-2 border-border flex items-center justify-center overflow-hidden">
                        <img
                          src={channel.watermarkUrl}
                          alt="watermark"
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-muted border-2 border-dashed border-border flex items-center justify-center text-zinc-400">
                        <X size={18} />
                      </div>
                    )}
                    <div>
                      <span className="text-zinc-500 font-black uppercase tracking-wider block text-[9px]">Watermark</span>
                      <span className="text-foreground font-bold">
                        {channel.watermarkUrl 
                          ? `Active (${channel.watermarkPosition})` 
                          : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal drawer for Add/Edit */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-none p-8 shadow-[8px_8px_0px_0px_var(--shadow-color)] relative max-h-[90vh] overflow-y-auto border-2 border-border bg-white">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-foreground transition-colors cursor-pointer border-2 border-transparent hover:border-border p-1"
            >
              <X size={20} className="stroke-[2.5]" />
            </button>

            <h2 className="text-2xl font-black text-foreground uppercase tracking-wide mb-6 border-b-2 border-border pb-3">
              {editingChannel ? `Edit Channel: ${editingChannel.name}` : 'Connect New Channel'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5">
                    Channel Display Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Finance Reels"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border-2 border-border rounded-none py-2.5 px-4 text-foreground font-semibold outline-none placeholder-zinc-400 text-sm"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5">
                    Instagram User ID (Graph ID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 17841400000000000"
                    value={igUserId}
                    onChange={(e) => setIgUserId(e.target.value)}
                    className="w-full bg-white border-2 border-border rounded-none py-2.5 px-4 text-foreground font-bold outline-none placeholder-zinc-400 font-mono text-sm"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5">
                  Facebook System User / Graph Access Token
                </label>
                <input
                  type="password"
                  placeholder={editingChannel ? '•••••••••••• (Leave blank to keep current token)' : 'EAACW... (Never-expiring token recommended)'}
                  required={!editingChannel}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full bg-white border-2 border-border rounded-none py-2.5 px-4 text-foreground font-bold outline-none placeholder-zinc-400 font-mono text-sm"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5">
                  MonsterLab Campaign ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. political-clipping-june-26"
                  value={monsterlabCampaignId}
                  onChange={(e) => setMonsterlabCampaignId(e.target.value)}
                  className="w-full bg-white border-2 border-border rounded-none py-2.5 px-4 text-foreground font-bold outline-none placeholder-zinc-400 font-mono text-sm"
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5">
                    Caption Template
                  </label>
                  <textarea
                    rows={4}
                    placeholder="e.g. Credit: @username"
                    value={captionTemplate}
                    onChange={(e) => setCaptionTemplate(e.target.value)}
                    className="w-full bg-white border-2 border-border rounded-none py-2.5 px-4 text-foreground font-semibold outline-none placeholder-zinc-400 resize-none text-sm"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5">
                    Hashtags Template
                  </label>
                  <textarea
                    rows={4}
                    placeholder="e.g. #clipping #reels #viral"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    className="w-full bg-white border-2 border-border rounded-none py-2.5 px-4 text-foreground font-semibold outline-none placeholder-zinc-400 resize-none text-sm"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Watermark Section */}
              <div className="border-t-2 border-border pt-5 space-y-4">
                <h3 className="text-foreground font-black text-sm uppercase tracking-wider">Watermark Configuration</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                  {/* File Upload */}
                  <div className="md:col-span-1">
                    <label className="block text-zinc-600 text-xs font-bold uppercase tracking-wider mb-2">Watermark File</label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/png, image/jpeg"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="watermark-upload-input"
                        disabled={uploadingFile || submitting}
                      />
                      <label
                        htmlFor="watermark-upload-input"
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border-2 border-dashed border-border bg-white hover:bg-muted text-xs font-black text-foreground cursor-pointer transition-all"
                      >
                        {uploadingFile ? (
                          <RefreshCw size={14} className="animate-spin text-primary" />
                        ) : (
                          <Upload size={14} className="stroke-[2.5]" />
                        )}
                        Upload PNG/JPG
                      </label>
                    </div>
                  </div>

                  {/* Watermark URL display and preview */}
                  <div className="md:col-span-2 flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-zinc-600 text-xs font-bold uppercase tracking-wider mb-2">Watermark URL</label>
                      <input
                        type="text"
                        placeholder="Public storage URL (auto-filled on upload)"
                        value={watermarkUrl}
                        onChange={(e) => setWatermarkUrl(e.target.value)}
                        className="w-full bg-white border-2 border-border py-2.5 px-4 text-xs text-zinc-500 font-mono outline-none"
                        disabled={submitting}
                      />
                    </div>
                    {watermarkUrl && (
                      <div className="relative w-12 h-12 bg-white border-2 border-border flex items-center justify-center overflow-hidden self-end">
                        <img src={watermarkUrl} alt="preview" className="w-10 h-10 object-contain" />
                        <button
                          type="button"
                          onClick={() => setWatermarkUrl('')}
                          className="absolute -top-1 -right-1 bg-destructive border border-border rounded-none p-0.5 text-white hover:bg-red-600 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5">
                      Watermark Position
                    </label>
                    <select
                      value={watermarkPosition}
                      onChange={(e) => setWatermarkPosition(e.target.value)}
                      className="w-full bg-white border-2 border-border py-2.5 px-4 text-foreground font-semibold outline-none transition-all cursor-pointer"
                      disabled={submitting}
                    >
                      <option value="bottom-right">Bottom-Right</option>
                      <option value="bottom-left">Bottom-Left</option>
                      <option value="top-right">Top-Right</option>
                      <option value="top-left">Top-Left</option>
                      <option value="center">Center</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <span className="block text-foreground text-xs font-black uppercase tracking-wider">
                        Enable by Default
                      </span>
                      <span className="text-zinc-500 text-xs">Automatically toggle on in Composer</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWatermarkEnabledDefault(!watermarkEnabledDefault)}
                      className={`relative inline-flex h-6.5 w-12 items-center rounded-none border-2 border-border transition-colors cursor-pointer outline-none ${
                        watermarkEnabledDefault ? 'bg-primary' : 'bg-muted'
                      }`}
                      disabled={submitting}
                    >
                      <span
                        className={`inline-block h-4 w-4 border-2 border-border transform rounded-none bg-white transition-transform ${
                          watermarkEnabledDefault ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t-2 border-border pt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border-2 border-border bg-card text-foreground font-black text-xs uppercase tracking-wide hover:bg-muted transition-all cursor-pointer"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingFile}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground font-black border-2 border-border shadow-[3px_3px_0px_0px_var(--shadow-color)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_var(--shadow-color)] transition-all cursor-pointer text-xs uppercase tracking-wide disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} className="stroke-[2.5]" />
                      Save Channel
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
