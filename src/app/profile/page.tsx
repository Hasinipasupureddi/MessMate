'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle2, Mail, Shield, House, KeyRound, LogOut, Sparkles, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Toaster, toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const initials = useMemo(() => {
    const name = user?.name || 'MessMate User';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join('');
  }, [user?.name]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/sign-up-login-screen');
    }
  }, [loading, router, user]);

  if (!loading && !user) {
    return null;
  }

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to update password.');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogout() {
    await signOut();
    router.replace('/sign-up-login-screen');
  }

  const roleLabel =
    user?.role === 'student'
      ? 'Student'
      : user?.role === 'staff'
        ? 'Mess Staff'
        : user?.role === 'warden'
          ? 'Warden'
          : 'User';

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8" style={{ background: 'hsl(222 47% 6%)' }}>
      <Toaster position="top-right" richColors />

      <div className="mx-auto max-w-6xl">
        <div className="mb-5 sm:mb-6 rounded-[1.5rem] border border-cyan-400/20 bg-slate-950/55 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_0_38px_rgba(34,211,238,0.14)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-[1rem] border border-cyan-400/40 bg-gradient-to-br from-cyan-400/20 to-teal-400/20 flex items-center justify-center text-lg sm:text-xl font-bold text-cyan-200">
                {initials || 'MM'}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Profile & Settings</h1>
                <p className="text-sm text-cyan-100/75 leading-relaxed">Manage account security and personal details.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.back()}
              className="h-10 px-4 rounded-[0.9rem] border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 transition-all"
            >
              Back
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <section className="xl:col-span-1 rounded-[1.5rem] border border-cyan-400/20 bg-slate-950/55 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_0_32px_rgba(34,211,238,0.11)] hover:shadow-[0_0_38px_rgba(34,211,238,0.15)] transition-all">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserCircle2 size={19} className="text-cyan-300" />
              Profile Details
            </h2>

            <div className="space-y-3 text-sm">
              <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3">
                <div className="text-white/60 mb-1">Full name</div>
                <div className="text-white font-medium">{user?.name || 'MessMate User'}</div>
              </div>

              <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3">
                <div className="text-white/60 mb-1 flex items-center gap-1.5"><Mail size={14} /> Email</div>
                <div className="text-cyan-200 font-medium break-all">{user?.email || 'N/A'}</div>
              </div>

              <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3">
                <div className="text-white/60 mb-1 flex items-center gap-1.5"><Shield size={14} /> Role</div>
                <div className="flex items-center justify-between">
                  <div className="text-white font-medium">{roleLabel}</div>
                  {user?.role === 'student' && (
                    <div className="flex items-center gap-1 bg-green-500/20 border border-green-500/30 px-2 py-0.5 rounded-full">
                      <Sparkles size={10} className="text-green-400" />
                      <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Verified Student</span>
                    </div>
                  )}
                </div>
              </div>

              {user?.rollNo && (
                <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3">
                  <div className="text-white/60 mb-1 flex items-center gap-1.5">Roll Number</div>
                  <div className="text-white font-medium">{user.rollNo}</div>
                </div>
              )}

              <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3">
                <div className="text-white/60 mb-1 flex items-center gap-1.5"><House size={14} /> Hostel / Room</div>
                <div className="text-white font-medium">{user?.hostelId || 'A'}</div>
              </div>
            </div>
          </section>

          <section className="xl:col-span-2 rounded-[1.5rem] border border-cyan-400/20 bg-slate-950/55 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_0_32px_rgba(34,211,238,0.11)] hover:shadow-[0_0_38px_rgba(34,211,238,0.15)] transition-all">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <KeyRound size={19} className="text-cyan-300" />
              Change Password
            </h2>

            <form onSubmit={handlePasswordUpdate} className="space-y-3.5">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="input-glass"
                placeholder="Current password"
                required
                autoComplete="current-password"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="input-glass"
                placeholder="New password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="input-glass"
                placeholder="Confirm new password"
                required
                minLength={8}
                autoComplete="new-password"
              />

              {passwordError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {passwordError}
                </div>
              )}

              <button
                type="submit"
                disabled={savingPassword}
                className="h-11 px-5 rounded-[0.9rem] border border-cyan-400/35 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 transition-all font-semibold disabled:opacity-60"
              >
                {savingPassword ? 'Updating...' : 'Update password'}
              </button>
            </form>

            <div className="mt-6 sm:mt-7 pt-5 sm:pt-6 border-t border-white/10">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Settings size={17} className="text-cyan-300" />
                Account Settings
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-all">
                  <div className="text-white font-medium flex items-center gap-2">
                    <Sparkles size={15} className="text-cyan-300" />
                    Security posture
                  </div>
                  <p className="text-sm text-white/65 mt-1">Password hashing and session-based authorization are active.</p>
                </div>

                <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-all">
                  <div className="text-white font-medium">Student verification</div>
                  <p className="text-sm text-white/65 mt-1">
                    {user?.role === 'student' 
                      ? 'Your account is verified against the hostel student database.' 
                      : 'Verified staff accounts can access operational dashboards.'}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3">
                  <div className="text-white font-medium mb-2">Dietary preference</div>
                  <DietPreferenceControl />
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-5 h-11 px-5 rounded-[0.9rem] border border-red-400/35 bg-red-500/10 text-red-200 hover:bg-red-500/20 transition-all font-semibold inline-flex items-center gap-2"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DietPreferenceControl() {
  const { user, reloadCurrentUser } = useAuth();
  const [value, setValue] = useState<'veg' | 'non_veg' | 'unset'>(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('messmate_diet') : null;
      if (stored === 'veg' || stored === 'non_veg') return stored as any;
      return user?.foodPreference || 'unset';
    } catch {
      return 'unset';
    }
  });

  const save = async (v: 'veg' | 'non_veg' | 'unset') => {
    try {
      if (v === 'unset') {
        window.localStorage.removeItem('messmate_diet');
      } else {
        window.localStorage.setItem('messmate_diet', v);
      }
      
      // Update database if user is logged in
      if (user?.id && v !== 'unset') {
        const response = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, foodPreference: v }),
        });
        
        if (response.ok) {
          await reloadCurrentUser();
        }
      }

      window.dispatchEvent(new Event('messmate-diet-change'));
      setValue(v);
      toast.success('Dietary preference updated successfully.');
    } catch {
      toast.error('Failed to save preference.');
    }
  };

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <input type="radio" name="diet" checked={value === 'veg'} onChange={() => save('veg')} />
          <span className="ml-1">Vegetarian</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="diet" checked={value === 'non_veg'} onChange={() => save('non_veg')} />
          <span className="ml-1">Non-vegetarian</span>
        </label>
      </div>
      <div className="text-xs text-[hsl(var(--muted-foreground))]">Preference is synced with your account and will personalise your dashboard.</div>
    </div>
  );
}
