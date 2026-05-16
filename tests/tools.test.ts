import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import type { ClaudeAdapter, ClaudeJsonResponse, ClaudePromptOptions, HealthProbeResult } from "../src/claude.js";
import type { Clock } from "../src/clock.js";
import { loadConfig } from "../src/config.js";
import { ERROR_CODES } from "../src/constants.js";
import { RouterDatabase } from "../src/db.js";
import { MemoryLockProvider, type LockProvider } from "../src/locks.js";
import type { Logger } from "../src/logger.js";
import { RouterRuntime } from "../src/runtime.js";
import { registerTools } from "../src/tools.js";

describe("cluster MCP tools", () => {
  it("prepares, gets, and lists a static cluster factsheet", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = ['--tools', ''];\n");

    const prepare = await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "config-and-cwd-isolation",
      name: "Config and cwd isolation",
      tool_profile_default: "bare",
      factsheet: {
        summary: "Static config facts.",
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists in config.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });
    const prepared = parseToolJson(prepare);

    const get = parseToolJson(
      await server.call("cluster_get", {
        project_id: "project",
        cluster_id: "config-and-cwd-isolation",
        include_factsheet: true
      })
    );
    const list = parseToolJson(await server.call("cluster_list", { project_id: "project" }));

    expect(prepare.isError).toBeFalsy();
    expect(prepared.verification_stage).toBe("static");
    expect(prepared.trust_state).toBe("static_verified");
    expect(get.cluster.trust_state).toBe("static_verified");
    expect(get.current_factsheet.status).toBe("static_verified");
    expect(get.current_factsheet.content.facts).toHaveLength(1);
    expect(get.current_factsheet.content.facts[0].evidence[0].snippet_hash).toMatch(/^sha256:/);
    expect(get.file_hashes).toHaveLength(1);
    expect(list.clusters).toHaveLength(1);
    expect(list.clusters[0].current_factsheet.fact_count).toBe(1);
    fixture.cleanup();
  });

  it("recalculates generated evidence hashes during cluster_prepare", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = ['--tools', ''];\n");

    const result = parseToolJson(
      await server.call("cluster_prepare", {
        project_id: "project",
        cluster_id: "router-ops",
        tool_profile_default: "bare",
        factsheet: {
          facts: [
            {
              id: "extra-args",
              claim: "extraArgs exists.",
              evidence: [
                {
                  path: "src/config.ts",
                  selector: "extraArgs",
                  hash: "sha256:stale-generated-hash"
                }
              ]
            }
          ]
        }
      })
    );

    expect(result.verified_facts).toBe(1);
    expect(result.rejected_facts).toBe(0);
    expect(result.factsheet.facts[0].evidence[0].hash).toMatch(/^sha256:/);
    expect(result.factsheet.facts[0].evidence[0].hash).not.toBe("sha256:stale-generated-hash");
    expect(result.factsheet.facts[0].evidence[0].snippet_hash).toMatch(/^sha256:/);
    fixture.cleanup();
  });

  it("re-prepares a cluster from the latest stored factsheet without caller-provided factsheet JSON", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const filePath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(filePath, "export const extraArgs = ['--tools', ''];\n");

    const prepared = parseToolJson(
      await server.call("cluster_prepare", {
        project_id: "project",
        cluster_id: "router-ops",
        tool_profile_default: "bare",
        static_factsheet_policy: "allow",
        factsheet: {
          facts: [
            {
              id: "extra-args",
              claim: "extraArgs exists.",
              evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
            }
          ]
        }
      })
    );
    const originalHash = prepared.factsheet.facts[0].evidence[0].hash;
    writeFileSync(filePath, "export const extraArgs = ['--bare', '--tools', ''];\n");

    const reprepared = parseToolJson(
      await server.call("cluster_reprepare", {
        project_id: "project",
        cluster_id: "router-ops",
        verification_mode: "static"
      })
    );

    expect(reprepared.source_factsheet_version).toBe(1);
    expect(reprepared.factsheet_version).toBe(2);
    expect(reprepared.verified_facts).toBe(1);
    expect(reprepared.rejected_facts).toBe(0);
    expect(reprepared.coverage).toMatchObject({
      source_fact_count: 1,
      verified_facts: 1,
      rejected_facts: 0,
      retained_percent: 100,
      drop_percent: 0
    });
    expect(reprepared.factsheet.facts[0].evidence[0].hash).toMatch(/^sha256:/);
    expect(reprepared.factsheet.facts[0].evidence[0].hash).not.toBe(originalHash);
    const get = parseToolJson(
      await server.call("cluster_get", {
        project_id: "project",
        cluster_id: "router-ops"
      })
    );
    expect(get.cluster.static_factsheet_policy).toBe("allow");
    fixture.cleanup();
  });

  it("preserves existing static factsheet policy when re-preparing without an explicit policy", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      static_factsheet_policy: "allow",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });
    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists after re-prepare.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });

    const get = parseToolJson(
      await server.call("cluster_get", {
        project_id: "project",
        cluster_id: "router-ops"
      })
    );

    expect(get.cluster.static_factsheet_policy).toBe("allow");
    fixture.cleanup();
  });

  it("returns project mismatch for cluster ownership conflicts", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    await server.call("cluster_prepare", {
      project_id: "project-a",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });

    const result = await server.call("cluster_get", {
      project_id: "project-b",
      cluster_id: "router-ops"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBe(true);
    expect(payload.error.code).toBe(ERROR_CODES.CLUSTER_PROJECT_MISMATCH);
    fixture.cleanup();
  });

  it("runs LLM verification when requested by cluster_prepare", async () => {
    const claude = new FakeClaude({
      facts: [{ id: "extra-args", verdict: "VERIFIED", reason: "Evidence supports the claim." }]
    });
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    const result = await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      verification_mode: "llm",
      llm_verifier_profile: "focused",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.verification_stage).toBe("llm");
    expect(payload.trust_state).toBe("llm_verified");
    expect(payload.profile_selection).toEqual({
      requested: "focused",
      selected: "focused",
      downgraded: false
    });
    expect(payload.factsheet.facts[0].confidence).toBe("llm_verified");
    expect(claude.lastOptions?.extraArgs).toEqual(["--tools", ""]);
    fixture.cleanup();
  });

  it("routes router_consult through an explicit cluster and records the decision", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");
    await prepareExtraArgsCluster(server);

    const result = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        cluster_id: "router-ops",
        question: "What does the config cluster know?"
      })
    );
    const decisions = fixture.runtime.db.db
      .prepare("SELECT event_type, answer_summary, match_score, match_reason FROM session_events ORDER BY id")
      .all() as Array<{ event_type: string; answer_summary: string; match_score: number; match_reason: string }>;

    expect(result.route_decision).toMatchObject({
      selected_path: "cluster_consult_explicit",
      cluster_id: "router-ops",
      match_score: 1,
      auto_cluster_routing: "disabled_read_only"
    });
    expect(result.cluster_id).toBe("router-ops");
    expect(decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "router_route_decision",
          answer_summary: "cluster_consult_explicit",
          match_score: 1,
          match_reason: expect.stringContaining("cluster_id=router-ops")
        })
      ])
    );
    fixture.cleanup();
  });

  it("routes router_consult to an exact existing session before creating a new session", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.createSession({
      id: "existing-session",
      projectId: "project",
      claudeSessionId: "claude-existing-session",
      topic: "project roadmap",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });

    const result = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        topic_hint: "project roadmap",
        question: "What should we do next?"
      })
    );

    expect(result.route_decision).toMatchObject({
      selected_path: "claude_consult_existing_session",
      session_id: "existing-session",
      match_score: 1
    });
    expect(result.session_id).toBe("existing-session");
    expect(result.routing.was_new_session).toBe(false);
    fixture.cleanup();
  });

  it("previews router_consult routing without invoking Claude or writing route events", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.createSession({
      id: "existing-session",
      projectId: "project",
      claudeSessionId: "claude-existing-session",
      topic: "project roadmap",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });

    const result = parseToolJson(
      await server.call("router_dry_run", {
        project_id: "project",
        topic_hint: "project roadmap",
        related_files: ["README.md"],
        tags: ["roadmap"],
        task_type: "planning",
        question: "What should the AgentSessionRouter project do next after the current release?",
        candidate_limit: 3
      })
    );
    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 10
      })
    );
    const inspection = fixture.runtime.db.inspectSession("existing-session", 10);

    expect(result).toMatchObject({
      project_id: "project",
      dry_run: true,
      invokes_claude: false,
      writes_route_event: false,
      lifecycle_applied: false,
      route_decision: {
        selected_path: "claude_consult_existing_session",
        session_id: "existing-session",
        match_score: 1
      }
    });
    expect(result.top_session_candidates[0]).toMatchObject({
      rank: 1,
      session_id: "existing-session",
      exact_topic_match: true
    });
    expect(monitor.route_health.decision_counts).toEqual([]);
    expect(inspection?.recentEvents).toEqual([]);
    fixture.cleanup();
  });

  it("surfaces router_consult route decisions in router_monitor", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);

    const consult = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        question: "Broad new topic with no existing session"
      })
    );
    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 10
      })
    );

    expect(consult.route_decision.selected_path).toBe("claude_consult_new_session");
    expect(consult.route_decision.metadata_quality).toMatchObject({
      score: 0,
      topic_hint_source: "inferred",
      missing: ["topic_hint", "related_files", "tags", "task_type"]
    });
    expect(consult.routing.was_new_session).toBe(true);
    expect(monitor.route_health.decision_counts).toEqual([
      expect.objectContaining({ selected_path: "claude_consult_new_session", count: 1 })
    ]);
    expect(monitor.route_health.metadata_quality).toMatchObject({
      total: 1,
      known: 1,
      average_score: 0,
      missing_topic_hint_count: 1,
      missing_related_files_count: 1,
      missing_tags_count: 1,
      missing_task_type_count: 1
    });
    expect(monitor.route_health.samples[0]).toMatchObject({
      selected_path: "claude_consult_new_session",
      question: "Broad new topic with no existing session"
    });
    expect(monitor.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "routing",
          action: expect.stringContaining("route_health.samples")
        })
      ])
    );
    fixture.cleanup();
  });

  it("uses rich router_consult metadata as hints without making it required", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.createSession({
      id: "metadata-session",
      projectId: "project",
      claudeSessionId: "claude-metadata-session",
      topic: "durable router metadata",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.applySessionUpdate("metadata-session", {
      summary: "Metadata-rich routing session.",
      decisions: [],
      open_questions: [],
      files_discussed: ["src/routerMetadata.ts"],
      tags: ["calibration"],
      aliases: []
    });

    const result = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        topic_hint: "unclear followup",
        related_files: ["src/routerMetadata.ts"],
        tags: ["calibration"],
        task_type: "architectural",
        question: "Should this reuse the metadata-rich routing session?"
      })
    );

    expect(result.route_decision).toMatchObject({
      selected_path: "claude_consult_disambiguated_session",
      session_id: "metadata-session",
      metadata_quality: {
        score: 1,
        related_files_count: 1,
        tags_count: 1,
        task_type: "architectural"
      }
    });
    expect(result.session_id).toBe("metadata-session");
    expect(result.routing.was_new_session).toBe(false);
    fixture.cleanup();
  });

  it("persists caller routing hints on newly created sessions", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);

    const result = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        topic_hint: "new metadata rich session",
        related_files: ["src/newMetadata.ts"],
        tags: ["routing"],
        task_type: "planning",
        question: "Create a new durable session and remember these routing hints."
      })
    );
    const session = fixture.runtime.db.getSessionView(result.session_id);

    expect(result.route_decision.metadata_quality.score).toBe(1);
    expect(session?.files_discussed).toContain("src/newMetadata.ts");
    expect(session?.tags).toEqual(expect.arrayContaining(["routing", "planning"]));
    fixture.cleanup();
  });

  it("rejects oversized router_consult input before invoking Claude", async () => {
    const claude = new FakeClaude();
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);

    const result = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        topic_hint: "oversized consult",
        question: "x".repeat(20_001)
      })
    );

    expect(result.error.code).toBe(ERROR_CODES.INPUT_INVALID);
    expect(claude.runPromptCalls).toBe(0);
    expect(claude.runPromptWithOptionsCalls).toBe(0);
    fixture.cleanup();
  });

  it("drops unsafe routing file hints before storing session metadata", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);

    const result = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        topic_hint: "metadata path sanitization",
        related_files: ["../../../etc/passwd", "/etc/passwd", "src/safe.ts"],
        tags: ["routing"],
        task_type: "debug",
        question: "Create a new durable session and keep only safe routing file metadata."
      })
    );
    const session = fixture.runtime.db.getSessionView(result.session_id);

    expect(session?.files_discussed).toEqual(["src/safe.ts"]);
    expect(result.route_decision.metadata_quality.related_files_count).toBe(1);
    fixture.cleanup();
  });

  it("disambiguates an unambiguous low-confidence session without caller input", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.createSession({
      id: "cache-session",
      projectId: "project",
      claudeSessionId: "claude-cache-session",
      topic: "router consult cache maintenance sample",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.applySessionUpdate("cache-session", {
      summary: "Cache maintenance route sample.",
      decisions: [],
      open_questions: [],
      files_discussed: ["scripts/router-route-sample.mjs"],
      tags: [],
      aliases: []
    });

    const result = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        topic_hint: "router consult cache maintenance",
        relevant_code: "scripts/router-route-sample.mjs",
        question: "Should this continue the cache maintenance session?"
      })
    );

    expect(result.route_decision).toMatchObject({
      selected_path: "claude_consult_disambiguated_session",
      session_id: "cache-session",
      match_score: 0.59
    });
    expect(result.session_id).toBe("cache-session");
    expect(result.routing.was_new_session).toBe(false);
    const second = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        topic_hint: "router consult cache maintenance",
        relevant_code: "scripts/router-route-sample.mjs",
        question: "Should this still continue the cache maintenance session?"
      })
    );

    expect(second.route_decision).toMatchObject({
      selected_path: "claude_consult_disambiguated_session",
      session_id: "cache-session",
      match_score: 0.59
    });
    expect(second.routing.was_new_session).toBe(false);
    fixture.cleanup();
  });

  it("starts a new session for ambiguous low-confidence matches instead of guessing", async () => {
    const fixture = createToolFixture();
    fixture.runtime.config.matching.disambiguationGap = 0.5;
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.createSession({
      id: "fallback-full",
      projectId: "project",
      claudeSessionId: "claude-fallback-full",
      topic: "cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.createSession({
      id: "fallback-targeted",
      projectId: "project",
      claudeSessionId: "claude-fallback-targeted",
      topic: "cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    for (const sessionId of ["fallback-full", "fallback-targeted"]) {
      fixture.runtime.db.applySessionUpdate(sessionId, {
        summary: "Cluster fallback benchmark session.",
        decisions: [],
        open_questions: [],
        files_discussed: ["src/prompt.ts"],
        tags: [],
        aliases: []
      });
    }

    const result = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        topic_hint: "cluster fallback agentsessionrouter codebase reprepared 2026 05 15",
        relevant_code: "src/prompt.ts",
        question: "Should this continue one of the fallback sessions?"
      })
    );

    expect(result.route_decision.selected_path).toBe("claude_consult_new_session");
    expect(result.route_decision.reason).toContain("Ambiguous low-confidence session candidates");
    expect(result.route_decision.force_new_session).toBe(true);
    expect(result.routing.was_new_session).toBe(true);
    expect(result.session_id).not.toBe("fallback-full");
    expect(result.session_id).not.toBe("fallback-targeted");
    const second = parseToolJson(
      await server.call("router_consult", {
        project_id: "project",
        topic_hint: "cluster fallback agentsessionrouter codebase reprepared 2026 05 15",
        relevant_code: "src/prompt.ts",
        question: "Should this continue the newly created ambiguity session?"
      })
    );

    expect(second.route_decision).toMatchObject({
      selected_path: "claude_consult_existing_session",
      session_id: result.session_id,
      match_score: 1
    });
    expect(second.routing.was_new_session).toBe(false);
    fixture.cleanup();
  });

  it("downgrades LLM verifier from bare to focused when bare probe fails", async () => {
    const claude = new FakeClaude(
      {
        facts: [{ id: "extra-args", verdict: "VERIFIED", reason: "Evidence supports the claim." }]
      },
      { failBareProbe: true }
    );
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    const result = await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      verification_mode: "llm",
      llm_verifier_profile: "bare",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });
    const payload = parseToolJson(result);
    const events = fixture.runtime.db.db
      .prepare("SELECT event_type FROM cluster_events WHERE cluster_id = ? ORDER BY id")
      .all("router-ops") as Array<{ event_type: string }>;

    expect(result.isError).toBeFalsy();
    expect(payload.profile_selection).toMatchObject({
      requested: "bare",
      selected: "focused",
      downgraded: true
    });
    expect(payload.verifier_metrics.tool_profile).toBe("focused");
    expect(claude.lastOptions?.extraArgs).toEqual(["--tools", ""]);
    expect(events.map((event) => event.event_type)).toContain("tool_profile_downgraded");
    fixture.cleanup();
  });

  it("consults a cluster through the MCP tool", async () => {
    const claude = new FakeClaude({
      facts: [{ id: "extra-args", verdict: "VERIFIED", reason: "Evidence supports the claim." }]
    });
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      verification_mode: "llm",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });
    claude.verifierResult = "Cluster answer.";
    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("Cluster answer.");
    expect(payload.used_fork).toBe(false);
    expect(payload.tool_profile).toBe("bare");
    expect(claude.lastOptions?.appendSystemPrompt).toContain("extraArgs exists");
    fixture.cleanup();
  });

  it("uses the fast path when evidence files are unchanged", async () => {
    const claude = new FakeClaude("Cluster answer.");
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      static_factsheet_policy: "allow",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?"
    });
    const payload = parseToolJson(result);
    const events = fixture.runtime.db.db
      .prepare("SELECT event_type FROM cluster_events WHERE cluster_id = ? ORDER BY id")
      .all("router-ops") as Array<{ event_type: string }>;

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("Cluster answer.");
    expect(events.map((event) => event.event_type)).not.toContain("evidence_revalidated");
    fixture.cleanup();
  });

  it("revalidates changed files when selectors and snippets still match", async () => {
    const claude = new FakeClaude("Cluster answer after revalidation.");
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithExtraArgs({ prefixLine: "const unrelatedChange = 1;" }));

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?"
    });
    const payload = parseToolJson(result);
    const latest = fixture.runtime.db.getLatestClusterFactsheet("router-ops");
    const events = clusterEventTypes(fixture.runtime.db, "router-ops");

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("Cluster answer after revalidation.");
    expect(payload.auto_refresh).toBeUndefined();
    expect(latest?.version).toBe(2);
    expect(latest?.status).toBe("static_verified");
    expect(fixture.runtime.db.getCluster("project", "router-ops")?.status).toBe("active");
    expect(events).toContain("cluster_refresh_required");
    expect(events).toContain("evidence_revalidated");
    fixture.cleanup();
  });

  it("revalidates when a selector moves but its snippet stays the same", async () => {
    const claude = new FakeClaude("Cluster answer after move.");
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithExtraArgs({ leadingLines: ["// inserted line A", "// inserted line B"] }));

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("Cluster answer after move.");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("evidence_revalidated");
    fixture.cleanup();
  });

  it("falls back to claude_consult when a selector is deleted", async () => {
    const fixture = createToolFixture(new FakeClaude("cluster path should not be used"));
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithoutExtraArgs());

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("ok");
    expect(payload.routing.was_new_session).toBe(true);
    expect(fixture.runtime.db.getCluster("project", "router-ops")?.status).toBe("needs_prepare");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("evidence_revalidation_failed");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("cluster_fallback_to_claude_consult");
    fixture.cleanup();
  });

  it("coalesces identical fallback calls after one stale revalidation failure", async () => {
    const claude = new FakeClaude("cluster path should not be used");
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithoutExtraArgs());

    const calls = await Promise.all(
      Array.from({ length: 10 }, () =>
        server.call("cluster_consult", {
          project_id: "project",
          cluster_id: "router-ops",
          question: "What config field exists?"
        })
      )
    );
    const events = clusterEventTypes(fixture.runtime.db, "router-ops");

    expect(calls.every((result) => !result.isError)).toBe(true);
    expect(claude.runPromptCalls).toBe(1);
    expect(events.filter((event) => event === "evidence_revalidation_failed")).toHaveLength(1);
    expect(events.filter((event) => event === "evidence_revalidation_suppressed")).toHaveLength(9);
    expect(events.filter((event) => event === "cluster_fallback_to_claude_consult")).toHaveLength(1);
    expect(events.filter((event) => event === "cluster_fallback_coalesced")).toHaveLength(9);
    fixture.cleanup();
  });

  it("falls back to claude_consult when evidence revalidation is disabled", async () => {
    const fixture = createToolFixture(new FakeClaude("cluster path should not be used"));
    fixture.runtime.config.cluster.autoRefresh = false;
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithExtraArgs({ prefixLine: "const unrelatedChange = 1;" }));

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("ok");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("cluster_fallback_to_claude_consult");
    fixture.cleanup();
  });

  it("falls back to claude_consult when the factsheet is not trusted enough for cluster mode", async () => {
    const fixture = createToolFixture(new FakeClaude("cluster path should not be used"));
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), configWithExtraArgs());

    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("ok");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("cluster_fallback_to_claude_consult");
    fixture.cleanup();
  });

  it("falls back to claude_consult when the requested cluster does not exist", async () => {
    const fixture = createToolFixture(new FakeClaude("cluster path should not be used"));
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "missing-cluster",
      question: "Answer through the normal router fallback."
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("ok");
    expect(payload.routing.was_new_session).toBe(true);
    expect(clusterEventTypes(fixture.runtime.db, "missing-cluster")).toContain("cluster_fallback_to_claude_consult");
    fixture.cleanup();
  });

  it("falls back even if retained-ratio config is lowered and only one fact fails", async () => {
    const fixture = createToolFixture(new FakeClaude("cluster path should not be used"));
    fixture.runtime.config.cluster.autoRefreshMinRetainedRatio = 0.5;
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, `${configWithExtraArgs()}\nexport const keptSelector = true;\n`);

    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      static_factsheet_policy: "allow",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          },
          {
            id: "kept-selector",
            claim: "keptSelector exists.",
            evidence: [{ path: "src/config.ts", selector: "keptSelector" }]
          }
        ]
      }
    });
    writeFileSync(configPath, `${configWithoutExtraArgs()}\nexport const keptSelector = true;\n`);

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config fields exist?"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("ok");
    expect(fixture.runtime.db.getCluster("project", "router-ops")?.status).toBe("needs_prepare");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("cluster_fallback_to_claude_consult");
    fixture.cleanup();
  });

  it("falls back to claude_consult when selector snippet content changes", async () => {
    const fixture = createToolFixture(new FakeClaude("cluster path should not be used"));
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithExtraArgs({ nearbyLine: "const nearSelector = 42;" }));

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("ok");
    expect(fixture.runtime.db.getCluster("project", "router-ops")?.status).toBe("needs_prepare");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("evidence_revalidation_failed");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("cluster_fallback_to_claude_consult");
    fixture.cleanup();
  });

  it("returns an infrastructure error only when fallback claude_consult also fails", async () => {
    const fixture = createToolFixture(new FakeClaude("cluster path should not be used", { failRunPrompt: true }));
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithoutExtraArgs());

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBe(true);
    expect(payload.error.code).toBe(ERROR_CODES.CLAUDE_INVOCATION_FAILED);
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("cluster_fallback_failed");
    fixture.cleanup();
  });

  it("serializes concurrent stale consult revalidation per cluster", async () => {
    const locks = new TrackingLockProvider();
    const claude = new FakeClaude("Cluster answer after locked revalidation.");
    const fixture = createToolFixture(claude, locks);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithExtraArgs({ prefixLine: "const unrelatedChange = 1;" }));

    const [first, second] = await Promise.all([
      server.call("cluster_consult", {
        project_id: "project",
        cluster_id: "router-ops",
        question: "What config field exists?"
      }),
      server.call("cluster_consult", {
        project_id: "project",
        cluster_id: "router-ops",
        question: "What config field exists?"
      })
    ]);

    expect(first.isError).toBeFalsy();
    expect(second.isError).toBeFalsy();
    expect(locks.maxActiveFor("cluster-evidence-revalidation:project:router-ops")).toBe(1);
    expect(clusterEventTypes(fixture.runtime.db, "router-ops").filter((event) => event === "evidence_revalidated")).toHaveLength(1);
    fixture.cleanup();
  });

  it("refreshes a cluster factsheet through the MCP tool", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });

    const result = await server.call("cluster_refresh", {
      project_id: "project",
      cluster_id: "router-ops",
      mode: "verify_only"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.fresh).toBe(true);
    expect(payload.mode).toBe("verify_only");
    expect(payload.changed_files).toEqual([]);
    fixture.cleanup();
  });

  it("returns comparison stats and list through MCP tools", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-1",
      projectId: "project",
      clusterId: "router-ops",
      question: "What config field exists?",
      clusterAnswer: "cluster",
      clusterDurationMs: 10
    });
    fixture.runtime.db.updateConsultComparisonDirect({
      id: "cmp-1",
      status: "ok",
      directAnswer: "direct",
      directDurationMs: 20
    });
    fixture.runtime.db.updateConsultComparisonJudge({
      id: "cmp-1",
      clusterScore: 3,
      directScore: 2,
      preferred: "cluster",
      clusterErrors: [],
      directErrors: ["missing detail"],
      judgeReasoning: "cluster wins"
    });

    const stats = parseToolJson(await server.call("comparison_stats", { project_id: "project" }));
    const list = parseToolJson(
      await server.call("comparison_list", {
        project_id: "project",
        include_answers: false
      })
    );

    expect(stats.stats).toEqual([
      {
        cluster_id: "router-ops",
        n: 1,
        cluster_q: 3,
        direct_q: 2,
        gap: -1,
        cluster_wins: 1,
        direct_wins: 0,
        ties: 0
      }
    ]);
    expect(list.comparisons).toHaveLength(1);
    expect(list.comparisons[0].cluster_answer).toBe("[omitted]");
    expect(list.comparisons[0].direct_answer).toBe("[omitted]");
    fixture.cleanup();
  });

  it("rejudges stored comparisons through MCP tool", async () => {
    const fixture = createToolFixture(
      new FakeClaude(
        JSON.stringify({
          answer_a_score: 3,
          answer_a_errors: [],
          answer_b_score: 2,
          answer_b_errors: [],
          preferred: "a",
          reasoning: "A is stronger."
        })
      )
    );
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.upsertCluster({
      id: "router-ops",
      projectId: "project",
      name: "Router ops",
      toolProfileDefault: "bare"
    });
    fixture.runtime.db.insertClusterFactsheet({
      id: "factsheet-1",
      clusterId: "router-ops",
      status: "llm_verified",
      trustState: "llm_verified",
      contentJson: JSON.stringify({ facts: [{ id: "fact", claim: "Router monitor exists." }] }),
      fileHashes: []
    });
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-rejudge",
      projectId: "project",
      clusterId: "router-ops",
      question: "What exists?",
      clusterAnswer: "Router monitor exists.",
      clusterDurationMs: 10
    });
    fixture.runtime.db.updateConsultComparisonDirect({
      id: "cmp-rejudge",
      status: "ok",
      directAnswer: "Search needed.",
      directDurationMs: 20
    });
    fixture.runtime.db.updateConsultComparisonJudge({
      id: "cmp-rejudge",
      clusterScore: 1,
      directScore: 3,
      preferred: "direct",
      clusterErrors: [],
      directErrors: [],
      judgeReasoning: "old policy"
    });

    const result = parseToolJson(
      await server.call("comparison_rejudge", {
        project_id: "project",
        preferred: "direct",
        limit: 1
      })
    );

    expect(result.processed_count).toBe(1);
    expect(result.processed[0]).toMatchObject({
      id: "cmp-rejudge",
      before_preferred: "direct",
      before_cluster_score: 1,
      before_direct_score: 3
    });
    expect(result.processed[0].error).toBeUndefined();
    expect(["cluster", "direct"]).toContain(result.processed[0].after_preferred);
    fixture.cleanup();
  });

  it("returns aggregate router status with stale cluster and shadow eval warnings", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.createSession({
      id: "session-1",
      projectId: "project",
      claudeSessionId: "claude-session-1",
      topic: "Router ops",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.logEvent({
      sessionId: "session-1",
      projectId: "project",
      eventType: "parse_failed",
      error: "bad SESSION_UPDATE_JSON"
    });
    fixture.runtime.db.logEvent({
      sessionId: "session-1",
      projectId: "project",
      eventType: "consult",
      question: "Why was this slow?",
      rawResponsePath: "/tmp/raw-slow.txt",
      tokensIn: 60_000,
      tokensOut: 678,
      durationMs: 150_000
    });
    fixture.runtime.db.upsertCluster({
      id: "router-ops",
      projectId: "project",
      name: "Router ops",
      toolProfileDefault: "bare"
    });
    const factsheet = fixture.runtime.db.insertClusterFactsheet({
      id: "factsheet-1",
      clusterId: "router-ops",
      status: "static_verified",
      trustState: "static_verified",
      contentJson: JSON.stringify({ facts: [] }),
      fileHashes: []
    });
    fixture.runtime.db.markClusterFactsheetStale(factsheet.id);
    fixture.runtime.db.logClusterEvent({
      clusterId: "router-ops",
      projectId: "project",
      eventType: "cluster_refresh_required"
    });
    fixture.runtime.db.logClusterEvent({
      clusterId: "router-ops",
      projectId: "project",
      eventType: "cluster_fallback_to_claude_consult"
    });
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-pending",
      projectId: "project",
      clusterId: "router-ops",
      question: "What is stale?",
      clusterAnswer: "cluster",
      clusterDurationMs: 1
    });
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-failed",
      projectId: "project",
      clusterId: "router-ops",
      question: "What failed?",
      clusterAnswer: "cluster",
      clusterDurationMs: 1
    });
    fixture.runtime.db.updateConsultComparisonDirect({
      id: "cmp-failed",
      status: "failed_auth",
      shadowError: "auth failed"
    });
    fixture.runtime.config.eval.shadowMode = true;

    const status = parseToolJson(
      await server.call("router_status", {
        project_id: "project",
        recent_hours: 24,
        warnings_limit: 10
      })
    );

    expect(status.mode).toBe("normal");
    expect(status.v1_sessions.active).toBe(1);
    expect(status.v2_clusters.stale).toBe(1);
    expect(status.v2_clusters.fallback_count_last_24h).toBe(1);
    expect(status.v2_clusters.stale_clusters[0].id).toBe("router-ops");
    expect(status.recent_errors.session_events[0]).toMatchObject({ event_type: "parse_failed", count: 1 });
    expect(status.recent_errors.slow_session_events[0]).toMatchObject({
      event_type: "consult",
      count: 1,
      max_duration_ms: 150_000
    });
    expect(status.recent_errors.cluster_events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_type: "cluster_refresh_required", count: 1 }),
        expect.objectContaining({ event_type: "cluster_fallback_to_claude_consult", count: 1 })
      ])
    );
    expect(status.shadow_eval).toMatchObject({
      enabled: true,
      total: 2,
      pending: 1,
      failed_auth: 1
    });
    expect(status.warnings.some((warning: string) => warning.includes("router-ops"))).toBe(true);
    expect(status.warnings.some((warning: string) => warning.includes("Shadow eval"))).toBe(true);
    fixture.cleanup();
  });

  it("returns an operator monitor with quality, cache health, and next-action recommendations", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.createSession({
      id: "session-1",
      projectId: "project",
      claudeSessionId: "claude-session-1",
      topic: "Router ops",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.logEvent({
      sessionId: "session-1",
      projectId: "project",
      eventType: "consult",
      question: "Why was this slow?",
      rawResponsePath: "/tmp/raw-slow.txt",
      tokensIn: 60_000,
      tokensOut: 678,
      durationMs: 150_000
    });
    fixture.runtime.db.upsertCluster({
      id: "weak-cluster",
      projectId: "project",
      name: "Weak cluster",
      toolProfileDefault: "bare"
    });
    const factsheet = fixture.runtime.db.insertClusterFactsheet({
      id: "factsheet-weak",
      clusterId: "weak-cluster",
      status: "static_verified",
      trustState: "static_verified",
      contentJson: JSON.stringify({ facts: [] }),
      fileHashes: []
    });
    fixture.runtime.db.markClusterFactsheetStale(factsheet.id);
    fixture.runtime.db.markClusterNeedsPrepare("weak-cluster");
    fixture.runtime.db.logClusterEvent({
      clusterId: "weak-cluster",
      projectId: "project",
      eventType: "cluster_fallback_to_claude_consult"
    });
    fixture.runtime.db.logClusterEvent({
      clusterId: "weak-cluster",
      projectId: "project",
      eventType: "cluster_reprepare",
      details: {
        source_factsheet_id: "factsheet-old",
        source_factsheet_version: 1,
        source_fact_count: 4,
        new_factsheet_id: "factsheet-new",
        new_factsheet_version: 2,
        verified_facts: 2,
        rejected_facts: 2,
        coverage_retained_percent: 50,
        coverage_drop_percent: 50,
        verification_mode: "llm"
      }
    });
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-direct-win",
      projectId: "project",
      clusterId: "weak-cluster",
      question: "Why is the cluster weak?",
      clusterAnswer: "NOT IN CONTEXT",
      clusterDurationMs: 5,
      clusterWasNotInContext: true
    });
    fixture.runtime.db.updateConsultComparisonDirect({
      id: "cmp-direct-win",
      status: "ok",
      directAnswer: "Because it lacks reasoning facts.",
      directDurationMs: 10
    });
    fixture.runtime.db.updateConsultComparisonJudge({
      id: "cmp-direct-win",
      clusterScore: 1,
      directScore: 3,
      preferred: "direct",
      clusterErrors: [],
      directErrors: [],
      judgeReasoning: "direct answer had the missing rationale"
    });
    fixture.runtime.config.eval.shadowMode = true;

    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 5
      })
    );

    expect(monitor.health.v2_clusters.fallback_count_last_24h).toBe(1);
    expect(monitor.cache_health.stale_or_needs_prepare[0].id).toBe("weak-cluster");
    expect(monitor.cache_health.decayed_cluster_cost_signals[0]).toMatchObject({
      cluster_id: "weak-cluster",
      status: "needs_prepare",
      fallback_count_recent_window: 1,
      recent_window_hours: 24,
      estimated_extra_cost_usd: 0.05
    });
    expect(monitor.cache_health.reprepare_coverage_drops[0]).toMatchObject({
      cluster_id: "weak-cluster",
      source_factsheet_version: 1,
      new_factsheet_version: 2,
      source_fact_count: 4,
      verified_facts: 2,
      rejected_facts: 2,
      coverage_retained_percent: 50,
      coverage_drop_percent: 50
    });
    expect(monitor.latency.slow_session_samples[0]).toMatchObject({
      session_id: "session-1",
      topic: "Router ops",
      event_type: "consult",
      question: "Why was this slow?",
      raw_response_path: "/tmp/raw-slow.txt",
      tokens_in: 60_000,
      tokens_out: 678,
      duration_ms: 150_000
    });
    expect(monitor.quality.cluster_stats[0]).toMatchObject({
      cluster_id: "weak-cluster",
      total: 1,
      judged: 1,
      not_in_context: 1,
      cluster_q: 1,
      direct_q: 3,
      gap: 2,
      direct_wins: 1
    });
    expect(monitor.quality.direct_win_samples[0]).toMatchObject({
      cluster_id: "weak-cluster",
      question: "Why is the cluster weak?"
    });
    expect(monitor.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ area: "cache", cluster_id: "weak-cluster" }),
        expect.objectContaining({
          area: "coverage",
          cluster_id: "weak-cluster",
          action: expect.stringContaining("cluster_prepare")
        }),
        expect.objectContaining({ area: "quality", cluster_id: "weak-cluster" }),
        expect.objectContaining({
          area: "latency",
          action: expect.stringContaining("direct-discovery/context bloat")
        })
      ])
    );
    expect(monitor.next_directions.some((direction: string) => direction.includes("factsheet expansion"))).toBe(true);
    fixture.cleanup();
  });

  it("does not report reprepare coverage drops after a later factsheet restores coverage", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.upsertCluster({
      id: "restored-cluster",
      projectId: "project",
      name: "Restored cluster",
      toolProfileDefault: "bare",
      staticFactsheetPolicy: "allow"
    });

    const contentWithFacts = (count: number) =>
      JSON.stringify({
        schema_version: 1,
        cluster_id: "restored-cluster",
        summary: "Restored cluster facts.",
        facts: Array.from({ length: count }, (_, index) => ({
          id: `fact-${index + 1}`,
          claim: `Fact ${index + 1}.`,
          confidence: "static_verified",
          evidence: []
        })),
        pitfalls: [],
        forbidden_inferences: [],
        omitted_facts: 0
      });

    fixture.runtime.db.insertClusterFactsheet({
      id: "factsheet-restored-source",
      clusterId: "restored-cluster",
      contentJson: contentWithFacts(4),
      status: "static_verified",
      trustState: "static_verified",
      fileHashes: []
    });
    fixture.runtime.db.insertClusterFactsheet({
      id: "factsheet-restored-dropped",
      clusterId: "restored-cluster",
      contentJson: contentWithFacts(2),
      status: "static_verified",
      trustState: "partial_static",
      fileHashes: []
    });
    fixture.runtime.db.logClusterEvent({
      clusterId: "restored-cluster",
      projectId: "project",
      eventType: "cluster_reprepare",
      details: {
        source_factsheet_id: "factsheet-restored-source",
        source_factsheet_version: 1,
        source_fact_count: 4,
        new_factsheet_id: "factsheet-restored-dropped",
        new_factsheet_version: 2,
        verified_facts: 2,
        rejected_facts: 2,
        coverage_retained_percent: 50,
        coverage_drop_percent: 50,
        verification_mode: "static"
      }
    });
    fixture.runtime.db.insertClusterFactsheet({
      id: "factsheet-restored-full",
      clusterId: "restored-cluster",
      contentJson: contentWithFacts(4),
      status: "static_verified",
      trustState: "static_verified",
      fileHashes: []
    });

    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 5
      })
    );

    expect(monitor.cache_health.reprepare_coverage_drops).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ cluster_id: "restored-cluster" })])
    );
    expect(monitor.recommendations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "coverage",
          cluster_id: "restored-cluster"
        })
      ])
    );
    fixture.cleanup();
  });

  it("surfaces a 100 percent reprepare coverage collapse in router_monitor", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithoutExtraArgs());

    const reprepare = parseToolJson(
      await server.call("cluster_reprepare", {
        project_id: "project",
        cluster_id: "router-ops",
        verification_mode: "static"
      })
    );
    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 5
      })
    );

    expect(reprepare.error.code).toBe(ERROR_CODES.CLUSTER_FACTSHEET_INVALID);
    expect(monitor.cache_health.reprepare_coverage_drops[0]).toMatchObject({
      cluster_id: "router-ops",
      source_fact_count: 1,
      verified_facts: 0,
      rejected_facts: 1,
      coverage_retained_percent: 0,
      coverage_drop_percent: 100
    });
    expect(monitor.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "coverage",
          cluster_id: "router-ops",
          action: expect.stringContaining("cluster_prepare")
        })
      ])
    );
    fixture.cleanup();
  });

  it("does not flag high-scoring NOT IN CONTEXT caveats as coverage failures", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.upsertCluster({
      id: "covered-cluster",
      projectId: "project",
      name: "Covered cluster",
      toolProfileDefault: "bare"
    });
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-caveat",
      projectId: "project",
      clusterId: "covered-cluster",
      question: "Explain covered behavior and caveat.",
      clusterAnswer: "The covered behavior is correct. NOT IN CONTEXT: one optional operational detail.",
      clusterDurationMs: 5,
      clusterWasNotInContext: true
    });
    fixture.runtime.db.updateConsultComparisonDirect({
      id: "cmp-caveat",
      status: "ok",
      directAnswer: "No useful answer.",
      directDurationMs: 10
    });
    fixture.runtime.db.updateConsultComparisonJudge({
      id: "cmp-caveat",
      clusterScore: 3,
      directScore: 0,
      preferred: "cluster",
      clusterErrors: [],
      directErrors: ["no answer"],
      judgeReasoning: "cluster answered and included a correct caveat"
    });

    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 10
      })
    );

    expect(monitor.quality.cluster_stats[0]).toMatchObject({
      cluster_id: "covered-cluster",
      not_in_context: 0,
      cluster_q: 3,
      direct_q: 0
    });
    expect(monitor.quality.not_in_context_samples).toHaveLength(0);
    expect(
      monitor.recommendations.some((recommendation: { area: string }) => recommendation.area === "coverage")
    ).toBe(false);
    fixture.cleanup();
  });

  it("surfaces stable clusters as read-only auto-routing candidates", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.upsertCluster({
      id: "stable-cluster",
      projectId: "project",
      name: "Stable cluster",
      toolProfileDefault: "bare"
    });

    for (let index = 0; index < 3; index += 1) {
      const id = `cmp-stable-${index}`;
      fixture.runtime.db.insertConsultComparison({
        id,
        projectId: "project",
        clusterId: "stable-cluster",
        question: `Stable question ${index}`,
        clusterAnswer: "Cluster answer.",
        clusterDurationMs: 5
      });
      fixture.runtime.db.updateConsultComparisonDirect({
        id,
        status: "ok",
        directAnswer: "Direct answer.",
        directDurationMs: 10
      });
      fixture.runtime.db.updateConsultComparisonJudge({
        id,
        clusterScore: 3,
        directScore: 2,
        preferred: "cluster",
        clusterErrors: [],
        directErrors: [],
        judgeReasoning: "cluster is better"
      });
    }

    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 10
      })
    );

    expect(monitor.quality.auto_routing_candidates).toEqual([
      expect.objectContaining({
        cluster_id: "stable-cluster",
        judged: 3,
        cluster_q: 3,
        direct_q: 2,
        gap: -1
      })
    ]);
    expect(monitor.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "routing",
          cluster_id: "stable-cluster",
          action: expect.stringContaining("read-only candidate")
        })
      ])
    );
    fixture.cleanup();
  });

  it("caps large router_monitor sample limits and reports truncation", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);

    for (let index = 0; index < 40; index += 1) {
      fixture.runtime.db.logEvent({
        projectId: "project",
        eventType: "router_route_decision",
        question: `Route decision ${index}`,
        answerSummary: "claude_consult_auto",
        matchScore: 0.1,
        matchReason: "synthetic sample"
      });
    }

    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 80
      })
    );

    expect(monitor.output_limits).toEqual({
      requested_sample_limit: 80,
      effective_sample_limit: 30,
      truncated: true
    });
    expect(monitor.route_health.samples).toHaveLength(30);
    fixture.cleanup();
  });

  it("surfaces route ambiguity counts and score histograms in router_monitor", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);

    fixture.runtime.db.logEvent({
      projectId: "project",
      eventType: "router_route_decision",
      question: "Ambiguous route",
      answerSummary: "claude_consult_new_session",
      matchScore: 0.6,
      matchReason:
        "Ambiguous low-confidence session candidates; router starts a new durable session instead of guessing. candidate_gap=0.02; force_new_session=true"
    });
    fixture.runtime.db.logEvent({
      projectId: "project",
      eventType: "router_route_decision",
      question: "Explicit cluster route",
      answerSummary: "cluster_consult_explicit",
      matchScore: 1,
      matchReason: "Explicit cluster_id provided by caller.; cluster_id=router-ops"
    });

    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 10
      })
    );

    expect(monitor.route_health.forced_new_due_to_ambiguity_count_last_24h).toBe(1);
    expect(monitor.route_health.score_histogram_by_selected_path).toEqual(
      expect.arrayContaining([
        {
          selected_path: "claude_consult_new_session",
          buckets: [{ bucket: "0.55-0.69", count: 1 }]
        },
        {
          selected_path: "cluster_consult_explicit",
          buckets: [{ bucket: "1.00", count: 1 }]
        }
      ])
    );
    expect(monitor.route_health.score_histogram_by_cluster).toEqual([
      {
        cluster_id: "router-ops",
        buckets: [{ bucket: "1.00", count: 1 }]
      }
    ]);
    fixture.cleanup();
  });

  it("surfaces SESSION_UPDATE_JSON metadata health in the operator monitor", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.createSession({
      id: "metadata-session",
      projectId: "project",
      claudeSessionId: "claude-metadata-session",
      topic: "Metadata updates",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.logEvent({
      sessionId: "metadata-session",
      projectId: "project",
      eventType: "parse_failed",
      question: "Return metadata",
      rawResponsePath: "/tmp/raw-metadata.txt",
      error: "SESSION_UPDATE_JSON block missing"
    });
    fixture.runtime.db.logEvent({
      sessionId: "metadata-session",
      projectId: "project",
      eventType: "parse_failed_threshold_exceeded",
      error: "parse_failure_threshold"
    });

    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 10
      })
    );

    expect(monitor.metadata_health.event_counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_type: "parse_failed", count: 1 }),
        expect.objectContaining({ event_type: "parse_failed_threshold_exceeded", count: 1 })
      ])
    );
    expect(monitor.metadata_health.affected_sessions[0]).toMatchObject({
      session_id: "metadata-session",
      topic: "Metadata updates",
      parse_failed_count: 1,
      threshold_exceeded_count: 1,
      latest_error: "parse_failure_threshold",
      latest_raw_response_path: "/tmp/raw-metadata.txt"
    });
    expect(monitor.metadata_health.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          session_id: "metadata-session",
          event_type: "parse_failed",
          raw_response_path: "/tmp/raw-metadata.txt",
          error: "SESSION_UPDATE_JSON block missing"
        })
      ])
    );
    expect(monitor.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "metadata",
          priority: "high",
          action: expect.stringContaining("archived SESSION_UPDATE_JSON")
        })
      ])
    );
    fixture.cleanup();
  });

  it("archives clusters and removes them from active monitor signals", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.upsertCluster({
      id: "old-benchmark",
      projectId: "project",
      name: "Old benchmark",
      toolProfileDefault: "bare"
    });
    fixture.runtime.db.upsertCluster({
      id: "current-cluster",
      projectId: "project",
      name: "Current cluster",
      toolProfileDefault: "bare"
    });
    fixture.runtime.db.logClusterEvent({
      clusterId: "old-benchmark",
      projectId: "project",
      eventType: "cluster_fallback_to_claude_consult"
    });
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-old-direct-win",
      projectId: "project",
      clusterId: "old-benchmark",
      question: "Why did the old benchmark lose?",
      clusterAnswer: "NOT IN CONTEXT",
      clusterDurationMs: 5,
      clusterWasNotInContext: true
    });
    fixture.runtime.db.updateConsultComparisonDirect({
      id: "cmp-old-direct-win",
      status: "ok",
      directAnswer: "The old benchmark had a stale factsheet.",
      directDurationMs: 10
    });
    fixture.runtime.db.updateConsultComparisonJudge({
      id: "cmp-old-direct-win",
      clusterScore: 1,
      directScore: 3,
      preferred: "direct",
      clusterErrors: [],
      directErrors: [],
      judgeReasoning: "old cluster lost"
    });
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-current-cluster-win",
      projectId: "project",
      clusterId: "current-cluster",
      question: "What does the current cluster answer?",
      clusterAnswer: "Current answer",
      clusterDurationMs: 5
    });
    fixture.runtime.db.updateConsultComparisonDirect({
      id: "cmp-current-cluster-win",
      status: "ok",
      directAnswer: "Direct answer",
      directDurationMs: 10
    });
    fixture.runtime.db.updateConsultComparisonJudge({
      id: "cmp-current-cluster-win",
      clusterScore: 3,
      directScore: 2,
      preferred: "cluster",
      clusterErrors: [],
      directErrors: [],
      judgeReasoning: "current cluster wins"
    });

    const archive = parseToolJson(
      await server.call("cluster_archive", {
        project_id: "project",
        cluster_id: "old-benchmark",
        reason: "superseded benchmark data"
      })
    );
    const activeList = parseToolJson(await server.call("cluster_list", { project_id: "project" }));
    const allList = parseToolJson(
      await server.call("cluster_list", {
        project_id: "project",
        include_archived: true
      })
    );
    const monitor = parseToolJson(
      await server.call("router_monitor", {
        project_id: "project",
        recent_hours: 24,
        sample_limit: 10
      })
    );

    expect(archive).toMatchObject({
      project_id: "project",
      cluster_id: "old-benchmark",
      ok: true,
      status: "archived"
    });
    expect(activeList.clusters.map((cluster: { id: string }) => cluster.id)).toEqual(["current-cluster"]);
    expect(allList.clusters.find((cluster: { id: string }) => cluster.id === "old-benchmark").status).toBe("archived");
    expect(monitor.health.v2_clusters.fallback_count_last_24h).toBe(0);
    expect(monitor.cache_health.attention_by_cluster).toHaveLength(0);
    expect(monitor.quality.cluster_stats.map((stats: { cluster_id: string }) => stats.cluster_id)).toEqual([
      "current-cluster"
    ]);
    expect(monitor.quality.direct_win_samples).toHaveLength(0);
    expect(monitor.quality.not_in_context_samples).toHaveLength(0);
    expect(
      monitor.recommendations.some(
        (recommendation: { cluster_id?: string }) => recommendation.cluster_id === "old-benchmark"
      )
    ).toBe(false);
    fixture.cleanup();
  });
});

class FakeServer {
  private readonly handlers = new Map<string, (input: Record<string, unknown>) => Promise<CallToolResult>>();

  registerTool(
    name: string,
    _options: unknown,
    handler: (input: Record<string, unknown>) => Promise<CallToolResult>
  ): void {
    this.handlers.set(name, handler);
  }

  async call(name: string, input: Record<string, unknown>): Promise<CallToolResult> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`missing tool: ${name}`);
    }
    return handler(input);
  }
}

class FakeClaude implements ClaudeAdapter {
  lastOptions: ClaudePromptOptions | undefined;
  runPromptCalls = 0;
  runPromptWithOptionsCalls = 0;

  constructor(
    public verifierResult: unknown = { facts: [] },
    private readonly options: { failBareProbe?: boolean; failRunPrompt?: boolean } = {}
  ) {}

  async getVersion(): Promise<string> {
    return "VERSION_A";
  }

  async runPrompt(_prompt: string, resumeSessionId?: string): Promise<ClaudeJsonResponse> {
    this.runPromptCalls += 1;
    if (this.options.failRunPrompt) {
      throw new Error("claude unavailable");
    }
    return {
      sessionId: resumeSessionId ?? "new-session",
      result: "ok",
      tokensIn: 1,
      tokensOut: 1
    };
  }

  async runPromptWithOptions(_prompt: string, options: ClaudePromptOptions): Promise<ClaudeJsonResponse> {
    this.runPromptWithOptionsCalls += 1;
    if (this.options.failBareProbe && _prompt.includes("PROFILE_OK") && options.extraArgs?.includes("--bare")) {
      throw new Error("bare auth failed");
    }
    this.lastOptions = options;
    return {
      sessionId: "verifier-session",
      result: typeof this.verifierResult === "string" ? this.verifierResult : JSON.stringify(this.verifierResult),
      tokensIn: 10,
      tokensOut: 5
    };
  }

  async healthProbe(): Promise<HealthProbeResult> {
    return {
      ok: true,
      degraded: false,
      detectedVersion: "VERSION_A",
      testedVersions: ["VERSION_A"],
      unknownVersion: false
    };
  }

  async sessionFileExists(): Promise<boolean> {
    return true;
  }
}

class TrackingLockProvider implements LockProvider {
  private readonly inner = new MemoryLockProvider();
  private readonly active = new Map<string, number>();
  private readonly maxActive = new Map<string, number>();

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return this.inner.withLock(key, async () => {
      const active = (this.active.get(key) ?? 0) + 1;
      this.active.set(key, active);
      this.maxActive.set(key, Math.max(this.maxActive.get(key) ?? 0, active));
      await Promise.resolve();
      try {
        return await fn();
      } finally {
        this.active.set(key, (this.active.get(key) ?? 1) - 1);
      }
    });
  }

  maxActiveFor(key: string): number {
    return this.maxActive.get(key) ?? 0;
  }
}

class FakeClock implements Clock {
  now(): Date {
    return new Date("2026-05-11T12:00:00.000Z");
  }

  nowIso(): string {
    return "2026-05-11T12:00:00.000Z";
  }

  nowMillis(): number {
    return 1_778_499_200_000;
  }
}

class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

function parseToolJson(result: CallToolResult): any {
  const content = result.content[0];
  if (content?.type !== "text") {
    throw new Error("expected text result");
  }
  return JSON.parse(content.text);
}

function createToolFixture(
  claude = new FakeClaude(),
  locks: LockProvider = new MemoryLockProvider()
): { runtime: RouterRuntime; dir: string; cleanup: () => void } {
  const dir = path.join(os.tmpdir(), `router-tools-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const clock = new FakeClock();
  const config = loadConfig({ cwd: dir });
  const db = RouterDatabase.open(config.storage.dbPath, clock);
  const runtime = new RouterRuntime(dir, config, db, claude, locks, clock, new NoopLogger());

  return {
    runtime,
    dir,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

async function prepareExtraArgsCluster(server: FakeServer): Promise<void> {
  await server.call("cluster_prepare", {
    project_id: "project",
    cluster_id: "router-ops",
    tool_profile_default: "bare",
    static_factsheet_policy: "allow",
    factsheet: {
      facts: [
        {
          id: "extra-args",
          claim: "extraArgs exists.",
          evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
        }
      ]
    }
  });
}

function clusterEventTypes(db: RouterDatabase, clusterId: string): string[] {
  const events = db.db
    .prepare("SELECT event_type FROM cluster_events WHERE cluster_id = ? ORDER BY id")
    .all(clusterId) as Array<{ event_type: string }>;
  return events.map((event) => event.event_type);
}

function configWithExtraArgs(options: { leadingLines?: string[]; prefixLine?: string; nearbyLine?: string } = {}): string {
  return [
    ...(options.leadingLines ?? []),
    options.prefixLine ?? "const stableHeader = 1;",
    "const stableHeaderTwo = 2;",
    "const stableHeaderThree = 3;",
    "const stableHeaderFour = 4;",
    "const stableHeaderFive = 5;",
    "const stableHeaderSix = 6;",
    "const stableHeaderSeven = 7;",
    "const stableHeaderEight = 8;",
    "const stableHeaderNine = 9;",
    "const stableHeaderTen = 10;",
    "export const extraArgs = [];",
    options.nearbyLine ?? "const nearSelector = 1;",
    "const stableFooterOne = 1;",
    "const stableFooterTwo = 2;",
    "const stableFooterThree = 3;",
    "const stableFooterFour = 4;",
    "const stableFooterFive = 5;",
    "const stableFooterSix = 6;"
  ].join("\n");
}

function configWithoutExtraArgs(): string {
  return configWithExtraArgs().replace("export const extraArgs = [];", "export const renamedArgs = [];");
}
