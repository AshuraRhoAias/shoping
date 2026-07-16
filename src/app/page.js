"use client";
import { useEffect, useState } from "react";
import { supabase, fetchAppUser } from "@/lib/supabaseClient";
import LoginPage from "./Page/Login/LoginPage";
import DashboardPage from "./Page/Dashboard/DashboardPage";

const C = { bg: "#0b0f14", accent: "#00d4aa", muted: "#8b949e" };

function SplashScreen() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: C.muted, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${C.accent}33`, borderTopColor: C.accent, animation: "app-splash-spin .8s linear infinite" }} />
      <style>{"@keyframes app-splash-spin{to{transform:rotate(360deg)}}"}</style>
      <span style={{ fontSize: 13 }}>Cargando sesión…</span>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const appUser = await fetchAppUser(session);
      if (active) {
        setUser(appUser);
        setChecking(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const appUser = await fetchAppUser(session);
      if (active) setUser(appUser);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (checking) return <SplashScreen />;

  if (!user) {
    return <LoginPage onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <DashboardPage
      user={user}
      onLogout={async () => {
        await supabase.auth.signOut();
        setUser(null);
      }}
    />
  );
}
