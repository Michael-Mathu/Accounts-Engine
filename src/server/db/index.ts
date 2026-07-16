import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from '@/server/db/schema';

let pool: Pool | null = null;

export const getPool = () => {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
};

export const getDb = () => {
  const p = getPool();
  return drizzle(p, { schema });
};

export { schema };