/**
 * lib/api.service.js
 * Capa de acceso a datos del frontend — habla directo con Supabase (sin backend propio).
 */
import { supabase } from "./supabaseClient";

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

export const ProductsAPI = {
  async list() {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(mapProductRow);
  },

  async create(data) {
    const idname = `${slugify(data.name)}-${randomSuffix()}`;
    const emoji = CATEGORY_EMOJI[data.cat] || "🏷️";
    const { data: row, error } = await supabase
      .from("products")
      .insert({
        idname,
        name: data.name,
        venta: data.price,
        stk: data.stock ?? null,
        cat: data.cat,
        emoji,
        img: data.imgSrc || null,
      })
      .select()
      .single();
    if (error) throw error;
    return { product: mapProductRow(row) };
  },

  async update(id, changes) {
    const patch = {};
    if (changes.name !== undefined) patch.name = changes.name;
    if (changes.price !== undefined) patch.venta = changes.price;
    if (changes.stock !== undefined) patch.stk = changes.stock;
    if (changes.cat !== undefined) patch.cat = changes.cat;
    if (changes.imgSrc !== undefined) patch.img = changes.imgSrc;
    const { data: row, error } = await supabase.from("products").update(patch).eq("idname", id).select().single();
    if (error) throw error;
    return { product: mapProductRow(row) };
  },

  async delete(id) {
    const { error } = await supabase.from("products").delete().eq("idname", id);
    if (error) throw error;
    return { success: true };
  },

  async adjustStock(id, delta) {
    const { data: current, error: e1 } = await supabase.from("products").select("stk").eq("idname", id).single();
    if (e1) throw e1;
    const newStock = Math.max(0, (current.stk ?? 0) + delta);
    const { data: row, error } = await supabase.from("products").update({ stk: newStock }).eq("idname", id).select().single();
    if (error) throw error;
    return { product: mapProductRow(row) };
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

export const SalesAPI = {
  async create(sale) {
    const total = sale.items.reduce((s, i) => s + i.price * i.qty, 0);
    const { data, error } = await supabase
      .from("sales")
      .insert({ productos: sale.items, vendedor: sale.operatorId, metodo_pago: sale.method, total })
      .select()
      .single();
    if (error) throw error;
    return { sale: mapSaleRow(data) };
  },

  async list(page = 1, limit = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error } = await supabase
      .from("sales").select("*").order("fecha", { ascending: false }).range(from, to);
    if (error) throw error;
    return (data || []).map(mapSaleRow);
  },
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

export const TicketsAPI = {
  async list() {
    const { data, error } = await supabase.from("tickets").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTicketRow);
  },
  async save(ticketData) {
    const { data, error } = await supabase.from("tickets").insert({
      items: ticketData.items,
      client: ticketData.client || null,
      mesa: ticketData.mesa || null,
      note: ticketData.note || null,
      saved_by: ticketData.savedBy,
      total: ticketData.total,
    }).select().single();
    if (error) throw error;
    return { ticket: mapTicketRow(data) };
  },
  // Mismo comportamiento original: cobrar solo elimina el ticket, no crea una venta.
  async charge(id, _payment) {
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  },
  async delete(id) {
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  },
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

export const DeudoresAPI = {
  async list() {
    const { data, error } = await supabase.from("deudores").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapDeudorRow);
  },
  async create(data) {
    const { data: row, error } = await supabase.from("deudores").insert({
      name: data.name, phone: data.phone || null, concept: data.concept || null, amount: data.amount,
    }).select().single();
    if (error) throw error;
    return { debtor: mapDeudorRow(row) };
  },
  async pay(id, amount) {
    const { data: current, error: e1 } = await supabase.from("deudores").select("amount").eq("id", id).single();
    if (e1) throw e1;
    const newAmount = Math.max(0, Number(current.amount) - amount);
    const { data: row, error } = await supabase.from("deudores").update({ amount: newAmount }).eq("id", id).select().single();
    if (error) throw error;
    return { debtor: mapDeudorRow(row) };
  },
  async delete(id) {
    const { error } = await supabase.from("deudores").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  },
};

// ─── Gastos ───────────────────────────────────────────────────────────────────

const OPERATOR_NAMES = { AD: "Admin", ML: "María", JR: "José" };

function formatDateEs(dateStr) {
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}
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

export const GastosAPI = {
  async list() {
    const { data, error } = await supabase.from("gastos").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapGastoRow);
  },
  async create(data) {
    const { data: row, error } = await supabase.from("gastos").insert({
      producto: data.desc,
      precio: data.amount,
      cat: data.cat,
      nota: data.note || null,
      registrado_por: data.operator,
      fecha: formatDateEs(new Date().toISOString()),
    }).select().single();
    if (error) throw error;
    return { expense: mapGastoRow(row) };
  },
  async delete(id) {
    const { error } = await supabase.from("gastos").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  },
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
    const [salesRes, gastosRes, deudoresRes] = await Promise.all([
      supabase.from("sales").select("*").gte("fecha", start.toISOString()).lte("fecha", end.toISOString()),
      supabase.from("gastos").select("*").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
      supabase.from("deudores").select("*"),
    ]);
    if (salesRes.error) throw salesRes.error;
    if (gastosRes.error) throw gastosRes.error;
    if (deudoresRes.error) throw deudoresRes.error;

    const sales = salesRes.data || [], gastos = gastosRes.data || [], deudores = deudoresRes.data || [];
    const ventasTotal = sales.reduce((s, r) => s + Number(r.total), 0);
    const gastosTotal = gastos.reduce((s, r) => s + Number(r.precio), 0);
    const deudaTotal = deudores.reduce((s, r) => s + Number(r.amount), 0);

    return {
      kpis: {
        ventas: ventasTotal,
        transacciones: sales.length,
        gastos: gastosTotal,
        gananciaNeta: ventasTotal - gastosTotal,
        deudaPendiente: deudaTotal,
        deudoresCount: deudores.length,
      },
      weeklySales: buildWeeklySeries(sales, start, end),
      paymentMethods: buildPaymentDistribution(sales),
    };
  },

  async deudores() {
    const { data, error } = await supabase.from("deudores").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => {
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
