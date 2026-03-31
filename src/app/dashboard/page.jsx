/**
 * Dashboard overview – fetches KPIs from the Fastify server via the proxy.
 * This is a Server Component so data is fetched at request time.
 */

import { cookies } from 'next/headers';

async function getOverview(token) {
  const base = process.env.NEXTJS_INTERNAL_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/proxy/v1/analytics/overview`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? json;
  } catch {
    return null;
  }
}

function KpiCard({ label, value, sub }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 10,
      padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,.08)',
      minWidth: 160,
    }}>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a2e' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  const data  = await getOverview(token);

  const fmt = (n) => typeof n === 'number' ? n.toLocaleString() : '—';
  const money = (n) => typeof n === 'number' ? `$${n.toLocaleString('en', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: 24, fontSize: 22, color: '#1a1a2e' }}>Overview</h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <KpiCard label="Total Revenue"        value={money(data?.totalRevenue)}      sub="All branches" />
        <KpiCard label="Total Orders"         value={fmt(data?.totalOrders)}          sub="All time" />
        <KpiCard label="Active Users"         value={fmt(data?.totalUsers)}           sub="Registered" />
        <KpiCard label="Active Branches"      value={fmt(data?.activeBranches)}       sub="" />
        <KpiCard label="Orders Today"         value={fmt(data?.ordersToday)}          sub="" />
        <KpiCard label="Revenue Today"        value={money(data?.revenueToday)}       sub="" />
        <KpiCard label="Avg Order Value"      value={money(data?.averageOrderValue)}  sub="" />
        <KpiCard label="Conversion Rate"      value={data?.conversionRate != null ? `${data.conversionRate}%` : '—'} sub="" />
      </div>

      {!token && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: 8,
          padding: 16,
          color: '#856404',
        }}>
          Not authenticated. Set an <code>access_token</code> cookie to see live data.
        </div>
      )}

      {token && !data && (
        <div style={{
          background: '#f8d7da',
          border: '1px solid #f5c2c7',
          borderRadius: 8,
          padding: 16,
          color: '#842029',
        }}>
          Could not load data. Make sure the Fastify server is running on{' '}
          <code>{process.env.FASTIFY_URL || 'http://localhost:4000'}</code>.
        </div>
      )}
    </div>
  );
}
