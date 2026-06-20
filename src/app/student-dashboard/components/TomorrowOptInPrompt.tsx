'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, ChevronRight, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getMessMateSocket, subscribeSocketEvent, SOCKET_EVENTS } from '@/lib/socket/client';

type MealSlotName = 'breakfast' | 'lunch' | 'snack' | 'dinner';

type MealOptinStatus = 'attending' | 'skip' | 'takeaway';

type SavedOptin = Partial<Record<MealSlotName, MealOptinStatus>>;

type TomorrowOptInPromptProps = {
  studentId: string;
};

const MEAL_TYPES: MealSlotName[] = ['breakfast', 'lunch', 'snack', 'dinner'];

const formatUpdatedAt = (updatedAt?: string | null) => {
  if (!updatedAt) return '';
  const date = new Date(`${updatedAt}Z`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export default function TomorrowOptInPrompt({ studentId }: TomorrowOptInPromptProps) {
  const tomorrow = getIstDateString(1);
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMeals, setSelectedMeals] = useState<Record<MealSlotName, boolean>>({
    breakfast: false,
    lunch: false,
    snack: false,
    dinner: false,
  });
  const [savedOptins, setSavedOptins] = useState<SavedOptin>({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState<'confirmed' | 'updated' | null>(null);

  const checkStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const [menuRes, optinRes] = await Promise.all([
        fetch(`/api/live/final-menu?date=${tomorrow}`, { signal }),
        fetch(`/api/meal-optins?date=${tomorrow}&studentId=${studentId}`, { signal }),
      ]);

      if (signal?.aborted) return;

      const menuData = await menuRes.json().catch(() => ({}));
      const optinData = await optinRes.json().catch(() => ({}));

      setFinalized(menuData.menu?.status === 'approved');

      const rowStatus: SavedOptin = {};
      const selected: Record<MealSlotName, boolean> = {
        breakfast: false,
        lunch: false,
        snack: false,
        dinner: false,
      };
      let latest: string | null = null;

      (optinData.rows || []).forEach((row: any) => {
        const mealType = String(row.meal_type) as MealSlotName;
        const status = String(row.status) as MealOptinStatus;
        if (MEAL_TYPES.includes(mealType)) {
          rowStatus[mealType] = status;
          selected[mealType] = status === 'attending' || status === 'takeaway';
          const updatedAt = row.updated_at || row.updatedAt || null;
          if (updatedAt && (!latest || updatedAt > latest)) {
            latest = updatedAt;
          }
        }
      });

      setSavedOptins(rowStatus);
      setSelectedMeals(selected);
      setLastUpdatedAt(latest);
      if (Object.keys(rowStatus).length > 0 && statusLabel === null) {
        setStatusLabel('confirmed');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Tomorrow attendance load failed:', error);
    } finally {
      setLoading(false);
    }
  }, [studentId, statusLabel, tomorrow]);

  useEffect(() => {
    const controller = new AbortController();
    void checkStatus(controller.signal);

    const cleanupDashboardRefresh = subscribeSocketEvent(SOCKET_EVENTS.dashboardRefresh, () => {
      void checkStatus(controller.signal);
    });
    const cleanupNotifications = subscribeSocketEvent(SOCKET_EVENTS.notificationsUpdated, () => {
      void checkStatus(controller.signal);
    });

    return () => {
      controller.abort();
      cleanupDashboardRefresh();
      cleanupNotifications();
    };
  }, [checkStatus]);

  const hasSavedAttendance = Object.keys(savedOptins).length > 0;
  const shouldShowConfirmedView = finalized && hasSavedAttendance && !editing;
  const statusTitle = statusLabel === 'updated' ? 'Attendance Updated' : 'Attendance Confirmed';
  const statusCopy = shouldShowConfirmedView ? '✅ ' + statusTitle : 'Will you eat tomorrow?';

  const handleToggleMeal = (mealType: MealSlotName) => {
    setSelectedMeals((prev) => ({
      ...prev,
      [mealType]: !prev[mealType],
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payloads = MEAL_TYPES.map((mealType) => {
        const status: MealOptinStatus = selectedMeals[mealType] ? 'attending' : 'skip';
        return fetch('/api/meal-optins', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            mealDate: tomorrow,
            mealType,
            status,
          }),
        });
      });

      const responses = await Promise.all(payloads);
      const failed = responses.some((res) => !res.ok);
      if (failed) {
        throw new Error('One or more attendance saves failed');
      }

      setEditing(false);
      setStatusLabel(hasSavedAttendance ? 'updated' : 'confirmed');
      toast.success(hasSavedAttendance ? 'Attendance updated' : 'Attendance confirmed');
      getMessMateSocket().emit(SOCKET_EVENTS.dashboardRefresh);
      getMessMateSocket().emit(SOCKET_EVENTS.mealOptinsUpdated);
      void checkStatus();
    } catch (error) {
      console.error('Save attendance failed:', error);
      toast.error('Unable to save attendance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const showWaiting = !loading && !finalized;

  return (
    <div className="glass-card border border-white/10 bg-slate-950/70 p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em]" style={{ color: 'var(--student-muted)' }}>Tomorrow's Attendance</p>
          <h2 className="mt-2 text-lg sm:text-xl font-semibold" style={{ color: 'var(--student-text)' }}>{showWaiting ? 'Menu not finalized yet' : statusCopy}</h2>
        </div>
        <div className="rounded-2xl bg-white/5 px-3 py-2 text-xs" style={{ color: 'var(--student-muted)' }}>
          {tomorrow}
        </div>
      </div>

      {loading ? (
        <div className="mt-5 h-32 rounded-3xl bg-white/5 animate-pulse" />
      ) : showWaiting ? (
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm" style={{ color: 'var(--student-muted)' }}>
          <p className="font-medium" style={{ color: 'var(--student-text)' }}>Waiting for tomorrow's menu to be finalized by mess staff.</p>
          <p className="mt-2 text-sm" style={{ color: 'var(--student-muted)' }}>You will be able to confirm attendance once tomorrow's menu is approved.</p>
        </div>
      ) : shouldShowConfirmedView ? (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MEAL_TYPES.map((mealType) => {
              const confirmed = savedOptins[mealType] === 'attending' || savedOptins[mealType] === 'takeaway';
              return (
                <div key={mealType} className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="capitalize text-sm" style={{ color: 'var(--student-text)' }}>{mealType}</span>
                  <span className={`text-sm font-semibold ${confirmed ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {confirmed ? '✓' : '✗'}
                  </span>
                </div>
              );
            })}
          </div>

          {lastUpdatedAt && (
            <p className="text-xs" style={{ color: 'var(--student-muted)' }}>Last updated: {formatUpdatedAt(lastUpdatedAt)}</p>
          )}

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400"
          >
            <Pencil size={16} /> Edit Attendance
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <p className="text-sm" style={{ color: 'var(--student-muted)' }}>Will you eat tomorrow?</p>
          <div className="grid grid-cols-2 gap-3">
            {MEAL_TYPES.map((mealType) => (
              <button
                key={mealType}
                type="button"
                onClick={() => handleToggleMeal(mealType)}
                className={`flex items-center justify-between rounded-3xl border px-4 py-4 text-left transition-all ${
                  selectedMeals[mealType]
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-white/10 bg-white/5 hover:border-indigo-500/40 hover:bg-white/10'
                }`}
                style={{ color: selectedMeals[mealType] ? 'var(--student-text)' : 'var(--student-muted)' }}
              >
                <span className="capitalize font-medium">{mealType}</span>
                <span className="text-xl">{selectedMeals[mealType] ? '☑' : '☐'}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs" style={{ color: 'var(--student-muted)' }}>You can update this until the cutoff.</p>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : hasSavedAttendance ? 'Save Changes' : 'Confirm Attendance'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
