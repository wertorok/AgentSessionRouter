import { describe, expect, it } from "vitest";
import type { ClaudeAdapter, ClaudeJsonResponse, ClaudePromptOptions, HealthProbeResult } from "../src/claude.js";
import { detectAvailableProfiles, pickProfile, profileArgs, profilePromptOptions } from "../src/profiles.js";

describe("Claude tool profiles", () => {
  const focusedArgs = ["--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}'];

  it("builds profile-specific Claude args", () => {
    expect(profileArgs("bare")).toEqual(["--bare", "--tools", ""]);
    expect(profileArgs("focused")).toEqual(focusedArgs);
    expect(profileArgs("agent")).toEqual([]);
    expect(profilePromptOptions("bare")).toEqual({
      extraArgs: ["--bare", "--tools", ""],
      includeConfiguredExtraArgs: false
    });
  });

  it("detects focused and bare availability", async () => {
    const claude = new ProbeClaude();
    const availability = await detectAvailableProfiles(claude, () => new Date("2026-05-12T00:00:00.000Z"));

    expect(availability.checked_at).toBe("2026-05-12T00:00:00.000Z");
    expect(availability.focused.available).toBe(true);
    expect(availability.bare.available).toBe(true);
    expect(claude.calls.map((call) => call.options.extraArgs)).toEqual([
      focusedArgs,
      ["--bare", "--tools", ""]
    ]);
  });

  it("downgrades bare to focused but never escalates to agent", () => {
    const selection = pickProfile("bare", {
      checked_at: "2026-05-12T00:00:00.000Z",
      bare: { available: false, duration_ms: 1, error: "bare auth failed" },
      focused: { available: true, duration_ms: 1 },
      agent: { available: true, duration_ms: 0 }
    });

    expect(selection).toEqual({
      requested: "bare",
      selected: "focused",
      downgraded: true,
      reason: "bare auth failed"
    });
  });

  it("fails when focused is requested but unavailable", () => {
    expect(() =>
      pickProfile("focused", {
        checked_at: "2026-05-12T00:00:00.000Z",
        bare: { available: true, duration_ms: 1 },
        focused: { available: false, duration_ms: 1, error: "focused failed" },
        agent: { available: true, duration_ms: 0 }
      })
    ).toThrow("focused is unavailable");
  });
});

class ProbeClaude implements ClaudeAdapter {
  calls: Array<{ prompt: string; options: ClaudePromptOptions }> = [];

  async getVersion(): Promise<string> {
    return "VERSION_A";
  }

  async runPrompt(prompt: string): Promise<ClaudeJsonResponse> {
    return {
      sessionId: "session",
      result: prompt
    };
  }

  async runPromptWithOptions(prompt: string, options: ClaudePromptOptions): Promise<ClaudeJsonResponse> {
    this.calls.push({ prompt, options });
    return {
      sessionId: "profile-probe",
      result: "PROFILE_OK",
      tokensIn: 1,
      tokensOut: 1
    };
  }

  async healthProbe(): Promise<HealthProbeResult> {
    return {
      ok: true,
      degraded: false,
      testedVersions: ["VERSION_A"],
      unknownVersion: false
    };
  }

  async sessionFileExists(): Promise<boolean> {
    return true;
  }
}
