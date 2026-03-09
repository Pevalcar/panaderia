import { createClient } from "@supabase/supabase-js";
import {
  PUBLIC_SUPABASE_ANON_KEY,
  PUBLIC_SUPABASE_URL,
} from "astro:env/client";

const supabaseUrl =
  PUBLIC_SUPABASE_URL || import.meta.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  PUBLIC_SUPABASE_ANON_KEY || import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Faltan variables de Supabase. Usa PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY (o EXPO_PUBLIC_* por compatibilidad).",
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: false,
  },
});

export const getCurrentUsername = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("panaderia_username");
};
