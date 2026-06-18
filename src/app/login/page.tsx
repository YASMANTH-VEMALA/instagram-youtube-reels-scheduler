'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, Loader2, Scissors, ArrowRight, ShieldAlert, Check, X, Eye, EyeOff } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showMailBrowser, setShowMailBrowser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'forgot') {
      try {
        const res = await fetch('/api/reset-password/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to request password reset.');
        }

        if (data.token) {
          setResetToken(data.token);
          setShowMailBrowser(true);
          setSuccess('Reset link generated! Open the Mail Client overlay below to complete the reset.');
        } else {
          setError('This email is not registered in the database. Please use a registered email (e.g. admin@clipping.com).');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'reset') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/reset-password/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: resetToken, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to update password.');
        }

        setSuccess('Password updated successfully! Redirecting to login...');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
        setTimeout(() => {
          setMode('login');
          setSuccess('');
        }, 1500);
      } catch (err: any) {
        setError(err.message || 'Failed to update password.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const endpoint = mode === 'login' ? '/api/login' : '/api/signup';
      const payload = { email, password };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${mode === 'login' ? 'authenticate' : 'register'}.`);
      }

      if (mode === 'signup') {
        setSuccess('Registration successful! Logging you in...');
        setTimeout(() => {
          router.refresh();
          router.push(callbackUrl);
        }, 1200);
      } else {
        router.refresh();
        router.push(callbackUrl);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const resetModes = (targetMode: 'login' | 'signup' | 'forgot' | 'reset') => {
    setError('');
    setSuccess('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setMode(targetMode);
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background relative">
      {/* Background decorative patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(at_top_right,rgba(255,51,51,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(at_bottom_left,rgba(0,102,255,0.08),transparent_50%)] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="glass-panel p-8 shadow-[6px_6px_0px_0px_var(--shadow-color)] relative overflow-hidden bg-white border-2 border-border rounded-none">
          {/* Accent border strip */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
          
          <div className="text-center mb-8 pt-2">
            <div className="w-12 h-12 bg-primary border-2 border-border flex items-center justify-center font-black text-primary-foreground shadow-[3px_3px_0px_0px_var(--shadow-color)] mx-auto mb-4">
              <Scissors size={22} className="stroke-[2.5]" />
            </div>
            <h1 className="text-3xl font-black text-foreground uppercase tracking-wide">
              {mode === 'login' && 'Welcome Back'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'reset' && 'Set New Password'}
            </h1>
            <p className="text-zinc-600 font-semibold text-sm mt-1">
              {mode === 'login' && 'Sign in to manage your clipping automation'}
              {mode === 'signup' && 'Get started with your personal clipping channel manager'}
              {mode === 'forgot' && 'Request a secure verification reset link'}
              {mode === 'reset' && 'Set your new account password'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-destructive text-destructive rounded-none p-3.5 text-xs font-bold mb-6 flex items-center gap-2">
              <ShieldAlert size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border-2 border-green-600 text-green-700 rounded-none p-3.5 text-xs font-bold mb-6 flex items-center gap-2">
              <Check size={16} className="flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode !== 'reset' && (
              <div>
                <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground pointer-events-none">
                    <Mail size={16} className="stroke-[2.5]" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="name@clipping.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border-2 border-border rounded-none py-2.5 pl-10 pr-4 text-sm text-foreground font-semibold placeholder-zinc-400 outline-none focus:ring-2 focus:ring-primary focus:border-border transition-all"
                    disabled={loading || mode === 'forgot' && showMailBrowser}
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-foreground text-xs font-black uppercase tracking-wider" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => resetModes('forgot')}
                    className="text-[10px] text-zinc-500 hover:text-primary font-black uppercase tracking-wider cursor-pointer font-sans"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground pointer-events-none">
                    <Lock size={16} className="stroke-[2.5]" />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border-2 border-border rounded-none py-2.5 pl-10 pr-10 text-sm text-foreground font-bold placeholder-zinc-400 outline-none focus:ring-2 focus:ring-primary focus:border-border transition-all"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} className="stroke-[2.5]" /> : <Eye size={16} className="stroke-[2.5]" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground pointer-events-none">
                    <Lock size={16} className="stroke-[2.5]" />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border-2 border-border rounded-none py-2.5 pl-10 pr-10 text-sm text-foreground font-bold placeholder-zinc-400 outline-none focus:ring-2 focus:ring-primary focus:border-border transition-all"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} className="stroke-[2.5]" /> : <Eye size={16} className="stroke-[2.5]" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <>
                <div>
                  <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5" htmlFor="password">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground pointer-events-none">
                      <Lock size={16} className="stroke-[2.5]" />
                    </span>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border-2 border-border rounded-none py-2.5 pl-10 pr-10 text-sm text-foreground font-bold placeholder-zinc-400 outline-none focus:ring-2 focus:ring-primary focus:border-border transition-all"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} className="stroke-[2.5]" /> : <Eye size={16} className="stroke-[2.5]" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-foreground text-xs font-black uppercase tracking-wider mb-1.5" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-foreground pointer-events-none">
                      <Lock size={16} className="stroke-[2.5]" />
                    </span>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white border-2 border-border rounded-none py-2.5 pl-10 pr-10 text-sm text-foreground font-bold placeholder-zinc-400 outline-none focus:ring-2 focus:ring-primary focus:border-border transition-all"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={16} className="stroke-[2.5]" /> : <Eye size={16} className="stroke-[2.5]" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || mode === 'forgot' && showMailBrowser}
              className="w-full py-3 bg-primary text-primary-foreground font-black border-2 border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--shadow-color)] transition-all cursor-pointer flex items-center justify-center gap-2 text-sm uppercase tracking-wider disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-primary-foreground" />
                  <span>
                    {mode === 'login' && 'Verifying...'}
                    {mode === 'signup' && 'Registering...'}
                    {mode === 'forgot' && 'Generating...'}
                    {mode === 'reset' && 'Updating...'}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'login' && 'Sign In'}
                    {mode === 'signup' && 'Sign Up'}
                    {mode === 'forgot' && 'Send Reset Link'}
                    {mode === 'reset' && 'Update Password'}
                  </span>
                  <ArrowRight size={14} className="stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Toggle link */}
          <div className="mt-6 text-center border-t-2 border-border pt-4">
            {mode === 'forgot' || mode === 'reset' ? (
              <button
                onClick={() => {
                  resetModes('login');
                  setShowMailBrowser(false);
                }}
                className="text-xs text-foreground hover:underline font-black uppercase tracking-wider cursor-pointer"
                disabled={loading}
              >
                Back to Sign In
              </button>
            ) : (
              <button
                onClick={() => {
                  resetModes(mode === 'login' ? 'signup' : 'login');
                }}
                className="text-xs text-foreground hover:underline font-black uppercase tracking-wider cursor-pointer"
                disabled={loading}
              >
                {mode === 'login' 
                  ? "Don't have an account? Create one" 
                  : "Already have an account? Sign in"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mock In-App Mail Inbox Browser Overlay */}
      {showMailBrowser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl border-4 border-border bg-white shadow-[8px_8px_0px_0px_var(--shadow-color)] flex flex-col max-h-[85vh] rounded-none">
            {/* Mail Client Window Top Title Bar */}
            <div className="bg-primary text-primary-foreground font-black uppercase tracking-wider text-xs px-4 py-3 flex justify-between items-center border-b-4 border-border">
              <span>✉️ Clipper Mail Browser ({email})</span>
              <button 
                onClick={() => setShowMailBrowser(false)}
                className="bg-white text-foreground border-2 border-border px-2 py-0.5 font-black hover:bg-zinc-200 active:translate-y-[1px] transition-all text-[10px]"
              >
                CLOSE [X]
              </button>
            </div>

            {/* Split Panel Body */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-[50vh]">
              {/* Left Column: Inbox List */}
              <div className="w-full md:w-1/3 border-b-4 md:border-b-0 md:border-r-4 border-border bg-zinc-100 flex flex-col overflow-y-auto">
                <div className="p-3 border-b-2 border-border bg-zinc-200 text-zinc-600 text-[10px] font-black uppercase tracking-wider">
                  Inbox (1)
                </div>
                <div className="p-4 bg-white border-b-2 border-border flex flex-col gap-1 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-xs text-foreground uppercase tracking-wide">IG Clipper Support</span>
                    <span className="text-[10px] text-zinc-500 font-bold">Just now</span>
                  </div>
                  <span className="font-extrabold text-xs text-foreground">Password Reset Request</span>
                  <p className="text-[10px] text-zinc-500 truncate font-semibold">Hi, We received a request to reset your...</p>
                  <span className="w-2.5 h-2.5 bg-primary rounded-none border border-border mt-1 self-start"></span>
                </div>
              </div>

              {/* Right Column: Mail Detail View */}
              <div className="w-full md:w-2/3 p-6 bg-white flex flex-col justify-between overflow-y-auto">
                <div>
                  <div className="border-b-2 border-border pb-4 mb-4 space-y-1">
                    <div className="text-xs">
                      <strong className="font-black uppercase tracking-wider text-zinc-500 mr-2">From:</strong>
                      <span className="font-bold text-foreground">IG Clipper Support &lt;noreply@clipping.com&gt;</span>
                    </div>
                    <div className="text-xs">
                      <strong className="font-black uppercase tracking-wider text-zinc-500 mr-2">To:</strong>
                      <span className="font-bold text-foreground">{email}</span>
                    </div>
                    <div className="text-xs">
                      <strong className="font-black uppercase tracking-wider text-zinc-500 mr-2">Subject:</strong>
                      <span className="font-extrabold text-foreground">Password Reset Request</span>
                    </div>
                  </div>

                  {/* HTML Content */}
                  <div className="space-y-4 text-sm text-foreground font-semibold font-sans">
                    <p>Hi,</p>
                    <p>
                      We received a request to reset your password for your IG Clipper account. 
                      You can reset your password by clicking the button below:
                    </p>
                    
                    <div className="py-4">
                      <button
                        onClick={() => {
                          setMode('reset');
                          setShowMailBrowser(false);
                          setSuccess('Verify your identity by setting a new password below.');
                        }}
                        className="px-6 py-3 bg-primary text-primary-foreground font-black border-2 border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--shadow-color)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer text-xs uppercase tracking-wider"
                      >
                        Reset Password
                      </button>
                    </div>

                    <p className="text-xs text-zinc-500">
                      If you did not request a password reset, you can safely ignore this email. This link will expire in 15 minutes.
                    </p>
                  </div>
                </div>

                <div className="border-t-2 border-border pt-4 mt-6 text-[10px] text-zinc-400 font-bold uppercase tracking-wider text-center">
                  IG Clipper Mail Server v1.0.0
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
        <div className="flex flex-col items-center">
          <Loader2 className="animate-spin text-primary mb-2" size={36} />
          <span className="text-foreground font-black uppercase text-xs tracking-wider">Loading security...</span>
        </div>
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
