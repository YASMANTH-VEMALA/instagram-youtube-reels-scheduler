'use client';

import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Wallet, 
  ExternalLink, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle, 
  FileText, 
  AlertCircle,
  Eye,
  DollarSign
} from 'lucide-react';

interface MonsterLabData {
  configured: boolean;
  apiError: string | null;
  account: {
    email?: string;
    username?: string;
    balance?: number;
  } | null;
  campaigns: Array<{
    id: string;
    name: string;
    payoutRate?: number;
    status?: string;
  }>;
  submissions: Array<{
    id: string;
    sourceUrl: string;
    caption: string;
    publishedAt: string | null;
    igMediaId: string | null;
    monsterlabClipId: string | null;
    monsterlabStatus: string | null;
    monsterlabViews: number | null;
    monsterlabEarnings: number | null;
    channel: {
      name: string;
      igUserId: string;
      monsterlabCampaignId: string | null;
    };
  }>;
}

export default function MonsterLabDashboard() {
  const [data, setData] = useState<MonsterLabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/monsterlab');
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        setErrorMsg('Failed to load MonsterLab dashboard data.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error connecting to the local server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <RefreshCw className="animate-spin text-primary mb-2" size={36} />
        <span className="font-bold text-foreground">Loading MonsterLab Dashboard...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="bg-red-500/10 border-2 border-destructive text-destructive rounded-none p-4 font-bold text-sm flex items-center gap-2">
        <ShieldAlert size={16} />
        {errorMsg}
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className="glass-panel rounded-none p-8 max-w-xl mx-auto text-center border-2 border-border bg-white shadow-[4px_4px_0px_0px_var(--shadow-color)]">
        <AlertCircle size={48} className="text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-black text-foreground uppercase tracking-wide">API Key Not Configured</h2>
        <p className="text-zinc-600 mt-2 mb-6 font-medium">
          Please set the <code className="bg-muted px-1.5 py-0.5 border border-border font-mono text-xs">MONSTERLAB_API_KEY</code> variable in your root <code className="bg-muted px-1.5 py-0.5 border border-border font-mono text-xs">.env</code> file to enable programmatic clipping and statistics tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground uppercase tracking-wide">MonsterLab Integration</h1>
          <p className="text-zinc-600 font-medium mt-1">Track clipping campaign performance and monitor automated submissions.</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-card text-foreground font-bold border-2 border-border shadow-[3px_3px_0px_0px_var(--shadow-color)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer text-xs uppercase tracking-wider"
        >
          <RefreshCw size={14} />
          Refresh Stats
        </button>
      </div>

      {/* Warning Banner for API Error */}
      {data.apiError && (
        <div className="bg-amber-500/10 border-2 border-amber-600 text-amber-800 rounded-none p-4 font-bold text-sm flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-600" />
            <span>MonsterLab API Authentication Failed</span>
          </div>
          <p className="text-xs font-semibold text-zinc-600 ml-6">
            The server responded with: <code className="font-mono bg-white/50 px-1 py-0.5">{data.apiError}</code>. Please double-check that your API key is correct and active in your MonsterLab dashboard.
          </p>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Wallet Balance */}
        <div className="glass-card rounded-none border-2 border-border bg-white p-6 relative overflow-hidden shadow-[4px_4px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between border-b-2 border-border pb-3 mb-4">
            <h3 className="font-black text-sm text-foreground uppercase tracking-wider">Wallet Balance</h3>
            <Wallet className="text-primary" size={20} />
          </div>
          <div className="text-3xl font-black text-foreground font-mono">
            {data.account ? formatCurrency(data.account.balance) : '$0.00'}
          </div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mt-2">
            Estimated earnings available in your ClipIt wallet
          </div>
        </div>

        {/* Local Submissions */}
        <div className="glass-card rounded-none border-2 border-border bg-white p-6 relative overflow-hidden shadow-[4px_4px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between border-b-2 border-border pb-3 mb-4">
            <h3 className="font-black text-sm text-foreground uppercase tracking-wider">Total Submitted</h3>
            <FileText className="text-primary" size={20} />
          </div>
          <div className="text-3xl font-black text-foreground font-mono">
            {data.submissions.length}
          </div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mt-2">
            Clips programmatically queued and reported to MonsterLab
          </div>
        </div>

        {/* API Credentials */}
        <div className="glass-card rounded-none border-2 border-border bg-white p-6 relative overflow-hidden shadow-[4px_4px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between border-b-2 border-border pb-3 mb-4">
            <h3 className="font-black text-sm text-foreground uppercase tracking-wider">Account Profile</h3>
            <CheckCircle className="text-green-600" size={20} />
          </div>
          <div className="text-base font-black text-foreground truncate uppercase tracking-wider">
            {data.account?.username || 'Clipping Partner'}
          </div>
          <div className="text-xs text-zinc-500 font-bold truncate mt-0.5">
            {data.account?.email || 'API key authenticated'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Campaigns Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-none p-6 space-y-4 border-2 border-border bg-white shadow-[4px_4px_0px_0px_var(--shadow-color)]">
            <div className="flex items-center gap-2 border-b-2 border-border pb-3">
              <Briefcase size={20} className="text-primary stroke-[2.5]" />
              <h2 className="font-black text-lg text-foreground uppercase tracking-wide">Available Campaigns</h2>
            </div>
            
            {data.campaigns.length === 0 ? (
              <p className="text-xs text-zinc-500 font-bold italic py-4">No active campaigns fetched from API.</p>
            ) : (
              <div className="space-y-4">
                {data.campaigns.map((camp) => (
                  <div key={camp.id} className="border-2 border-border p-4 bg-muted relative">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-black text-xs text-foreground uppercase tracking-wide block truncate">{camp.name}</span>
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 font-bold text-[9px] border border-green-300 uppercase">
                        {camp.status || 'Active'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] font-bold">
                      <span className="text-zinc-500 uppercase">Campaign ID</span>
                      <span className="font-mono text-foreground">{camp.id}</span>
                    </div>
                    {camp.payoutRate !== undefined && (
                      <div className="mt-1 flex items-center justify-between text-[10px] font-bold">
                        <span className="text-zinc-500 uppercase">Payout / View</span>
                        <span className="text-foreground">{formatCurrency(camp.payoutRate)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submissions Log Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-none p-6 space-y-4 border-2 border-border bg-white shadow-[4px_4px_0px_0px_var(--shadow-color)]">
            <h2 className="font-black text-lg text-foreground uppercase tracking-wide border-b-2 border-border pb-3">
              Programmatic Submissions Log
            </h2>

            {data.submissions.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border bg-muted">
                <FileText size={32} className="text-zinc-400 mx-auto mb-2" />
                <h3 className="font-black text-sm text-foreground uppercase tracking-wide">No submissions recorded</h3>
                <p className="text-zinc-500 text-xs mt-1">
                  Once your background worker publishes a Reel with a campaign ID set, it will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border-2 border-border">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted border-b-2 border-border text-[10px] font-black uppercase text-zinc-600 tracking-wider">
                      <th className="py-3 px-4">Channel & Post</th>
                      <th className="py-3 px-4">Clip ID / Campaign</th>
                      <th className="py-3 px-4">Stats</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {data.submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-foreground truncate max-w-[200px]" title={sub.channel.name}>
                            {sub.channel.name}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-medium truncate max-w-[200px] mt-0.5">
                            {sub.caption || 'No caption'}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px]">
                          <div className="text-foreground font-semibold">ID: {sub.monsterlabClipId || '—'}</div>
                          <div className="text-zinc-500 mt-0.5">Camp: {sub.channel.monsterlabCampaignId || '—'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px]">
                          <div className="flex items-center gap-1 text-foreground">
                            <Eye size={10} />
                            <span>{sub.monsterlabViews !== null ? sub.monsterlabViews : '—'}</span>
                          </div>
                          <div className="flex items-center gap-1 text-green-700 font-semibold mt-0.5">
                            <DollarSign size={10} />
                            <span>{sub.monsterlabEarnings !== null ? sub.monsterlabEarnings.toFixed(4) : '—'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-1.5 py-0.5 font-black text-[9px] border uppercase ${
                            sub.monsterlabStatus === 'active' 
                              ? 'bg-green-100 border-green-300 text-green-700' 
                              : sub.monsterlabStatus === 'pending'
                              ? 'bg-amber-100 border-amber-300 text-amber-700'
                              : 'bg-zinc-100 border-zinc-300 text-zinc-600'
                          }`}>
                            {sub.monsterlabStatus || 'Submitted'}
                          </span>
                          {sub.sourceUrl && (
                            <a 
                              href={sub.sourceUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="block text-[9px] text-primary font-bold hover:underline uppercase tracking-wide mt-1.5"
                            >
                              View Post <ExternalLink size={8} className="inline ml-0.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
