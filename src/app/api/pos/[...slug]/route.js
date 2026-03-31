/**
 * app/api/pos/[...slug]/route.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Catch-all Next.js API route for all POS operations.
 *
 * Routes handled:
 *   POST   /api/pos/auth/login
 *   POST   /api/pos/auth/register
 *   POST   /api/pos/auth/verify
 *   POST   /api/pos/auth/logout
 *
 *   GET    /api/pos/products
 *   POST   /api/pos/products
 *   PUT    /api/pos/products/:id
 *   DELETE /api/pos/products/:id
 *   POST   /api/pos/products/:id/stock
 *
 *   GET    /api/pos/sales
 *   POST   /api/pos/sales
 *
 *   GET    /api/pos/tickets
 *   POST   /api/pos/tickets
 *   POST   /api/pos/tickets/:id/charge
 *   DELETE /api/pos/tickets/:id
 *
 *   GET    /api/pos/deudores
 *   POST   /api/pos/deudores
 *   POST   /api/pos/deudores/:id/pay
 *   DELETE /api/pos/deudores/:id
 *
 *   GET    /api/pos/gastos
 *   POST   /api/pos/gastos
 *   DELETE /api/pos/gastos/:id
 *
 *   GET    /api/pos/reports/summary
 *   GET    /api/pos/reports/deudores
 *
 * ALL responses are AES-256-GCM encrypted (via secureRoute wrapper).
 * ─────────────────────────────────────────────────────────────────────────────
 */


import { NextResponse } from "next/server";
import { secureRoute } from "@/lib/secureRoute";
import { destroySession } from "@/lib/crypto.server";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { encryptedResponse } from "@/lib/Helpers";

export const runtime = "nodejs";

// ─── Helper: parse slug ───────────────────────────────────────────────────────
function parsePath(params) {
  // params.slug is string[] from the catch-all: e.g. ["auth","login"]
  return params.slug ?? [];
}

// ─── Shared rate-limit check ──────────────────────────────────────────────────
async function checkRate(request, max = 60, windowMs = 60_000) {
  const r = await rateLimit(request, { max, windowMs });
  if (!r.ok) throw Object.assign(new Error("Rate limit exceeded"), { status: 429 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET handler
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET(request, { params }) {
  await checkRate(request);

  const slug      = parsePath(params);
  const sessionId = request.headers.get("X-Session-Id");
  if (!sessionId) return err(401, "Missing session");

  const { searchParams } = new URL(request.url);

  try {
    // ── /products ───────────────────────────────────────────────────────────
    if (slug[0] === "products" && slug.length === 1) {
      const products = await db.product.findMany({ orderBy: { name: "asc" } });
      return encryptedResponse(products, sessionId);
    }

    // ── /sales ──────────────────────────────────────────────────────────────
    if (slug[0] === "sales" && slug.length === 1) {
      const page  = parseInt(searchParams.get("page")  ?? "1");
      const limit = parseInt(searchParams.get("limit") ?? "50");
      const sales = await db.sale.findMany({
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: "desc" },
        include: { items: true },
      });
      return encryptedResponse(sales, sessionId);
    }

    // ── /tickets ────────────────────────────────────────────────────────────
    if (slug[0] === "tickets" && slug.length === 1) {
      const tickets = await db.ticket.findMany({
        where:   { paid: false },
        orderBy: { createdAt: "asc" },
        include: { items: true },
      });
      return encryptedResponse(tickets, sessionId);
    }

    // ── /deudores ───────────────────────────────────────────────────────────
    if (slug[0] === "deudores" && slug.length === 1) {
      const deudores = await db.debtor.findMany({ orderBy: { createdAt: "desc" } });
      return encryptedResponse(deudores, sessionId);
    }

    // ── /gastos ─────────────────────────────────────────────────────────────
    if (slug[0] === "gastos" && slug.length === 1) {
      const gastos = await db.expense.findMany({ orderBy: { createdAt: "desc" } });
      return encryptedResponse(gastos, sessionId);
    }

    // ── /reports/summary ────────────────────────────────────────────────────
    if (slug[0] === "reports" && slug[1] === "summary") {
      const period  = searchParams.get("period") ?? "week";
      const summary = await buildSummary(period);
      return encryptedResponse(summary, sessionId);
    }

    // ── /reports/deudores ───────────────────────────────────────────────────
    if (slug[0] === "reports" && slug[1] === "deudores") {
      const report = await db.debtor.findMany({
        select: { name: true, totalDebt: true, paid: true, pending: true, status: true },
      });
      return encryptedResponse(report, sessionId);
    }

    return err(404, "Not found");
  } catch (e) {
    return handleError(e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST handler
// ═══════════════════════════════════════════════════════════════════════════════
export const POST = secureRoute(async (body, sessionId, request) => {
  await checkRate(request, 120);

  const urlParts = new URL(request.url).pathname
    .replace(/^\/api\/pos\//, "")
    .split("/")
    .filter(Boolean);

  // ── auth/login ─────────────────────────────────────────────────────────────
  if (urlParts[0]==="auth" && urlParts[1]==="login") {
    const { email, password } = body;
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }
    return {
      user: { id: user.id, name: user.name, role: user.role, email: user.email },
    };
  }

  // ── auth/register ──────────────────────────────────────────────────────────
  if (urlParts[0]==="auth" && urlParts[1]==="register") {
    const { name, email, phone, password } = body;
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw Object.assign(new Error("Email already in use"), { status: 409 });
    const hash = await hashPassword(password);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const user = await db.user.create({
      data: { name, email, phone, passwordHash: hash, role: "cliente", verifyCode: code, verified: false },
    });
    // In production: send `code` via email/SMS here
    return { ok: true, email }; // code returned only in dev for demo
  }

  // ── auth/verify ────────────────────────────────────────────────────────────
  if (urlParts[0]==="auth" && urlParts[1]==="verify") {
    const { email, code } = body;
    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.verifyCode !== code) throw Object.assign(new Error("Invalid code"), { status: 400 });
    await db.user.update({ where: { email }, data: { verified: true, verifyCode: null } });
    return { ok: true, name: user.name };
  }

  // ── auth/logout ────────────────────────────────────────────────────────────
  if (urlParts[0]==="auth" && urlParts[1]==="logout") {
    destroySession(sessionId);
    return { ok: true };
  }

  // ── products (create) ──────────────────────────────────────────────────────
  if (urlParts[0]==="products" && urlParts.length===1) {
    const { name, price, cat, stock, emoji, imgBase64 } = body;
    const product = await db.product.create({
      data: { name, price, category: cat, stock: stock ?? null, emoji, imageBase64: imgBase64 ?? null },
    });
    return { product };
  }

  // ── products/:id/stock ─────────────────────────────────────────────────────
  if (urlParts[0]==="products" && urlParts[2]==="stock") {
    const id    = urlParts[1];
    const delta = parseInt(body.delta ?? 0);
    const product = await db.product.update({
      where: { id },
      data:  { stock: { increment: delta } },
    });
    return { product };
  }

  // ── sales ──────────────────────────────────────────────────────────────────
  if (urlParts[0]==="sales" && urlParts.length===1) {
    const { items, method, operatorId } = body;
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const sale  = await db.sale.create({
      data: {
        total, paymentMethod: method, operatorId,
        items: { create: items.map(i => ({ productId: i.id, qty: i.qty, price: i.price })) },
      },
    });
    // Decrement stock for each item
    for (const item of items) {
      await db.product.updateMany({
        where: { id: item.id, stock: { not: null } },
        data:  { stock: { decrement: item.qty } },
      });
    }
    return { sale: { id: sale.id, total: sale.total } };
  }

  // ── tickets ────────────────────────────────────────────────────────────────
  if (urlParts[0]==="tickets" && urlParts.length===1) {
    const { items, client, mesa, note, savedBy } = body;
    const total  = items.reduce((s, i) => s + i.price * i.qty, 0);
    const ticket = await db.ticket.create({
      data: {
        total, client, location: mesa, note, savedBy, paid: false,
        items: { create: items.map(i => ({ productId: i.id, qty: i.qty, price: i.price })) },
      },
    });
    return { ticket: { id: ticket.id } };
  }

  // ── tickets/:id/charge ─────────────────────────────────────────────────────
  if (urlParts[0]==="tickets" && urlParts[2]==="charge") {
    const id = urlParts[1];
    const { method, operator } = body;
    const ticket = await db.ticket.update({
      where: { id },
      data:  { paid: true, paymentMethod: method, chargedBy: operator, chargedAt: new Date() },
    });
    return { ok: true, ticket: { id: ticket.id } };
  }

  // ── deudores ───────────────────────────────────────────────────────────────
  if (urlParts[0]==="deudores" && urlParts.length===1) {
    const { name, phone, concept, amount } = body;
    const debtor = await db.debtor.create({
      data: { name, phone, concept, totalDebt: amount, paid: 0, pending: amount, status: "Al Día" },
    });
    return { debtor };
  }

  // ── deudores/:id/pay ───────────────────────────────────────────────────────
  if (urlParts[0]==="deudores" && urlParts[2]==="pay") {
    const id     = urlParts[1];
    const amount = parseFloat(body.amount ?? 0);
    const debtor = await db.debtor.findUnique({ where: { id } });
    const newPaid    = debtor.paid + amount;
    const newPending = debtor.totalDebt - newPaid;
    const status     = newPending <= 0 ? "Al Día" : debtor.daysOverdue > 60 ? "Crítico" : debtor.daysOverdue > 30 ? "Atrasado" : "En Seguimiento";
    const updated    = await db.debtor.update({
      where: { id },
      data:  { paid: newPaid, pending: Math.max(0, newPending), status },
    });
    return { debtor: updated };
  }

  // ── gastos ─────────────────────────────────────────────────────────────────
  if (urlParts[0]==="gastos" && urlParts.length===1) {
    const { desc, amount, cat, note, operator } = body;
    const expense = await db.expense.create({
      data: { description: desc, amount, category: cat, note, operatorId: operator },
    });
    return { expense };
  }

  throw Object.assign(new Error("Route not found"), { status: 404 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT / DELETE handlers
// ═══════════════════════════════════════════════════════════════════════════════
export const PUT = secureRoute(async (body, sessionId, request) => {
  const urlParts = new URL(request.url).pathname.replace(/^\/api\/pos\//, "").split("/").filter(Boolean);

  if (urlParts[0]==="products" && urlParts.length===2) {
    const id      = urlParts[1];
    const product = await db.product.update({ where: { id }, data: body });
    return { product };
  }
  throw Object.assign(new Error("Not found"), { status: 404 });
});

export const DELETE = secureRoute(async (body, sessionId, request) => {
  const urlParts = new URL(request.url).pathname.replace(/^\/api\/pos\//, "").split("/").filter(Boolean);

  if (urlParts[0]==="products") {
    await db.product.delete({ where: { id: urlParts[1] } });
    return { ok: true };
  }
  if (urlParts[0]==="tickets") {
    await db.ticket.delete({ where: { id: urlParts[1] } });
    return { ok: true };
  }
  if (urlParts[0]==="deudores") {
    await db.debtor.delete({ where: { id: urlParts[1] } });
    return { ok: true };
  }
  if (urlParts[0]==="gastos") {
    await db.expense.delete({ where: { id: urlParts[1] } });
    return { ok: true };
  }
  throw Object.assign(new Error("Not found"), { status: 404 });
});
<<<<<<< HEAD

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encryptedResponse(data, sessionId) {
  const envelope = encryptServerPayload(data, sessionId);
  return NextResponse.json(envelope, { status: 200, headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  }});
}

function err(status, message) {
  return NextResponse.json({ error: message }, { status });
}

function handleError(e) {
  if (e.status) return err(e.status, e.message);
  console.error(e);
  return err(500, "Internal error");
}

// Password utilities (use bcrypt or argon2 in production)
async function hashPassword(plain) {
  const { hash } = await import("bcryptjs");
  return hash(plain, 12);
}
async function verifyPassword(plain, hashed) {
  const { compare } = await import("bcryptjs");
  return compare(plain, hashed);
}

// Report aggregation stub
async function buildSummary(period) {
  const now   = new Date();
  const start = period === "today"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : period === "week"
    ? new Date(now.getTime() - 7 * 86400000)
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const [sales, expenses, debtors] = await Promise.all([
    db.sale.aggregate({ where: { createdAt: { gte: start } }, _sum: { total: true }, _count: true }),
    db.expense.aggregate({ where: { createdAt: { gte: start } }, _sum: { amount: true } }),
    db.debtor.aggregate({ _sum: { pending: true }, _count: true }),
  ]);

  const totalSales    = sales._sum.total    ?? 0;
  const totalExpenses = expenses._sum.amount ?? 0;

  return {
    sales:        totalSales,
    transactions: sales._count,
    expenses:     totalExpenses,
    netProfit:    totalSales - totalExpenses,
    pendingDebt:  debtors._sum.pending ?? 0,
    debtors:      debtors._count,
  };
}
=======
>>>>>>> e651d92 (help)
