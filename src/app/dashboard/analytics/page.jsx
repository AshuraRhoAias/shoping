/**
 * Analytics page – aggregated data across all branches.
 * Server Component.
 */

import { cookies } from 'next/headers';

async function fetchAnalytics(token) {
  const base = process.env.NEXTJS_INTERNAL_URL || 'http://localhost:3000';
  const h    = { Authorization: `Bearer ${token}` };

  const [overviewRes, branchesRes, productsRes] = await Promise.allSettled([
    fetch(`${base}/api/proxy/v1/analytics/overview`,  { headers: h, cache: 'no-store' }),
    fetch(`${base}/api/proxy/v1/analytics/branches`,  { headers: h, cache: 'no-store' }),
    fetch(`${base}/api/proxy/v1/analytics/products?limit=5`, { headers: h, cache: 'no-store' }),
  ]);

  const safe = async (r) => {
    if (r.status !== 'fulfilled' || !r.value.ok) return null;
    const j = await r.value.json();
    return j?.data ?? j;
  };

  return {
    overview:  await safe(overviewRes),
    branches:  await safe(branchesRes),
    products:  await safe(productsRes),
  };
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 20 }}>
      <h2 style={{ marginTop: 0, fontSize: 16, color: '#1a1a2e', borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 16 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

export default async function AnalyticsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  const { overview, branches, products } = await fetchAnalytics(token);

  const fmt   = n => typeof n === 'number' ? n.toLocaleString() : '—';
  const money = n => typeof n === 'number' ? `$${n.toLocaleString('en', { minimumFractionDigits: 2 })}` : '—';
  const pct   = n => typeof n === 'number' ? `${n}%` : '—';

  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: 24, fontSize: 22, color: '#1a1a2e' }}>Analytics</h1>

      <Section title="Global KPIs">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {[
            ['Total Revenue',     money(overview?.totalRevenue)],
            ['Total Orders',      fmt(overview?.totalOrders)],
            ['Total Users',       fmt(overview?.totalUsers)],
            ['Active Branches',   fmt(overview?.activeBranches)],
            ['Revenue Today',     money(overview?.revenueToday)],
            ['Avg Order Value',   money(overview?.averageOrderValue)],
            ['Conversion Rate',   pct(overview?.conversionRate)],
          ].map(([label, value]) => (
            <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 18px', minWidth: 130 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{value}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Branch Comparison">
        {!branches?.branches?.length ? (
          <p style={{ color: '#94a3b8', margin: 0 }}>No branch data available.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Branch', 'Revenue', 'Orders'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branches.branches.map((b, i) => (
                <tr key={b.id || i} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px' }}>{b.name}</td>
                  <td style={{ padding: '10px 12px' }}>{money(b.revenue)}</td>
                  <td style={{ padding: '10px 12px' }}>{fmt(b.orders)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Top Products">
        {!products?.topProducts?.length ? (
          <p style={{ color: '#94a3b8', margin: 0 }}>No product data available.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {products.topProducts.map((p, i) => (
              <li key={p.id || i} style={{ padding: '6px 0', color: '#334155' }}>
                <strong>{p.name}</strong> — {money(p.revenue)}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
