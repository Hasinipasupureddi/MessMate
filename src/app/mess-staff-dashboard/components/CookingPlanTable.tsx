'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Clock, ChefHat } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { subscribeSocketEvent, SOCKET_EVENTS } from '@/lib/socket/client';

interface CookingTask {
  id: string;
  meal: string;
  dish: string;
  quantity: string;
  portions: number;
  startTime: string;
  status: 'pending' | 'cooking' | 'ready' | 'served';
  assignedTo: string;
  notes?: string;
  taskDate?: string;
  mealType?: string;
  taskName?: string;
}

// Map API status to UI status
function mapApiStatusToUiStatus(apiStatus: string): CookingTask['status'] {
  const map: Record<string, CookingTask['status']> = {
    'pending': 'pending',
    'in_progress': 'cooking',
    'done': 'served',
  };
  return map[apiStatus] || 'pending';
}

// Map UI status to API status
function mapUiStatusToApiStatus(uiStatus: CookingTask['status']): string {
  const map: Record<CookingTask['status'], string> = {
    'pending': 'pending',
    'cooking': 'in_progress',
    'ready': 'done',
    'served': 'done',
  };
  return map[uiStatus] || 'pending';
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'text-white/50 bg-white/6 border-white/12' },
  cooking: { label: '🔥 Cooking', color: 'text-amber-400 bg-amber-500/15 border-amber-500/25' },
  ready: { label: '✅ Ready', color: 'text-green-400 bg-green-500/15 border-green-500/25' },
  served: { label: '🍽️ Served', color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/25' },
};

const shortenDishName = (name: string) => {
  if (name.includes('+')) {
    return name.split('+')[0].trim() + ' Combo';
  }
  return name;
};

export default function CookingPlanTable() {
  const [tasks, setTasks] = useState<CookingTask[]>([]);
  const [filter, setFilter] = useState<'all' | 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedAssignment, setEditedAssignment] = useState('');
  const today = getIstDateString();

  const loadTasks = useCallback(async () => {
    try {
      // Add timestamp to bust cache
      const timestamp = Date.now();
      const response = await fetch(`/api/cooking-tasks?date=${today}&t=${timestamp}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch cooking tasks');
      }

      const data = await response.json();
      const enrichedTasks = (data.rows || []).map((row: any) => {
        return {
          id: row.id,
          taskDate: row.taskDate,
          mealType: row.mealType,
          taskName: row.taskName,
          status: row.status, // API already returns UI format
          meal: row.mealType.charAt(0).toUpperCase() + row.mealType.slice(1),
          dish: row.taskName,
          quantity: row.quantity || '—',
          portions: row.portions || 0,
          startTime: row.startTime || '—',
          assignedTo: row.assignedTo || 'Unassigned',
          notes: row.notes || undefined,
        };
      });
      setTasks(enrichedTasks);
      setIsLoading(false);
    } catch (error) {
      console.error('[CookingPlanTable] Load error:', error);
      toast.error((error as Error).message || 'Failed to load cooking tasks');
      setTasks([]);
      setIsLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void loadTasks();

    const refreshTasks = () => {
      void loadTasks();
    };

    const cleanupDashboardRefresh = subscribeSocketEvent(SOCKET_EVENTS.dashboardRefresh, refreshTasks);
    const cleanupMealOptinsUpdated = subscribeSocketEvent(SOCKET_EVENTS.mealOptinsUpdated, refreshTasks);

    return () => {
      cleanupDashboardRefresh();
      cleanupMealOptinsUpdated();
    };
  }, [today, loadTasks]);

  const updateStatus = async (id: string, newStatus: CookingTask['status']) => {
    // Store old task for potential revert
    const oldTask = tasks.find(t => t.id === id);
    if (!oldTask) return;

    // Optimistic update - update UI immediately
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));

    try {
      const apiStatus = mapUiStatusToApiStatus(newStatus);
      console.log(`[CookingPlanTable] Updating task ${id}: ${oldTask.status} → ${newStatus} (API: ${apiStatus})`);
      
      const response = await fetch(`/api/cooking-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: apiStatus }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[CookingPlanTable] Status update failed:', error);
        throw new Error(error.message || 'Failed to update task');
      }

      const result = await response.json();
      console.log('[CookingPlanTable] Status update successful:', result);
      toast.success(`Task updated to ${STATUS_CONFIG[newStatus].label}`);
    } catch (error) {
      // Revert on error
      console.error('[CookingPlanTable] Status update error, reverting:', error);
      setTasks(prev => prev.map(t => t.id === id ? oldTask : t));
      toast.error((error as Error).message || 'Failed to update task');
    }
  };

  const updateAssignment = async (id: string, newAssignment: string) => {
    if (!newAssignment.trim()) {
      toast.error('Assignment cannot be empty');
      return;
    }

    // Store old task for potential revert
    const oldTask = tasks.find(t => t.id === id);
    if (!oldTask) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, assignedTo: newAssignment } : t));
    setEditingTaskId(null);
    
    try {
      console.log(`[CookingPlanTable] Updating assignment for task ${id}: ${oldTask.assignedTo} → ${newAssignment}`);
      
      const response = await fetch(`/api/cooking-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: newAssignment }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[CookingPlanTable] Assignment update failed:', error);
        throw new Error(error.message || 'Failed to update assignment');
      }

      const result = await response.json();
      console.log('[CookingPlanTable] Assignment update successful:', result);
      toast.success(`Assigned to ${newAssignment}`);
    } catch (error) {
      // Revert on error
      console.error('[CookingPlanTable] Assignment update error, reverting:', error);
      setTasks(prev => prev.map(t => t.id === id ? oldTask : t));
      setEditingTaskId(null);
      toast.error((error as Error).message || 'Failed to update assignment');
    }
  };


  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.meal === filter);

  const displayDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">Today&apos;s Cooking Plan</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{displayDate} · {tasks.length} tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <ChefHat size={18} className="text-cyan-400" />
          <span className="text-sm font-semibold text-white">
            {tasks.filter(t => t.status === 'served').length}/{tasks.length} Done
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'Breakfast', 'Lunch', 'Snack', 'Dinner'] as const).map(f => (
          <button
            key={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === f ? 'tab-active' : 'bg-white/4 border border-white/8 text-white/50 hover:bg-white/7'
            }`}
          >
            {f === 'all' ? 'All Meals' : f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              {['Meal', 'Dish', 'Quantity', 'Portions', 'Start Time', 'Assigned To', 'Status', 'Action'].map(h => (
                <th key={`th-${h}`} className="text-left text-xs font-semibold text-white/40 uppercase tracking-wide pb-3 pr-4 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map(task => (
              <tr key={task.id} className="hover:bg-white/3 transition-colors group">
                <td className="py-3 pr-4">
                  <span className="text-xs font-semibold text-white/60">{task.meal}</span>
                </td>
                <td className="py-3 pr-4">
                  <div>
                    <p className="text-sm font-semibold text-white truncate max-w-[200px]" title={task.dish}>
                      {shortenDishName(task.dish)}
                    </p>
                    {task.notes && <p className="text-xs text-indigo-400">{task.notes}</p>}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <span className="text-sm font-mono text-cyan-400">{task.quantity}</span>
                </td>
                <td className="py-3 pr-4">
                  <span className="text-sm font-mono text-white/80">{task.portions}</span>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1 text-xs text-white/60">
                    <Clock size={11} />
                    {task.startTime}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  {editingTaskId === task.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editedAssignment}
                      onChange={(e) => setEditedAssignment(e.target.value)}
                      onBlur={() => updateAssignment(task.id, editedAssignment)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateAssignment(task.id, editedAssignment);
                        if (e.key === 'Escape') setEditingTaskId(null);
                      }}
                      className="text-sm bg-white/10 border border-white/30 text-white rounded-lg px-2 py-1 cursor-text w-full outline-none hover:bg-white/20 transition-all"
                      placeholder="Enter name"
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setEditedAssignment(task.assignedTo);
                      }}
                      className="text-sm text-white/80 cursor-pointer hover:text-white hover:bg-white/10 px-2 py-1 rounded transition-all inline-block"
                      title="Click to edit"
                    >
                      {task.assignedTo}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span className={`status-badge border ${STATUS_CONFIG[task.status].color}`}>
                    {STATUS_CONFIG[task.status].label}
                  </span>
                </td>
                <td className="py-3">
                  {task.status !== 'served' && (
                    <select
                      value={task.status}
                      onChange={(e) => updateStatus(task.id, e.target.value as CookingTask['status'])}
                      className="text-xs bg-white/6 border border-white/12 text-white rounded-lg px-2 py-1 cursor-pointer hover:bg-white/10 transition-all outline-none"
                    >
                      <option className="text-slate-900 bg-white" value="pending">Pending</option>
                      <option className="text-slate-900 bg-white" value="cooking">Cooking</option>
                      <option className="text-slate-900 bg-white" value="ready">Ready</option>
                      <option className="text-slate-900 bg-white" value="served">Served</option>
                    </select>
                  )}
                  {task.status === 'served' && (
                    <CheckCircle2 size={16} className="text-green-400" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        {(['pending', 'cooking', 'ready', 'served'] as const).map(status => {
          const count = tasks.filter(t => t.status === status).length;
          return (
            <div key={`summary-${status}`} className={`p-3 rounded-xl border text-center ${STATUS_CONFIG[status].color}`}>
              <div className="text-xl font-bold font-mono">{count}</div>
              <div className="text-xs mt-0.5">{STATUS_CONFIG[status].label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}