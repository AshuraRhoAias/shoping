/**
 * Branches management page – lists all branches and shows aggregate data.
 * Server Component.
 */

import { cookies } from 'next/headers';
import Link from 'next/link';

async function fetchBranches(token) {
  const base = process.env.NEXTJS_INTERNAL_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/proxy/v1/branches/all/summary`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.summary ?? [];
  } catch {
    return [];
  }
}

function StatusBadge({ active }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: active ? '#d1fae5' : '#fee2e2',
      color:      active ? '#065f46' : '#991b1b',
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default async function BranchesPage() {
  const cookieStore = await cookies();
  const token       = cookieStore.get('access_token')?.value;
  const branches    = await fetchBranches(token);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a1a2e' }}>Branches</h1>
        <Link href="/dashboard/branches/new" style={{
          background: '#3b82f6',
          color: '#fff',
          padding: '8px 18px',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 600,
        }}>
          + New Branch
        </Link>
      </div>

      {branches.length === 0 ? (
        <div style={{
          background: '#fff',
          borderRadius: 10,
          padding: 32,
          textAlign: 'center',
          color: '#888',
          boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        }}>
          No branches found. Create one to get started.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <thead style={{ background: '#f1f5f9' }}>
              <tr>
                {['Branch', 'Status', 'Revenue', 'Orders', 'Stock', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branches.map((b, i) => (
                <tr key={b.id} style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1a1a2e' }}>{b.name}</td>
                  <td style={{ padding: '14px 16px' }}><StatusBadge active={b.active} /></td>
                  <td style={{ padding: '14px 16px', color: '#334155' }}>${(b.revenue || 0).toLocaleString()}</td>
                  <td style={{ padding: '14px 16px', color: '#334155' }}>{(b.orders || 0).toLocaleString()}</td>
                  <td style={{ padding: '14px 16px', color: '#334155' }}>{(b.stock || 0).toLocaleString()}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <Link href={`/dashboard/branches/${b.id}`} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 13, marginRight: 12 }}>
                      View
                    </Link>
                    <Link href={`/dashboard/branches/${b.id}/edit`} style={{ color: '#64748b', textDecoration: 'none', fontSize: 13 }}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
