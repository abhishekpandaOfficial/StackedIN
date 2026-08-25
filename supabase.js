import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://salivpvqzbzuzbxzploo.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbGl2cHZxemJ6dXpieHpwbG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2Njc3MDYsImV4cCI6MjEwMzI0MzcwNn0.NXeYpPnYUQ0TbpkoqDc2LUIGZPPd1hEh0xY5k5WoCek";
export const supabasePublicConfig = { url: supabaseUrl, anonKey: supabaseAnonKey };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

export function getAppRedirectUrl() {
  const base = import.meta.env.BASE_URL || "/";
  return new URL(base, window.location.origin).toString();
}
