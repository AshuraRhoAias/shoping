import Link from 'next/link';

export const metadata = {
  title: 'Admin Dashboard',
};

export default function DashboardLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: '#1a1a2e',
        color: '#eee',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        gap: 4,
        flexShrink: 0,
      }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #333', marginBottom: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#7eb8f7' }}>ShopAdmin</span>
        </div>

        {[
          { href: '/dashboard',               label: 'Overview' },
          { href: '/dashboard/branches',      label: 'Branches' },
          { href: '/dashboard/products',      label: 'Products' },
          { href: '/dashboard/orders',        label: 'Orders' },
          { href: '/dashboard/analytics',     label: 'Analytics' },
          { href: '/dashboard/users',         label: 'Users' },
          { href: '/dashboard/admin',         label: 'Admin' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} style={{
            display: 'block',
            padding: '10px 20px',
            color: '#ccc',
            textDecoration: 'none',
            borderRadius: 6,
            margin: '0 8px',
            fontSize: 14,
          }}>
            {label}
          </Link>
        ))}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: 32, background: '#f5f7fa', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
