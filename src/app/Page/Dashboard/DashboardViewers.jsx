"use client";
import { useState, useEffect, useRef } from "react";
import { DeudoresAPI, TicketsAPI, ProductsAPI, GastosAPI, ReportsAPI } from "@/lib/api.service";
import Image from "next/image";
import "./dashboard.css";

// ═══════════════════════════════════════════════════════════════
// Colores dinámicos — solo los valores que se pasan como CSS var
// (--c / --bg-c). El resto del estilo vive en dashboard.css.
// ═══════════════════════════════════════════════════════════════
const COLORS = {
  accent: "#00d4aa", warn: "#f0ad4e", danger: "#f85149",
  green: "#3fb950", purple: "#bc8cff", blue: "#58a6ff", orange: "#ffa657", muted: "#8b949e",
};

// ═══════════════════════════════════════════════════════════════
// PRIMITIVES
// ═══════════════════════════════════════════════════════════════
export function Avatar({ initials, color, size = 36 }) {
  const style = { "--sz": `${size}px` };
  if (color) style["--bg-c"] = color;
  return <span className="avatar" style={style}>{initials}</span>;
}

export function PageHeader({ title, user }) {
  const now = new Date();
  return (
    <header className="topbar">
      <div>
        <h2 className="topbar__title">{title}</h2>
        <p className="topbar__date">{now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <div className="topbar__right">
        <span className="topbar__clock">📶 💬 {now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
        <Avatar initials={user.name[0]} />
        <div>
          <p className="topbar__meta-name">{user.name}</p>
          <p className="topbar__meta-role">Operador activo</p>
        </div>
      </div>
    </header>
  );
}

export function StatCard({ icon, label, value, sub, color = COLORS.accent, delay = 0 }) {
  return (
    <article className="stat-card" style={{ "--c": color, "--d": `${delay}ms` }}>
      <p className="stat-card__label">{icon} {label}</p>
      <p className="stat-card__value">{value}</p>
      {sub && <p className="stat-card__sub">{sub}</p>}
    </article>
  );
}

export function ScrollArea({ children }) {
  return <div className="scroll-area">{children}</div>;
}

export function SectionLabel({ icon, title, count, color = COLORS.accent }) {
  return (
    <div className="section-label" style={{ "--c": color }}>
      <span className="section-label__title">{icon} {title}</span>
      <span className="section-label__count">{count}</span>
    </div>
  );
}

export function Btn({ children, onClick, variant = "primary", size = "md", disabled = false }) {
  const cls = `btn btn--${variant}${size === "sm" ? " btn--sm" : ""}`;
  return <button className={cls} onClick={onClick} disabled={disabled}>{children}</button>;
}

const STATUS_META_BADGE = {
  "Al Día": { color: COLORS.accent, icon: "✅" },
  "En Seguimiento": { color: COLORS.warn, icon: "🕐" },
  "Atrasado": { color: COLORS.orange, icon: "⚠️" },
  "Crítico": { color: COLORS.danger, icon: "🔴" },
  "Bajo": { color: COLORS.warn, icon: "⚠️" },
  "OK": { color: COLORS.green, icon: "✓" },
  "Agotado": { color: COLORS.danger, icon: "✗" },
  "Urgente": { color: COLORS.danger, icon: "⚠️" },
};

export function StatusBadge({ status }) {
  const s = STATUS_META_BADGE[status] || { color: COLORS.muted, icon: "·" };
  return <span className="badge" style={{ "--c": s.color }}>{s.icon} {status}</span>;
}

// ═══════════════════════════════════════════════════════════════
// MODAL WRAPPER
// ═══════════════════════════════════════════════════════════════
export function Modal({ title, titleIcon, onClose, children, width = 460 }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ "--w": `${width}px` }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal__head">
          <h3 className="modal__title">{titleIcon} {title}</h3>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

function MInput({ label, placeholder, value, onChange, type = "text", prefix, required }) {
  return (
    <div className="field">
      <label className="field__label">{label}{required && <span className="field__req"> *</span>}</label>
      <div className="field__wrap">
        {prefix && <span className="field__prefix">{prefix}</span>}
        <input className={`field__input${prefix ? " field__input--prefixed" : ""}`} type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
      </div>
    </div>
  );
}

const OPERATORS = [
  { initials: "AD", name: "Admin", color: COLORS.accent },
  { initials: "ML", name: "María", color: COLORS.purple },
  { initials: "JR", name: "José", color: COLORS.warn },
];
const MESAS = ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6", "Mesa 7", "Mostrador", "Para llevar"];
const PAY_METHODS = [{ id: "Efectivo", icon: "💵" }, { id: "MP / QR", icon: "📱" }, { id: "Tarjeta", icon: "💳" }];

function PayMethodPicker({ method, setMethod }) {
  return (
    <div className="pay-methods">
      {PAY_METHODS.map(m => (
        <button key={m.id} className={`pay-method${method === m.id ? " pay-method--active" : ""}`} onClick={() => setMethod(m.id)}>
          <p className="pay-method__icon">{m.icon}</p>{m.id}
        </button>
      ))}
    </div>
  );
}

function OperatorPicker({ operator, setOperator }) {
  return (
    <div className="operators">
      {OPERATORS.map(op => (
        <button key={op.initials} className={`operator${operator === op.initials ? " operator--active" : ""}`} style={{ "--c": op.color }} onClick={() => setOperator(op.initials)}>
          <Avatar initials={op.initials} size={32} color={op.color} />
          <p className="operator__name">{op.name}</p>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════
export function ProcesarPagoModal({ total, onClose, onConfirm }) {
  const [method, setMethod] = useState("Efectivo");
  const [cash, setCash] = useState("");
  const cambio = method === "Efectivo" ? Math.max(0, parseFloat(cash || 0) - total) : 0;
  const canConfirm = method !== "Efectivo" || parseFloat(cash || 0) >= total;
  return (
    <Modal title="Procesar Pago" onClose={onClose}>
      <div className="amount-box">
        <p className="amount-box__label">Total a pagar</p>
        <p className="amount-box__value">${total.toFixed(2)}</p>
      </div>
      <PayMethodPicker method={method} setMethod={setMethod} />
      {method === "Efectivo" && <MInput label="Efectivo recibido" placeholder="$0.00" value={cash} onChange={setCash} type="number" prefix="$" />}
      {method === "Efectivo" && parseFloat(cash || 0) > 0 && (
        <div className="change-row">
          <span className="change-row__label">Cambio</span>
          <span className={`change-row__value${cambio > 0 ? " change-row__value--positive" : ""}`}>${cambio.toFixed(2)}</span>
        </div>
      )}
      {method === "MP / QR" && <p className="pay-hint">📱 Escanea el código QR con Mercado Pago</p>}
      {method === "Tarjeta" && <p className="pay-hint">💳 Acerca la tarjeta al lector</p>}
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
      <div className="field">
        <label className="field__label">Mesa / Ubicación</label>
        <div className="mesa-grid">
          {MESAS.map(m => (
            <button key={m} className={`mesa${mesa === m ? " mesa--active" : ""}`} onClick={() => setMesa(m)}>{m}</button>
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
      <div className="reg-by">
        <Avatar initials={user.name.slice(0, 2).toUpperCase()} size={28} />
        <span className="reg-by__text">Registrado por: <strong>{user.name}</strong></span>
      </div>
      <Btn disabled={!valid} onClick={() => { onSave({ name, phone, concept, amount: parseFloat(amount) }); onClose(); }}>Registrar Deudor</Btn>
    </Modal>
  );
}

export function CobrarTicketModal({ ticket, onClose, onConfirm }) {
  const [method, setMethod] = useState("Efectivo");
  const [cash, setCash] = useState("");
  const [operator, setOperator] = useState("AD");
  const cambio = method === "Efectivo" ? Math.max(0, parseFloat(cash || 0) - ticket.total) : 0;
  const canConfirm = method !== "Efectivo" || parseFloat(cash || 0) >= ticket.total;
  return (
    <Modal title="Cobrar Ticket" onClose={onClose}>
      <p className="stat-card__sub" style={{ marginBottom: 16 }}>{ticket.location} — {ticket.client || "Sin cliente"}</p>
      <div className="amount-box">
        <p className="amount-box__label">Total a cobrar</p>
        <p className="amount-box__value">${ticket.total.toFixed(2)}</p>
      </div>
      <div className="ticket-items">
        {ticket.items.map((item, i) => (
          <div key={i} className="ticket-items__row">
            <span>{item.name}</span><span className="ticket-items__price">${item.price}.00</span>
          </div>
        ))}
        <div className="ticket-items__saved">
          <Avatar initials={ticket.savedBy[0]} size={20} color={COLORS.blue} /> Guardado por {ticket.savedBy}
        </div>
      </div>
      <PayMethodPicker method={method} setMethod={setMethod} />
      {method === "Efectivo" && <MInput label="Efectivo recibido" placeholder="$0.00" value={cash} onChange={setCash} type="number" prefix="$" />}
      {method === "Efectivo" && parseFloat(cash || 0) > 0 && (
        <div className="change-row">
          <span className="change-row__label">Cambio</span>
          <span className={`change-row__value${cambio > 0 ? " change-row__value--positive" : ""}`}>${cambio.toFixed(2)}</span>
        </div>
      )}
      <div className="field">
        <label className="field__label">Cobrado por</label>
        <OperatorPicker operator={operator} setOperator={setOperator} />
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
      <div className="field">
        <label className="field__label">Categoría</label>
        <select className="field__select" value={cat} onChange={e => setCat(e.target.value)}>
          {GASTO_CATS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <MInput label="Nota (opcional)" placeholder="Información adicional..." value={note} onChange={setNote} />
      <div className="field">
        <label className="field__label">Registrado por</label>
        <OperatorPicker operator={operator} setOperator={setOperator} />
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
  const [imgSrc, setImgSrc] = useState(null);
  const [imgFile, setImgFile] = useState(null);
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
      <div className="field">
        <label className="field__label">Categoría</label>
        <div className="chips">
          {CATS_FOR_PRODUCT.map(c => (
            <button key={c} className={`chip${cat === c ? " chip--active" : ""}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field__label">Imagen del producto</label>
        <div className={`dropzone${imgSrc ? " dropzone--filled" : ""}`} onClick={() => fileRef.current?.click()}>
          {imgSrc ? (
            <div className="dropzone__col">
              <Image className="dropzone__preview" src={imgSrc} alt="preview" width={100} height={100} />
              <span className="dropzone__ok">✅ Imagen cargada — clic para cambiar</span>
            </div>
          ) : (
            <div className="dropzone__col">
              <p className="dropzone__big">🖼️</p>
              <p className="dropzone__hint">Clic para subir imagen</p>
              <p className="dropzone__sub">PNG, JPG, WEBP · máx 5 MB</p>
            </div>
          )}
        </div>
        <input className="visually-hidden" ref={fileRef} type="file" accept="image/*" onChange={handleFile} />
      </div>

      <MInput label="Nombre del producto" required placeholder="Ej. Café Americano" value={name} onChange={setName} />
      <MInput label="Precio" required placeholder="0.00" value={price} onChange={setPrice} type="number" prefix="$" />

      <div className="field">
        <div className="toggle-row">
          <label className="field__label" style={{ margin: 0 }}>¿Tiene control de stock?</label>
          <button className={`toggle${hasStock ? " toggle--on" : ""}`} onClick={() => setHasStock(!hasStock)} aria-pressed={hasStock}>
            <span className="toggle__knob" />
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
// CHART: BAR — tooltip on hover
// ═══════════════════════════════════════════════════════════════
export function BarChart({ data, height = 200 }) {
  const [hovered, setHovered] = useState(null);
  const containerRef = useRef(null);

  const max = Math.max(...data.map(d => d.value), 1);
  const ySteps = 5;
  const steps = Array.from({ length: ySteps + 1 }, (_, i) => Math.round(max * i / ySteps));

  return (
    <div className="bar-chart" ref={containerRef}>
      {hovered && (
        <div className="bar-chart__tooltip" style={{ left: hovered.x, top: hovered.y - 66 }}>
          <p className="bar-chart__tooltip-label">{hovered.label}</p>
          <p className="bar-chart__tooltip-value">${hovered.value.toLocaleString()}</p>
          <span className="bar-chart__tooltip-arrow" />
        </div>
      )}
      <div className="bar-chart__plot-wrap" style={{ height }}>
        <div className="bar-chart__yaxis">
          {[...steps].reverse().map((v, i) => (
            <span key={i} className="bar-chart__ytick">{v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}</span>
          ))}
        </div>
        <div className="bar-chart__plot">
          {steps.map((_, i) => (
            <span key={i} className="bar-chart__gridline" style={{ "--b": `${(i / (steps.length - 1)) * (height - 28)}px` }} />
          ))}
          {data.map((d, i) => {
            const pct = (d.value / max) * 100;
            return (
              <div key={i} className="bar-col"
                onMouseEnter={e => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  const br = e.currentTarget.getBoundingClientRect();
                  setHovered({ x: br.left - rect.left + br.width / 2, y: br.top - rect.top, label: d.label, value: d.value });
                }}
                onMouseLeave={() => setHovered(null)}>
                <div className="bar-col__track">
                  <div className="bar" style={{ "--h": `${pct}%`, "--d": `${i * 60}ms` }} />
                </div>
                <span className="bar-col__label">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHART: DONUT
// ═══════════════════════════════════════════════════════════════
export function DonutChart({ segments, size = 180, thickness = 30 }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 300); return () => clearTimeout(t); }, []);

  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;

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
    <div className="donut">
      <div className="donut__figure" style={{ width: size, height: size }}>
        <svg className="donut__svg" width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
          {arcs.map((arc, i) => (
            <circle key={i} className="donut__arc" cx={cx} cy={cy} r={r} fill="none"
              stroke={arc.color} strokeWidth={thickness}
              strokeDasharray={`${mounted ? arc.dash : 0} ${arc.gap}`}
              strokeDashoffset={arc.startOffset}
              style={{ filter: `drop-shadow(0 0 5px ${arc.color}88)` }}
            />
          ))}
        </svg>
        <div className="donut__center">
          <span className="donut__center-label">Total</span>
          <span className="donut__center-value">100%</span>
        </div>
      </div>
      <ul className="donut__legend">
        {segments.map((seg, i) => (
          <li key={i} className="legend-item">
            <span className="legend-dot" style={{ "--c": seg.color }} />
            <span className="legend-label">{seg.label}</span>
            <span className="legend-value">{seg.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressBar({ label, value, max, color, amount, delay = 0 }) {
  const pct = Math.min((value / (max || 1)) * 100, 100);
  return (
    <div className="progress" style={{ "--c": color }}>
      <div className="progress__head">
        <span className="progress__label">{label}</span>
        <span className="progress__amount">{amount}</span>
      </div>
      <div className="progress__track">
        <div className="progress__fill" style={{ "--w": `${pct}%`, "--d": `${delay}ms` }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════
const STATUS_ORDER = ["Al Día", "En Seguimiento", "Atrasado", "Crítico"];
const STATUS_META = {
  "Al Día": { color: COLORS.accent, icon: "✅", range: "0–7 días" },
  "En Seguimiento": { color: COLORS.warn, icon: "🕐", range: "8–30 días" },
  "Atrasado": { color: COLORS.orange, icon: "⚠️", range: "31–60 días" },
  "Crítico": { color: COLORS.danger, icon: "🔴", range: "60+ días" },
};

const CATS_INV = ["Todos", "Bebidas", "Snacks", "Suplementos", "Servicios", "Ropa", "Accesorios"];
const GASTO_CATS_FILTER = ["Todos", "Renta / Local", "Proveedores", "Servicios", "Sueldos", "Equipo", "Marketing", "Limpieza"];

// ─── Product thumbnail helper ─────────────────────────────────────────────────
export function ProductThumb({ p, size = 48 }) {
  return p.imgSrc ? (
    <Image className="product-thumb" style={{ "--sz": `${size}px` }} src={p.imgSrc} alt={p.name} width={size} height={size} />
  ) : (
    <span className="product-thumb--emoji" style={{ "--sz": `${size}px` }}>{p.emoji}</span>
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

  useEffect(() => {
    DeudoresAPI.list()
      .then(data => setDeudores(data))
      .catch(err => console.error("Error al cargar deudores:", err));
  }, []);

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = deudores.filter(d => d.status === s && (filter === "Todos" || filter === s) && (d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)));
    return acc;
  }, {});

  const totalDebt = deudores.reduce((s, d) => s + d.amount, 0);
  const stats = STATUS_ORDER.map(s => ({ status: s, count: deudores.filter(d => d.status === s).length, amount: deudores.filter(d => d.status === s).reduce((a, d) => a + d.amount, 0) }));

  return (
    <section className="view">
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
        <div className="debt-stats">
          {stats.map((s, i) => {
            const m = STATUS_META[s.status];
            return (
              <article key={s.status} className="debt-stat" style={{ "--c": m.color, "--d": `${i * 80}ms` }}>
                <p className="debt-stat__label">{m.icon} {s.status}</p>
                <p className="debt-stat__count">{s.count}</p>
                <p className="debt-stat__amount">${s.amount.toLocaleString()}</p>
                <p className="debt-stat__range">{m.range}</p>
              </article>
            );
          })}
        </div>
        <section className="debt-total">
          <div className="debt-total__left">
            <span className="debt-total__icon">👥</span>
            <div>
              <p className="debt-total__count">{deudores.length} Deudores registrados</p>
              <p className="debt-total__sub">Deuda total acumulada</p>
            </div>
          </div>
          <div>
            <p className="debt-total__amount">${totalDebt.toLocaleString()}.00</p>
            <p className="debt-total__sub" style={{ textAlign: "right" }}>pendiente</p>
          </div>
        </section>
        <div className="toolbar-row">
          <div className="search">
            <span className="search__icon">🔍</span>
            <input className="search__input" placeholder="Buscar deudor, teléfono o concepto..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Btn onClick={() => setShowModal(true)}>+ Nuevo Deudor</Btn>
        </div>
        <div className="filters">
          {["Todos", ...STATUS_ORDER].map(f => (
            <button key={f} className={`chip${filter === f ? " chip--active" : ""}`} onClick={() => setFilter(f)}>
              {f === "Todos" ? `Todos (${deudores.length})` : `${STATUS_META[f].icon} ${f} (${deudores.filter(d => d.status === f).length})`}
            </button>
          ))}
        </div>
        {STATUS_ORDER.map(status => {
          const group = grouped[status];
          if (!group.length) return null;
          const m = STATUS_META[status];
          return (
            <section key={status}>
              <SectionLabel icon={m.icon} title={`${status} (${m.range})`} count={`${group.length} clientes`} color={m.color} />
              {group.map((d, i) => (
                <article key={d.id} className="debt-card animate" style={{ "--c": m.color, "--d": `${i * 60}ms` }} onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                  <div className="debt-card__row">
                    <Avatar initials={d.initials} color={m.color} size={38} />
                    <div className="debt-card__info">
                      <div className="debt-card__name-row"><span className="debt-card__name">{d.name}</span><StatusBadge status={d.status} /></div>
                      <p className="debt-card__meta">📅 {d.days} días &nbsp;📞 {d.phone}</p>
                    </div>
                    <div className="debt-card__amount">
                      <p className="debt-card__amount-value" style={{ "--c": m.color }}>${d.amount.toLocaleString()}.00</p>
                      <p className="debt-card__amount-sub">pendiente</p>
                    </div>
                    <span className={`debt-card__chevron${expanded === d.id ? " debt-card__chevron--open" : ""}`}>▾</span>
                  </div>
                  {expanded === d.id && (
                    <div className="debt-card__actions">
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
                </article>
              ))}
            </section>
          );
        })}
      </ScrollArea>
    </section>
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
    <section className="view">
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
        <div className="stats-row">
          <StatCard icon="🎫" label="Tickets activos" value={active} color={COLORS.accent} delay={0} />
          <StatCard icon="💰" label="Total pendiente" value={`$${total}`} color={COLORS.blue} delay={80} />
          <StatCard icon="⚠️" label="Urgentes (+45min)" value={urgentes} color={COLORS.danger} delay={160} />
        </div>
        <div className="subhead">
          <span>🎫</span><h3 className="subhead__title">Tickets Pendientes</h3>
        </div>
        <div className="tickets-grid">
          {tickets.map((t, i) => (
            <article key={t.id} className={`ticket-card animate${t.urgent ? " ticket-card--urgent" : ""}`} style={{ "--d": `${i * 100}ms` }}>
              <header className="ticket__head">
                <div className="ticket__head-left">
                  <span className="ticket__icon">🛍</span>
                  <div>
                    <p className="ticket__loc">{t.location}</p>
                    <p className={`ticket__time${t.urgent ? " ticket__time--urgent" : ""}`}>🕐 {t.time} {t.urgent && <StatusBadge status="Urgente" />}</p>
                  </div>
                </div>
                <div>
                  <p className={`ticket__total${t.urgent ? " ticket__total--urgent" : ""}`}>${t.total}.00</p>
                  <p className="ticket__count">{t.items.length} productos</p>
                </div>
              </header>
              {t.items.map((item, j) => (
                <div key={j} className="ticket__line"><span>{item.name}</span><span>${item.price}.00</span></div>
              ))}
              {t.note && <p className="ticket__note">📋 {t.note}</p>}
              <p className="ticket__saved">
                <Avatar initials={t.savedBy[0]} size={20} color={COLORS.blue} /> Guardado por <strong>{t.savedBy}</strong>
                {t.client && <> &nbsp;👤 <span>{t.client}</span></>}
              </p>
              <div className="ticket__actions">
                <button className="icon-btn-danger" onClick={async () => {
                  try {
                    await TicketsAPI.delete(t.id);
                    setTickets(p => p.filter(x => x.id !== t.id));
                  } catch (err) {
                    console.error("Error al eliminar ticket:", err);
                  }
                }}>🗑</button>
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
            </article>
          ))}
          {tickets.length === 0 && (
            <div className="empty-block">
              <p className="empty-block__emoji">🎉</p><p>No hay tickets pendientes</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
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
  const statusColor = { "OK": COLORS.green, "Bajo": COLORS.warn, "Agotado": COLORS.danger };

  const handleSave = async (data) => {
    try {
      const { product } = await ProductsAPI.create(data);
      setProducts(prev => [...prev, product]);
    } catch (err) {
      console.error("Error al crear producto:", err);
    }
  };

  return (
    <section className="view">
      {showModal && <AgregarProductoModal onClose={() => setShowModal(false)} onSave={handleSave} />}
      <PageHeader title="Inventario" user={user} />
      <ScrollArea>
        {lowStock.length > 0 && (
          <aside className="low-stock">
            <span className="low-stock__title">⚠️ {lowStock.length} productos con stock bajo</span>
            {lowStock.map(p => <span key={p.id} className="low-stock__tag">{p.emoji} {p.name} ({p.stock})</span>)}
          </aside>
        )}
        <div className="stats-row">
          <StatCard icon="📦" label="Total productos" value={products.length} color={COLORS.accent} delay={0} />
          <StatCard icon="⚠️" label="Stock bajo" value={lowStock.length} color={COLORS.warn} delay={80} />
          <StatCard icon="❌" label="Agotados" value={agotados} color={COLORS.danger} delay={160} />
          <StatCard icon="💲" label="Valor en stock" value={`$${totalVal.toLocaleString()}`} color={COLORS.green} delay={240} />
        </div>
        <div className="toolbar-row" style={{ flexWrap: "wrap" }}>
          <div className="search">
            <span className="search__icon">🔍</span>
            <input className="search__input" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {CATS_INV.map(c => (
            <button key={c} className={`chip${cat === c ? " chip--active" : ""}`} onClick={() => setCat(c)}>{c}</button>
          ))}
          <Btn variant="primary" onClick={() => setShowModal(true)}>+ Agregar</Btn>
        </div>
        <div className="data-card">
          <div className="inv-head">
            <span>Producto</span><span>Categoría</span><span>Precio</span><span>Stock</span><span>Estado</span><span>Acciones</span>
          </div>
          {filtered.map((p, i) => (
            <div key={p.id} className="inv-row animate" style={{ "--c": statusColor[p.status] || "var(--border)", "--d": `${i * 30}ms` }}>
              <div className="inv-row__prod">
                <ProductThumb p={p} size={36} />
                <span className="inv-row__prod-name">{p.name}</span>
              </div>
              <span><span className="cat-tag">{p.cat}</span></span>
              <span className="inv-row__price">${p.price}.00</span>
              <span className={p.stock !== null && p.stock <= 8 ? "inv-row__stock--low" : ""}>{p.stock !== null ? `↘ ${p.stock}` : "—"}</span>
              <StatusBadge status={p.status} />
              <div className="inv-row__actions">
                <button className="icon-btn">✏️</button>
                <button className="icon-btn" onClick={async () => {
                  try {
                    await ProductsAPI.delete(p.id);
                    setProducts(prev => prev.filter(x => x.id !== p.id));
                  } catch (err) {
                    console.error("Error al eliminar producto:", err);
                  }
                }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
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
      .then(data => setGastos(data.map(g => ({ ...g, color: CAT_COLORS_MAP[g.cat] || COLORS.muted }))))
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
    .map(([label, value]) => ({ label, value, color: CAT_COLORS_MAP[label] || COLORS.muted }))
    .sort((a, b) => b.value - a.value);
  const maxGasto = Math.max(...catDist.map(g => g.value), 1);
  const filtered = filter === "Todos" ? gastos : gastos.filter(g => (g.cat || "").toLowerCase().includes(filter.toLowerCase()));

  return (
    <section className="view">
      {showModal && <RegistrarGastoModal onClose={() => setShowModal(false)} onSave={async data => {
        try {
          const { expense } = await GastosAPI.create(data);
          setGastos(prev => [{ ...expense, color: CAT_COLORS_MAP[expense.cat] || COLORS.muted }, ...prev]);
        } catch (err) {
          console.error("Error al registrar gasto:", err);
        }
      }} />}
      <PageHeader title="Registro de Gastos" user={user} />
      <ScrollArea>
        <div className="stats-row">
          <StatCard icon="📉" label="Total gastos" value={`$${totalGastos.toLocaleString()}`} sub={`${gastos.length} registros`} color={COLORS.danger} delay={0} />
          <StatCard icon="📅" label="Este mes" value={`$${totalGastos.toLocaleString()}`} sub={`${gastos.length} gastos`} color={COLORS.orange} delay={80} />
          <StatCard icon="💲" label="Ingresos mes" value={`$${ingresosMes.toLocaleString()}`} sub="ventas del mes" color={COLORS.blue} delay={160} />
          <StatCard icon="📋" label="Ganancia neta" value={`$${gananciaNeta.toLocaleString()}`} sub="ingresos − gastos" color={COLORS.green} delay={240} />
        </div>
        {catDist.length > 0 && (
          <section className="card-pad">
            <h4 className="card-pad__title">Distribución por categoría</h4>
            {catDist.map((g, i) => <ProgressBar key={g.label} label={g.label} value={g.value} max={maxGasto} color={g.color} amount={`$${g.value.toLocaleString()}`} delay={i * 100} />)}
          </section>
        )}
        <div className="gasto-toolbar">
          <div className="gasto-toolbar__filters">
            {GASTO_CATS_FILTER.map(f => (
              <button key={f} className={`chip${filter === f ? " chip--active" : ""}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          <Btn variant="primary" onClick={() => setShowModal(true)}>+ Nuevo Gasto</Btn>
        </div>
        <div className="data-card">
          <div className="data-card__head">
            <span>{filtered.length} gastos</span>
            <span>Total: <strong>${filtered.reduce((s, g) => s + g.amount, 0).toLocaleString()}</strong></span>
          </div>
          {filtered.map((g, i) => (
            <article key={g.id} className="gasto-row animate" style={{ "--c": g.color, "--d": `${i * 70}ms` }}>
              <span className="gasto__icon">🏷️</span>
              <div className="gasto__info">
                <p className="gasto__desc">{g.desc}</p>
                <div className="gasto__meta">
                  <span className="gasto__cat">{g.cat}</span>
                  <span className="gasto__date">📅 {g.date}</span>
                  <span className="gasto__by"><Avatar initials={g.byInitials} size={18} color={COLORS.blue} /> {g.by}</span>
                </div>
              </div>
              <span className="gasto__amount">${g.amount.toLocaleString()}</span>
            </article>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEW: REPORTES
// ═══════════════════════════════════════════════════════════════
const PAY_METHOD_COLORS = { "Efectivo": COLORS.accent, "MP / QR": COLORS.green, "Tarjeta": COLORS.purple };

export function ReportesView({ user }) {
  const [period, setPeriod] = useState("Esta semana");
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
    { icon: "💲", label: "Ventas", value: `$${summary.kpis.ventas.toLocaleString()}`, sub: period.toLowerCase(), color: COLORS.green },
    { icon: "🎫", label: "Transacciones", value: `${summary.kpis.transacciones}`, sub: "ventas", color: COLORS.purple },
    { icon: "📉", label: "Gastos", value: `$${summary.kpis.gastos.toLocaleString()}`, sub: period.toLowerCase(), color: COLORS.danger },
    { icon: "📈", label: "Ganancia neta", value: `$${summary.kpis.gananciaNeta.toLocaleString()}`, sub: "ventas − gastos", color: COLORS.accent },
    { icon: "👥", label: "Deuda pendiente", value: `$${summary.kpis.deudaPendiente.toLocaleString()}`, sub: `${summary.kpis.deudoresCount} deudores`, color: COLORS.warn },
  ] : [];
  const donutSegments = summary
    ? summary.paymentMethods.map(m => ({ ...m, color: PAY_METHOD_COLORS[m.label] || COLORS.muted }))
    : [];
  const sc = { "Al Día": COLORS.accent, "En Seguimiento": COLORS.warn, "Atrasado": COLORS.orange, "Crítico": COLORS.danger };

  return (
    <section className="view">
      <PageHeader title="Reportes & Analytics" user={user} />
      <ScrollArea>
        <div className="periods">
          {["Hoy", "Esta semana", "Este mes"].map(p => (
            <button key={p} className={`period${period === p ? " period--active" : ""}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
        {loading ? (
          <div className="state-msg">
            <p className="state-msg__emoji">📊</p>
            <p>Cargando reportes…</p>
          </div>
        ) : !summary ? (
          <div className="state-msg">
            <p className="state-msg__emoji">⚠️</p>
            <p>No se pudieron cargar los reportes.</p>
          </div>
        ) : (
          <>
            <div className="kpis">
              {kpis.map((k, i) => (
                <article key={k.label} className="kpi" style={{ "--c": k.color, "--d": `${i * 70}ms` }}>
                  <p className="kpi__label">{k.icon} {k.label}</p>
                  <p className="kpi__value">{k.value}</p>
                  <p className="kpi__sub">{k.sub}</p>
                </article>
              ))}
            </div>
            <div className="report-grid">
              <section className="card-pad report-card">
                <h4 className="report-card__title">📊 Ventas — {period}</h4>
                <BarChart data={summary.weeklySales} height={220} />
              </section>
              <section className="card-pad report-card">
                <h4 className="report-card__title">💲 Métodos de pago</h4>
                {donutSegments.length > 0 ? (
                  <DonutChart segments={donutSegments} size={180} thickness={30} />
                ) : (
                  <p className="report-empty">Sin ventas en este periodo</p>
                )}
              </section>
            </div>
            <div className="data-card">
              <div className="data-card__title-row">
                <h4 className="data-card__title">👥 Reporte de Deudores</h4>
                <span className="data-card__date">📅 Al {new Date().toLocaleDateString("es-MX")}</span>
              </div>
              <div className="report-head">
                <span>Cliente</span><span>Total Deuda</span><span className="report-head__paid">Pagado</span><span className="report-head__pending">Pendiente</span><span>Estado</span>
              </div>
              {deudoresReport.length === 0 && (
                <p className="report-empty">Sin deudores registrados 🎉</p>
              )}
              {deudoresReport.map((d, i) => (
                <div key={i} className="report-row animate" style={{ "--d": `${i * 60}ms` }}>
                  <div className="report-row__client">
                    <Avatar initials={d.initials} size={30} color={sc[d.status] || COLORS.muted} />
                    <span className="report-row__client-name">{d.name}</span>
                  </div>
                  <span>${d.totalDebt.toLocaleString()}.00</span>
                  <span className="report-row__paid">${d.paid.toLocaleString()}.00</span>
                  <span className="report-row__pending">${d.pending.toLocaleString()}.00</span>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </ScrollArea>
    </section>
  );
}
