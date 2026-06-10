import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

export type InventoryRow = {
  ingredient_id: string;
  ingredient_name: string;
  unit: 'kg' | 'litres' | 'pcs';
  per_person_qty: number;
  current_stock: number;
  reorder_threshold: number;
  updated_at: string | null;
};

type PurchaseRequestStatus = 'requested' | 'ordered' | 'received' | 'cancelled';

export type PurchaseRequestRow = {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  requestedQty: number;
  unit: 'kg' | 'litres' | 'pcs';
  status: PurchaseRequestStatus;
  requested_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function getInventoryList(): Promise<InventoryRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT
       ic.id AS ingredient_id,
       ic.ingredient_name,
       ic.unit,
       ic.per_person_qty,
       COALESCE(isr.current_stock, 0) AS current_stock,
       COALESCE(isr.reorder_threshold, 0) AS reorder_threshold,
       isr.updated_at
     FROM ingredient_catalog ic
     LEFT JOIN ingredient_stock isr ON isr.ingredient_id = ic.id
     ORDER BY FIELD(ic.id, 'ing-rice','ing-dal','ing-tomato','ing-onion','ing-potato','ing-oil','ing-curd','ing-tamarind','ing-idly-batter','ing-coconut','ing-wheat-flour') ASC`
  );

  return (rows as any[]).map((row) => ({
    ingredient_id: String(row.ingredient_id),
    ingredient_name: String(row.ingredient_name),
    unit: String(row.unit) as 'kg' | 'litres' | 'pcs',
    per_person_qty: Number(row.per_person_qty || 0),
    current_stock: Number(row.current_stock || 0),
    reorder_threshold: Number(row.reorder_threshold || 0),
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }));
}

export async function updateInventoryStock(input: {
  ingredientId: string;
  currentStock: number;
  reorderThreshold: number;
}) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const ingredientId = String(input.ingredientId || '').trim();
  const currentStock = Number(input.currentStock ?? 0);
  const reorderThreshold = Number(input.reorderThreshold ?? 0);

  await pool.execute(
    `INSERT INTO ingredient_stock (ingredient_id, current_stock, reorder_threshold, unit, updated_at)
     VALUES (?, ?, ?, (SELECT unit FROM ingredient_catalog WHERE id = ?), NOW())
     ON DUPLICATE KEY UPDATE
       current_stock = VALUES(current_stock),
       reorder_threshold = VALUES(reorder_threshold),
       updated_at = NOW()`,
    [ingredientId, currentStock, reorderThreshold, ingredientId]
  );

  const [rows] = await pool.execute(
    `SELECT
       ic.id AS ingredient_id,
       ic.ingredient_name,
       ic.unit,
       ic.per_person_qty,
       COALESCE(isr.current_stock, 0) AS current_stock,
       COALESCE(isr.reorder_threshold, 0) AS reorder_threshold,
       isr.updated_at
     FROM ingredient_catalog ic
     LEFT JOIN ingredient_stock isr ON isr.ingredient_id = ic.id
     WHERE ic.id = ?`,
    [ingredientId]
  );

  const row = (rows as any[])[0];
  if (!row) {
    throw new Error(`Ingredient not found: ${ingredientId}`);
  }

  return {
    ingredient_id: String(row.ingredient_id),
    ingredient_name: String(row.ingredient_name),
    unit: String(row.unit) as 'kg' | 'litres' | 'pcs',
    per_person_qty: Number(row.per_person_qty || 0),
    current_stock: Number(row.current_stock || 0),
    reorder_threshold: Number(row.reorder_threshold || 0),
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

export async function getPurchaseRequests(): Promise<PurchaseRequestRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT pr.id,
            pr.ingredient_id,
            ic.ingredient_name,
            pr.requested_qty,
            pr.unit,
            pr.status,
            pr.requested_by,
            pr.notes,
            pr.created_at,
            pr.updated_at
     FROM purchase_requests pr
     LEFT JOIN ingredient_catalog ic ON ic.id = pr.ingredient_id
     ORDER BY pr.created_at DESC`
  );

  return (rows as any[]).map((row) => ({
    id: String(row.id),
    ingredient_id: String(row.ingredient_id),
    ingredient_name: String(row.ingredient_name || row.ingredient_id),
    requestedQty: Number(row.requested_qty || 0),
    unit: String(row.unit) as 'kg' | 'litres' | 'pcs',
    status: String(row.status) as PurchaseRequestStatus,
    requested_by: row.requested_by ? String(row.requested_by) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

export async function createPurchaseRequest(input: {
  ingredientId: string;
  requestedQty: number;
  notes?: string | null;
  requestedBy?: string | null;
}) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const id = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const ingredientId = String(input.ingredientId || '').trim();
  const requestedQty = Number(input.requestedQty || 0);
  const notes = input.notes ? String(input.notes).trim() : null;
  const requestedBy = input.requestedBy ? String(input.requestedBy).trim() : null;

  if (!ingredientId || requestedQty <= 0) {
    throw new Error('Invalid purchase request data.');
  }

  await pool.execute(
    `INSERT INTO purchase_requests (id, ingredient_id, requested_qty, unit, status, requested_by, notes, created_at, updated_at)
     VALUES (?, ?, ?, (SELECT unit FROM ingredient_catalog WHERE id = ?), 'requested', ?, ?, NOW(), NOW())`,
    [id, ingredientId, requestedQty, ingredientId, requestedBy, notes]
  );

  const [rows] = await pool.execute(
    `SELECT pr.id,
            pr.ingredient_id,
            ic.ingredient_name,
            pr.requested_qty,
            pr.unit,
            pr.status,
            pr.requested_by,
            pr.notes,
            pr.created_at,
            pr.updated_at
     FROM purchase_requests pr
     LEFT JOIN ingredient_catalog ic ON ic.id = pr.ingredient_id
     WHERE pr.id = ?`,
    [id]
  );

  const row = (rows as any[])[0];
  if (!row) {
    throw new Error('Failed to create purchase request.');
  }

  return {
    id: String(row.id),
    ingredient_id: String(row.ingredient_id),
    ingredient_name: String(row.ingredient_name || row.ingredient_id),
    requestedQty: Number(row.requested_qty || 0),
    unit: String(row.unit) as 'kg' | 'litres' | 'pcs',
    status: String(row.status) as PurchaseRequestStatus,
    requested_by: row.requested_by ? String(row.requested_by) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function updatePurchaseRequestStatus(input: { id: string; status: PurchaseRequestStatus }) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const id = String(input.id || '').trim();
  const status = String(input.status || 'requested') as PurchaseRequestStatus;

  await pool.execute(
    `UPDATE purchase_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
    [status, id]
  );

  const [rows] = await pool.execute(
    `SELECT pr.id,
            pr.ingredient_id,
            ic.ingredient_name,
            pr.requested_qty,
            pr.unit,
            pr.status,
            pr.requested_by,
            pr.notes,
            pr.created_at,
            pr.updated_at
     FROM purchase_requests pr
     LEFT JOIN ingredient_catalog ic ON ic.id = pr.ingredient_id
     WHERE pr.id = ?`,
    [id]
  );

  const row = (rows as any[])[0];
  if (!row) {
    throw new Error(`Purchase request not found: ${id}`);
  }

  return {
    id: String(row.id),
    ingredient_id: String(row.ingredient_id),
    ingredient_name: String(row.ingredient_name || row.ingredient_id),
    requestedQty: Number(row.requested_qty || 0),
    unit: String(row.unit) as 'kg' | 'litres' | 'pcs',
    status: String(row.status) as PurchaseRequestStatus,
    requested_by: row.requested_by ? String(row.requested_by) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
