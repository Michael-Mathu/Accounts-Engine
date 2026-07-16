import { getDb } from '@/server/db';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { jwtDecode } from 'jwt-decode';

export async function createTRPCContext(opts: { headers?: Headers; req?: NextRequest }) {
  const { headers: headerList } = opts;
  const session = await auth();
  
  // Parse JWT to get user info if available
  let userId: string | null = null;
  let companyId: string | null = null;
  
  if (session?.user?.id) {
    userId = session.user.id;
  }
  
  // If user is authenticated and has a company, set RLS context
  if (userId) {
    // Find the user's current company
    const db = getDb();
    const userCompanyQuery = sql`
      SELECT c.id as company_id
      FROM users u
      JOIN company_users cu ON u.id = cu.user_id
      JOIN companies c ON cu.company_id = c.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;
    
    const result = await db.execute(userCompanyQuery);
    if (result.rows.length > 0) {
      companyId = result.rows[0].company_id;
    }
  }
  
  return {
    db: getDb(),
    userId,
    companyId,
    async setRLSContext() {
      if (companyId && userId) {
        const db = getDb();
        // Set RLS context variables for tenant isolation
        await db.execute(sql`SET LOCAL app.current_company_id = ${companyId}`);
        await db.execute(sql`SET LOCAL app.current_user_id = ${userId}`);
      }
    },
  };
}
