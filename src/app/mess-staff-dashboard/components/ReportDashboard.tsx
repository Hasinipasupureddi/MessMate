
'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { ReportData } from '@/lib/api/reportMySQL';

const COLORS = ['#10b981', '#6366f1', '#06b6d4', '#f59e0b'];

export default function ReportDashboard() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [hostelName] = useState('Hostel A');

  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchReportData() {
      try {
        const response = await fetch('/api/reports/data');
        console.log('[ReportDashboard] fetch response:', response);
        if (response.ok) {
          const data = await response.json();
          console.log('[ReportDashboard] Got data:', data);
          setReportData(data);
          setError(null);
        } else {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.details || errorData?.error || 'Unknown error';
          console.error('[ReportDashboard] Response error:', errorMessage);
          setError(errorMessage);
        }
      } catch (error) {
        console.error('[ReportDashboard] Failed to fetch report data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchReportData();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/reports/export', {
        method: 'GET',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const month = new Date().toISOString().slice(0, 7);
        a.download = `MessMate-Report-${month}.html`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-white text-xl">Loading report data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-4">
        <div className="text-red-400 text-xl">Failed to load report data</div>
        <div className="text-gray-300 text-sm max-w-2xl text-center">{error}</div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-white text-xl">Failed to load report data</div>
      </div>
    );
  }

  // Transform attendance trends for chart
  const chartAttendanceTrends = reportData.attendanceTrends.reduce((acc, curr) => {
    const existing = acc.find(item => item.date === curr.date);
    if (existing) {
      existing[curr.meal_type as keyof typeof existing] = curr.count;
    } else {
      acc.push({ date: curr.date, breakfast: 0, lunch: 0, snack: 0, dinner: 0, [curr.meal_type]: curr.count });
    }
    return acc;
  }, [] as any[]);

  // Transform waste breakdown for chart
  const chartWasteBreakdown = reportData.wasteBreakdown.map(item => ({
    meal: item.meal_type,
    amount: item.totalAmount
  }));

  // Calculate budget utilization percentage
  const budgetUtilizationPercent = reportData.executiveSummary.budgetUtilization !== "No data" 
    ? Number(reportData.executiveSummary.budgetUtilization.replace('%', ''))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Monthly Operations Report</h2>
          <p className="text-white/60 text-sm">{new Date().toISOString().slice(0,7)} - {hostelName}</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition-all disabled:opacity-50"
        >
          {exporting ? 'Exporting...' : 'Download Report (HTML)'}
        </button>
      </div>

      {/* Executive Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-6 text-center">
          <div className="text-3xl mb-2">📊</div>
          <div className="text-xs uppercase text-white/60 mb-1">Student Satisfaction</div>
          <div className="text-3xl font-bold text-blue-400">{reportData.executiveSummary.avgRating}/5</div>
        </div>
        <div className="glass-card p-6 text-center">
          <div className="text-3xl mb-2">♻️</div>
          <div className="text-xs uppercase text-white/60 mb-1">Waste Recovery</div>
          <div className="text-3xl font-bold text-green-400">{reportData.executiveSummary.leftoverStats.recoveryRate}</div>
        </div>
        <div className="glass-card p-6 text-center">
          <div className="text-3xl mb-2">💰</div>
          <div className="text-xs uppercase text-white/60 mb-1">Budget Utilization</div>
          <div className="text-3xl font-bold text-amber-400">{reportData.executiveSummary.budgetUtilization}</div>
        </div>
        <div className="glass-card p-6 text-center">
          <div className="text-3xl mb-2">👥</div>
          <div className="text-xs uppercase text-white/60 mb-1">Active Students</div>
          <div className="text-3xl font-bold text-purple-400">{reportData.executiveSummary.totalStudents}</div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-bold text-white mb-4">Key Insights</h3>
        <div className="space-y-2">
          {reportData.insights.map((insight, i) => {
            let bgClass = "bg-blue-500/10 border-l-blue-500";
            if (insight.includes("exceeds") || insight.includes("Consider adjusting")) bgClass = "bg-amber-500/10 border-l-amber-500";
            if (insight.includes("Excellent") || insight.includes("Great")) bgClass = "bg-green-500/10 border-l-green-500";
            if (insight.includes("Only") && insight.includes("recovered")) bgClass = "bg-red-500/10 border-l-red-500";
            return (
              <div key={i} className={`p-4 rounded-r-lg border-l-4 ${bgClass}`}>
                <p className="text-white/90">{insight}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Analytics */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-4">Attendance Analytics</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {reportData.meal_attendance.map((m, i) => (
              <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
                <div className="text-xs uppercase text-white/60 mb-1">{m.meal_type}</div>
                <div className="text-2xl font-bold text-blue-400">{m.percentage}%</div>
                <div className="text-xs text-white/50">{m.count} meals</div>
              </div>
            ))}
          </div>
          <div className="h-56">
            {chartAttendanceTrends.length > 0 ? (
              <LineChart data={chartAttendanceTrends} width={450} height={220}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#fff' }} 
                />
                <Legend />
                <Line type="monotone" dataKey="breakfast" stroke="#6366f1" />
                <Line type="monotone" dataKey="lunch" stroke="#10b981" />
                <Line type="monotone" dataKey="snack" stroke="#f59e0b" />
                <Line type="monotone" dataKey="dinner" stroke="#06b6d4" />
              </LineChart>
            ) : (
              <div className="flex justify-center items-center h-full text-white/70">No attendance data yet</div>
            )}
          </div>
        </div>

        {/* Menu Performance */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-4">Menu Performance</h3>
          <div className="mb-4">
            <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
              🏆 Top Rated Meals
            </h4>
            {reportData.topRatedMeals.length > 0 ? (
              <ol className="list-decimal list-inside text-white/70 space-y-2">
                {reportData.topRatedMeals.map((meal, i) => (
                  <li key={i} className="flex justify-between items-center">
                    <span>{meal.name}</span>
                    <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1 rounded">{meal.rating}/5</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-white/70">No ratings data yet</div>
            )}
          </div>
          <div>
            <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
              ⚠️ Lowest Rated Meals
            </h4>
            {reportData.lowestRatedMeals.length > 0 ? (
              <ol className="list-decimal list-inside text-white/70 space-y-2">
                {reportData.lowestRatedMeals.map((meal, i) => (
                  <li key={i} className="flex justify-between items-center">
                    <span>{meal.name}</span>
                    <span className="text-red-400 font-semibold bg-red-500/10 px-2 py-1 rounded">{meal.rating}/5</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-white/70">No ratings data yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leftover Management */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-4">Leftover Management</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
              <div className="text-xl font-bold text-white">{reportData.executiveSummary.leftoverStats.totalPortionsDeclared}</div>
              <div className="text-xs text-white/60">Total Declared</div>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
              <div className="text-xl font-bold text-green-400">{reportData.executiveSummary.leftoverStats.totalClaimed}</div>
              <div className="text-xs text-white/60">Claimed</div>
            </div>
          </div>
          {reportData.leftover_details.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/70 border-b border-white/10">
                    <th className="text-left py-2">Meal</th>
                    <th className="text-left py-2">Dish</th>
                    <th className="text-right py-2">Total</th>
                    <th className="text-right py-2">Claimed</th>
                    <th className="text-right py-2">Expired</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.leftover_details.map((l, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-2 font-semibold">{l.meal_type}</td>
                      <td className="py-2">{l.dish_name}</td>
                      <td className="py-2 text-right">{l.total_portions}</td>
                      <td className="py-2 text-right text-green-400 font-semibold">{l.claimed_count}</td>
                      <td className="py-2 text-right text-red-400 font-semibold">{l.expired_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sustainability Impact */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-4">🌱 Sustainability Impact</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="text-2xl font-bold text-green-400">{reportData.sustainability.portions_saved}</div>
              <div className="text-xs text-white/60">Portions Saved</div>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="text-2xl font-bold text-green-400">{reportData.sustainability.estimated_waste_prevented_kg} kg</div>
              <div className="text-xs text-white/60">Waste Prevented</div>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="text-2xl font-bold text-green-400">{reportData.sustainability.estimated_co2_reduction_kg} kg</div>
              <div className="text-xs text-white/60">CO₂ Reduction</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Tracking */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-4">Cost Tracking</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-white/60">Monthly Budget</p>
              <p className="text-2xl font-bold text-white">₹{reportData.executiveSummary.monthlyBudget.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Actual Spend</p>
              <p className="text-2xl font-bold text-indigo-400">₹{reportData.executiveSummary.actualSpend.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Savings</p>
              <p className="text-2xl font-bold text-emerald-400">₹{reportData.executiveSummary.remainingBudget.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Budget Utilization</p>
              <p className="text-2xl font-bold text-amber-400">{reportData.executiveSummary.budgetUtilization}</p>
            </div>
          </div>
          <div className="h-40 flex justify-center">
            <PieChart width={200} height={160}>
              <Pie
                data={[
                  { name: 'Spent', value: budgetUtilizationPercent },
                  { name: 'Saved', value: 100 - budgetUtilizationPercent },
                ]}
                cx="50%"
                cy="50%"
                outerRadius={60}
                dataKey="value"
              >
                <Cell fill="#6366f1" />
                <Cell fill="#10b981" />
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#fff' }} 
              />
            </PieChart>
          </div>
        </div>

        {/* Most Requested Meals */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-4">Most Requested Meals</h3>
          {reportData.mostRequestedMeals.length > 0 ? (
            <ol className="list-decimal list-inside space-y-2 text-white/80">
              {reportData.mostRequestedMeals.map((item, i) => (
                <li key={i} className="flex justify-between items-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <span>{item.dish_name}</span>
                  <span className="font-semibold text-purple-400">{item.votes} votes</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-white/70">No voting data yet</div>
          )}
        </div>
      </div>

      {/* Performance Scorecard */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-bold text-white mb-6 text-center">Mess Performance Scorecard</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs uppercase text-white/60 mb-1">Attendance</div>
            <div className={`text-4xl font-bold ${
              reportData.scorecard.attendance.startsWith('A') ? 'text-green-400' : 
              reportData.scorecard.attendance.startsWith('B') ? 'text-amber-400' : 
              reportData.scorecard.attendance.startsWith('C') ? 'text-orange-400' : 'text-red-400'
            }`}>
              {reportData.scorecard.attendance}
            </div>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs uppercase text-white/60 mb-1">Satisfaction</div>
            <div className={`text-4xl font-bold ${
              reportData.scorecard.satisfaction.startsWith('A') ? 'text-green-400' : 
              reportData.scorecard.satisfaction.startsWith('B') ? 'text-amber-400' : 
              reportData.scorecard.satisfaction.startsWith('C') ? 'text-orange-400' : 'text-red-400'
            }`}>
              {reportData.scorecard.satisfaction}
            </div>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs uppercase text-white/60 mb-1">Budget Control</div>
            <div className={`text-4xl font-bold ${
              reportData.scorecard.budget_control.startsWith('A') ? 'text-green-400' : 
              reportData.scorecard.budget_control.startsWith('B') ? 'text-amber-400' : 
              reportData.scorecard.budget_control.startsWith('C') ? 'text-orange-400' : 'text-red-400'
            }`}>
              {reportData.scorecard.budget_control}
            </div>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs uppercase text-white/60 mb-1">Waste Reduction</div>
            <div className={`text-4xl font-bold ${
              reportData.scorecard.waste_reduction.startsWith('A') ? 'text-green-400' : 
              reportData.scorecard.waste_reduction.startsWith('B') ? 'text-amber-400' : 
              reportData.scorecard.waste_reduction.startsWith('C') ? 'text-orange-400' : 'text-red-400'
            }`}>
              {reportData.scorecard.waste_reduction}
            </div>
          </div>
        </div>
        <div className="text-center">
          <p className="text-white/60 mb-2">Overall Grade</p>
          <div className="text-7xl font-bold bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
            {reportData.scorecard.overall_grade}
          </div>
        </div>
      </div>
    </div>
  );
}
