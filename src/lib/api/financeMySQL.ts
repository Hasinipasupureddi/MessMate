import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';
import { v4 as uuidv4 } from 'uuid';

export interface BudgetSettings {
  id: string;
  hostel_id: string;
  monthly_budget: number;
  expected_cost_per_student: number;
  effective_from: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  contact_person?: string;
  phone?: string;
}

export interface Purchase {
  id: string;
  vendor_id: string;
  item_name: string;
  category: 'grains' | 'vegetables' | 'dairy' | 'oil' | 'pulses' | 'misc';
  quantity: number;
  unit: 'kg' | 'litres' | 'pcs';
  total_cost: number;
  invoice_no?: string;
  purchase_date: string;
  staff_id: string;
}

export async function getBudgetSettings(hostelId: string, date?: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const targetDate = date || new Date().toISOString().slice(0, 7) + '-01';

  const [rows] = await pool.execute(
    `SELECT * FROM budget_settings 
     WHERE hostel_id = ? AND effective_from <= ? 
     ORDER BY effective_from DESC LIMIT 1`,
    [hostelId, targetDate]
  );
  return (rows as any[])[0] as BudgetSettings | undefined;
}

export async function saveBudgetSettings(settings: Omit<BudgetSettings, 'id'>) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const id = uuidv4();

  await pool.execute(
    `INSERT INTO budget_settings (id, hostel_id, monthly_budget, expected_cost_per_student, effective_from)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
     monthly_budget = VALUES(monthly_budget),
     expected_cost_per_student = VALUES(expected_cost_per_student)`,
    [id, settings.hostel_id, settings.monthly_budget, settings.expected_cost_per_student, settings.effective_from]
  );
}

export async function getVendors() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [rows] = await pool.execute(`SELECT * FROM vendors ORDER BY name ASC`);
  return rows as Vendor[];
}

export async function getPurchases(startDate: string, endDate: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [rows] = await pool.execute(
    `SELECT p.*, v.name as vendor_name 
     FROM procurement_purchases p
     JOIN vendors v ON p.vendor_id = v.id
     WHERE p.purchase_date BETWEEN ? AND ?
     ORDER BY p.purchase_date DESC`,
    [startDate, endDate]
  );
  return rows as any[];
}

export async function savePurchase(purchase: Omit<Purchase, 'id'>) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const id = uuidv4();

  await pool.execute(
    `INSERT INTO procurement_purchases 
     (id, vendor_id, item_name, category, quantity, unit, total_cost, invoice_no, purchase_date, staff_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      purchase.vendor_id,
      purchase.item_name,
      purchase.category,
      purchase.quantity,
      purchase.unit,
      purchase.total_cost,
      purchase.invoice_no || null,
      purchase.purchase_date,
      purchase.staff_id
    ]
  );
}

export async function getMealCostConfig() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [rows] = await pool.execute(`SELECT meal_type, base_cost_per_portion FROM meal_cost_config`);
  const config: Record<string, number> = {};
  (rows as any[]).forEach(row => {
    config[row.meal_type] = Number(row.base_cost_per_portion);
  });
  return config;
}

export async function getFinanceStats(hostelId: string, month: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const startDate = `${month}-01`;
  const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];

  const [purchases] = await pool.execute(
    `SELECT category, SUM(total_cost) as total 
     FROM procurement_purchases 
     WHERE purchase_date BETWEEN ? AND ?
     GROUP BY category`,
    [startDate, endDate]
  );

  const [wasteCost] = await pool.execute(
    `SELECT SUM(amount * 45) as estimated_loss 
     FROM waste_logs 
     WHERE log_date BETWEEN ? AND ?`,
    [startDate, endDate]
  );

  return {
    categories: purchases as any[],
    wasteLoss: (wasteCost as any[])[0]?.estimated_loss || 0,
  };
}

export async function getMonthlyFinancialTrends(hostelId: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  
  // Get last 6 months of data
  const [rows] = await pool.execute(
    `SELECT 
      DATE_FORMAT(purchase_date, '%b') as month,
      DATE_FORMAT(purchase_date, '%Y-%m') as monthKey,
      SUM(total_cost) as actual
     FROM procurement_purchases
     WHERE purchase_date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
     GROUP BY monthKey
     ORDER BY monthKey ASC`
  );

  // Join with budget settings (fallback to default if not set for that month)
  const trends = await Promise.all((rows as any[]).map(async (row) => {
    const budgetRow = await getBudgetSettings(hostelId, row.monthKey + '-01');
    
    // Calculate cost per meal for this month
    const [optinCount] = await pool.execute(
      `SELECT COUNT(*) as total FROM meal_optins 
       WHERE meal_date LIKE ? AND optin_status IN ('attending', 'takeaway')`,
      [row.monthKey + '%']
    );
    
    const meals = Number((optinCount as any[])[0]?.total || 0);
    const perMeal = meals > 0 ? Number((row.actual / meals).toFixed(2)) : 0;

    return {
      month: row.month,
      actual: Number(row.actual),
      budget: Number(budgetRow?.monthly_budget || 52000),
      perMeal
    };
  }));

  return trends;
}
