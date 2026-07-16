"use client";
import { createClient } from "@supabase/supabase-js";

// Cae a valores de relleno si faltan las env vars así el build/prerender no
// truena (createClient lanza de forma síncrona con una URL vacía) — solo
// falla en tiempo de ejecución si de verdad se usa sin configurar.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Los datos de sesión (nombre, rol) viven en user_metadata + la tabla
// profiles; el resto de la app solo conoce esta forma de "user".
export async function fetchAppUser(session) {
  if (!session?.user) return null;
  const { user } = session;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || profile?.username || user.email,
    phone: user.user_metadata?.phone || profile?.phone || "",
    role: profile?.role || "cliente",
  };
}
