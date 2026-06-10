
import { NextResponse } from 'next/server';
import { getReportData, ReportData } from '@/lib/api/reportMySQL';
import { getIstDateString } from '@/lib/utils/mealStatus';

export async function GET() {
  try {
    console.log('[api/reports/export] Starting');
    const date = getIstDateString();
    const month = date.slice(0, 7);
    const reportData: ReportData = await getReportData(date);
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>MessMate Monthly Report - ${month}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          max-width: 900px;
          margin: 0 auto;
          padding: 40px;
          color: #1e293b;
          background-color: #fafafa;
          line-height: 1.6;
        }
        .page {
          background-color: white;
          padding: 60px 50px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        h1 { 
          color: #2563eb; 
          font-size: 3.5rem; 
          font-weight: 800;
          letter-spacing: -0.05em;
        }
        h2 { 
          color: #1e3a8a; 
          font-size: 1.75rem;
          font-weight: 700;
          border-bottom: 3px solid #e0e7ff; 
          padding-bottom: 12px; 
          margin-top: 48px; 
          margin-bottom: 24px;
        }
        h3 {
          color: #374151;
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 24px;
          margin-bottom: 12px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 16px 0; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        th, td { 
          border: 1px solid #e5e7eb; 
          padding: 14px 16px; 
          text-align: left; 
        }
        th { 
          background: linear-gradient(to bottom, #f9fafb, #f3f4f6); 
          color: #1f2937;
          font-weight: 600;
        }
        .cover {
          text-align: center;
          min-height: 85vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding-bottom: 40px;
        }
        .cover-badge {
          display: inline-block;
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          color: #1e40af;
          padding: 8px 24px;
          border-radius: 999px;
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin: 24px 0;
        }
        .kpi-card {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
        }
        .kpi-card.blue {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1px solid #bfdbfe;
        }
        .kpi-card.orange {
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          border: 1px solid #fed7aa;
        }
        .kpi-card.purple {
          background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
          border: 1px solid #e9d5ff;
        }
        .kpi-label {
          color: #64748b;
          font-size: 0.95rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .kpi-value { 
          font-size: 2.5rem; 
          font-weight: 800; 
          color: #065f46;
        }
        .kpi-card.blue .kpi-value { color: #1e40af; }
        .kpi-card.orange .kpi-value { color: #92400e; }
        .kpi-card.purple .kpi-value { color: #7c3aed; }
        .kpi-icon {
          font-size: 2rem;
          margin-bottom: 8px;
        }
        .scorecard {
          background: linear-gradient(135deg, #dbeafe 0%, #d1fae5 100%);
          padding: 40px;
          border-radius: 16px;
          text-align: center;
          margin: 40px 0;
          border: 2px solid #a7f3d0;
        }
        .scorecard-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-top: 24px;
        }
        .score-item {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .score-label {
          font-size: 0.85rem;
          color: #64748b;
          margin-bottom: 4px;
          text-transform: uppercase;
          font-weight: 600;
        }
        .score-grade {
          font-size: 2rem;
          font-weight: 800;
        }
        .grade-a { color: #059669; }
        .grade-b { color: #d97706; }
        .grade-c { color: #dc2626; }
        .grade-d { color: #991b1b; }
        .grade {
          font-size: 5rem;
          font-weight: 800;
          background: linear-gradient(135deg, #2563eb, #10b981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-top: 24px;
        }
        .sustainability {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          padding: 32px;
          border-radius: 12px;
          margin: 24px 0;
        }
        .sustainability-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 16px;
        }
        .sustain-item {
          text-align: center;
        }
        .sustain-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #065f46;
        }
        .sustain-label {
          color: #064e3b;
          font-size: 0.9rem;
        }
        .insight-card {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 16px 20px;
          margin: 12px 0;
          border-radius: 0 8px 8px 0;
        }
        .insight-card.green {
          background: #d1fae5;
          border-left-color: #10b981;
        }
        .insight-card.blue {
          background: #dbeafe;
          border-left-color: #3b82f6;
        }
        .insight-card.red {
          background: #fee2e2;
          border-left-color: #ef4444;
        }
        .leftover-table td {
          vertical-align: middle;
        }
        .footer {
          margin-top: 60px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #64748b;
          font-size: 0.9rem;
        }
        @media print {
          body { 
            width: 100%; 
            padding: 0;
            background-color: white;
          }
          .page {
            box-shadow: none;
            padding: 40px;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="cover">
          <div class="cover-badge">Hostel A</div>
          <h1 style="margin-top: 24px;">MESSMATE</h1>
          <p style="font-size: 1.25rem; color: #64748b; margin-top: 8px;">Smart Hostel Mess Management System</p>
          <h2 style="border: none; margin-top: 60px; font-size: 2.5rem; font-weight: 700;">Monthly Operations Report</h2>
          <p style="font-size: 1.75rem; margin: 12px 0; color: #374151; font-weight: 500;">${month}</p>
          <p style="margin-top: 32px; font-size: 1.15rem;">Prepared for: Warden &amp; Mess Committee</p>
          <p style="color: #6b7280; margin-top: 8px;">Generated on: ${date}</p>
        </div>

        <h2>Executive Summary</h2>
        
        <div class="kpi-grid">
          <div class="kpi-card blue">
            <div class="kpi-icon">📊</div>
            <div class="kpi-label">Student Satisfaction</div>
            <div class="kpi-value">${reportData.executiveSummary.avgRating}/5</div>
          </div>
          <div class="kpi-card green">
            <div class="kpi-icon">♻️</div>
            <div class="kpi-label">Waste Recovery</div>
            <div class="kpi-value">${reportData.executiveSummary.leftoverStats.recoveryRate}</div>
          </div>
          <div class="kpi-card orange">
            <div class="kpi-icon">💰</div>
            <div class="kpi-label">Budget Utilization</div>
            <div class="kpi-value">${reportData.executiveSummary.budgetUtilization}</div>
          </div>
          <div class="kpi-card purple">
            <div class="kpi-icon">👥</div>
            <div class="kpi-label">Active Students</div>
            <div class="kpi-value">${reportData.executiveSummary.totalStudents}</div>
          </div>
        </div>

        <h3>Key Insights</h3>
        ${reportData.insights.map((i: string, index: number) => {
          let colorClass = 'blue';
          if (i.includes('exceeds') || i.includes('Consider adjusting')) colorClass = 'orange';
          if (i.includes('Excellent') || i.includes('Great')) colorClass = 'green';
          if (i.includes('Only') && i.includes('recovered')) colorClass = 'red';
          return `<div class="insight-card ${colorClass}">${i}</div>`;
        }).join('')}

        <h2>Attendance Analytics</h2>
        <div class="kpi-grid">
          ${reportData.meal_attendance.map((m: any) => `
            <div class="kpi-card blue">
              <div class="kpi-label">${m.meal_type}</div>
              <div class="kpi-value">${m.percentage}%</div>
              <div style="margin-top: 4px; color: #64748b;">${m.count} meals</div>
            </div>
          `).join('')}
        </div>
        
        <h3>Weekly Trend</h3>
        <table>
          <thead>
            <tr><th>Date</th><th>Meal Type</th><th>Attendance</th></tr>
          </thead>
          <tbody>
            ${reportData.attendanceTrends.length > 0 ? 
              reportData.attendanceTrends.map((t) => `<tr><td>${t.date}</td><td>${t.meal_type}</td><td>${t.count}</td></tr>`).join('') :
              '<tr><td colspan="3">No attendance data yet.</td></tr>'
            }
          </tbody>
        </table>

        <h2>Menu Performance Report</h2>
        
        <h3>🏆 Top Rated Meals</h3>
        ${reportData.topRatedMeals.length > 0 ?
          `<ol style="margin-left:24px; line-height:2; font-size:1.1rem;">
            ${reportData.topRatedMeals.map((m) => `<li>${m.name} <span style="color:#059669; font-weight:700;">- ${m.rating}/5</span></li>`).join('')}
          </ol>` :
          `<p style="color:#64748b;">No ratings yet.</p>`
        }

        <h3>⚠️ Lowest Rated Meals</h3>
        ${reportData.lowestRatedMeals.length > 0 ?
          `<ol style="margin-left:24px; line-height:2; font-size:1.1rem;">
            ${reportData.lowestRatedMeals.map((m) => `<li>${m.name} <span style="color:#dc2626; font-weight:700;">- ${m.rating}/5</span></li>`).join('')}
          </ol>` :
          `<p style="color:#64748b;">No ratings yet.</p>`
        }

        <h2>Leftover Management Report</h2>
        
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Declared</div>
            <div class="kpi-value">${reportData.executiveSummary.leftoverStats.totalPortionsDeclared}</div>
          </div>
          <div class="kpi-card green">
            <div class="kpi-label">Claimed Portions</div>
            <div class="kpi-value">${reportData.executiveSummary.leftoverStats.totalClaimed}</div>
          </div>
        </div>

        <h3>Detailed Breakdown</h3>
        <table class="leftover-table">
          <thead>
            <tr><th>Meal</th><th>Dish</th><th>Total Portions</th><th>Claimed</th><th>Expired</th></tr>
          </thead>
          <tbody>
            ${reportData.leftover_details.length > 0 ? 
              reportData.leftover_details.map((l) => `
                <tr>
                  <td style="font-weight:600;">${l.meal_type}</td>
                  <td>${l.dish_name}</td>
                  <td>${l.total_portions}</td>
                  <td style="color:#059669; font-weight:600;">${l.claimed_count}</td>
                  <td style="color:#dc2626; font-weight:600;">${l.expired_count}</td>
                </tr>
              `).join('') :
              '<tr><td colspan="5">No leftover data yet.</td></tr>'
            }
          </tbody>
        </table>

        <h2>Most Requested Meals</h2>
        ${reportData.mostRequestedMeals.length > 0 ?
          `<ol style="margin-left:24px; line-height:2; font-size:1.1rem;">
            ${reportData.mostRequestedMeals.map((m) => `<li>${m.dish_name} <span style="color:#7c3aed; font-weight:700;">- ${m.votes} votes</span></li>`).join('')}
          </ol>` :
          `<p style="color:#64748b;">No votes yet.</p>`
        }

        <h2>Sustainability Impact</h2>
        <div class="sustainability">
          <p style="font-size:1.25rem; color:#065f46; font-weight:600; text-align:center;">
            🌱 Making a Positive Impact on the Environment
          </p>
          <div class="sustainability-grid">
            <div class="sustain-item">
              <div class="sustain-value">${reportData.sustainability.portions_saved}</div>
              <div class="sustain-label">Portions Saved</div>
            </div>
            <div class="sustain-item">
              <div class="sustain-value">${reportData.sustainability.estimated_waste_prevented_kg} kg</div>
              <div class="sustain-label">Waste Prevented</div>
            </div>
            <div class="sustain-item">
              <div class="sustain-value">${reportData.sustainability.estimated_co2_reduction_kg} kg</div>
              <div class="sustain-label">CO₂ Reduction</div>
            </div>
          </div>
        </div>

        <h2>Cost Tracking</h2>
        <div class="kpi-grid">
          <div class="kpi-card orange">
            <div class="kpi-label">Monthly Budget</div>
            <div class="kpi-value">₹${reportData.executiveSummary.monthlyBudget.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Actual Spend</div>
            <div class="kpi-value">₹${reportData.executiveSummary.actualSpend.toLocaleString()}</div>
          </div>
          <div class="kpi-card green">
            <div class="kpi-label">Remaining</div>
            <div class="kpi-value">₹${reportData.executiveSummary.remainingBudget.toLocaleString()}</div>
          </div>
        </div>

        <div class="scorecard">
          <h2 style="border: none; margin-top: 0; margin-bottom: 8px;">Mess Performance Scorecard</h2>
          <div class="scorecard-grid">
            <div class="score-item">
              <div class="score-label">Attendance</div>
              <div class="score-grade grade-${reportData.scorecard.attendance.toLowerCase().replace('+', '')}">
                ${reportData.scorecard.attendance}
              </div>
            </div>
            <div class="score-item">
              <div class="score-label">Satisfaction</div>
              <div class="score-grade grade-${reportData.scorecard.satisfaction.toLowerCase().replace('+', '')}">
                ${reportData.scorecard.satisfaction}
              </div>
            </div>
            <div class="score-item">
              <div class="score-label">Budget Control</div>
              <div class="score-grade grade-${reportData.scorecard.budget_control.toLowerCase().replace('+', '')}">
                ${reportData.scorecard.budget_control}
              </div>
            </div>
            <div class="score-item">
              <div class="score-label">Waste Reduction</div>
              <div class="score-grade grade-${reportData.scorecard.waste_reduction.toLowerCase().replace('+', '')}">
                ${reportData.scorecard.waste_reduction}
              </div>
            </div>
          </div>
          <div style="margin-top:32px;">
            <p style="font-size:1.25rem; color:#4b5563; margin-bottom:8px;">Overall Grade</p>
            <div class="grade">${reportData.scorecard.overall_grade}</div>
          </div>
        </div>

        <div class="footer">
          <p>Generated by MessMate • ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          <p style="margin-top:4px;">Powered by smart hostel management</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="MessMate-Report-${month}.html"`,
    },
  });
  } catch (error) {
    console.error('[api/reports/export] Failed:', error);
    return new NextResponse(`Error generating report: ${error instanceof Error ? error.message : String(error)}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
