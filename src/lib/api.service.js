/**
 * lib/api.service.js
 * Capa de acceso a datos del frontend — habla directo con Supabase (sin backend propio).
 *
 * Cada entidad se arma sobre `createResource()` (ver ./supabaseResource), que
 * aporta el CRUD genérico. Aquí solo viven los mappers y helpers de dominio y
 * los pocos métodos a la medida (ventas, reportes, cobros).
 */
import { supabase } from "./supabaseClient";
import { createResource, run } from "./supabaseResource";

// ─── helpers compartidos ──────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toString()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function randomSuffix(len = 5) {
  return Math.random().toString(36).slice(2, 2 + len);
}
function daysSince(dateStr) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}
function initialsFromName(name) {
  return (name || "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function formatDateEs(dateStr) {
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Products ─────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI = {
  Bebidas: "🥤", Snacks: "🍿", Suplementos: "💊",
  Servicios: "🏋️", Ropa: "👕", Accesorios: "📦",
};

function computeProductStatus(stock) {
  if (stock === null || stock === undefined) return "OK";
  if (stock === 0) return "Agotado";
  if (stock <= 8) return "Bajo";
  return "OK";
}
function mapProductRow(row) {
  return {
    id: row.idname,
    name: row.name,
    price: Number(row.venta),
    stock: row.stk ?? null,
    cat: row.cat,
    emoji: row.emoji,
    imgSrc: row.img || null,
    status: computeProductStatus(row.stk ?? null),
  };
}

const products = createResource({
  table: "products",
  pk: "idname",
  order: { column: "created_at", ascending: true },
  toRow: mapProductRow,
  toInsert: (d) => ({
    idname: `${slugify(d.name)}-${randomSuffix()}`,
    name: d.name,
    venta: d.price,
    stk: d.stock ?? null,
    cat: d.cat,
    emoji: CATEGORY_EMOJI[d.cat] || "🏷️",
    img: d.imgSrc || null,
  }),
  toUpdate: (c) => {
    const patch = {};
    if (c.name !== undefined) patch.name = c.name;
    if (c.price !== undefined) patch.venta = c.price;
    if (c.stock !== undefined) patch.stk = c.stock;
    if (c.cat !== undefined) patch.cat = c.cat;
    if (c.imgSrc !== undefined) patch.img = c.imgSrc;
    return patch;
  },
});

export const ProductsAPI = {
  list: () => products.list(),
  create: async (data) => ({ product: await products.create(data) }),
  update: async (id, changes) => ({ product: await products.update(id, changes) }),
  delete: (id) => products.remove(id),
  adjustStock: async (id, delta) => {
    const current = await run(supabase.from("products").select("stk").eq("idname", id).single());
    const stock = Math.max(0, (current.stk ?? 0) + delta);
    return { product: await products.update(id, { stock }) };
  },
};

// ─── Sales / POS ──────────────────────────────────────────────────────────────

function mapSaleRow(row) {
  return {
    id: row.id,
    items: row.productos || [],
    vendedor: row.vendedor,
    metodoPago: row.metodo_pago,
    notas: row.notas,
    total: Number(row.total),
    fecha: row.fecha,
  };
}

const sales = createResource({
  table: "sales",
  order: { column: "fecha", ascending: false },
  toRow: mapSaleRow,
  toInsert: (sale) => ({
    productos: sale.items,
    vendedor: sale.operatorId,
    metodo_pago: sale.method,
    total: sale.items.reduce((s, i) => s + i.price * i.qty, 0),
  }),
});

export const SalesAPI = {
  create: async (sale) => ({ sale: await sales.create(sale) }),
  list: (page = 1, limit = 50) => sales.list({ page, limit }),
};

// ─── Tickets ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr) {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 60000));
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const h = Math.floor(diffMin / 60), m = diffMin % 60;
  return `Hace ${h}h ${m}min`;
}
function mapTicketRow(row) {
  const diffMin = (Date.now() - new Date(row.created_at).getTime()) / 60000;
  return {
    id: row.id,
    location: row.mesa || "Mostrador",
    time: formatRelativeTime(row.created_at),
    urgent: diffMin > 45,
    total: Number(row.total),
    items: (row.items || []).map((i) => ({ name: i.name, price: i.price * i.qty })),
    note: row.note,
    savedBy: row.saved_by,
    client: row.client,
    cart: row.items || [],
  };
}

const tickets = createResource({
  table: "tickets",
  order: { column: "created_at", ascending: false },
  toRow: mapTicketRow,
  toInsert: (t) => ({
    items: t.items,
    client: t.client || null,
    mesa: t.mesa || null,
    note: t.note || null,
    saved_by: t.savedBy,
    total: t.total,
  }),
});

export const TicketsAPI = {
  list: () => tickets.list(),
  save: async (ticketData) => ({ ticket: await tickets.create(ticketData) }),
  // Mismo comportamiento original: cobrar solo elimina el ticket, no crea una venta.
  charge: (id, _payment) => tickets.remove(id),
  delete: (id) => tickets.remove(id),
};

// ─── Deudores ─────────────────────────────────────────────────────────────────

function computeDebtorStatus(days) {
  if (days <= 7) return "Al Día";
  if (days <= 30) return "En Seguimiento";
  if (days <= 60) return "Atrasado";
  return "Crítico";
}
function mapDeudorRow(row) {
  const days = daysSince(row.created_at);
  return {
    id: row.id,
    name: row.name,
    initials: initialsFromName(row.name),
    phone: row.phone || "",
    amount: Number(row.amount),
    days,
    status: computeDebtorStatus(days),
  };
}

const deudores = createResource({
  table: "deudores",
  order: { column: "created_at", ascending: false },
  toRow: mapDeudorRow,
  toInsert: (d) => ({
    name: d.name,
    phone: d.phone || null,
    concept: d.concept || null,
    amount: d.amount,
  }),
  toUpdate: (c) => {
    const patch = {};
    if (c.amount !== undefined) patch.amount = c.amount;
    return patch;
  },
});

export const DeudoresAPI = {
  list: () => deudores.list(),
  create: async (data) => ({ debtor: await deudores.create(data) }),
  pay: async (id, amount) => {
    const current = await run(supabase.from("deudores").select("amount").eq("id", id).single());
    const newAmount = Math.max(0, Number(current.amount) - amount);
    return { debtor: await deudores.update(id, { amount: newAmount }) };
  },
  delete: (id) => deudores.remove(id),
};

// ─── Gastos ───────────────────────────────────────────────────────────────────

const OPERATOR_NAMES = { AD: "Admin", ML: "María", JR: "José" };

function mapGastoRow(row) {
  const initials = row.registrado_por || "AD";
  return {
    id: row.id,
    desc: row.producto,
    cat: row.cat,
    date: formatDateEs(row.created_at),
    by: OPERATOR_NAMES[initials] || initials,
    byInitials: initials,
    amount: Number(row.precio),
  };
}

const gastos = createResource({
  table: "gastos",
  order: { column: "created_at", ascending: false },
  toRow: mapGastoRow,
  toInsert: (d) => ({
    producto: d.desc,
    precio: d.amount,
    cat: d.cat,
    nota: d.note || null,
    registrado_por: d.operator,
    fecha: formatDateEs(new Date().toISOString()),
  }),
});

export const GastosAPI = {
  list: () => gastos.list(),
  create: async (data) => ({ expense: await gastos.create(data) }),
  delete: (id) => gastos.remove(id),
};

// ─── Reports ──────────────────────────────────────────────────────────────────

function getDateRange(period) {
  const now = new Date();
  let start;
  if (period === "Hoy") start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (period === "Este mes") { start = new Date(now); start.setDate(start.getDate() - 29); }
  else { start = new Date(now); start.setDate(start.getDate() - 6); } // "Esta semana"
  return { start, end: now };
}

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]; // JS getDay(): 0=Dom
function buildWeeklySeries(sales, start, end) {
  const order = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const totals = Object.fromEntries(order.map((l) => [l, 0]));
  for (const s of sales) {
    const d = new Date(s.fecha);
    if (d < start || d > end) continue;
    totals[WEEKDAY_LABELS[d.getDay()]] += Number(s.total);
  }
  return order.map((label) => ({ label, value: Math.round(totals[label]) }));
}
function buildPaymentDistribution(sales) {
  const totals = {};
  let grand = 0;
  for (const s of sales) {
    const method = s.metodo_pago || "Otro";
    totals[method] = (totals[method] || 0) + Number(s.total);
    grand += Number(s.total);
  }
  if (grand === 0) return [];
  return Object.entries(totals).map(([label, value]) => ({ label, value: Math.round((value / grand) * 100) }));
}

export const ReportsAPI = {
  async summary(period = "Esta semana") {
    const { start, end } = getDateRange(period);
    const [salesData, gastosData, deudoresData] = await Promise.all([
      run(supabase.from("sales").select("*").gte("fecha", start.toISOString()).lte("fecha", end.toISOString())),
      run(supabase.from("gastos").select("*").gte("created_at", start.toISOString()).lte("created_at", end.toISOString())),
      run(supabase.from("deudores").select("*")),
    ]);

    const salesRows = salesData || [], gastosRows = gastosData || [], deudoresRows = deudoresData || [];
    const ventasTotal = salesRows.reduce((s, r) => s + Number(r.total), 0);
    const gastosTotal = gastosRows.reduce((s, r) => s + Number(r.precio), 0);
    const deudaTotal = deudoresRows.reduce((s, r) => s + Number(r.amount), 0);

    return {
      kpis: {
        ventas: ventasTotal,
        transacciones: salesRows.length,
        gastos: gastosTotal,
        gananciaNeta: ventasTotal - gastosTotal,
        deudaPendiente: deudaTotal,
        deudoresCount: deudoresRows.length,
      },
      weeklySales: buildWeeklySeries(salesRows, start, end),
      paymentMethods: buildPaymentDistribution(salesRows),
    };
  },

  async deudores() {
    const rows = await run(supabase.from("deudores").select("*").order("created_at", { ascending: false }));
    return (rows || []).map((row) => {
      const days = daysSince(row.created_at);
      return {
        initials: initialsFromName(row.name),
        name: row.name,
        totalDebt: Number(row.amount),
        paid: 0,
        pending: Number(row.amount),
        status: computeDebtorStatus(days),
      };
    });
  },
};
