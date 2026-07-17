"use client";
import { useState, useEffect, useRef } from "react";
import { DeudoresAPI, TicketsAPI, ProductsAPI, GastosAPI, ReportsAPI } from "@/lib/api.service";
import Image from "next/image";

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════
const C = {
  bg: "#0d1117", sidebar: "#010409", card: "#161b22", cardHover: "#1c2128",
  border: "#21262d", accent: "#00d4aa", accentEnd: "#00b894",
  text: "#e6edf3", muted: "#8b949e", warn: "#f0ad4e", danger: "#f85149",
  green: "#3fb950", purple: "#bc8cff", blue: "#58a6ff", orange: "#ffa657",
};

if (typeof document !== "undefined" && !document.getElementById("feh-kf")) {
  const s = document.createElement("style");
  s.id = "feh-kf";
  s.textContent = `
    @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes scaleIn { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
    .feh-fade  { animation:fadeUp .35s ease both; }
    .feh-hover:hover { background:${C.cardHover} !important; }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
// PRIMITIVES
// ═══════════════════════════════════════════════════════════════
export function Avatar({ initials, color = C.accent, size = 36 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * .36, flexShrink: 0 }}>{initials}</div>;
}

export function PageHeader({ title, user }) {
  const now = new Date();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", borderBottom: `1px solid ${C.border}`, background: C.sidebar, flexShrink: 0 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 12, color: C.muted, textTransform: "capitalize" }}>
          {now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: C.muted }}>📶 💬 {now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
        <Avatar initials={user.name[0]} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: 11, color: C.accent }}>Operador activo</div>
        </div>
      </div>
    </div>
  );
}

export function StatCard({ icon, label, value, sub, color = C.accent, delay = 0 }) {
  const [v, setV] = useState(false);
  useEffect(() => { const t = setTimeout(() => setV(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{ flex: 1, minWidth: 160, background: C.card, border: `1px solid ${C.border}`, borderTop: `3px solid ${color}`, borderRadius: 12, padding: "18px 20px", opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(12px)", transition: "opacity .4s,transform .4s" }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{icon} {label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function ScrollArea({ children, style }) {
  return <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", ...style }}>{children}</div>;
}

export function SectionLabel({ icon, title, count, color = C.accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 20 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color }}>{icon} {title}</span>
      <span style={{ fontSize: 12, color: C.muted }}>{count}</span>
    </div>
  );
}

export function Btn({ children, onClick, variant = "primary", size = "md", disabled = false }) {
  const pad = size === "sm" ? "6px 12px" : "10px 18px";
  const fs = size === "sm" ? 12 : 14;
  const styles = {
    primary: { background: `linear-gradient(90deg,${C.accent},${C.accentEnd})`, color: "#0d1117", border: "none" },
    ghost: { background: C.card, border: `1px solid ${C.border}`, color: C.text },
    danger: { background: `${C.danger}22`, border: `1px solid ${C.danger}55`, color: C.danger },
    orange: { background: `linear-gradient(90deg,${C.warn},${C.orange})`, color: "#0d1117", border: "none" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: pad, borderRadius: 8, ...styles[variant], fontWeight: 700, fontSize: fs, cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: disabled ? .5 : 1, transition: "opacity .2s" }}>
      {children}
    </button>
  );
}

export function StatusBadge({ status }) {
  const map = {
    "Al Día": { color: C.accent, bg: `${C.accent}22`, icon: "✅" },
    "En Seguimiento": { color: C.warn, bg: `${C.warn}22`, icon: "🕐" },
    "Atrasado": { color: C.orange, bg: `${C.orange}22`, icon: "⚠️" },
    "Crítico": { color: C.danger, bg: `${C.danger}22`, icon: "🔴" },
    "Bajo": { color: C.warn, bg: `${C.warn}22`, icon: "⚠️" },
    "OK": { color: C.green, bg: `${C.green}22`, icon: "✓" },
    "Agotado": { color: C.danger, bg: `${C.danger}22`, icon: "✗" },
    "Urgente": { color: C.danger, bg: `${C.danger}22`, icon: "⚠️" },
  };
  const s = map[status] || { color: C.muted, bg: `${C.muted}22`, icon: "·" };
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.color}44`, display: "inline-flex", alignItems: "center", gap: 4 }}>{s.icon} {status}</span>;
}

// ═══════════════════════════════════════════════════════════════
// MODAL WRAPPER
// ═══════════════════════════════════════════════════════════════
export function Modal({ title, titleIcon, onClose, children, width = 460 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,.6)", animation: "scaleIn .22s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.card, zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{titleIcon} {title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ padding: "20px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

function MInput({ label, placeholder, value, onChange, type = "text", prefix, required }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 6 }}>
        {label}{required && <span style={{ color: C.danger }}> *</span>}
      </label>
      <div style={{ position: "relative" }}>
        {prefix && <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 13 }}>{prefix}</span>}
        <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: `11px 14px 11px ${prefix ? "36px" : "14px"}`, outline: "none" }} />
      </div>
    </div>
  );
}

const OPERATORS = [
  { initials: "AD", name: "Admin", color: C.accent },
  { initials: "ML", name: "María", color: "#bc8cff" },
  { initials: "JR", name: "José", color: "#f0ad4e" },
];
const MESAS = ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6", "Mesa 7", "Mostrador", "Para llevar"];

// ═══════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════
export function ProcesarPagoModal({ total, onClose, onConfirm }) {
  const [method, setMethod] = useState("Efectivo");
  const [cash, setCash] = useState("");
  const methods = [{ id: "Efectivo", icon: "💵" }, { id: "MP / QR", icon: "📱" }, { id: "Tarjeta", icon: "💳" }];
  const cambio = method === "Efectivo" ? Math.max(0, parseFloat(cash || 0) - total) : 0;
  const canConfirm = method !== "Efectivo" || parseFloat(cash || 0) >= total;
  return (
    <Modal title="Procesar Pago" onClose={onClose}>
      <div style={{ background: C.bg, borderRadius: 12, padding: "16px", textAlign: "center", marginBottom: 20, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Total a pagar</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: C.accent }}>${total.toFixed(2)}</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {methods.map(m => (
          <button key={m.id} onClick={() => setMethod(m.id)} style={{ flex: 1, padding: "12px 8px", borderRadius: 10, border: `2px solid ${method === m.id ? C.accent : C.border}`, background: method === m.id ? `${C.accent}22` : C.bg, color: method === m.id ? C.accent : C.muted, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>{m.id}
          </button>
        ))}
      </div>
      {method === "Efectivo" && <MInput label="Efectivo recibido" placeholder="$0.00" value={cash} onChange={setCash} type="number" prefix="$" />}
      {method === "Efectivo" && parseFloat(cash || 0) > 0 && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: C.muted }}>Cambio</span>
          <span style={{ fontWeight: 700, color: cambio > 0 ? C.green : C.text }}>${cambio.toFixed(2)}</span>
        </div>
      )}
      {method === "MP / QR" && <div style={{ textAlign: "center", padding: "24px 0 16px", color: C.muted }}>📱 Escanea el código QR con Mercado Pago</div>}
      {method === "Tarjeta" && <div style={{ textAlign: "center", padding: "24px 0 16px", color: C.muted }}>💳 Acerca la tarjeta al lector</div>}
      <Btn disabled={!canConfirm} onClick={() => { onConfirm(method); onClose(); }}>✅ Confirmar Pago</Btn>
    </Modal>
  );
}

export function GuardarTicketModal({ onClose, onSave }) {
  const [client, setClient] = useState("");
  const [mesa, setMesa] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal title="Guardar Ticket" titleIcon="📋" onClose={onClose}>
      <MInput label="Nombre del cliente (opcional)" placeholder="Ej. Carlos M., Sandra..." value={client} onChange={setClient} />
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 10 }}>Mesa / Ubicación</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {MESAS.map(m => (
            <button key={m} onClick={() => setMesa(m)} style={{ padding: "9px 6px", borderRadius: 8, border: `1px solid ${mesa === m ? C.accent : C.border}`, background: mesa === m ? `${C.accent}22` : C.bg, color: mesa === m ? C.accent : C.text, cursor: "pointer", fontSize: 13, fontWeight: mesa === m ? 700 : 400 }}>{m}</button>
          ))}
        </div>
      </div>
      <MInput label="Nota (opcional)" placeholder="Sin azúcar, para llevar..." value={note} onChange={setNote} />
      <Btn onClick={() => { onSave({ client, mesa, note }); onClose(); }}>✅ Guardar Ticket</Btn>
    </Modal>
  );
}

export function NuevoDeudorModal({ user, onClose, onSave }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const valid = name && concept && parseFloat(amount || 0) > 0;
  return (
    <Modal title="Nuevo Deudor" onClose={onClose}>
      <MInput label="Nombre del cliente" required placeholder="Ej. Juan García" value={name} onChange={setName} />
      <MInput label="Teléfono" placeholder="555-0000" value={phone} onChange={setPhone} />
      <MInput label="Concepto" required placeholder="Ej. Mensualidad Gym - Junio" value={concept} onChange={setConcept} />
      <MInput label="Monto" required placeholder="0.00" value={amount} onChange={setAmount} type="number" prefix="$" />
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar initials={user.name.slice(0, 2).toUpperCase()} size={28} />
        <span style={{ fontSize: 13, color: C.muted }}>Registrado por: <strong style={{ color: C.text }}>{user.name}</strong></span>
      </div>
      <Btn disabled={!valid} onClick={() => { onSave({ name, phone, concept, amount: parseFloat(amount) }); onClose(); }}>Registrar Deudor</Btn>
    </Modal>
  );
}

export function CobrarTicketModal({ ticket, onClose, onConfirm }) {
  const [method, setMethod] = useState("Efectivo");
  const [cash, setCash] = useState("");
  const [operator, setOperator] = useState("AD");
  const methods = [{ id: "Efectivo", icon: "💵" }, { id: "MP / QR", icon: "📱" }, { id: "Tarjeta", icon: "💳" }];
  const cambio = method === "Efectivo" ? Math.max(0, parseFloat(cash || 0) - ticket.total) : 0;
  const canConfirm = method !== "Efectivo" || parseFloat(cash || 0) >= ticket.total;
  return (
    <Modal title="Cobrar Ticket" onClose={onClose}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{ticket.location} — {ticket.client || "Sin cliente"}</div>
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Total a cobrar</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: C.accent }}>${ticket.total.toFixed(2)}</div>
      </div>
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
        {ticket.items.map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: i < ticket.items.length - 1 ? 8 : 0 }}>
            <span>{item.name}</span><span style={{ color: C.muted }}>${item.price}.00</span>
          </div>
        ))}
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted }}>
          <Avatar initials={ticket.savedBy[0]} size={20} color={C.blue} /> Guardado por {ticket.savedBy}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {methods.map(m => (
          <button key={m.id} onClick={() => setMethod(m.id)} style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: `2px solid ${method === m.id ? C.accent : C.border}`, background: method === m.id ? `${C.accent}22` : C.bg, color: method === m.id ? C.accent : C.muted, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{m.icon}</div>{m.id}
          </button>
        ))}
      </div>
      {method === "Efectivo" && <MInput label="Efectivo recibido" placeholder="$0.00" value={cash} onChange={setCash} type="number" prefix="$" />}
      {method === "Efectivo" && parseFloat(cash || 0) > 0 && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: C.muted }}>Cambio</span>
          <span style={{ fontWeight: 700, color: cambio > 0 ? C.green : C.text }}>${cambio.toFixed(2)}</span>
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 10 }}>Cobrado por</label>
        <div style={{ display: "flex", gap: 10 }}>
          {OPERATORS.map(op => (
            <button key={op.initials} onClick={() => setOperator(op.initials)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `2px solid ${operator === op.initials ? op.color : C.border}`, background: operator === op.initials ? `${op.color}22` : C.bg, cursor: "pointer", textAlign: "center" }}>
              <Avatar initials={op.initials} size={32} color={op.color} />
              <div style={{ fontSize: 12, marginTop: 6, color: operator === op.initials ? op.color : C.muted, fontWeight: operator === op.initials ? 700 : 400 }}>{op.name}</div>
            </button>
          ))}
        </div>
      </div>
      <Btn disabled={!canConfirm} onClick={() => { onConfirm({ method, operator }); onClose(); }}>✅ Confirmar Cobro</Btn>
    </Modal>
  );
}

const GASTO_CATS_LIST = ["Renta / Local", "Sueldos", "Proveedores", "Servicios (Luz, Agua, Internet)", "Equipo / Mantenimiento", "Marketing", "Limpieza", "Otros"];

export function RegistrarGastoModal({ onClose, onSave }) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Renta / Local");
  const [note, setNote] = useState("");
  const [operator, setOperator] = useState("AD");
  const valid = desc && parseFloat(amount || 0) > 0;
  return (
    <Modal title="Registrar Gasto" titleIcon="📉" onClose={onClose}>
      <MInput label="Descripción" required placeholder="Ej. Renta local mayo, pago luz..." value={desc} onChange={setDesc} />
      <MInput label="Monto" required placeholder="0.00" value={amount} onChange={setAmount} type="number" prefix="$" />
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 6 }}>Categoría</label>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "11px 14px", outline: "none" }}>
          {GASTO_CATS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <MInput label="Nota (opcional)" placeholder="Información adicional..." value={note} onChange={setNote} />
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 10 }}>Registrado por</label>
        <div style={{ display: "flex", gap: 10 }}>
          {OPERATORS.map(op => (
            <button key={op.initials} onClick={() => setOperator(op.initials)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `2px solid ${operator === op.initials ? op.color : C.border}`, background: operator === op.initials ? `${op.color}22` : C.bg, cursor: "pointer", textAlign: "center" }}>
              <Avatar initials={op.initials} size={32} color={op.color} />
              <div style={{ fontSize: 12, marginTop: 6, color: operator === op.initials ? op.color : C.muted, fontWeight: operator === op.initials ? 700 : 400 }}>{op.name}</div>
            </button>
          ))}
        </div>
      </div>
      <Btn variant="orange" disabled={!valid} onClick={() => { onSave({ desc, amount: parseFloat(amount), cat, note, operator }); onClose(); }}>
        📉 Registrar Gasto de ${parseFloat(amount || 0).toFixed(2)}
      </Btn>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODAL: AGREGAR PRODUCTO — con carga de imagen
// ═══════════════════════════════════════════════════════════════
const CATS_FOR_PRODUCT = ["Bebidas", "Snacks", "Suplementos", "Servicios", "Ropa", "Accesorios"];

export function AgregarProductoModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cat, setCat] = useState("Bebidas");
  const [stock, setStock] = useState("");
  const [hasStock, setHasStock] = useState(true);
  const [imgSrc, setImgSrc] = useState(null);   // base64 preview
  const [imgFile, setImgFile] = useState(null);  // File object
  const fileRef = useRef();
  const valid = name && parseFloat(price || 0) > 0;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImgSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <Modal title="Agregar Producto" titleIcon="📦" onClose={onClose}>
      {/* Category */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 8 }}>Categoría</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATS_FOR_PRODUCT.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${cat === c ? C.accent : C.border}`, background: cat === c ? `${C.accent}22` : C.bg, color: cat === c ? C.accent : C.muted, cursor: "pointer", fontSize: 12, fontWeight: cat === c ? 700 : 400 }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Image upload */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 8 }}>Imagen del producto</label>
        <div
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${imgSrc ? C.accent : C.border}`, borderRadius: 12, padding: "20px", textAlign: "center", cursor: "pointer", background: imgSrc ? `${C.accent}08` : C.bg, transition: "border-color .2s" }}>
          {imgSrc ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <Image
                src={imgSrc}
                alt="preview"
                width={100}
                height={100}
                style={{
                  borderRadius: 10,
                  objectFit: "cover",
                  border: `2px solid ${C.accent}55`
                }}
              />
              <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>✅ Imagen cargada — clic para cambiar</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 36 }}>🖼️</div>
              <div style={{ fontSize: 13, color: C.muted }}>Clic para subir imagen</div>
              <div style={{ fontSize: 11, color: C.muted }}>PNG, JPG, WEBP · máx 5 MB</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
      </div>

      <MInput label="Nombre del producto" required placeholder="Ej. Café Americano" value={name} onChange={setName} />
      <MInput label="Precio" required placeholder="0.00" value={price} onChange={setPrice} type="number" prefix="$" />

      {/* Stock toggle */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ fontSize: 13, color: C.muted }}>¿Tiene control de stock?</label>
          <button onClick={() => setHasStock(!hasStock)} style={{ width: 44, height: 24, borderRadius: 12, background: hasStock ? C.accent : C.border, border: "none", cursor: "pointer", position: "relative", transition: "background .2s" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: hasStock ? 23 : 3, transition: "left .2s" }} />
          </button>
        </div>
        {hasStock && <MInput label="Stock inicial" placeholder="0" value={stock} onChange={setStock} type="number" />}
      </div>

      <Btn disabled={!valid} onClick={() => {
        onSave({ name, price: parseFloat(price), cat, stock: hasStock ? parseInt(stock || 0) : null, imgSrc, imgFile });
        onClose();
      }}>
        ➕ Agregar Producto
      </Btn>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHART: BAR — hover tooltip
// ═══════════════════════════════════════════════════════════════
export function BarChart({ data, height = 200 }) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(null);
  const containerRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);

  const max = Math.max(...data.map(d => d.value), 1);
  const ySteps = 5;
  const steps = Array.from({ length: ySteps + 1 }, (_, i) => Math.round(max * i / ySteps));

  return (
    <div style={{ width: "100%", position: "relative" }} ref={containerRef}>
      {hovered && (
        <div style={{ position: "absolute", left: hovered.x, top: hovered.y - 66, transform: "translateX(-50%)", background: C.card, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, pointerEvents: "none", zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,.5)", whiteSpace: "nowrap" }}>
          <div style={{ color: C.accent, fontWeight: 700 }}>{hovered.label}</div>
          <div style={{ color: C.text }}>${hovered.value.toLocaleString()}</div>
          <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `6px solid ${C.accent}` }} />
        </div>
      )}
      <div style={{ display: "flex", gap: 10, height, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 28, minWidth: 36 }}>
          {[...steps].reverse().map((v, i) => (
            <span key={i} style={{ fontSize: 10, color: C.muted }}>{v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}</span>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, position: "relative", borderLeft: `1px solid ${C.border}`, paddingLeft: 6 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ position: "absolute", left: 6, right: 0, bottom: `${(i / (steps.length - 1)) * (height - 28)}px`, borderTop: `1px dashed ${C.border}33`, pointerEvents: "none" }} />
          ))}
          {data.map((d, i) => {
            const pct = (d.value / max) * 100;
            const isHov = hovered?.idx === i;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", cursor: "pointer" }}
                onMouseEnter={e => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  const br = e.currentTarget.getBoundingClientRect();
                  setHovered({ idx: i, x: br.left - rect.left + br.width / 2, y: br.top - rect.top, label: d.label, value: d.value });
                }}
                onMouseLeave={() => setHovered(null)}>
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                  <div style={{ width: "100%", height: mounted ? `${pct}%` : "0%", background: isHov ? `linear-gradient(180deg,#00ffcc,${C.accent})` : `linear-gradient(180deg,${C.accent}cc,${C.accentEnd})`, borderRadius: "5px 5px 0 0", transition: `height ${0.45 + i * .06}s cubic-bezier(.34,1.56,.64,1), background .15s`, minHeight: d.value > 0 ? 3 : 0, boxShadow: isHov ? `0 0 14px ${C.accent}88` : "none" }} />
                </div>
                <span style={{ fontSize: 10, color: isHov ? C.accent : C.muted, textAlign: "center", paddingTop: 6, paddingBottom: 4, lineHeight: 1.2, fontWeight: isHov ? 700 : 400, transition: "color .15s" }}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHART: DONUT — fixed with user-provided arc formula
// ═══════════════════════════════════════════════════════════════
export function DonutChart({ segments, size = 180, thickness = 30 }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 300); return () => clearTimeout(t); }, []);

  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;

  // ── Arc calculation exactly as provided by user ──────────────
  const arcs = segments.reduce(
    (acc, seg) => {
      const frac = seg.value / total;
      const dash = frac * circ;
      const gap = circ - dash;
      const startOffset = circ - (acc.offset / total) * circ;
      acc.result.push({ ...seg, dash, gap, startOffset });
      acc.offset += seg.value;
      return acc;
    },
    { offset: 0, result: [] }
  ).result;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
      {/* SVG */}
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={thickness} />
          {/* Segments */}
          {arcs.map((arc, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeDasharray={`${mounted ? arc.dash : 0} ${arc.gap}`}
              strokeDashoffset={arc.startOffset}
              style={{
                transition: `stroke-dasharray ${0.7 + i * .2}s cubic-bezier(.34,1.56,.64,1)`,
                filter: `drop-shadow(0 0 5px ${arc.color}88)`,
              }}
            />
          ))}
        </svg>
        {/* Center */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 11, color: C.muted }}>Total</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>100%</span>
        </div>
      </div>
      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minWidth: 130 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: seg.color, flexShrink: 0, boxShadow: `0 0 8px ${seg.color}` }} />
            <span style={{ color: C.muted, fontSize: 13, flex: 1 }}>{seg.label}</span>
            <span style={{ color: C.text, fontWeight: 700, fontSize: 15, minWidth: 36, textAlign: "right" }}>{seg.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressBar({ label, value, max, color, amount, delay = 0 }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), delay + 100); return () => clearTimeout(t); }, [delay]);
  const pct = Math.min((value / (max || 1)) * 100, 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
        <span style={{ background: `${color}33`, color, padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{label}</span>
        <span style={{ color: C.muted, fontSize: 12 }}>{amount}</span>
      </div>
      <div style={{ height: 6, background: C.border, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg,${color},${color}99)`, width: mounted ? `${pct}%` : "0%", transition: `width ${0.6 + delay * .001}s cubic-bezier(.34,1.56,.64,1)` }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════
const STATUS_ORDER = ["Al Día", "En Seguimiento", "Atrasado", "Crítico"];
const STATUS_META = {
  "Al Día": { color: C.accent, icon: "✅", range: "0–7 días", cardBg: `${C.accent}11` },
  "En Seguimiento": { color: C.warn, icon: "🕐", range: "8–30 días", cardBg: `${C.warn}11` },
  "Atrasado": { color: C.orange, icon: "⚠️", range: "31–60 días", cardBg: `${C.orange}11` },
  "Crítico": { color: C.danger, icon: "🔴", range: "60+ días", cardBg: `${C.danger}11` },
};

const CATS_INV = ["Todos", "Bebidas", "Snacks", "Suplementos", "Servicios", "Ropa", "Accesorios"];
const GASTO_CATS_FILTER = ["Todos", "Renta / Local", "Proveedores", "Servicios", "Sueldos", "Equipo", "Marketing", "Limpieza"];

// ─── Product thumbnail helper ─────────────────────────────────────────────────
// Shows image if available, otherwise emoji with subtle dark bg
export function ProductThumb({ p, size = 48 }) {
  return p.imgSrc ? (
    <Image
      src={p.imgSrc}
      alt={p.name}
      width={size}
      height={size}
      style={{
        borderRadius: size * 0.2,
        objectFit: "cover",
        flexShrink: 0
      }}
    />
  ) : (
    <div style={{ width: size, height: size, borderRadius: size * .2, background: `${C.accent}11`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * .5, flexShrink: 0 }}>{p.emoji}</div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEW: DEUDORES
// ═══════════════════════════════════════════════════════════════
export function DeudoresView({ user }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [expanded, setExpanded] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [deudores, setDeudores] = useState([]);
  const [loadingD, setLoadingD] = useState(true);

  useEffect(() => {
    DeudoresAPI.list()
      .then(data => setDeudores(data))
      .catch(err => console.error("Error al cargar deudores:", err))
      .finally(() => setLoadingD(false));
  }, []);

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = deudores.filter(d => d.status === s && (filter === "Todos" || filter === s) && (d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)));
    return acc;
  }, {});

  const totalDebt = deudores.reduce((s, d) => s + d.amount, 0);
  const stats = STATUS_ORDER.map(s => ({ status: s, count: deudores.filter(d => d.status === s).length, amount: deudores.filter(d => d.status === s).reduce((a, d) => a + d.amount, 0) }));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
      {showModal && <NuevoDeudorModal user={user} onClose={() => setShowModal(false)} onSave={async data => {
        try {
          const { debtor } = await DeudoresAPI.create(data);
          setDeudores(p => [...p, debtor]);
        } catch (err) {
          console.error("Error al registrar deudor:", err);
        }
      }} />}
      <PageHeader title="Gestión de Deudores" user={user} />
      <ScrollArea>
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {stats.map((s, i) => {
            const m = STATUS_META[s.status]; return (
              <div key={s.status} style={{ flex: 1, minWidth: 160, background: m.cardBg, border: `1px solid ${m.color}33`, borderRadius: 12, padding: "16px 18px", opacity: 0, animation: `fadeUp .4s ease ${i * .08}s both` }}>
                <div style={{ fontSize: 12, color: m.color, marginBottom: 6, fontWeight: 600 }}>{m.icon} {s.status}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{s.count}</div>
                <div style={{ fontSize: 13, color: C.muted }}>${s.amount.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: `${m.color}99`, marginTop: 2 }}>{m.range}</div>
              </div>
            );
          })}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${C.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👥</div>
            <div><div style={{ fontWeight: 700 }}>{deudores.length} Deudores registrados</div><div style={{ fontSize: 12, color: C.muted }}>Deuda total acumulada</div></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.accent }}>${totalDebt.toLocaleString()}.00</div>
            <div style={{ fontSize: 12, color: C.muted }}>pendiente</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.muted }}>🔍</span>
            <input style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "10px 14px 10px 40px", outline: "none" }}
              placeholder="Buscar deudor, teléfono o concepto..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Btn onClick={() => setShowModal(true)}>+ Nuevo Deudor</Btn>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {["Todos", ...STATUS_ORDER].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: filter === f ? `${C.accent}22` : "transparent", border: `1px solid ${filter === f ? C.accent : C.border}`, color: filter === f ? C.accent : C.muted }}>
              {f === "Todos" ? `Todos (${deudores.length})` : `${STATUS_META[f].icon} ${f} (${deudores.filter(d => d.status === f).length})`}
            </button>
          ))}
        </div>
        {STATUS_ORDER.map(status => {
          const group = grouped[status];
          if (!group.length) return null;
          const m = STATUS_META[status];
          return (
            <div key={status}>
              <SectionLabel icon={m.icon} title={`${status} (${m.range})`} count={`${group.length} clientes`} color={m.color} />
              {group.map((d, i) => (
                <div key={d.id} className="feh-hover feh-fade" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8, padding: "14px 18px", cursor: "pointer", animationDelay: `${i * .06}s`, borderLeft: `3px solid ${m.color}` }} onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar initials={d.initials} color={m.color} size={38} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</span><StatusBadge status={d.status} /></div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>📅 {d.days} días &nbsp;📞 {d.phone}</div>
                    </div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>${d.amount.toLocaleString()}.00</div><div style={{ fontSize: 11, color: C.muted }}>pendiente</div></div>
                    <span style={{ color: C.muted, display: "inline-block", transform: expanded === d.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>▾</span>
                  </div>
                  {expanded === d.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
                      <Btn variant="ghost" size="sm">📋 Ver historial</Btn>
                      <Btn variant="primary" size="sm">💰 Registrar pago</Btn>
                      <Btn variant="danger" size="sm" onClick={async e => {
                        e.stopPropagation();
                        try {
                          await DeudoresAPI.delete(d.id);
                          setDeudores(p => p.filter(x => x.id !== d.id));
                        } catch (err) {
                          console.error("Error al eliminar deudor:", err);
                        }
                      }}>🗑 Eliminar</Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEW: TICKETS
// ═══════════════════════════════════════════════════════════════
export function TicketsView({ user, tickets, setTickets, onRecover }) {
  const [cobrarTicket, setCobrarTicket] = useState(null);

  const active = tickets.length;
  const total = tickets.reduce((s, t) => s + t.total, 0);
  const urgentes = tickets.filter(t => t.urgent).length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
      {cobrarTicket && <CobrarTicketModal ticket={cobrarTicket} onClose={() => setCobrarTicket(null)} onConfirm={async (payment) => {
        try {
          await TicketsAPI.charge(cobrarTicket.id, payment);
          setTickets(p => p.filter(t => t.id !== cobrarTicket.id));
        } catch (err) {
          console.error("Error al cobrar ticket:", err);
        }
        setCobrarTicket(null);
      }} />}
      <PageHeader title="Tickets Pendientes" user={user} />
      <ScrollArea>
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard icon="🎫" label="Tickets activos" value={active} color={C.accent} delay={0} />
          <StatCard icon="💰" label="Total pendiente" value={`$${total}`} color={C.blue} delay={80} />
          <StatCard icon="⚠️" label="Urgentes (+45min)" value={urgentes} color={C.danger} delay={160} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span>🎫</span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tickets Pendientes</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
          {tickets.map((t, i) => (
            <div key={t.id} className="feh-fade" style={{ background: C.card, border: `1px solid ${t.urgent ? `${C.danger}66` : C.border}`, borderRadius: 14, padding: "18px 20px", animationDelay: `${i * .1}s` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛍</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{t.location}</div>
                    <div style={{ fontSize: 12, color: t.urgent ? C.danger : C.muted, display: "flex", alignItems: "center", gap: 4 }}>🕐 {t.time} {t.urgent && <StatusBadge status="Urgente" />}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 18, fontWeight: 800, color: t.urgent ? C.danger : C.accent }}>${t.total}.00</div><div style={{ fontSize: 11, color: C.muted }}>{t.items.length} productos</div></div>
              </div>
              {t.items.map((item, j) => (
                <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 4 }}><span>{item.name}</span><span>${item.price}.00</span></div>
              ))}
              {t.note && <div style={{ background: "#2d1e0088", border: `1px solid ${C.warn}44`, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: C.warn, margin: "10px 0" }}>📋 {t.note}</div>}
              <div style={{ fontSize: 12, color: C.muted, margin: "10px 0", display: "flex", alignItems: "center", gap: 6 }}>
                <Avatar initials={t.savedBy[0]} size={20} color={C.blue} /> Guardado por <strong style={{ color: C.text }}>{t.savedBy}</strong>
                {t.client && <> &nbsp;👤 <span>{t.client}</span></>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={async () => {
                  try {
                    await TicketsAPI.delete(t.id);
                    setTickets(p => p.filter(x => x.id !== t.id));
                  } catch (err) {
                    console.error("Error al eliminar ticket:", err);
                  }
                }} style={{ width: 36, height: 36, borderRadius: 8, background: `${C.danger}22`, border: `1px solid ${C.danger}44`, color: C.danger, cursor: "pointer", fontSize: 16 }}>🗑</button>
                <Btn variant="ghost" onClick={async () => {
                  try {
                    await TicketsAPI.delete(t.id);
                    setTickets(p => p.filter(x => x.id !== t.id));
                    onRecover(t.cart);
                  } catch (err) {
                    console.error("Error al recuperar ticket:", err);
                  }
                }}>🔄 Recuperar</Btn>
                <Btn variant="primary" onClick={() => setCobrarTicket(t)}>✅ Cobrar</Btn>
              </div>
            </div>
          ))}
          {tickets.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: C.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div><p>No hay tickets pendientes</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEW: INVENTARIO — products passed from parent (shared state)
// ═══════════════════════════════════════════════════════════════
export function InventarioView({ user, products, setProducts }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("Todos");
  const [showModal, setShowModal] = useState(false);

  const filtered = products.filter(p => (cat === "Todos" || p.cat === cat) && p.name.toLowerCase().includes(search.toLowerCase()));
  const lowStock = products.filter(p => p.status === "Bajo");
  const totalVal = products.reduce((s, p) => s + p.price * (p.stock || 0), 0);
  const agotados = products.filter(p => p.stock === 0).length;
  const statusColor = { "OK": C.green, "Bajo": C.warn, "Agotado": C.danger };

  const handleSave = async (data) => {
    try {
      const { product } = await ProductsAPI.create(data);
      setProducts(prev => [...prev, product]);
    } catch (err) {
      console.error("Error al crear producto:", err);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
      {showModal && <AgregarProductoModal onClose={() => setShowModal(false)} onSave={handleSave} />}
      <PageHeader title="Inventario" user={user} />
      <ScrollArea>
        {lowStock.length > 0 && (
          <div style={{ background: "#2d1e00", border: `1px solid ${C.warn}44`, borderRadius: 12, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ color: C.warn, fontWeight: 700 }}>⚠️ {lowStock.length} productos con stock bajo</span>
            {lowStock.map(p => <span key={p.id} style={{ background: `${C.warn}22`, color: C.warn, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{p.emoji} {p.name} ({p.stock})</span>)}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard icon="📦" label="Total productos" value={products.length} color={C.accent} delay={0} />
          <StatCard icon="⚠️" label="Stock bajo" value={lowStock.length} color={C.warn} delay={80} />
          <StatCard icon="❌" label="Agotados" value={agotados} color={C.danger} delay={160} />
          <StatCard icon="💲" label="Valor en stock" value={`$${totalVal.toLocaleString()}`} color={C.green} delay={240} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }}>🔍</span>
            <input style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, padding: "9px 12px 9px 36px", outline: "none" }}
              placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {CATS_INV.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${cat === c ? C.accent : C.border}`, background: cat === c ? `${C.accent}22` : C.card, color: cat === c ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>
          ))}
          <Btn variant="primary" onClick={() => setShowModal(true)}>+ Agregar</Btn>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 80px 100px", padding: "10px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
            <span>Producto</span><span>Categoría</span><span>Precio</span><span>Stock</span><span>Estado</span><span>Acciones</span>
          </div>
          {filtered.map((p, i) => (
            <div key={p.id} className="feh-hover feh-fade" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 80px 100px", padding: "10px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 13, alignItems: "center", animationDelay: `${i * .03}s`, borderLeft: `3px solid ${statusColor[p.status] || C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ProductThumb p={p} size={36} />
                <span style={{ fontWeight: 500 }}>{p.name}</span>
              </div>
              <span><span style={{ background: `${C.accent}22`, color: C.accent, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{p.cat}</span></span>
              <span style={{ color: C.accent, fontWeight: 600 }}>${p.price}.00</span>
              <span style={{ color: p.stock !== null && p.stock <= 8 ? C.warn : C.text }}>{p.stock !== null ? `↘ ${p.stock}` : "—"}</span>
              <StatusBadge status={p.status} />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: 0 }}>✏️</button>
                <button onClick={async () => {
                  try {
                    await ProductsAPI.delete(p.id);
                    setProducts(prev => prev.filter(x => x.id !== p.id));
                  } catch (err) {
                    console.error("Error al eliminar producto:", err);
                  }
                }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: 0 }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEW: GASTOS
// ═══════════════════════════════════════════════════════════════
const CAT_COLORS_MAP = { "Renta / Local": "#f85149", "Sueldos": "#3fb950", "Proveedores": "#bc8cff", "Servicios (Luz, Agua, Internet)": "#58a6ff", "Equipo / Mantenimiento": "#f0ad4e", "Marketing": "#ffa657", "Limpieza": "#00d4aa", "Otros": "#8b949e" };

export function GastosView({ user }) {
  const [filter, setFilter] = useState("Todos");
  const [showModal, setShowModal] = useState(false);
  const [gastos, setGastos] = useState([]);
  const [ingresosMes, setIngresosMes] = useState(0);

  useEffect(() => {
    GastosAPI.list()
      .then(data => setGastos(data.map(g => ({ ...g, color: CAT_COLORS_MAP[g.cat] || C.muted }))))
      .catch(err => console.error("Error al cargar gastos:", err));
    ReportsAPI.summary("Este mes")
      .then(s => setIngresosMes(s.kpis.ventas))
      .catch(err => console.error("Error al cargar ingresos:", err));
  }, []);

  const totalGastos = gastos.reduce((s, g) => s + g.amount, 0);
  const gananciaNeta = ingresosMes - totalGastos;
  const catDist = Object.entries(
    gastos.reduce((acc, g) => {
      const cat = g.cat || "Otros";
      acc[cat] = (acc[cat] || 0) + g.amount;
      return acc;
    }, {})
  )
    .map(([label, value]) => ({ label, value, color: CAT_COLORS_MAP[label] || C.muted }))
    .sort((a, b) => b.value - a.value);
  const maxGasto = Math.max(...catDist.map(g => g.value), 1);
  const filtered = filter === "Todos" ? gastos : gastos.filter(g => (g.cat || "").toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
      {showModal && <RegistrarGastoModal onClose={() => setShowModal(false)} onSave={async data => {
        try {
          const { expense } = await GastosAPI.create(data);
          setGastos(prev => [{ ...expense, color: CAT_COLORS_MAP[expense.cat] || C.muted }, ...prev]);
        } catch (err) {
          console.error("Error al registrar gasto:", err);
        }
      }} />}
      <PageHeader title="Registro de Gastos" user={user} />
      <ScrollArea>
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard icon="📉" label="Total gastos" value={`$${totalGastos.toLocaleString()}`} sub={`${gastos.length} registros`} color={C.danger} delay={0} />
          <StatCard icon="📅" label="Este mes" value={`$${totalGastos.toLocaleString()}`} sub={`${gastos.length} gastos`} color={C.orange} delay={80} />
          <StatCard icon="💲" label="Ingresos mes" value={`$${ingresosMes.toLocaleString()}`} sub="ventas del mes" color={C.blue} delay={160} />
          <StatCard icon="📋" label="Ganancia neta" value={`$${gananciaNeta.toLocaleString()}`} sub="ingresos − gastos" color={C.green} delay={240} />
        </div>
        {catDist.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
            <h4 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>Distribución por categoría</h4>
            {catDist.map((g, i) => <ProgressBar key={g.label} label={g.label} value={g.value} max={maxGasto} color={g.color} amount={`$${g.value.toLocaleString()}`} delay={i * 100} />)}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1 }}>
            {GASTO_CATS_FILTER.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${filter === f ? C.accent : C.border}`, background: filter === f ? `${C.accent}22` : "transparent", color: filter === f ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{f}</button>
            ))}
          </div>
          <Btn variant="primary" onClick={() => setShowModal(true)}>+ Nuevo Gasto</Btn>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: C.muted }}>{filtered.length} gastos</span>
            <span style={{ color: C.muted }}>Total: <strong style={{ color: C.text }}>${filtered.reduce((s, g) => s + g.amount, 0).toLocaleString()}</strong></span>
          </div>
          {filtered.map((g, i) => (
            <div key={g.id} className="feh-hover feh-fade" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: `1px solid ${C.border}`, animationDelay: `${i * .07}s` }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${g.color}22`, border: `1px solid ${g.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🏷️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{g.desc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ background: `${g.color}22`, color: g.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{g.cat}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>📅 {g.date}</span>
                  <span style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}><Avatar initials={g.byInitials} size={18} color={C.blue} /> {g.by}</span>
                </div>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.orange }}>${g.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEW: REPORTES
// ═══════════════════════════════════════════════════════════════
const PAY_METHOD_COLORS = { "Efectivo": C.accent, "MP / QR": C.green, "Tarjeta": C.purple };

export function ReportesView({ user }) {
  const [period, setPeriod] = useState("Esta semana");
  // report.period distinto del period activo ⇒ todavía cargando ese periodo
  const [report, setReport] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([ReportsAPI.summary(period), ReportsAPI.deudores()])
      .then(([s, d]) => { if (active) setReport({ period, summary: s, deudores: d }); })
      .catch(err => {
        console.error("Error al cargar reportes:", err);
        if (active) setReport({ period, summary: null, deudores: [] });
      });
    return () => { active = false; };
  }, [period]);

  const loading = !report || report.period !== period;
  const summary = loading ? null : report.summary;
  const deudoresReport = loading ? [] : report.deudores;

  const kpis = summary ? [
    { icon: "💲", label: "Ventas", value: `$${summary.kpis.ventas.toLocaleString()}`, sub: period.toLowerCase(), color: C.green },
    { icon: "🎫", label: "Transacciones", value: `${summary.kpis.transacciones}`, sub: "ventas", color: C.purple },
    { icon: "📉", label: "Gastos", value: `$${summary.kpis.gastos.toLocaleString()}`, sub: period.toLowerCase(), color: C.danger },
    { icon: "📈", label: "Ganancia neta", value: `$${summary.kpis.gananciaNeta.toLocaleString()}`, sub: "ventas − gastos", color: C.accent },
    { icon: "👥", label: "Deuda pendiente", value: `$${summary.kpis.deudaPendiente.toLocaleString()}`, sub: `${summary.kpis.deudoresCount} deudores`, color: C.warn },
  ] : [];
  const donutSegments = summary
    ? summary.paymentMethods.map(m => ({ ...m, color: PAY_METHOD_COLORS[m.label] || C.muted }))
    : [];
  const sc = { "Al Día": C.accent, "En Seguimiento": C.warn, "Atrasado": C.orange, "Crítico": C.danger };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
      <PageHeader title="Reportes & Analytics" user={user} />
      <ScrollArea>
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {["Hoy", "Esta semana", "Este mes"].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding: "8px 20px", borderRadius: 20, border: `1px solid ${period === p ? C.accent : C.border}`, background: period === p ? `${C.accent}22` : "transparent", color: period === p ? C.accent : C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{p}</button>
          ))}
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: .4 }}>📊</div>
            <p style={{ margin: 0, fontSize: 13 }}>Cargando reportes…</p>
          </div>
        ) : !summary ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: .4 }}>⚠️</div>
            <p style={{ margin: 0, fontSize: 13 }}>No se pudieron cargar los reportes.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              {kpis.map((k, i) => (
                <div key={k.label} style={{ flex: 1, minWidth: 140, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", opacity: 0, animation: `fadeUp .4s ease ${i * .07}s both` }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{k.icon} {k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px" }}>
                <h4 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>📊 Ventas — {period}</h4>
                <BarChart data={summary.weeklySales} height={220} />
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px" }}>
                <h4 style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 700 }}>💲 Métodos de pago</h4>
                {donutSegments.length > 0 ? (
                  <DonutChart segments={donutSegments} size={180} thickness={30} />
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 0", color: C.muted, fontSize: 13 }}>Sin ventas en este periodo</div>
                )}
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>👥 Reporte de Deudores</h4>
                <span style={{ fontSize: 12, color: C.muted }}>📅 Al {new Date().toLocaleDateString("es-MX")}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                <span>Cliente</span><span>Total Deuda</span><span style={{ color: C.green }}>Pagado</span><span style={{ color: C.warn }}>Pendiente</span><span>Estado</span>
              </div>
              {deudoresReport.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 0", color: C.muted, fontSize: 13 }}>Sin deudores registrados 🎉</div>
              )}
              {deudoresReport.map((d, i) => (
                <div key={i} className="feh-fade" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "12px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 13, alignItems: "center", animationDelay: `${i * .06}s` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar initials={d.initials} size={30} color={sc[d.status] || C.muted} />
                    <span style={{ fontWeight: 500 }}>{d.name}</span>
                  </div>
                  <span>${d.totalDebt.toLocaleString()}.00</span>
                  <span style={{ color: C.green }}>${d.paid.toLocaleString()}.00</span>
                  <span style={{ color: C.warn }}>${d.pending.toLocaleString()}.00</span>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
