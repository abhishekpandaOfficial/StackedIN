import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { activateAIProvider, forgetAIProvider, getAIProviderConfiguration, selectAIProviderModel } from "../src/services/aiProviderSession.js";

const writingApi = readFileSync(resolve("api/ai-writing.mjs"), "utf8");
const modelsApi = readFileSync(resolve("api/ai-models.mjs"), "utf8");
const migration = readFileSync(resolve("supabase/migrations/202608250012_sarvam_default_ai.sql"), "utf8");

afterEach(() => {
  forgetAIProvider("openai");
  forgetAIProvider("anthropic");
});

describe("AI provider session routing", () => {
  it("keeps verified BYOK configuration in module memory", () => {
    activateAIProvider("openai", { apiKey: "sk-test-session-key-123456", model: "gpt-test", models: [{ id: "gpt-test", name: "GPT Test" }] });
    expect(getAIProviderConfiguration("openai")?.model).toBe("gpt-test");
    selectAIProviderModel("openai", "gpt-test");
    expect(getAIProviderConfiguration("openai")?.apiKey).toContain("session-key");
  });

  it("never writes personal keys to browser storage", () => {
    const sessionSource = readFileSync(resolve("src/services/aiProviderSession.js"), "utf8");
    expect(sessionSource).not.toMatch(/localStorage|sessionStorage|indexedDB/i);
  });
});

describe("AI API routing contract", () => {
  it("uses Sarvam as the server-managed default", () => {
    expect(writingApi).toContain('process.env.SARVAM_API_KEY');
    expect(writingApi).toContain('https://api.sarvam.ai/v1/chat/completions');
    expect(writingApi).toContain('sarvam-105b');
  });

  it("loads personal model lists only from fixed provider endpoints", () => {
    expect(modelsApi).toContain('https://api.openai.com/v1/models');
    expect(modelsApi).toContain('https://api.anthropic.com/v1/models?limit=100');
    expect(modelsApi).not.toContain('request.body?.url');
  });

  it("allows all three providers in the quota function", () => {
    expect(migration).toContain("('sarvam','openai','anthropic')");
  });
});

