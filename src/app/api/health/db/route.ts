import { NextResponse } from 'next/server';
import { getMysqlPool } from '@/lib/db/mysql';

const DB_HEALTH_TIMEOUT_MS = Math.max(Number(process.env.MESSMATE_DB_HEALTH_TIMEOUT_MS || 3000), 1000);

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Database health check timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function GET() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[messmate][health/db] probing MySQL connectivity.');
    }

    const pool = getMysqlPool();
    await withTimeout(pool.execute('SELECT 1'), DB_HEALTH_TIMEOUT_MS);
    
    return NextResponse.json({ 
      status: 'ok',
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    return NextResponse.json({ 
      status: 'error',
      message: 'Database connection failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
