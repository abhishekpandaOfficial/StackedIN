import { supabase } from "./supabase.js";

export async function loadTenantContext(userId) {
  if (!userId) return null;

  const [profileResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url, bio").eq("id", userId).maybeSingle(),
    supabase
      .from("tenant_memberships")
      .select("role, tenant:tenants(id, name, slug, owner_id)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  // The public feed remains usable while an owner is still applying the SQL migration.
  if (profileResult.error || membershipResult.error) return null;

  return {
    profile: profileResult.data,
    role: membershipResult.data?.role || null,
    tenant: membershipResult.data?.tenant || null,
  };
}
