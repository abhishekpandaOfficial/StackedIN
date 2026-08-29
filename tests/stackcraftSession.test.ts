import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const supabaseSource = readFileSync(new URL("../supabase.js", import.meta.url), "utf8");
const stackCraftWorkspace = readFileSync(new URL("../src/careeros/CareerOSWorkspace.jsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");

describe("StackCraft authentication boundary", () => {
  it("reuses the exact StackedIN Supabase client and persisted browser session", () => {
    expect(supabaseSource).toContain("persistSession: true");
    expect(supabaseSource).toContain("autoRefreshToken: true");
    expect(stackCraftWorkspace).toContain('import { supabase } from "../../supabase.js"');
    expect(stackCraftWorkspace).not.toContain("createClient(");
  });

  it("opens the private StackCraft dashboard on the same origin", () => {
    expect(mainSource).toContain('window.location.assign("/Craft/app")');
    expect(mainSource).not.toContain("stackcraft.vercel.app");
    expect(mainSource).not.toContain("careeros.vercel.app");
  });
});
