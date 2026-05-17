import { describe, expect, it } from "vitest";
import {
  ARCHITECTURAL_MEMORY_SERVING_LIMITS,
  buildArchitecturalMemorySeedManifest,
  parseArchitecturalMemoryMarkdown,
  selectArchitecturalMemorySeed,
  shouldInjectArchitecturalMemorySeed,
  type ArchitecturalMemoryRecord
} from "../src/architecturalMemoryServing.js";

describe("architectural memory serving preflight", () => {
  it("parses source-of-truth records and gates serving by active status", () => {
    const records = parseArchitecturalMemoryMarkdown(
      [
        "| id | status | active_date | field_review_status | statement | applies_when | revisit_when | counter_evidence | provenance |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        "| EP-ACTIVE | status: active | 2026-05-17 | APPROVED_FIELDS | Stale evidence must signal and fallback. | Apply to caches and evidence stores. | When fallback policy changes. | If evidence is fully revalidated, signal may stay internal. | docs:active |",
        "| EP-SUSPENDED | suspended |  | SUSPEND | Suspended stale memory should not serve. | Apply to memory. | When status changes. | Do not use while suspended. | docs:suspended |"
      ].join("\n"),
      "engineering-principles",
      "docs/ENGINEERING_PRINCIPLES.md"
    );

    const selection = selectArchitecturalMemorySeed(records, {
      session_kind: "lead",
      task_type: "architectural",
      topic_hint: "stale evidence fallback memory",
      tags: ["stale", "evidence"]
    });

    expect(records).toHaveLength(2);
    expect(selection.selected.map((item) => item.record.id)).toEqual(["EP-ACTIVE"]);
    expect(selection.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "EP-SUSPENDED",
          reason: "status:suspended"
        })
      ])
    );
  });

  it("selects a deterministic subset with zero LLM selection tokens and hard seed caps", () => {
    const records = Array.from({ length: 12 }, (_, index) =>
      makeRecord(`EP-${String(index + 1).padStart(2, "0")}`, {
        statement: `Router architectural memory principle ${index + 1} keeps evidence explicit and auditable.`,
        applies_when: "Apply to architectural router memory and evidence selection.",
        counter_evidence: "Do not apply when the record is outside the current architecture task."
      })
    );

    const selection = selectArchitecturalMemorySeed(records, {
      session_kind: "lead",
      task_type: "architectural",
      topic_hint: "router architectural memory evidence",
      tags: ["router", "memory", "evidence"]
    });

    expect(selection.selection_llm_input_tokens).toBe(0);
    expect(selection.per_consult_architectural_memory_tokens).toBe(0);
    expect(selection.selected.length).toBeLessThanOrEqual(ARCHITECTURAL_MEMORY_SERVING_LIMITS.maxEngineeringPrinciples);
    expect(selection.estimated_seed_tokens).toBeLessThanOrEqual(ARCHITECTURAL_MEMORY_SERVING_LIMITS.targetSeedTokens);
    expect(selection.budget.absolute_seed_tokens).toBe(1_200);
    expect(selection.selected.map((item) => item.record.id)).toEqual([
      "EP-01",
      "EP-02",
      "EP-03",
      "EP-04",
      "EP-05",
      "EP-06",
      "EP-07"
    ]);
  });

  it("keeps project architecture out of the global seed unless explicitly project scoped", () => {
    const projectRecord = makeRecord("PA-1", {
      memory_product: "project-architecture",
      statement: "AgentSessionRouter uses router_monitor before deciding what to fix.",
      applies_when: "Apply to this project only.",
      counter_evidence: "Do not apply to unrelated projects."
    });
    const request = {
      session_kind: "project_lead" as const,
      task_type: "architectural",
      topic_hint: "AgentSessionRouter router monitor",
      tags: ["router", "monitor"]
    };

    const globalSelection = selectArchitecturalMemorySeed([projectRecord], request);
    const projectSelection = selectArchitecturalMemorySeed([projectRecord], {
      ...request,
      project_scoped: true
    });

    expect(globalSelection.selected).toHaveLength(0);
    expect(globalSelection.skipped[0]).toMatchObject({
      id: "PA-1",
      reason: "project_architecture_not_in_global_seed"
    });
    expect(projectSelection.selected.map((item) => item.record.id)).toEqual(["PA-1"]);
    expect(projectSelection.estimated_seed_tokens).toBeLessThanOrEqual(
      ARCHITECTURAL_MEMORY_SERVING_LIMITS.projectScopedAddonTokens
    );
  });

  it("builds a seed manifest and skips reinjection when the signature is unchanged", () => {
    const records = [
      makeRecord("EP-A", {
        statement: "Evaluation telemetry must not alter caller-facing answers.",
        applies_when: "Apply to shadow evaluation.",
        counter_evidence: "Expose evaluation only when it is the requested product result."
      })
    ];
    const selection = selectArchitecturalMemorySeed(records, {
      session_kind: "lead",
      task_type: "architectural",
      topic_hint: "evaluation telemetry caller answers",
      tags: ["telemetry"]
    });
    const manifest = buildArchitecturalMemorySeedManifest(selection, [
      { path: "docs/ENGINEERING_PRINCIPLES.md", content: "source-v1" }
    ]);

    expect(manifest.record_ids).toEqual(["EP-A"]);
    expect(manifest.seed_signature).toMatch(/^sha256:/);
    expect(shouldInjectArchitecturalMemorySeed(null, manifest)).toMatchObject({
      should_inject: true,
      reason: "no_existing_manifest",
      delta_record_ids: ["EP-A"]
    });
    expect(shouldInjectArchitecturalMemorySeed(manifest, manifest)).toMatchObject({
      should_inject: false,
      reason: "same_seed_signature",
      delta_record_ids: []
    });
  });

  it("codifies the Gate 13 quality proof requirements", () => {
    expect(ARCHITECTURAL_MEMORY_SERVING_LIMITS.minPostServingContinuityRuns).toBe(3);
    expect(ARCHITECTURAL_MEMORY_SERVING_LIMITS.adversarialBrokenZeroSufficient).toBe(false);
    expect(ARCHITECTURAL_MEMORY_SERVING_LIMITS.runtimeImportServingEnabled).toBe(true);
  });
});

function makeRecord(id: string, overrides: Partial<ArchitecturalMemoryRecord> = {}): ArchitecturalMemoryRecord {
  return {
    id,
    memory_product: "engineering-principles",
    status: "active",
    statement: "Architectural memory should be selected as a compact seed.",
    applies_when: "Apply to durable lead sessions.",
    revisit_when: "When monitor evidence contradicts the principle.",
    counter_evidence: "Do not apply when the principle is outside task scope.",
    provenance: "docs:test",
    source_path: "docs/ENGINEERING_PRINCIPLES.md",
    ...overrides
  };
}
