import type { ClaudeAdapter, ClaudePromptOptions } from "./claude.js";

export type ClaudeToolProfile = "bare" | "focused" | "agent";
export type VerifierToolProfile = "bare" | "focused";

export interface ProfileProbeResult {
  available: boolean;
  duration_ms: number;
  tokens_in?: number;
  tokens_out?: number;
  error?: string;
}

export interface ProfileAvailability {
  checked_at: string;
  bare: ProfileProbeResult;
  focused: ProfileProbeResult;
  agent: ProfileProbeResult;
}

export interface ProfileSelection {
  requested: ClaudeToolProfile;
  selected: ClaudeToolProfile;
  downgraded: boolean;
  reason?: string;
}

const PROFILE_PROBE_PROMPT = "Return exactly: PROFILE_OK";
const STRICT_EMPTY_MCP_ARGS = ["--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}'];

export function profileArgs(profile: ClaudeToolProfile): string[] {
  switch (profile) {
    case "bare":
      return ["--bare", "--tools", ""];
    case "focused":
      return [...STRICT_EMPTY_MCP_ARGS];
    case "agent":
      return [];
  }
}

export async function detectAvailableProfiles(claude: ClaudeAdapter, now = () => new Date()): Promise<ProfileAvailability> {
  const focused = await probeProfile(claude, "focused");
  const bare = await probeProfile(claude, "bare");
  return {
    checked_at: now().toISOString(),
    bare,
    focused,
    agent: {
      available: true,
      duration_ms: 0
    }
  };
}

export function pickProfile(requested: ClaudeToolProfile, availability: ProfileAvailability): ProfileSelection {
  if (requested === "agent") {
    if (!availability.agent.available) {
      throw new Error(`Requested profile agent is unavailable: ${availability.agent.error ?? "unknown error"}`);
    }
    return {
      requested,
      selected: "agent",
      downgraded: false
    };
  }

  if (requested === "focused") {
    if (!availability.focused.available) {
      throw new Error(`Requested profile focused is unavailable: ${availability.focused.error ?? "unknown error"}`);
    }
    return {
      requested,
      selected: "focused",
      downgraded: false
    };
  }

  if (availability.bare.available) {
    return {
      requested,
      selected: "bare",
      downgraded: false
    };
  }

  if (availability.focused.available) {
    return {
      requested,
      selected: "focused",
      downgraded: true,
      reason: availability.bare.error ?? "bare profile unavailable"
    };
  }

  throw new Error(
    `Requested profile bare is unavailable and focused fallback is unavailable: ${
      availability.bare.error ?? availability.focused.error ?? "unknown error"
    }`
  );
}

async function probeProfile(claude: ClaudeAdapter, profile: VerifierToolProfile): Promise<ProfileProbeResult> {
  if (!claude.runPromptWithOptions) {
    return {
      available: false,
      duration_ms: 0,
      error: "Claude adapter does not support profile-specific prompt options"
    };
  }

  const start = Date.now();
  try {
    const response = await claude.runPromptWithOptions(PROFILE_PROBE_PROMPT, profilePromptOptions(profile));
    return {
      available: true,
      duration_ms: Date.now() - start,
      tokens_in: response.tokensIn,
      tokens_out: response.tokensOut
    };
  } catch (error: unknown) {
    return {
      available: false,
      duration_ms: Date.now() - start,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function profilePromptOptions(profile: ClaudeToolProfile): ClaudePromptOptions {
  return {
    extraArgs: profileArgs(profile),
    includeConfiguredExtraArgs: false
  };
}
