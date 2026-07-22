"use client";
import { createClient } from "@supabase/supabase-js";

// Cae a valores de relleno si faltan las env vars, o si llegan mal
// formadas (p.ej. la cadena literal "undefined", que puede colarse desde
// integraciones de CI/CD que no resuelven la variable), así el
// build/prerender no truena (createClient valida la URL de forma
// síncrona) — solo falla en tiempo de ejecución si de verdad se usa sin
// configurar.
function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const url = isValidHttpUrl(rawUrl) ? rawUrl : "https://placeholder.supabase.co";

const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const anonKey = rawAnonKey && rawAnonKey !== "undefined" ? rawAnonKey : "placeholder-anon-key";

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
