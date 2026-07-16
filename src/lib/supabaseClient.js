"use client";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
