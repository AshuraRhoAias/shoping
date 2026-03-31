"use client";
import { useState, useMemo } from "react";
import {
    DeudoresView, TicketsView, InventarioView,
    GastosView, ReportesView,
    ProcesarPagoModal, GuardarTicketModal,
    ProductThumb, INITIAL_PRODUCTS,
} from "./DashboardViewers";
import { ProductsAPI, SalesAPI, TicketsAPI, AuthAPI } from "@/lib/api.service";
import Image from "next/image";

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
    bg: "#0d1117", sidebar: "#010409", card: "#161b22", cardHover: "#1c2128",
    border: "#21262d", accent: "#00d4aa", accentEnd: "#00b894",
    text: "#e6edf3", muted: "#8b949e", warn: "#f0ad4e", danger: "#f85149",
};

const CATS = ["Todos", "Bebidas", "Snacks", "Suplementos", "Servicios", "Ropa"];
const NAV = [
    { id: "ventas", icon: "🛒", label: "Ventas", badge: null },
    { id: "deudores", icon: "👥", label: "Deudores", badge: null },
    { id: "tickets", icon: "🎫", label: "Tickets", badge: 3 },
    { id: "inventario", icon: "📦", label: "Inventario", badge: null },
    { id: "gastos", icon: "📉", label: "Gastos", badge: null },
    { id: "reportes", icon: "📊", label: "Reportes", badge: null },
];

const av = (color = C.accent, size = 36) => ({ width: size, height: size, borderRadius: "50%", background: color, color: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * .36, flexShrink: 0 });
const ni = (active) => ({ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", borderRadius: active ? 8 : 0, background: active ? `${C.accent}22` : "transparent", color: active ? C.accent : C.muted, borderLeft: active ? `3px solid ${C.accent}` : "3px solid transparent", margin: "0 8px", fontSize: 14, fontWeight: active ? 600 : 400, transition: "all .2s", userSelect: "none" });
const cb = (active) => ({ padding: "6px 14px", borderRadius: 20, border: `1px solid ${active ? C.accent : C.border}`, background: active ? `${C.accent}22` : "transparent", color: active ? C.accent : C.muted, cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, whiteSpace: "nowrap" });

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ user, activeNav, onNav, onLogout }) {
    return (
        <aside style={{ width: 196, minWidth: 196, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: "16px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px 16px", borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>🏋️</span><span style={{ fontSize: 13, color: C.muted }}>Fit & Ecoree</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 16px", borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
                <div style={av()}>{user.name[0]}</div>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div><div style={{ fontSize: 11, color: C.muted, textTransform: "capitalize" }}>{user.role}</div></div>
            </div>
            {NAV.map(n => (
                <div key={n.id} style={ni(activeNav === n.id)} onClick={() => onNav(n.id)}>
                    <span>{n.icon}</span><span>{n.label}</span>
                    {n.badge && <span style={{ background: C.accent, color: "#0d1117", borderRadius: "50%", width: 20, height: 20, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto" }}>{n.badge}</span>}
                </div>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ background: "#2d1e00", border: `1px solid ${C.warn}44`, borderRadius: 10, padding: "12px 14px", margin: "auto 16px 16px", fontSize: 12, color: C.warn }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>⚠️ Alertas activas</div>
                <div>3 productos con bajo stock</div>
            </div>
            <div style={{ padding: "0 16px", marginBottom: 8 }}>
                <div style={{ ...ni(false), color: C.muted }}>⚙️ Configuración</div>
                <div style={{ ...ni(false), color: C.danger, cursor: "pointer" }} onClick={onLogout}>🚪 Cerrar sesión</div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, textAlign: "center", paddingBottom: 8 }}>Fit & Ecoree POS v1.0</div>
        </aside>
    );
}

// ─── VentasView — receives products (with imgSrc) + lifted cart ───────────────
function VentasView({ user, products, cart, setCart }) {
    const [cat, setCat] = useState("Todos");
    const [search, setSearch] = useState("");
    const [hoveredId, setHoveredId] = useState(null);
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
    const ci = (c) => c === "Todos" ? "🏷️" : c === "Bebidas" ? "🥤" : c === "Snacks" ? "🍿" : c === "Suplementos" ? "💊" : c === "Servicios" ? "🏋️" : "👕";

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Modals */}
            {showPago && <ProcesarPagoModal total={total} onClose={() => setShowPago(false)} onConfirm={async (method) => {
                try {
                    await SalesAPI.create({
                        items: cart.map(i => ({ id: i.id, qty: i.qty, price: i.price })),
                        method,
                        operatorId: user.id,
                    });
                } catch { }  // venta se registra localmente aunque falle la API
                setToast({ method, total });
                setCart([]);
            }} />}
            {showGuardar && <GuardarTicketModal onClose={() => setShowGuardar(false)} onSave={async (ticketData) => {
                try {
                    await TicketsAPI.save({
                        items: cart.map(i => ({ id: i.id, qty: i.qty, price: i.price })),
                        client: ticketData.client,
                        mesa: ticketData.mesa,
                        note: ticketData.note,
                        savedBy: user.name,
                    });
                } catch { }
                setCart([]);
            }} />}

            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, background: C.card, border: `1px solid ${C.accent}`, borderRadius: 12, padding: "14px 20px", boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
                    <div style={{ fontWeight: 700, color: C.accent, marginBottom: 4 }}>✅ Venta confirmada</div>
                    <div style={{ fontSize: 13, color: C.muted }}>Método: {toast.method} · ${toast.total.toFixed(2)}</div>
                    <button onClick={() => setToast(null)} style={{ marginTop: 10, background: "none", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: 12 }}>Cerrar</button>
                </div>
            )}

            {/* Topbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: `1px solid ${C.border}`, background: C.sidebar, flexShrink: 0 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Punto de Venta</h2>
                    <p style={{ margin: 0, fontSize: 12, color: C.muted, textTransform: "capitalize" }}>{now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>📶 💬 {now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
                    <div style={av(C.accent, 32)}>{user.name[0]}</div>
                    <div><div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div><div style={{ fontSize: 11, color: C.accent }}>Operador activo</div></div>
                </div>
            </div>

            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Products */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "12px 24px 0", flexShrink: 0 }}>
                        <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.muted }}>🔍</span>
                            <input style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "10px 14px 10px 40px", outline: "none" }}
                                placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                            {CATS.map(c => <button key={c} style={cb(cat === c)} onClick={() => setCat(c)}>{ci(c)} {c}</button>)}
                        </div>
                    </div>

                    {/* Grid — image or emoji */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(185px,1fr))", gap: 12, padding: "16px 24px", overflowY: "auto", flex: 1 }}>
                        {filtered.map(p => {
                            const inCart = cart.find(i => i.id === p.id);
                            return (
                                <div key={p.id}
                                    style={{ background: hoveredId === p.id ? C.cardHover : C.card, border: `1px solid ${hoveredId === p.id ? `${C.accent}55` : C.border}`, borderRadius: 12, padding: "14px", cursor: "pointer", transition: "all .2s", position: "relative", userSelect: "none" }}
                                    onClick={() => addToCart(p)} onMouseEnter={() => setHoveredId(p.id)} onMouseLeave={() => setHoveredId(null)}>
                                    {p.stock !== null && <span style={{ position: "absolute", top: 10, right: 10, fontSize: 11, fontWeight: 600, color: p.stock <= 5 ? C.warn : C.muted }}>{p.stock} left</span>}
                                    {inCart && <span style={{ position: "absolute", top: 10, left: 10, background: `${C.accent}22`, color: C.accent, borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>x{inCart.qty} en carrito</span>}

                                    {/* Product image or emoji */}
                                    {p.imgSrc ? (
                                        <Image
                                            src={p.imgSrc}
                                            alt={p.name}
                                            width={300} // ajusta según tu layout
                                            height={90}
                                            style={{
                                                width: "100%",
                                                height: 90,
                                                borderRadius: 8,
                                                objectFit: "cover",
                                                marginBottom: 10,
                                                marginTop: inCart ? 14 : 0
                                            }}
                                        />
                                    ) : (
                                        <div style={{ fontSize: 32, marginBottom: 8, marginTop: inCart ? 14 : 0, textAlign: "center" }}>{p.emoji}</div>
                                    )}

                                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                                    <div style={{ color: C.accent, fontWeight: 700 }}>${p.price}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Cart */}
                <aside style={{ width: 280, minWidth: 280, background: C.sidebar, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>🛒 Orden actual</span>
                        <div style={av(C.accent, 28)}>{user.name[0]}</div>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto" }}>
                        {cart.length === 0 ? (
                            <div style={{ textAlign: "center", color: C.muted, padding: "48px 20px" }}>
                                <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
                                <div style={{ fontSize: 13 }}>Carrito vacío</div>
                                <div style={{ fontSize: 12, marginTop: 4 }}>Toca un producto para agregar</div>
                            </div>
                        ) : cart.map(item => (
                            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: `1px solid ${C.border}` }}>
                                {/* Thumbnail in cart */}
                                <ProductThumb p={item} size={32} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                                    <div style={{ fontSize: 12, color: C.accent }}>${item.price * item.qty}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <button onClick={() => changeQty(item.id, -1)} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                                    <span style={{ fontSize: 12, minWidth: 14, textAlign: "center" }}>{item.qty}</span>
                                    <button onClick={() => changeQty(item.id, 1)} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
                        {[["Subtotal", `$${subtotal.toFixed(2)}`], ["IVA (16%)", `$${iva.toFixed(2)}`]].map(([l, v]) => (
                            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                                <span style={{ color: C.muted }}>{l}</span><span>{v}</span>
                            </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
                            <span>Total</span><span style={{ color: C.accent }}>${total.toFixed(2)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={av(C.accent, 22)}>{user.name[0]}</div>Operando: {user.name}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button disabled={cart.length === 0} onClick={() => setShowGuardar(true)}
                                style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: cart.length === 0 ? C.muted : C.text, fontWeight: 700, fontSize: 13, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? .5 : 1 }}>
                                💾 Guardar
                            </button>
                            <button disabled={cart.length === 0} onClick={() => setShowPago(true)}
                                style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: cart.length === 0 ? C.border : `linear-gradient(90deg,${C.accent},${C.accentEnd})`, color: cart.length === 0 ? C.muted : "#0d1117", fontWeight: 700, fontSize: 14, cursor: cart.length === 0 ? "not-allowed" : "pointer" }}>
                                Cobrar ›
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

// ─── StoreView (Cliente) ──────────────────────────────────────────────────────
function StoreView({ user, products, onLogout }) {
    const [cat, setCat] = useState("Todos");
    const [search, setSearch] = useState("");
    const [cart, setCart] = useState([]);
    const [tab, setTab] = useState("tienda");
    const [hoveredId, setHoveredId] = useState(null);

    const filtered = useMemo(() => products.filter(p => (cat === "Todos" || p.cat === cat) && p.name.toLowerCase().includes(search.toLowerCase())), [cat, search, products]);
    const addToCart = (p) => setCart(prev => { const ex = prev.find(i => i.id === p.id); return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }]; });
    const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const ci = (c) => c === "Todos" ? "🏷️" : c === "Bebidas" ? "🥤" : c === "Snacks" ? "🍿" : c === "Suplementos" ? "💊" : c === "Servicios" ? "🏋️" : "👕";

    return (
        <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px", borderBottom: `1px solid ${C.border}`, background: C.sidebar, position: "sticky", top: 0, zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 24 }}>🏋️</span>
                    <div><div style={{ fontWeight: 700, fontSize: 15 }}>Fit & Ecoree House</div><div style={{ fontSize: 11, color: C.muted }}>Tienda en línea</div></div>
                </div>
                <div style={{ display: "flex" }}>
                    {[{ id: "tienda", icon: "🏪", label: "Tienda" }, { id: "pedidos", icon: "📋", label: "Mis pedidos" }, { id: "perfil", icon: "👤", label: "Mi perfil" }].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 18px", color: tab === t.id ? C.accent : C.muted, fontWeight: tab === t.id ? 700 : 400, fontSize: 14, borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent" }}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <button style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "8px 14px", cursor: "pointer", fontSize: 14 }}>🛒 ${cartTotal.toFixed(2)}</button>
                    <div style={av("#7c3aed", 34)}>{user.name[0]}</div>
                    <span style={{ fontSize: 14 }}>{user.name}</span>
                    <button onClick={onLogout} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>↩</button>
                </div>
            </header>
            {tab === "tienda" && (
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
                    <div style={{ position: "relative", marginBottom: 20 }}>
                        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.muted }}>🔍</span>
                        <input style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "10px 14px 10px 44px", outline: "none" }}
                            placeholder="Buscar productos..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                        {CATS.map(c => <button key={c} style={cb(cat === c)} onClick={() => setCat(c)}>{ci(c)} {c}</button>)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
                        {filtered.map(p => (
                            <div key={p.id} style={{ background: hoveredId === p.id ? C.cardHover : C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px", cursor: "pointer", transition: "all .2s" }}
                                onMouseEnter={() => setHoveredId(p.id)} onMouseLeave={() => setHoveredId(null)}>
                                {p.imgSrc ? (
                                    <Image
                                        src={p.imgSrc}
                                        alt={p.name}
                                        width={300}        // Ajusta según el contenedor
                                        height={110}       // Coincide con tu altura deseada
                                        style={{
                                            width: "100%",
                                            height: 110,
                                            borderRadius: 8,
                                            objectFit: "cover",
                                            marginBottom: 12
                                        }}
                                    />
                                ) : (
                                    <div style={{ fontSize: 42, textAlign: "center", marginBottom: 12 }}>{p.emoji}</div>
                                )}
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{p.cat}</div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span style={{ color: C.accent, fontWeight: 700, fontSize: 16 }}>${p.price}</span>
                                    <button onClick={() => addToCart(p)} style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg,${C.accent},${C.accentEnd})`, border: "none", color: "#0d1117", fontWeight: 700, fontSize: 18, cursor: "pointer" }}>+</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {tab === "pedidos" && (
                <div style={{ maxWidth: 700, margin: "48px auto", padding: "0 24px" }}>
                    <h2>📋 Mis pedidos</h2>
                    {cart.length === 0 ? <p style={{ color: C.muted }}>Agrega productos desde la tienda.</p> : (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                            {cart.map(i => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 14, alignItems: "center", gap: 8 }}>
                                <ProductThumb p={i} size={28} /><span style={{ flex: 1 }}>{i.name} × {i.qty}</span><span style={{ color: C.accent }}>${i.price * i.qty}</span>
                            </div>)}
                            <div style={{ fontWeight: 700, marginTop: 12, display: "flex", justifyContent: "space-between" }}><span>Total</span><span style={{ color: C.accent }}>${cartTotal.toFixed(2)}</span></div>
                        </div>
                    )}
                </div>
            )}
            {tab === "perfil" && (
                <div style={{ maxWidth: 500, margin: "48px auto", padding: "0 24px" }}>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
                        <div style={{ ...av("#7c3aed", 64), margin: "0 auto 16px", fontSize: 24 }}>{user.name[0]}</div>
                        <h2 style={{ margin: "0 0 4px" }}>{user.name}</h2>
                        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 24px" }}>Cliente · Fit & Ecoree House</p>
                        <button onClick={onLogout} style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.danger, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Cerrar sesión</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── POSView — shared products + lifted cart ──────────────────────────────────
function POSView({ user, onLogout }) {
    const [activeNav, setActiveNav] = useState("ventas");
    const [cart, setCart] = useState([]);
    // Shared products so Inventario and Ventas are always in sync
    const [products, setProducts] = useState(INITIAL_PRODUCTS);  // datos iniciales demo

    useEffect(() => {
        ProductsAPI.list()
            .then(data => setProducts(data))
            .catch(() => { });  // mantiene INITIAL_PRODUCTS si falla
    }, []);

    const handleRecover = (recoveredCart) => {
        setCart(recoveredCart);
        setActiveNav("ventas");
    };

    const renderView = () => {
        switch (activeNav) {
            case "ventas": return <VentasView user={user} products={products} cart={cart} setCart={setCart} />;
            case "deudores": return <DeudoresView user={user} />;
            case "tickets": return <TicketsView user={user} onRecover={handleRecover} />;
            case "inventario": return <InventarioView user={user} products={products} setProducts={setProducts} />;
            case "gastos": return <GastosView user={user} />;
            case "reportes": return <ReportesView user={user} />;
            default: return <VentasView user={user} products={products} cart={cart} setCart={setCart} />;
        }
    };

    return (
        <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, fontFamily: "'Segoe UI',system-ui,sans-serif", overflow: "hidden" }}>
            <Sidebar user={user} activeNav={activeNav} onNav={setActiveNav} onLogout={onLogout} />
            <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {renderView()}
            </main>
        </div>
    );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function DashboardPage({ user, onLogout }) {
    // Shared products at top level so both POS and Store see the same catalog
    const [products, setProducts] = useState(INITIAL_PRODUCTS);
    const isOperator = user?.role === "admin" || user?.role === "vendedor";
    return isOperator
        ? <POSView user={user} onLogout={onLogout} />
        : <StoreView user={user} products={products} onLogout={onLogout} />;
}