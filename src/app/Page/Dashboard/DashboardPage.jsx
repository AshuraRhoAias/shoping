"use client";
import { useState, useMemo, useEffect, Fragment } from "react";
import {
    DeudoresView, TicketsView, InventarioView,
    GastosView, ReportesView,
    ProcesarPagoModal, GuardarTicketModal,
    ProductThumb, Avatar,
} from "./DashboardViewers";
import { ProductsAPI, SalesAPI, TicketsAPI } from "@/lib/api.service";
import Image from "next/image";
import "./dashboard.css";

const CATS = ["Todos", "Bebidas", "Snacks", "Suplementos", "Servicios", "Ropa", "Accesorios"];
const NAV_BASE = [
    { id: "ventas", icon: "🛒", label: "Ventas" },
    { id: "deudores", icon: "👥", label: "Deudores" },
    { id: "tickets", icon: "🎫", label: "Tickets" },
    { id: "inventario", icon: "📦", label: "Inventario" },
    { id: "gastos", icon: "📉", label: "Gastos" },
    { id: "reportes", icon: "📊", label: "Reportes" },
];

const catIcon = (c) => c === "Todos" ? "🏷️" : c === "Bebidas" ? "🥤" : c === "Snacks" ? "🍿" : c === "Suplementos" ? "💊" : c === "Servicios" ? "🏋️" : c === "Ropa" ? "👕" : c === "Accesorios" ? "📦" : "🏷️";

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ user, activeNav, onNav, onLogout, ticketsCount, lowStockCount, open, onClose }) {
    const nav = NAV_BASE.map((n) => ({ ...n, badge: n.id === "tickets" && ticketsCount > 0 ? ticketsCount : null }));
    return (
        <aside className={`sidebar${open ? " sidebar--open" : ""}`}>
            <header className="sidebar__brand">
                <span className="sidebar__brand-emoji">🏋️</span>
                <span className="sidebar__brand-name">Fit &amp; Ecoree</span>
                <button className="sidebar__close" aria-label="Cerrar menú" onClick={onClose}>✕</button>
            </header>
            <section className="sidebar__user">
                <Avatar initials={user.name[0]} />
                <p>
                    <span className="sidebar__user-name">{user.name}</span>
                    <br />
                    <span className="sidebar__user-role">{user.role}</span>
                </p>
            </section>
            <nav className="nav">
                {nav.map(n => (
                    <button key={n.id} className={`nav-item${activeNav === n.id ? " nav-item--active" : ""}`} onClick={() => { onNav(n.id); onClose?.(); }}>
                        <span>{n.icon}</span><span>{n.label}</span>
                        {n.badge && <span className="nav-item__badge">{n.badge}</span>}
                    </button>
                ))}
            </nav>
            <div className="sidebar__spacer" />
            {lowStockCount > 0 && (
                <aside className="sidebar__alert">
                    <p className="sidebar__alert-title">⚠️ Alertas activas</p>
                    <p>{lowStockCount} producto{lowStockCount === 1 ? "" : "s"} con bajo stock</p>
                </aside>
            )}
            <footer className="sidebar__foot">
                <button className="nav-item">⚙️ Configuración</button>
                <button className="nav-item nav-item--danger" onClick={onLogout}>🚪 Cerrar sesión</button>
            </footer>
            <p className="sidebar__version">Fit &amp; Ecoree POS v1.0</p>
        </aside>
    );
}

// ─── VentasView — recibe products (con imgSrc) + carrito elevado ───────────────
function VentasView({ user, products, cart, setCart }) {
    const [cat, setCat] = useState("Todos");
    const [search, setSearch] = useState("");
    const [showPago, setShowPago] = useState(false);
    const [showGuardar, setShowGuardar] = useState(false);
    const [toast, setToast] = useState(null);

    const filtered = useMemo(() => products.filter(p =>
        (cat === "Todos" || p.cat === cat) && p.name.toLowerCase().includes(search.toLowerCase())
    ), [cat, search, products]);

    const addToCart = (p) => setCart(prev => {
        const ex = prev.find(i => i.id === p.id);
        return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
    });
    const changeQty = (id, delta) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));

    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;
    const now = new Date();

    return (
        <section className="view">
            {showPago && <ProcesarPagoModal total={total} onClose={() => setShowPago(false)} onConfirm={async (method) => {
                try {
                    await SalesAPI.create({
                        items: cart.map(i => ({ id: i.id, qty: i.qty, price: i.price })),
                        method,
                        operatorId: user.id,
                    });
                } catch (err) {
                    console.error("Error al registrar venta:", err);
                }
                setToast({ method, total });
                setCart([]);
            }} />}
            {showGuardar && <GuardarTicketModal onClose={() => setShowGuardar(false)} onSave={async (ticketData) => {
                try {
                    await TicketsAPI.save({
                        items: cart,
                        client: ticketData.client,
                        mesa: ticketData.mesa,
                        note: ticketData.note,
                        savedBy: user.name,
                        total: subtotal,
                    });
                } catch (err) {
                    console.error("Error al guardar ticket:", err);
                }
                setCart([]);
            }} />}

            {toast && (
                <aside className="toast" role="status">
                    <p className="toast__title">✅ Venta confirmada</p>
                    <p className="toast__detail">Método: {toast.method} · ${toast.total.toFixed(2)}</p>
                    <button className="toast__close" onClick={() => setToast(null)}>Cerrar</button>
                </aside>
            )}

            <header className="topbar">
                <div>
                    <h2 className="topbar__title">Punto de Venta</h2>
                    <p className="topbar__date">{now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</p>
                </div>
                <div className="topbar__right">
                    <span className="topbar__clock">📶 💬 {now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
                    <Avatar initials={user.name[0]} size={32} />
                    <p>
                        <span className="topbar__meta-name">{user.name}</span>
                        <br />
                        <span className="topbar__meta-role">Operador activo</span>
                    </p>
                </div>
            </header>

            <div className="pos-body">
                <section className="pos-products">
                    <div className="pos-products__toolbar">
                        <search className="search">
                            <span className="search__icon">🔍</span>
                            <input className="search__input" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
                        </search>
                        <ul className="chips pos-products__filters">
                            {CATS.map(c => <li key={c}><button className={`chip${cat === c ? " chip--active" : ""}`} onClick={() => setCat(c)}>{catIcon(c)} {c}</button></li>)}
                        </ul>
                    </div>

                    <ul className="products-grid">
                        {filtered.map(p => {
                            const inCart = cart.find(i => i.id === p.id);
                            return (
                                <li key={p.id}>
                                    <button className={`product-card${inCart ? " product-card--has-cart" : ""}`} onClick={() => addToCart(p)}>
                                        {p.stock !== null && <span className={`product-card__stock${p.stock <= 5 ? " product-card__stock--low" : ""}`}>{p.stock} left</span>}
                                        {inCart && <span className="product-card__in-cart">x{inCart.qty} en carrito</span>}
                                        {p.imgSrc
                                            ? <Image className="product-card__media" src={p.imgSrc} alt={p.name} width={300} height={90} />
                                            : <p className="product-card__emoji">{p.emoji}</p>}
                                        <p className="product-card__name">{p.name}</p>
                                        <p className="product-card__price">${p.price}</p>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <aside className="cart">
                    <header className="cart__head">
                        <span>🛒 Orden actual</span>
                        <Avatar initials={user.name[0]} size={28} />
                    </header>
                    {cart.length === 0 ? (
                        <div className="cart__body">
                            <div className="cart__empty">
                                <p className="cart__empty-emoji">🛒</p>
                                <p>Carrito vacío</p>
                                <p className="cart__empty-hint">Toca un producto para agregar</p>
                            </div>
                        </div>
                    ) : (
                        <ul className="cart__body">
                            {cart.map(item => (
                                <li key={item.id} className="cart__item">
                                    <ProductThumb p={item} size={32} />
                                    <div className="cart__item-info">
                                        <p className="cart__item-name">{item.name}</p>
                                        <p className="cart__item-price">${item.price * item.qty}</p>
                                    </div>
                                    <div className="cart__qty">
                                        <button className="qty-btn" onClick={() => changeQty(item.id, -1)}>−</button>
                                        <span className="cart__qty-val">{item.qty}</span>
                                        <button className="qty-btn" onClick={() => changeQty(item.id, 1)}>+</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    <footer className="cart__foot">
                        <dl className="cart__totals">
                            {[["Subtotal", `$${subtotal.toFixed(2)}`], ["IVA (16%)", `$${iva.toFixed(2)}`]].map(([l, v]) => (
                                <Fragment key={l}>
                                    <dt>{l}</dt><dd>{v}</dd>
                                </Fragment>
                            ))}
                            <dt className="cart__totals--strong">Total</dt>
                            <dd className="cart__totals--strong">${total.toFixed(2)}</dd>
                        </dl>
                        <p className="cart__oper">
                            <Avatar initials={user.name[0]} size={22} />Operando: {user.name}
                        </p>
                        <menu className="cart__actions">
                            <li><button className="btn btn--ghost" disabled={cart.length === 0} onClick={() => setShowGuardar(true)}>💾 Guardar</button></li>
                            <li><button className="btn btn--primary btn--pay" disabled={cart.length === 0} onClick={() => setShowPago(true)}>Cobrar ›</button></li>
                        </menu>
                    </footer>
                </aside>
            </div>
        </section>
    );
}

// ─── StoreView (Cliente) ──────────────────────────────────────────────────────
function StoreView({ user, products, onLogout }) {
    const [cat, setCat] = useState("Todos");
    const [search, setSearch] = useState("");
    const [cart, setCart] = useState([]);
    const [tab, setTab] = useState("tienda");

    const filtered = useMemo(() => products.filter(p => (cat === "Todos" || p.cat === cat) && p.name.toLowerCase().includes(search.toLowerCase())), [cat, search, products]);
    const addToCart = (p) => setCart(prev => { const ex = prev.find(i => i.id === p.id); return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }]; });
    const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

    return (
        <div className="store">
            <header className="store__header">
                <div className="store__brand">
                    <span className="store__brand-emoji">🏋️</span>
                    <p>
                        <span className="store__brand-name">Fit &amp; Ecoree House</span>
                        <br />
                        <span className="store__brand-sub">Tienda en línea</span>
                    </p>
                </div>
                <nav className="store__tabs">
                    {[{ id: "tienda", icon: "🏪", label: "Tienda" }, { id: "pedidos", icon: "📋", label: "Mis pedidos" }, { id: "perfil", icon: "👤", label: "Mi perfil" }].map(t => (
                        <button key={t.id} className={`tab${tab === t.id ? " tab--active" : ""}`} onClick={() => setTab(t.id)}>{t.icon} {t.label}</button>
                    ))}
                </nav>
                <div className="store__actions">
                    <button className="cart-pill">🛒 ${cartTotal.toFixed(2)}</button>
                    <Avatar initials={user.name[0]} size={34} color="#7c3aed" />
                    <span>{user.name}</span>
                    <button className="icon-link" onClick={onLogout}>↩</button>
                </div>
            </header>

            {tab === "tienda" && (
                <main className="store__main">
                    <search className="search store__search">
                        <span className="search__icon">🔍</span>
                        <input className="search__input" placeholder="Buscar productos..." value={search} onChange={e => setSearch(e.target.value)} />
                    </search>
                    <ul className="chips store__filters">
                        {CATS.map(c => <li key={c}><button className={`chip${cat === c ? " chip--active" : ""}`} onClick={() => setCat(c)}>{catIcon(c)} {c}</button></li>)}
                    </ul>
                    <ul className="store-grid">
                        {filtered.map(p => (
                            <li key={p.id}>
                                <article className="store-card">
                                    {p.imgSrc
                                        ? <Image className="store-card__media" src={p.imgSrc} alt={p.name} width={300} height={110} />
                                        : <p className="store-card__emoji">{p.emoji}</p>}
                                    <p className="store-card__name">{p.name}</p>
                                    <p className="store-card__cat">{p.cat}</p>
                                    <div className="store-card__foot">
                                        <span className="store-card__price">${p.price}</span>
                                        <button className="add-btn" onClick={() => addToCart(p)}>+</button>
                                    </div>
                                </article>
                            </li>
                        ))}
                    </ul>
                </main>
            )}
            {tab === "pedidos" && (
                <section className="store-panel">
                    <h2>📋 Mis pedidos</h2>
                    {cart.length === 0 ? <p className="store-panel__muted">Agrega productos desde la tienda.</p> : (
                        <div className="order-box">
                            <ul className="order-list">
                                {cart.map(i => (
                                    <li key={i.id} className="order-row">
                                        <ProductThumb p={i} size={28} /><span className="order-row__name">{i.name} × {i.qty}</span><span className="order-row__price">${i.price * i.qty}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="order-total"><span>Total</span><span className="order-total__value">${cartTotal.toFixed(2)}</span></p>
                        </div>
                    )}
                </section>
            )}
            {tab === "perfil" && (
                <section className="store-panel store-panel--narrow">
                    <article className="profile-card">
                        <Avatar initials={user.name[0]} size={64} color="#7c3aed" />
                        <h2 className="profile-card__name">{user.name}</h2>
                        <p className="profile-card__sub">Cliente · Fit &amp; Ecoree House</p>
                        <button className="profile-card__logout" onClick={onLogout}>Cerrar sesión</button>
                    </article>
                </section>
            )}
        </div>
    );
}

// ─── POSView — products/tickets compartidos para que las vistas queden en sync ─
function POSView({ user, products, setProducts, onLogout }) {
    const [activeNav, setActiveNav] = useState("ventas");
    const [cart, setCart] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        TicketsAPI.list()
            .then(setTickets)
            .catch((err) => console.error("Error al cargar tickets:", err));
    }, []);

    const lowStockCount = products.filter(p => p.status === "Bajo").length;

    const handleRecover = (recoveredCart) => {
        setCart(recoveredCart);
        setActiveNav("ventas");
    };

    const renderView = () => {
        switch (activeNav) {
            case "ventas": return <VentasView user={user} products={products} cart={cart} setCart={setCart} />;
            case "deudores": return <DeudoresView user={user} />;
            case "tickets": return <TicketsView user={user} tickets={tickets} setTickets={setTickets} onRecover={handleRecover} />;
            case "inventario": return <InventarioView user={user} products={products} setProducts={setProducts} />;
            case "gastos": return <GastosView user={user} />;
            case "reportes": return <ReportesView user={user} />;
            default: return <VentasView user={user} products={products} cart={cart} setCart={setCart} />;
        }
    };

    return (
        <div className="pos">
            <button className="pos__menu-toggle" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>☰</button>
            {menuOpen && <button className="pos__nav-overlay" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
            <Sidebar user={user} activeNav={activeNav} onNav={setActiveNav} onLogout={onLogout} ticketsCount={tickets.length} lowStockCount={lowStockCount} open={menuOpen} onClose={() => setMenuOpen(false)} />
            <main className="pos__main">
                {renderView()}
            </main>
        </div>
    );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function DashboardPage({ user, onLogout }) {
    // Catálogo compartido entre POS (admin/vendedor) y la tienda (cliente)
    const [products, setProducts] = useState([]);

    useEffect(() => {
        ProductsAPI.list()
            .then(setProducts)
            .catch((err) => console.error("Error al cargar productos:", err));
    }, []);

    const isOperator = user?.role === "admin" || user?.role === "vendedor";
    return isOperator
        ? <POSView user={user} products={products} setProducts={setProducts} onLogout={onLogout} />
        : <StoreView user={user} products={products} onLogout={onLogout} />;
}
