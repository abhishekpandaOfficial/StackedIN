import type { SupabaseClient } from "@supabase/supabase-js";

export type CareerAgentMode = "MANUAL" | "HITL" | "AUTONOMOUS";

export interface CareerProfileInput {
  current_title?: string | null;
  current_company?: string | null;
  current_country_code?: string | null;
  current_salary?: number | null;
  current_currency?: string | null;
  years_experience?: number | null;
  notice_period_days?: number | null;
  relocation_open?: boolean;
  sponsorship_required?: boolean;
  remote_preference?: "ONSITE" | "HYBRID_OK" | "REMOTE_ONLY" | "ANY";
  agent_mode?: CareerAgentMode;
  match_threshold?: number;
  auto_prepare_threshold?: number;
  whatsapp_enabled?: boolean;
  whatsapp_number_e164?: string | null;
  profile_status?: "DRAFT" | "VERIFIED" | "PAUSED";
}

export interface TargetCountryInput {
  country_code: string;
  priority: number;
  minimum_salary?: number | null;
  currency?: string | null;
  visa_required?: boolean;
  relocation_required?: boolean;
  enabled?: boolean;
}

export interface CareerOSDashboard {
  profile: Record<string, unknown> | null;
  countries: Array<Record<string, unknown>>;
  roles: Array<Record<string, unknown>>;
  applications: Array<Record<string, unknown>>;
  matches: Array<Record<string, unknown>>;
  subscription: Record<string, unknown> | null;
  aeonSessions: Array<Record<string, unknown>>;
}

const throwIfError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export class CareerOSService {
  constructor(private readonly client: SupabaseClient) {}

  async ensureCareerProfile(tenantId: string, userId: string): Promise<Record<string, unknown>> {
    const existing = await this.client
      .from("career_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    throwIfError(existing.error);
    if (existing.data) return existing.data;

    const { data, error } = await this.client
      .from("career_profiles")
      .insert({ tenant_id: tenantId, user_id: userId, agent_mode: "HITL" })
      .select("*")
      .single();
    throwIfError(error);
    return data as Record<string, unknown>;
  }

  async ensureTrial(tenantId: string, userId: string): Promise<Record<string, unknown>> {
    const existing = await this.client
      .from("career_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    throwIfError(existing.error);
    if (existing.data) return existing.data;

    const { data, error } = await this.client
      .from("career_subscriptions")
      .insert({ tenant_id: tenantId, user_id: userId, plan: "TRIAL", price_minor: 0, currency: "INR" })
      .select("*")
      .single();
    throwIfError(error);
    return data as Record<string, unknown>;
  }

  async loadDashboard(tenantId: string, userId: string): Promise<CareerOSDashboard> {
    const [profileResult, countriesResult, rolesResult, applicationsResult, matchesResult, subscriptionResult, aeonResult] = await Promise.all([
      this.client.from("career_profiles").select("*").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle(),
      this.client.from("career_target_countries").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("priority", { ascending: false }),
      this.client.from("career_target_roles").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("priority", { ascending: false }),
      this.client.from("career_applications").select("*,job:career_jobs(company_name,role_title,location_text,country_code,source_url),match:career_job_matches(overall_score,visa_score,compensation_score)").eq("tenant_id", tenantId).eq("user_id", userId).order("last_status_at", { ascending: false }).limit(100),
      this.client.from("career_job_matches").select("*,job:career_jobs(company_name,role_title,location_text,country_code,source_url,published_at,discovered_at,sponsorship_signal,relocation_signal,salary_min,salary_max,salary_currency)").eq("tenant_id", tenantId).eq("user_id", userId).order("overall_score", { ascending: false }).limit(20),
      this.client.from("career_subscriptions").select("*").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle(),
      this.client.from("aeon_sessions").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);

    for (const result of [profileResult, countriesResult, rolesResult, applicationsResult, matchesResult, subscriptionResult, aeonResult]) {
      throwIfError(result.error);
    }

    return {
      profile: profileResult.data as Record<string, unknown> | null,
      countries: countriesResult.data ?? [],
      roles: rolesResult.data ?? [],
      applications: applicationsResult.data ?? [],
      matches: matchesResult.data ?? [],
      subscription: subscriptionResult.data as Record<string, unknown> | null,
      aeonSessions: aeonResult.data ?? [],
    };
  }

  async saveProfile(tenantId: string, userId: string, changes: CareerProfileInput): Promise<Record<string, unknown>> {
    const profile = await this.ensureCareerProfile(tenantId, userId);
    const profileId = String(profile.id);
    const safeChanges = { ...changes };
    if (safeChanges.current_country_code) safeChanges.current_country_code = safeChanges.current_country_code.toUpperCase();
    if (safeChanges.current_currency) safeChanges.current_currency = safeChanges.current_currency.toUpperCase();

    const { data, error } = await this.client
      .from("career_profiles")
      .update(safeChanges)
      .eq("id", profileId)
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .select("*")
      .single();
    throwIfError(error);
    return data as Record<string, unknown>;
  }

  async replaceTargetCountries(tenantId: string, userId: string, countries: TargetCountryInput[]): Promise<void> {
    const profile = await this.ensureCareerProfile(tenantId, userId);
    const careerProfileId = String(profile.id);
    const deleteResult = await this.client
      .from("career_target_countries")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("career_profile_id", careerProfileId);
    throwIfError(deleteResult.error);

    if (!countries.length) return;
    const rows = countries.map(country => ({
      ...country,
      country_code: country.country_code.toUpperCase(),
      currency: country.currency?.toUpperCase() || null,
      tenant_id: tenantId,
      user_id: userId,
      career_profile_id: careerProfileId,
    }));
    const { error } = await this.client.from("career_target_countries").insert(rows);
    throwIfError(error);
  }

  async replaceTargetRoles(tenantId: string, userId: string, roles: string[]): Promise<void> {
    const profile = await this.ensureCareerProfile(tenantId, userId);
    const careerProfileId = String(profile.id);
    const normalizedRoles = [...new Set(roles.map(role => role.trim()).filter(Boolean))].slice(0, 20);
    const deleteResult = await this.client
      .from("career_target_roles")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("career_profile_id", careerProfileId);
    throwIfError(deleteResult.error);

    if (!normalizedRoles.length) return;
    const { error } = await this.client.from("career_target_roles").insert(
      normalizedRoles.map((role_name, index) => ({
        tenant_id: tenantId,
        user_id: userId,
        career_profile_id: careerProfileId,
        role_name,
        priority: Math.max(10, 100 - index * 5),
      })),
    );
    throwIfError(error);
  }

  async uploadMasterCV(tenantId: string, userId: string, file: File): Promise<Record<string, unknown>> {
    const allowed = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]);
    if (!allowed.has(file.type)) throw new Error("Upload a PDF, DOCX, or plain-text CV.");
    if (file.size > 15 * 1024 * 1024) throw new Error("CV must be smaller than 15 MB.");

    const profile = await this.ensureCareerProfile(tenantId, userId);
    const careerProfileId = String(profile.id);
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
    const storagePath = `${userId}/${careerProfileId}/master-${crypto.randomUUID()}.${extension}`;
    const upload = await this.client.storage.from("career-documents").upload(storagePath, file, { upsert: false });
    throwIfError(upload.error);

    const { data, error } = await this.client
      .from("career_documents")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        career_profile_id: careerProfileId,
        document_type: "MASTER_CV",
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        metadata: { size: file.size },
      })
      .select("*")
      .single();
    if (error) {
      await this.client.storage.from("career-documents").remove([storagePath]);
      throw new Error(error.message);
    }
    return data as Record<string, unknown>;
  }

  async recordConsent(tenantId: string, userId: string, consentType: string, granted: boolean, version = "2026-08-29"): Promise<void> {
    const { error } = await this.client.from("career_consents").insert({
      tenant_id: tenantId,
      user_id: userId,
      consent_type: consentType,
      consent_version: version,
      granted,
    });
    throwIfError(error);
  }

  async getApplicationHistory(tenantId: string, userId: string, applicationId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client
      .from("career_application_events")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("application_id", applicationId)
      .order("event_time", { ascending: false });
    throwIfError(error);
    return data ?? [];
  }
}
