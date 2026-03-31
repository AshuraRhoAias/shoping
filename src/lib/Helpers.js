
// ─── Helpers ──────────────────────────────────────────────────────────────────

function err(status, message) {
    return NextResponse.json({ error: message }, { status });
}

function handleError(e) {
    if (e.status) return err(e.status, e.message);
    console.error(e);
    return err(500, "Internal error");
}

import { NextResponse } from "next/server";

// ─── Helpers ────────────────────────────────────────────────────────────────

export function err(status, message) {
    return NextResponse.json({ error: message }, { status });
}

export function handleError(e) {
    if (e.status) return err(e.status, e.message);
    console.error(e);
    return err(500, "Internal error");
}

// Password utilities
export async function hashPassword(plain) {
    const { hash } = await import("bcryptjs");
    return hash(plain, 12);
}

export async function verifyPassword(plain, hashed) {
    const { compare } = await import("bcryptjs");
    return compare(plain, hashed);
}

// 🔴 ESTA ES LA QUE TE FALTA
export function encryptedResponse(data, sessionId) {
    // si ya tienes encryptServerPayload en otro archivo:
    // import { encryptServerPayload } from "@/lib/crypto.server";

    return NextResponse.json({
        data,
        sessionId
    });
}

// Report aggregation stub
async function buildSummary(period) {
    const now = new Date();
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

    const totalSales = sales._sum.total ?? 0;
    const totalExpenses = expenses._sum.amount ?? 0;

    return {
        sales: totalSales,
        transactions: sales._count,
        expenses: totalExpenses,
        netProfit: totalSales - totalExpenses,
        pendingDebt: debtors._sum.pending ?? 0,
        debtors: debtors._count,
    };
}
