/**
 * Individual branch detail page.
 * Shows KPIs, inventory summary, and recent orders for a single branch.
 */

import { cookies } from 'next/headers';
import Link from 'next/link';

async function fetchBranchData(id, token) {
  const base = process.env.NEXTJS_INTERNAL_URL || 'http://localhost:3000';
  const headers = { Authorization: `Bearer ${token}` };

  const [branchRes, statsRes, inventoryRes] = await Promise.allSettled([
    fetch(`${base}/api/proxy/v1/branches/${id}`,           { headers, cache: 'no-store' }),
    fetch(`${base}/api/proxy/v1/analytics/branches/${id}`, { headers, cache: 'no-store' }),
    fetch(`${base}/api/proxy/v1/branches/${id}/inventory?limit=10`, { headers, cache: 'no-store' }),
  ]);

  const json = async (r) => {
    if (r.status !== 'fulfilled' || !r.value.ok) return null;
    const j = await r.value.json();
    return j?.data ?? j;
  };

  return {
    branch:    await json(branchRes),
    stats:     await json(statsRes),
    inventory: await json(inventoryRes),
  };
}

export default async function BranchDetailPage({ params }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  const { branch, stats, inventory } = await fetchBranchData(id, token);

  if (!branch?.branch && !branch?.id) {
    return (
      <div>
        <Link href="/dashboard/branches" style={{ color: '#3b82f6', fontSize: 14 }}>← Back to branches</Link>
        <h1 style={{ color: '#991b1b', marginTop: 16 }}>Branch not found</h1>
      </div>
    );
  }

  const b = branch?.branch ?? branch;
  const s = stats?.stats ?? stats;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard/branches" style={{ color: '#3b82f6', fontSize: 14, textDecoration: 'none' }}>
          ← Back to branches
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: '#1a1a2e' }}>{b?.name}</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{b?.address}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/dashboard/branches/${id}/edit`} style={{
            background: '#f1f5f9',
            color: '#334155',
            padding: '8px 16px',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 14,
          }}>
            Edit
          </Link>
          <form action={`/api/proxy/v1/branches/${id}/sync`} method="post">
            <button type="submit" style={{
              background: '#3b82f6',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
            }}>
              Sync Data
            </button>
          </form>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Revenue',   value: `$${(s?.revenue || 0).toLocaleString()}` },
          { label: 'Orders',    value: (s?.orders  || 0).toLocaleString() },
          { label: 'Avg Order', value: `$${(s?.avgOrderValue || 0).toLocaleString()}` },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: '#fff',
            borderRadius: 10,
            padding: '18px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,.07)',
            minWidth: 140,
          }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Stock alerts */}
      {s?.stockAlerts?.length > 0 && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <strong>Stock Alerts:</strong>{' '}
          {s.stockAlerts.map(a => a.name || a.productId).join(', ')}
        </div>
      )}

      {/* Branch info */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <h2 style={{ marginTop: 0, fontSize: 16, color: '#1a1a2e' }}>Branch Info</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['ID',        b?.id],
              ['Phone',     b?.phone || '—'],
              ['Timezone',  b?.timezone || '—'],
              ['Status',    b?.active ? 'Active' : 'Inactive'],
              ['Created',   b?.createdAt ? new Date(b.createdAt).toLocaleString() : '—'],
            ].map(([k, v]) => (
              <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 0', fontWeight: 600, color: '#64748b', width: 120, fontSize: 14 }}>{k}</td>
                <td style={{ padding: '10px 0', color: '#334155', fontSize: 14 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
