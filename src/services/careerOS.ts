import type { SupabaseClient } from "@supabase/supabase-js";

export type CareerAgentMode = "MANUAL" | "HITL" | "AUTONOMOUS";
export type EvidenceStatus = "UNVERIFIED" | "USER_CONFIRMED" | "SYSTEM_VERIFIED" | "REJECTED";

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

export interface ManualEvidenceInput {
  evidence_type: "EXPERIENCE" | "OUTCOME" | "SKILL" | "PROJECT" | "EDUCATION" | "CERTIFICATION" | "DOMAIN" | "ACHIEVEMENT" | "RESPONSIBILITY" | "OTHER";
  claim_text: string;
  normalized_key?: string | null;
}

export interface CareerOSDashboard {
  profile: Record<string, any> | null;
  countries: Array<Record<string, any>>;
  roles: Array<Record<string, any>>;
  applications: Array<Record<string, any>>;
  matches: Array<Record<string, any>>;
  subscription: Record<string, any> | null;
  aeonSessions: Array<Record<string, any>>;
  documents: Array<Record<string, any>>;
  ingestionJobs: Array<Record<string, any>>;
  evidence: Array<Record<string, any>>;
}

const throwIfError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export class CareerOSService {
  constructor(private readonly client: SupabaseClient) {}

  async ensureCareerProfile(tenantId: string, userId: string): Promise<Record<string, any>> {
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
    return data as Record<string, any>;
  }

  async ensureTrial(tenantId: string, userId: string): Promise<Record<string, any>> {
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
    return data as Record<string, any>;
  }

  async loadDashboard(tenantId: string, userId: string): Promise<CareerOSDashboard> {
    const [profileResult, countriesResult, rolesResult, applicationsResult, matchesResult, subscriptionResult, aeonResult, documentsResult, ingestionResult, evidenceResult] = await Promise.all([
      this.client.from("career_profiles").select("*").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle(),
      this.client.from("career_target_countries").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("priority", { ascending: false }),
      this.client.from("career_target_roles").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("priority", { ascending: false }),
      this.client.from("career_applications").select("*,job:career_jobs(company_name,role_title,location_text,country_code,source_url),match:career_job_matches(overall_score,visa_score,compensation_score)").eq("tenant_id", tenantId).eq("user_id", userId).order("last_status_at", { ascending: false }).limit(100),
      this.client.from("career_job_matches").select("*,job:career_jobs(company_name,role_title,location_text,country_code,source_url,published_at,discovered_at,sponsorship_signal,relocation_signal,salary_min,salary_max,salary_currency)").eq("tenant_id", tenantId).eq("user_id", userId).order("overall_score", { ascending: false }).limit(20),
      this.client.from("career_subscriptions").select("*").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle(),
      this.client.from("aeon_sessions").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      this.client.from("career_documents").select("id,document_type,file_name,mime_type,metadata,created_at").eq("tenant_id", tenantId).eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      this.client.from("career_ingestion_jobs").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      this.client.from("career_evidence_items").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("created_at", { ascending: false }).limit(250),
    ]);

    for (const result of [profileResult, countriesResult, rolesResult, applicationsResult, matchesResult, subscriptionResult, aeonResult, documentsResult, ingestionResult, evidenceResult]) {
      throwIfError(result.error);
    }

    return {
      profile: profileResult.data as Record<string, any> | null,
      countries: countriesResult.data ?? [],
      roles: rolesResult.data ?? [],
      applications: applicationsResult.data ?? [],
      matches: matchesResult.data ?? [],
      subscription: subscriptionResult.data as Record<string, any> | null,
      aeonSessions: aeonResult.data ?? [],
      documents: documentsResult.data ?? [],
      ingestionJobs: ingestionResult.data ?? [],
      evidence: evidenceResult.data ?? [],
    };
  }

  async saveProfile(tenantId: string, userId: string, changes: CareerProfileInput): Promise<Record<string, any>> {
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
    return data as Record<string, any>;
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

  async uploadMasterCV(tenantId: string, userId: string, file: File): Promise<Record<string, any>> {
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

    const queue = await this.client
      .from("career_ingestion_jobs")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        career_profile_id: careerProfileId,
        document_id: data.id,
        status: "QUEUED",
      });
    if (queue.error) {
      await this.client.from("career_documents").delete().eq("id", data.id).eq("user_id", userId);
      await this.client.storage.from("career-documents").remove([storagePath]);
      throw new Error(queue.error.message);
    }

    return data as Record<string, any>;
  }

  async addManualEvidence(tenantId: string, userId: string, input: ManualEvidenceInput): Promise<Record<string, any>> {
    const claim = input.claim_text.trim();
    if (claim.length < 2) throw new Error("Evidence needs a meaningful claim.");
    const profile = await this.ensureCareerProfile(tenantId, userId);
    const { data, error } = await this.client
      .from("career_evidence_items")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        career_profile_id: profile.id,
        evidence_type: input.evidence_type,
        normalized_key: input.normalized_key?.trim() || null,
        claim_text: claim,
        source_type: "USER",
        verification_status: "USER_CONFIRMED",
        confidence: 1,
      })
      .select("*")
      .single();
    throwIfError(error);
    return data as Record<string, any>;
  }

  async reviewEvidence(tenantId: string, userId: string, evidenceId: string, status: Extract<EvidenceStatus, "USER_CONFIRMED" | "REJECTED">): Promise<void> {
    const { error } = await this.client
      .from("career_evidence_items")
      .update({ verification_status: status })
      .eq("id", evidenceId)
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);
    throwIfError(error);
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

  async getApplicationHistory(tenantId: string, userId: string, applicationId: string): Promise<Array<Record<string, any>>> {
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
