import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const supabaseSource = readFileSync(new URL("../supabase.js", import.meta.url), "utf8");
const stackCraftWorkspace = readFileSync(new URL("../src/careeros/StackCraftWorkspace.jsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");

describe("StackCraft authentication boundary", () => {
  it("reuses the exact StackedIN Supabase client and persisted browser session", () => {
    expect(supabaseSource).toContain("persistSession: true");
    expect(supabaseSource).toContain("autoRefreshToken: true");
    expect(stackCraftWorkspace).toContain('import { supabase } from "../../supabase.js"');
    expect(stackCraftWorkspace).not.toContain("createClient(");
  });

  it("uses the StackedIN login handoff and returns to the private StackCraft dashboard on the same origin", () => {
    expect(mainSource).toContain('const STACKCRAFT_LOGIN = "/login?next=%2FCraft%2Fapp&product=stackcraft"');
    expect(mainSource).toContain('window.location.replace(next)');
    expect(mainSource).toContain('event==="SIGNED_IN"');
    expect(stackCraftWorkspace).toContain('/login?next=%2FCraft%2Fapp&product=stackcraft');
    expect(mainSource).not.toContain("stackcraft.vercel.app");
    expect(mainSource).not.toContain("careeros.vercel.app");
  });
});
