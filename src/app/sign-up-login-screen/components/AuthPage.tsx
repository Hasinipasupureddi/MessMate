'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  GraduationCap,
  ChefHat,
  Shield,
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  User,
  Utensils,
  TrendingUp,
  Leaf,
  Star,
  Check,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Toaster, toast } from 'sonner';

type Role = 'student' | 'staff' | 'warden';
type Mode = 'signin' | 'signup' | 'forgot';

const DASHBOARD_ROUTES: Record<Role, string> = {
  student: '/student-dashboard',
  staff: '/mess-staff-dashboard',
  warden: '/warden-analytics',
};

function getDashboardRoute(role: string | undefined, fallback: Role): string {
  if (role === 'student' || role === 'staff' || role === 'warden') {
    return DASHBOARD_ROUTES[role];
  }
  return DASHBOARD_ROUTES[fallback];
}

const ROLE_CONFIG: Record<Role, { label: string; icon: React.ReactNode; description: string }> = {
  student: {
    label: 'Student',
    icon: <GraduationCap size={18} />,
    description: 'Access your meal schedule, vote for dishes and track your food journey.',
  },
  staff: {
    label: 'Mess Staff',
    icon: <ChefHat size={18} />,
    description: 'Manage cooking plans, ingredient quantities and meal operations.',
  },
  warden: {
    label: 'Warden',
    icon: <Shield size={18} />,
    description: 'Review analytics, waste trends and satisfaction outcomes.',
  },
};

const FEATURES = [
  { icon: <Utensils size={20} />, text: 'AI-powered meal demand prediction' },
  { icon: <TrendingUp size={20} />, text: 'Real-time waste and cost analytics' },
  { icon: <Leaf size={20} />, text: 'Reduce food waste by up to 40%' },
  { icon: <Star size={20} />, text: 'Student satisfaction tracking' },
];

const SAMPLE_ACCOUNTS = [
  { key: 'student', role: 'Student', identifier: 'arjun.mehta@messmate.in', password: 'Student@2026' },
  { key: 'staff', role: 'Mess Staff', identifier: 'raju.cook@messmate.in', password: 'Cook@2026' },
  { key: 'warden', role: 'Warden', identifier: 'dr.sharma@messmate.in', password: 'Warden@2026' },
];

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [activeRole, setActiveRole] = useState<Role>('student');
  const [email, setEmail] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [hostelId, setHostelId] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetLink, setResetLink] = useState('');

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  function clearForm() {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setResetLink('');
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    clearForm();
  }

  function handleDemoFill() {
    const account = SAMPLE_ACCOUNTS.find((item) => item.key === activeRole) ?? SAMPLE_ACCOUNTS[0];
    setEmail(account.identifier);
    setPassword(account.password);
    setMode('signin');
    setError(null);

    const payload = `Identifier: ${account.identifier}\nPass: ${account.password}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(payload).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }).catch(() => {
        // ignore clipboard failures
      });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResetLink('');

    try {
      if (mode === 'signin') {
        const response = await signIn(email.trim(), password, { rememberMe });
        const user = response?.user;
        if (!user) {
          throw new Error('Sign in succeeded but no user session was returned.');
        }

        const target = getDashboardRoute(user.role, activeRole);
        toast.success('Welcome back! Redirecting to dashboard...');
        router.push(target);
        return;
      }

      if (mode === 'forgot') {
        const response = await fetch('/api/auth/password/forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Failed to request password reset.');
        }

        const generatedLink = typeof payload?.resetUrl === 'string' ? payload.resetUrl : '';
        if (generatedLink) {
          setResetLink(generatedLink);
          const target = new URL(generatedLink, window.location.origin);
          toast.success('Reset link generated. Opening reset form.');
          router.push(`${target.pathname}${target.search}`);
          return;
        }

        setError('If the email exists, a reset link has been sent.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      const response = await signUp(email.trim(), password, {
        rollNo: activeRole === 'student' ? rollNo.trim() : undefined,
        fullName: fullName.trim(),
        role: activeRole,
        hostelId: hostelId.trim(),
      });

      toast.success('Account created successfully! You can now sign in.');
      setMode('signin');
    } catch (err: any) {
      const message = String(err?.message || '').toLowerCase();

      if (message.includes('roll number is already registered')) {
        setError('This roll number is already registered.');
      } else if (message.includes('email is already registered')) {
        setError('This email is already registered.');
      } else if (message.includes('invalid roll')) {
        setError('Invalid Roll Number.');
      } else if (message.includes('invalid credentials')) {
        setError('Invalid roll number/email or password.');
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden lg:flex-row" style={{ background: 'hsl(222 47% 6%)' }}>
      <Toaster position="top-right" richColors />

      <div className="hidden lg:flex lg:w-[46%] relative flex-col justify-start px-10 xl:px-12 py-9 overflow-hidden gap-7 xl:gap-8">
        <div className="absolute inset-0 gradient-primary opacity-90" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 50%, rgba(34,211,238,0.3) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(14,116,144,0.3) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 pt-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 xl:w-12 xl:h-12 rounded-[0.95rem] bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <span className="text-2xl">🍽️</span>
            </div>
            <div>
              <h1 className="text-xl xl:text-2xl font-bold text-white tracking-tight">MessMate</h1>
              <p className="text-white/70 text-xs xl:text-sm">AI-Powered Mess Management</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-4 xl:space-y-5">
          <div>
            <h2 className="text-3xl xl:text-[2.1rem] font-bold text-white leading-tight mb-2.5">
              Smarter meals,
            <br />
            <span className="text-cyan-300">simple access.</span>
          </h2>
          <p className="text-white/75 text-[0.96rem] xl:text-[1.03rem] leading-relaxed max-w-md">
            Direct role-based registration for seamless hostel mess operations.
          </p>
        </div>

          <div className="space-y-2">
            {FEATURES.map((item, index) => (
              <div key={`feature-${index}`} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[0.85rem] bg-white/15 flex items-center justify-center text-white flex-shrink-0">
                  {item.icon}
                </div>
                <span className="text-white/85 text-[0.96rem] font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[54%] flex items-center justify-center px-4 py-5 sm:px-6 lg:px-8 xl:px-12 lg:py-8 overflow-y-auto">
        <div className="w-full max-w-[27.5rem]">
          <div className="flex lg:hidden items-center gap-3 mb-5 sm:mb-6 justify-center">
            <div className="w-9 h-9 rounded-[0.9rem] gradient-primary flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.14)]">
              <span className="text-xl">🍽️</span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-white">MessMate</span>
          </div>

          <div className="glass-card auth-shell-card p-5 sm:p-6 lg:p-7 transition-all duration-200">
            <div className="mb-4 sm:mb-5">
              <h2 className="text-2xl font-bold text-white mb-1">
                {isSignup ? 'Create account' : isForgot ? 'Forgot password' : 'Welcome back'}
              </h2>
              <p className="text-[hsl(var(--muted-foreground))] text-sm leading-relaxed">
                {isSignup
                  ? 'Enter your details and roll number to create an account.'
                  : isForgot
                    ? 'Generate a secure reset link for your account.'
                    : 'Sign in with your roll number or email.'}
              </p>
            </div>

            {!isForgot && (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4 sm:mb-5">
                  {(Object.keys(ROLE_CONFIG) as Role[]).map((role) => {
                    const cfg = ROLE_CONFIG[role];
                    const isActive = activeRole === role;
                    return (
                      <button
                        key={`role-${role}`}
                        type="button"
                        onClick={() => setActiveRole(role)}
                        className={`flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-[0.9rem] border transition-all duration-200 text-sm font-medium ${
                          isActive
                            ? 'tab-active'
                            : 'border-white/8 bg-white/3 text-[hsl(var(--muted-foreground))] hover:bg-white/6 hover:border-white/12'
                        }`}
                      >
                        <span className={isActive ? 'text-cyan-300' : ''}>{cfg.icon}</span>
                        <span className={isActive ? 'text-cyan-200' : ''}>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mb-4 px-3 py-2 rounded-[0.9rem] bg-white/4 border border-white/8">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{ROLE_CONFIG[activeRole].description}</p>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
              {isSignup && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-white/80 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="text"
                      className="input-glass pl-10"
                      placeholder="Your name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              {isSignup && activeRole === 'student' && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-white/80 mb-1.5">Roll Number</label>
                  <div className="relative">
                    <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="text"
                      className="input-glass pl-10"
                      placeholder="e.g. 2023CS001"
                      value={rollNo}
                      onChange={(event) => setRollNo(event.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium text-white/80 mb-1.5">
                  {isSignup ? 'Email address' : 'Roll Number or Email'}
                </label>
                <div className="relative">
                  {isSignup ? (
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  ) : (
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  )}
                  <input
                    type={isSignup ? 'email' : 'text'}
                    className="input-glass pl-10"
                    placeholder={isSignup ? 'your@email.com' : 'Roll No or Email'}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {isSignup && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-white/80 mb-1.5">Hostel / Room Details</label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="A-204"
                    value={hostelId}
                    onChange={(event) => setHostelId(event.target.value)}
                    required
                  />
                </div>
              )}

              {!isForgot && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-white/80 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input-glass pl-10 pr-10"
                      placeholder={isSignup ? 'Min. 8 characters' : 'Enter your password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      minLength={isSignup ? 8 : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {isSignup && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-white/80 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="input-glass pl-10 pr-10"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {!isSignup && !isForgot && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-white/20 bg-white/5 accent-cyan-500"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                    />
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {isForgot && resetLink && (
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100 break-all">
                  Reset link generated: {resetLink}
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isSignup ? 'Creating account...' : isForgot ? 'Sending reset link...' : 'Signing in...'}</span>
                  </>
                ) : isSignup ? (
                  <>
                    <Sparkles size={16} />
                    <span>Create Account</span>
                  </>
                ) : isForgot ? (
                  <>
                    <Mail size={16} />
                    <span>Send Reset Link</span>
                  </>
                ) : (
                  <>
                    <span>Sign In as {ROLE_CONFIG[activeRole].label}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 sm:mt-5 text-center">
              <span className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">
                {isSignup ? 'Already have an account? ' : isForgot ? 'Back to login? ' : "Don't have an account? "}
              </span>
              <button
                onClick={() => {
                  const nextMode = isSignup || isForgot ? 'signin' : 'signup';
                  switchMode(nextMode);
                }}
                className="text-xs sm:text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
              >
                {isSignup || isForgot ? 'Sign in' : 'Create account'}
              </button>
            </div>

            {!isForgot && (
              <div className="auth-demo-card mt-3.5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-transparent text-[#9edfff] ring-1 ring-cyan-400/20">
                      <Check size={9} />
                    </div>
                    <div className="truncate text-[13px] sm:text-[14px] font-semibold uppercase tracking-[0.5px] text-[#9edfff]">
                      Demo Credentials
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDemoFill}
                    className="auth-demo-button small inline-flex items-center gap-2"
                    aria-label="Autofill credentials"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(34,211,238,0.28)',
                      boxShadow: '0 0 0 1px rgba(34,211,238,0.08)',
                    }}
                  >
                    {copied ? <Check size={10} /> : <Zap size={10} />}
                    <span className="text-[12px] sm:text-[13px]" style={{ color: '#9edfff' }}>
                      {copied ? 'Copied!' : 'Auto-fill'}
                    </span>
                  </button>
                </div>

                <div className="mt-2 space-y-1 text-[12px] sm:text-[13px] leading-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-14 shrink-0 text-[12px] sm:text-[13px] text-[#9CA3AF] font-medium">Login:</span>
                    <span className="min-w-0 truncate font-medium text-[#22D3EE] text-[12px] sm:text-[13px]">
                      {(SAMPLE_ACCOUNTS.find((item) => item.key === activeRole) || SAMPLE_ACCOUNTS[0]).identifier}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-14 shrink-0 text-[12px] sm:text-[13px] text-[#9CA3AF] font-medium">Pass:</span>
                    <span className="min-w-0 truncate font-medium text-[#22D3EE] text-[12px] sm:text-[13px]">
                      {(SAMPLE_ACCOUNTS.find((item) => item.key === activeRole) || SAMPLE_ACCOUNTS[0]).password}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
