/**
 * INTEGRATION GUIDE — How to wire the encrypted API into the React components
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Replace any direct state operations in DashboardPage.jsx / DashboardViews.jsx
 * with calls to api.service.js.  All traffic is AES-256-GCM encrypted.
 *
 * Example patterns below.
 */

// ─── 1. Login ─────────────────────────────────────────────────────────────────
import { AuthAPI } from "@/lib/api.service";

// Inside LoginPage.jsx — handleLogin():
async function handleLogin(email, password) {
  try {
    const { user } = await AuthAPI.login(email, password);
    // user = { id, name, role, email }
    onLoginSuccess(user);
  } catch (err) {
    setError("Credenciales incorrectas");
  }
}

// ─── 2. Load products on mount ────────────────────────────────────────────────
import { ProductsAPI } from "@/lib/api.service";
import { useEffect, useState } from "react";

function VentasView({ user, cart, setCart }) {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    ProductsAPI.list()
      .then(data => setProducts(data))
      .catch(console.error);
  }, []);

  // ... rest of component unchanged
}

// ─── 3. Process a sale ───────────────────────────────────────────────────────
import { SalesAPI } from "@/lib/api.service";

async function handleConfirmPago(method) {
  const items = cart.map(i => ({ id: i.id, qty: i.qty, price: i.price }));
  await SalesAPI.create({ items, method, operatorId: user.id });
  setCart([]);
}

// ─── 4. Add a product from Inventario ────────────────────────────────────────
import { ProductsAPI } from "@/lib/api.service";

async function handleSaveProduct(data) {
  const { product } = await ProductsAPI.create(data);
  setProducts(prev => [...prev, product]);
}

// ─── 5. Register a debtor ────────────────────────────────────────────────────
import { DeudoresAPI } from "@/lib/api.service";

async function handleSaveDeudor(data) {
  const { debtor } = await DeudoresAPI.create(data);
  setDeudores(prev => [...prev, debtor]);
}

// ─── 6. Register an expense ───────────────────────────────────────────────────
import { GastosAPI } from "@/lib/api.service";

async function handleSaveGasto(data) {
  const { expense } = await GastosAPI.create(data);
  setGastos(prev => [expense, ...prev]);
}

// ─── 7. Logout ────────────────────────────────────────────────────────────────
import { AuthAPI } from "@/lib/api.service";

async function handleLogout() {
  await AuthAPI.logout(); // destroys server session + clears browser keys
  setUser(null);
}

// ─── 8. Load reports ─────────────────────────────────────────────────────────
import { ReportsAPI } from "@/lib/api.service";

async function loadSummary(period) {
  const summary = await ReportsAPI.summary(period);
  // summary = { sales, transactions, expenses, netProfit, pendingDebt, debtors }
  setSummaryData(summary);
}
