import { isoHoursAgo } from "./clock.js";
import { buildArchitecturalMemoryTelemetry } from "./architecturalMemoryMonitor.js";
import { SESSION_STATUSES } from "./constants.js";
import type {
  ClusterEventCount,
  ClusterReprepareCoverageDrop,
  ConsultComparisonMonitorStats,
  EventCount,
  RouteDecisionCount,
  RouteDecisionScoreRow,
  ShadowEvalHealth,
  SessionMetadataAffectedSession,
  SlowSessionEventCount,
  SlowSessionEventSample,
  StaleClusterView,
  StatusCount
} from "./db.js";
import { round2 } from "./routeDecision.js";
import type { RouterRuntime } from "./runtime.js";
import { buildStorageHealth, storageHealthIssueSummary, type StorageHealth } from "./storageHealth.js";

const SLOW_SESSION_TOKEN_BLOAT_THRESHOLD = 50_000;
const ROUTER_MONITOR_SAMPLE_LIMIT_CAP = 30;
const ESTIMATED_CLUSTER_FALLBACK_EXTRA_COST_USD = 0.05;

export function buildRouterStatusPayload(
  runtime: RouterRuntime,
  projectId: string,
  recentHours: number,
  warningsLimit: number
): object {
  const sinceIso = isoHoursAgo(runtime.clock, recentHours);
  const fallbackCountLast24h = runtime.db.getClusterFallbackCount(projectId, isoHoursAgo(runtime.clock, 24));
  const architecturalMemory = buildArchitecturalMemoryTelemetry(runtime.cwd, runtime.db, projectId);
  const storageHealth = buildStorageHealth(runtime);
  const staleClusters = runtime.db.listStaleClusters(projectId, warningsLimit);
  const sessionErrors = runtime.db.getRecentSessionErrorCounts(projectId, sinceIso);
  const slowSessionEvents = runtime.db.getRecentSlowSessionEvents(
    projectId,
    sinceIso,
    slowSessionThresholdMs(runtime.config.claude.commandTimeoutMs)
  );
  const clusterAttention = runtime.db.getRecentClusterAttentionCounts(projectId, sinceIso);
  const shadowEval = runtime.db.getShadowEvalHealth(projectId);
  const sessionCounts = countMap(runtime.db.getSessionStatusCounts(projectId), SESSION_STATUSES);
  const clusterCounts = countMap(runtime.db.getClusterStatusCounts(projectId), [
    "active",
    "stale",
    "needs_prepare",
    "invalidated",
    "archived"
  ]);
  const warnings = buildStatusWarnings({
    degradedMode: runtime.degradedMode,
    degradedReason: runtime.degradedReason,
    staleClusters,
    sessionErrors,
    slowSessionEvents,
    clusterAttention,
    shadowEval,
    shadowEnabled: runtime.config.eval.shadowMode,
    storageHealth,
    limit: warningsLimit
  });

  return {
    project_id: projectId,
    checked_at: runtime.clock.nowIso(),
    mode: runtime.degradedMode ? "degraded" : "normal",
    degraded_reason: runtime.degradedReason ?? null,
    uptime_hours: round2((runtime.clock.nowMillis() - new Date(runtime.startedAt).getTime()) / 3_600_000),
    claude: {
      detected_version: runtime.detectedClaudeVersion ?? null,
      tested_versions: runtime.testedClaudeVersions
    },
    v1_sessions: {
      ...sessionCounts,
      total: sumCounts(sessionCounts)
    },
    v2_clusters: {
      ...clusterCounts,
      total: sumCounts(clusterCounts),
      fallback_count_last_24h: fallbackCountLast24h,
      stale_clusters: staleClusters
    },
    recent_window_hours: recentHours,
    recent_errors: {
      session_events: sessionErrors,
      slow_session_events: slowSessionEvents,
      cluster_events: clusterAttention
    },
    shadow_eval: {
      enabled: runtime.config.eval.shadowMode,
      ...shadowEval
    },
    architectural_memory: architecturalMemory,
    storage: storageHealth,
    warnings
  };
}

export function buildRouterMonitorPayload(
  runtime: RouterRuntime,
  projectId: string,
  recentHours: number,
  requestedSampleLimit: number
): object {
  const sinceIso = isoHoursAgo(runtime.clock, recentHours);
  const sampleLimit = Math.min(requestedSampleLimit, ROUTER_MONITOR_SAMPLE_LIMIT_CAP);
  const staleClusters = runtime.db.listStaleClusters(projectId, sampleLimit);
  const sessionErrors = runtime.db.getRecentSessionErrorCounts(projectId, sinceIso);
  const slowSessionEvents = runtime.db.getRecentSlowSessionEvents(
    projectId,
    sinceIso,
    slowSessionThresholdMs(runtime.config.claude.commandTimeoutMs)
  );
  const slowSessionSamples = runtime.db.listRecentSlowSessionEventSamples(
    projectId,
    sinceIso,
    slowSessionThresholdMs(runtime.config.claude.commandTimeoutMs),
    sampleLimit
  );
  const metadataEventCounts = runtime.db.getRecentSessionMetadataEventCounts(projectId, sinceIso);
  const metadataAffectedSessions = runtime.db.listRecentSessionMetadataAffectedSessions(projectId, sinceIso, sampleLimit);
  const metadataSamples = runtime.db.listRecentSessionMetadataEventSamples(projectId, sinceIso, sampleLimit);
  const routeDecisionCounts = runtime.db.getRecentRouteDecisionCounts(projectId, sinceIso);
  const routeDecisionScores = runtime.db.listRecentRouteDecisionScores(projectId, sinceIso);
  const routeDecisionSamples = runtime.db.listRecentRouteDecisionSamples(projectId, sinceIso, sampleLimit);
  const forcedNewDueToAmbiguityCount = runtime.db.getForcedNewDueToAmbiguityCount(
    projectId,
    isoHoursAgo(runtime.clock, 24)
  );
  const architecturalMemory = buildArchitecturalMemoryTelemetry(runtime.cwd, runtime.db, projectId);
  const storageHealth = buildStorageHealth(runtime);
  const clusterAttention = runtime.db.getRecentClusterAttentionCounts(projectId, sinceIso);
  const clusterAttentionByCluster = runtime.db.getRecentClusterAttentionCountsByCluster(projectId, sinceIso);
  const decayedClusterCostSignals = buildDecayedClusterCostSignals(
    staleClusters,
    clusterAttentionByCluster,
    recentHours
  );
  const reprepareCoverageDrops = runtime.db.listRecentClusterReprepareCoverageDrops(projectId, sinceIso, sampleLimit);
  const shadowEval = runtime.db.getShadowEvalHealth(projectId);
  const activeClusterIds = new Set(runtime.db.listClusters(projectId, false).map((cluster) => cluster.id));
  const comparisonStats = runtime.db
    .getConsultComparisonMonitorStats(projectId, sinceIso)
    .filter((stats) => !stats.cluster_id || activeClusterIds.has(stats.cluster_id));
  const directWins = runtime.db
    .listConsultComparisons({
      projectId,
      preferred: "direct",
      limit: sampleLimit * 10
    })
    .filter(
      (comparison) =>
        comparison.created_at >= sinceIso && (!comparison.cluster_id || activeClusterIds.has(comparison.cluster_id))
    )
    .map((comparison) => ({
      id: comparison.id,
      cluster_id: comparison.cluster_id,
      question: comparison.question,
      cluster_score: comparison.cluster_score,
      direct_score: comparison.direct_score,
      judge_reasoning: comparison.judge_reasoning,
      created_at: comparison.created_at
    }))
    .slice(0, sampleLimit);
  const notInContextSamples = runtime.db
    .listConsultComparisons({
      projectId,
      limit: sampleLimit * 10
    })
    .filter(
      (comparison) =>
        comparison.created_at >= sinceIso &&
        comparison.cluster_was_not_in_context === 1 &&
        (comparison.judged_at === null || (comparison.cluster_score ?? 0) <= 1) &&
        (!comparison.cluster_id || activeClusterIds.has(comparison.cluster_id))
    )
    .map((comparison) => ({
      id: comparison.id,
      cluster_id: comparison.cluster_id,
      question: comparison.question,
      preferred: comparison.preferred,
      created_at: comparison.created_at
    }))
    .slice(0, sampleLimit);
  const sessionCounts = countMap(runtime.db.getSessionStatusCounts(projectId), SESSION_STATUSES);
  const clusterCounts = countMap(runtime.db.getClusterStatusCounts(projectId), [
    "active",
    "stale",
    "needs_prepare",
    "invalidated",
    "archived"
  ]);
  const autoRoutingCandidates = buildAutoRoutingCandidates(comparisonStats, clusterAttentionByCluster, staleClusters);
  const recommendations = buildMonitorRecommendations({
    degradedMode: runtime.degradedMode,
    degradedReason: runtime.degradedReason,
    shadowEnabled: runtime.config.eval.shadowMode,
    shadowEval,
    staleClusters,
    sessionErrors,
    metadataEventCounts,
    metadataAffectedSessions,
    routeDecisionCounts,
    slowSessionEvents,
    slowSessionSamples,
    clusterAttentionByCluster,
    reprepareCoverageDrops,
    comparisonStats,
    autoRoutingCandidates,
    storageHealth
  });

  return {
    project_id: projectId,
    checked_at: runtime.clock.nowIso(),
    recent_window_hours: recentHours,
    output_limits: {
      requested_sample_limit: requestedSampleLimit,
      effective_sample_limit: sampleLimit,
      truncated: requestedSampleLimit > sampleLimit
    },
    health: {
      mode: runtime.degradedMode ? "degraded" : "normal",
      degraded_reason: runtime.degradedReason ?? null,
      claude: {
        detected_version: runtime.detectedClaudeVersion ?? null,
        tested_versions: runtime.testedClaudeVersions
      },
      v1_sessions: {
        ...sessionCounts,
        total: sumCounts(sessionCounts)
      },
      v2_clusters: {
        ...clusterCounts,
        total: sumCounts(clusterCounts),
        fallback_count_last_24h: runtime.db.getClusterFallbackCount(projectId, isoHoursAgo(runtime.clock, 24))
      },
      shadow_eval: {
        enabled: runtime.config.eval.shadowMode,
        ...shadowEval
      },
      architectural_memory: architecturalMemory,
      storage: storageHealth
    },
    cache_health: {
      stale_or_needs_prepare: staleClusters,
      decayed_cluster_cost_signals: decayedClusterCostSignals,
      reprepare_coverage_drops: reprepareCoverageDrops,
      attention_by_event: clusterAttention,
      attention_by_cluster: clusterAttentionByCluster
    },
    latency: {
      slow_session_threshold_ms: slowSessionThresholdMs(runtime.config.claude.commandTimeoutMs),
      slow_session_events: slowSessionEvents,
      slow_session_samples: slowSessionSamples
    },
    metadata_health: {
      event_counts: metadataEventCounts,
      affected_sessions: metadataAffectedSessions,
      samples: metadataSamples
    },
    route_health: {
      decision_counts: routeDecisionCounts,
      forced_new_due_to_ambiguity_count_last_24h: forcedNewDueToAmbiguityCount,
      score_histogram_by_selected_path: buildRouteScoreHistogramBySelectedPath(routeDecisionScores),
      score_histogram_by_cluster: buildRouteScoreHistogramByCluster(routeDecisionScores),
      metadata_quality: buildRouteMetadataQualitySummary(routeDecisionScores),
      samples: routeDecisionSamples
    },
    quality: {
      cluster_stats: comparisonStats,
      direct_win_samples: directWins,
      not_in_context_samples: notInContextSamples,
      auto_routing_candidates: autoRoutingCandidates
    },
    recommendations,
    next_directions: buildMonitorNextDirections(
      comparisonStats,
      clusterAttentionByCluster,
      staleClusters,
      shadowEval,
      reprepareCoverageDrops,
      storageHealth
    )
  };
}

function countMap(rows: StatusCount[], keys: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of keys) {
    counts[key] = 0;
  }
  for (const row of rows) {
    counts[row.status] = row.count;
  }
  return counts;
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function buildRouteScoreHistogramBySelectedPath(rows: RouteDecisionScoreRow[]): Array<{
  selected_path: string;
  buckets: Array<{ bucket: string; count: number }>;
}> {
  const groups = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const selectedPath = row.selected_path ?? "unknown";
    const buckets = groups.get(selectedPath) ?? new Map<string, number>();
    const bucket = routeScoreBucket(row.match_score);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    groups.set(selectedPath, buckets);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([selected_path, buckets]) => ({
      selected_path,
      buckets: serializeBucketMap(buckets)
    }));
}

function buildRouteScoreHistogramByCluster(rows: RouteDecisionScoreRow[]): Array<{
  cluster_id: string;
  buckets: Array<{ bucket: string; count: number }>;
}> {
  const groups = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const clusterId = extractRouteClusterId(row.match_reason);
    if (!clusterId) {
      continue;
    }
    const buckets = groups.get(clusterId) ?? new Map<string, number>();
    const bucket = routeScoreBucket(row.match_score);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    groups.set(clusterId, buckets);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cluster_id, buckets]) => ({
      cluster_id,
      buckets: serializeBucketMap(buckets)
    }));
}

function routeScoreBucket(score: number | null): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return "unknown";
  }
  if (score >= 1) {
    return "1.00";
  }
  if (score >= 0.7) {
    return "0.70-0.99";
  }
  if (score >= 0.55) {
    return "0.55-0.69";
  }
  return "0.00-0.54";
}

function serializeBucketMap(bucketMap: Map<string, number>): Array<{ bucket: string; count: number }> {
  const order = ["1.00", "0.70-0.99", "0.55-0.69", "0.00-0.54", "unknown"];
  return [...bucketMap.entries()]
    .sort(([left], [right]) => order.indexOf(left) - order.indexOf(right))
    .map(([bucket, count]) => ({ bucket, count }));
}

function extractRouteClusterId(matchReason: string | null): string | null {
  const match = matchReason?.match(/(?:^|; )cluster_id=([^;]+)/);
  return match?.[1] ?? null;
}

function buildRouteMetadataQualitySummary(rows: RouteDecisionScoreRow[]): {
  total: number;
  known: number;
  unknown_schema_count: number;
  average_score: number | null;
  full_metadata_count: number;
  missing_topic_hint_count: number;
  missing_related_files_count: number;
  missing_tags_count: number;
  missing_task_type_count: number;
  generic_tags_count: number;
  score_buckets: Array<{ bucket: string; count: number }>;
} {
  const buckets = new Map<string, number>();
  let known = 0;
  let totalScore = 0;
  let fullMetadataCount = 0;
  let missingTopicHintCount = 0;
  let missingRelatedFilesCount = 0;
  let missingTagsCount = 0;
  let missingTaskTypeCount = 0;
  let genericTagsCount = 0;

  for (const row of rows) {
    const fields = extractRouteMetadataFields(row.match_reason);
    if (fields.metadata_score === null) {
      continue;
    }
    known += 1;
    totalScore += fields.metadata_score;
    const bucket = routeMetadataScoreBucket(fields.metadata_score);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    if (fields.metadata_score >= 1) {
      fullMetadataCount += 1;
    }
    if (fields.metadata_missing.includes("topic_hint")) {
      missingTopicHintCount += 1;
    }
    if (fields.metadata_missing.includes("related_files")) {
      missingRelatedFilesCount += 1;
    }
    if (fields.metadata_missing.includes("tags")) {
      missingTagsCount += 1;
    }
    if (fields.metadata_missing.includes("task_type")) {
      missingTaskTypeCount += 1;
    }
    genericTagsCount += fields.generic_tags_count;
  }

  return {
    total: rows.length,
    known,
    unknown_schema_count: rows.length - known,
    average_score: known > 0 ? round2(totalScore / known) : null,
    full_metadata_count: fullMetadataCount,
    missing_topic_hint_count: missingTopicHintCount,
    missing_related_files_count: missingRelatedFilesCount,
    missing_tags_count: missingTagsCount,
    missing_task_type_count: missingTaskTypeCount,
    generic_tags_count: genericTagsCount,
    score_buckets: serializeMetadataBucketMap(buckets)
  };
}

function extractRouteMetadataFields(matchReason: string | null): {
  metadata_score: number | null;
  metadata_missing: string[];
  generic_tags_count: number;
} {
  const metadataScoreMatch = matchReason?.match(/(?:^|; )metadata_score=([^;]+)/);
  const missingMatch = matchReason?.match(/(?:^|; )metadata_missing=([^;]+)/);
  const genericTagsMatch = matchReason?.match(/(?:^|; )generic_tags_count=([^;]+)/);
  return {
    metadata_score: metadataScoreMatch ? Number(metadataScoreMatch[1]) : null,
    metadata_missing:
      missingMatch && missingMatch[1] !== "none" ? missingMatch[1].split(",").map((item) => item.trim()).filter(Boolean) : [],
    generic_tags_count: genericTagsMatch ? Number(genericTagsMatch[1]) : 0
  };
}

function routeMetadataScoreBucket(score: number): string {
  if (score >= 1) {
    return "1.00";
  }
  if (score >= 0.7) {
    return "0.70-0.99";
  }
  if (score >= 0.35) {
    return "0.35-0.69";
  }
  return "0.00-0.34";
}

function serializeMetadataBucketMap(bucketMap: Map<string, number>): Array<{ bucket: string; count: number }> {
  const order = ["1.00", "0.70-0.99", "0.35-0.69", "0.00-0.34"];
  return [...bucketMap.entries()]
    .sort(([left], [right]) => order.indexOf(left) - order.indexOf(right))
    .map(([bucket, count]) => ({ bucket, count }));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function slowSessionThresholdMs(commandTimeoutMs: number): number {
  if (!Number.isFinite(commandTimeoutMs) || commandTimeoutMs <= 0) {
    return 100_000;
  }
  return Math.min(100_000, Math.max(30_000, Math.floor(commandTimeoutMs * 0.8)));
}

function buildStatusWarnings(input: {
  degradedMode: boolean;
  degradedReason?: string;
  staleClusters: StaleClusterView[];
  sessionErrors: EventCount[];
  slowSessionEvents: SlowSessionEventCount[];
  clusterAttention: EventCount[];
  shadowEval: ShadowEvalHealth;
  shadowEnabled: boolean;
  storageHealth: StorageHealth;
  limit: number;
}): string[] {
  const warnings: string[] = [];
  if (input.degradedMode) {
    warnings.push(`Router is degraded: ${input.degradedReason ?? "unknown reason"}`);
  }
  if (!input.storageHealth.ok) {
    warnings.push(`Storage health warning: ${storageHealthIssueSummary(input.storageHealth)}.`);
  }
  for (const cluster of input.staleClusters) {
    warnings.push(
      `Cluster '${cluster.id}' is stale; latest factsheet ${cluster.factsheet_id ?? "unknown"} version ${
        cluster.factsheet_version ?? "unknown"
      } needs refresh or re-prepare.`
    );
  }
  for (const event of input.clusterAttention) {
    warnings.push(`Cluster event '${event.event_type}' occurred ${event.count} time(s) in the recent window.`);
  }
  for (const event of input.sessionErrors) {
    warnings.push(`Session event '${event.event_type}' has ${event.count} error row(s) in the recent window.`);
  }
  for (const event of input.slowSessionEvents) {
    warnings.push(
      `Session event '${event.event_type}' exceeded the slow-call threshold ${event.count} time(s); max duration ${event.max_duration_ms ?? "unknown"}ms.`
    );
  }
  if (input.shadowEnabled) {
    const stalled = input.shadowEval.pending + input.shadowEval.ok_unjudged;
    const failed = input.shadowEval.failed_auth + input.shadowEval.failed_timeout + input.shadowEval.failed_other;
    if (stalled > 0) {
      warnings.push(`Shadow eval has ${stalled} unjudged comparison(s).`);
    }
    if (failed > 0) {
      warnings.push(`Shadow eval has ${failed} failed shadow comparison(s).`);
    }
  }
  return warnings.slice(0, input.limit);
}

function buildMonitorRecommendations(input: {
  degradedMode: boolean;
  degradedReason?: string;
  shadowEnabled: boolean;
  shadowEval: ShadowEvalHealth;
  staleClusters: StaleClusterView[];
  sessionErrors: EventCount[];
  metadataEventCounts: EventCount[];
  metadataAffectedSessions: SessionMetadataAffectedSession[];
  routeDecisionCounts: RouteDecisionCount[];
  slowSessionEvents: SlowSessionEventCount[];
  slowSessionSamples: SlowSessionEventSample[];
  clusterAttentionByCluster: ClusterEventCount[];
  reprepareCoverageDrops: ClusterReprepareCoverageDrop[];
  comparisonStats: ConsultComparisonMonitorStats[];
  autoRoutingCandidates: AutoRoutingCandidate[];
  storageHealth: StorageHealth;
}): Array<{ priority: "high" | "medium" | "low"; area: string; cluster_id?: string | null; action: string; reason: string }> {
  const recommendations: Array<{
    priority: "high" | "medium" | "low";
    area: string;
    cluster_id?: string | null;
    action: string;
    reason: string;
  }> = [];

  if (input.degradedMode) {
    recommendations.push({
      priority: "high",
      area: "infrastructure",
      action: "Fix Claude CLI compatibility/auth and run claude_router_reset.",
      reason: input.degradedReason ?? "Router is in degraded mode."
    });
  }

  if (!input.storageHealth.ok) {
    recommendations.push({
      priority: "high",
      area: "storage",
      action: "Fix SQLite/raw-log storage before trusting router telemetry or persistent memory.",
      reason: storageHealthIssueSummary(input.storageHealth)
    });
  }

  if (!input.shadowEnabled) {
    recommendations.push({
      priority: "medium",
      area: "monitoring",
      action: "Enable [eval].shadow_mode when you want real quality telemetry.",
      reason: "Shadow eval is disabled, so comparison quality data will not accumulate."
    });
  }

  const stalledShadow = input.shadowEval.pending + input.shadowEval.ok_unjudged;
  const failedShadow = input.shadowEval.failed_auth + input.shadowEval.failed_timeout + input.shadowEval.failed_other;
  if (stalledShadow > 0) {
    recommendations.push({
      priority: "medium",
      area: "monitoring",
      action: "Inspect comparison_list and shadow logs; judge or direct baseline may be stalled.",
      reason: `Shadow eval has ${stalledShadow} unjudged comparison(s).`
    });
  }
  if (failedShadow > 0) {
    recommendations.push({
      priority: "high",
      area: "monitoring",
      action: "Fix shadow direct baseline failures before trusting comparison coverage.",
      reason: `Shadow eval has ${failedShadow} failed comparison(s).`
    });
  }

  for (const cluster of input.staleClusters) {
    recommendations.push({
      priority: "high",
      area: "cache",
      cluster_id: cluster.id,
      action: "Run cluster_prepare or expand/rebuild this factsheet.",
      reason: `Cluster is ${cluster.status}; factsheet ${cluster.factsheet_id ?? "unknown"} cannot be trusted as current cache.`
    });
  }

  for (const drop of input.reprepareCoverageDrops) {
    recommendations.push({
      priority: drop.coverage_drop_percent >= 25 || drop.rejected_facts >= 3 ? "high" : "medium",
      area: "coverage",
      cluster_id: drop.cluster_id,
      action:
        "Run cluster_prepare with updated facts if the rejected facts are still part of the intended coverage; cluster_reprepare only rechecks existing facts.",
      reason:
        `cluster_reprepare retained ${drop.verified_facts}/${drop.source_fact_count} fact(s), ` +
        `rejected ${drop.rejected_facts}, coverage dropped ${drop.coverage_drop_percent}%.`
    });
  }

  for (const event of input.clusterAttentionByCluster) {
    if (event.event_type === "cluster_fallback_failed") {
      recommendations.push({
        priority: "high",
        area: "fallback",
        cluster_id: event.cluster_id,
        action: "Investigate Claude availability and fallback path immediately.",
        reason: `Fallback failed ${event.count} time(s) in the recent window.`
      });
    } else if (event.event_type === "cluster_fallback_to_claude_consult") {
      recommendations.push({
        priority: "medium",
        area: "cache",
        cluster_id: event.cluster_id,
        action: "Re-prepare or broaden this cluster if fallback is recurring.",
        reason: `Router fell back to claude_consult ${event.count} time(s), meaning cache could not serve those calls.`
      });
    } else if (event.event_type === "evidence_revalidation_failed") {
      recommendations.push({
        priority: "medium",
        area: "cache",
        cluster_id: event.cluster_id,
        action: "Refresh factsheet evidence; selectors or snippets changed.",
        reason: `Strict evidence revalidation failed ${event.count} time(s).`
      });
    } else if (event.event_type === "evidence_revalidation_suppressed") {
      recommendations.push({
        priority: "medium",
        area: "cache",
        cluster_id: event.cluster_id,
        action: "Re-prepare this cluster instead of repeatedly retrying strict revalidation.",
        reason: `Strict evidence revalidation was suppressed ${event.count} time(s) by the short failure cooldown.`
      });
    } else if (event.event_type === "cluster_fallback_coalesced") {
      recommendations.push({
        priority: "low",
        area: "cost",
        cluster_id: event.cluster_id,
        action: "Watch for repeated coalescing; it means burst traffic is hitting a decayed cluster.",
        reason: `Identical fallback calls were coalesced ${event.count} time(s), preventing duplicate Claude invocations.`
      });
    } else if (event.event_type === "tool_profile_downgraded" || event.event_type === "bare_probe_failed") {
      recommendations.push({
        priority: "low",
        area: "profiles",
        cluster_id: event.cluster_id,
        action: "Check bare-profile auth/support if latency or cost regresses.",
        reason: `${event.event_type} occurred ${event.count} time(s).`
      });
    }
  }

  for (const stats of input.comparisonStats) {
    if ((stats.direct_wins ?? 0) > 0 && (stats.gap ?? 0) >= 0.5) {
      recommendations.push({
        priority: "high",
        area: "quality",
        cluster_id: stats.cluster_id,
        action: "Inspect direct_win_samples, then expand or rebuild the cluster factsheet.",
        reason: `Direct baseline is beating cluster by ${stats.gap} points on average.`
      });
    } else if ((stats.direct_wins ?? 0) >= 2) {
      recommendations.push({
        priority: "medium",
        area: "quality",
        cluster_id: stats.cluster_id,
        action: "Inspect recurring direct wins and decide whether the cluster needs narrower scope, richer facts, or routing away from that question type.",
        reason: `Direct baseline won ${stats.direct_wins} judged comparison(s) in the recent window even though the average gap is small.`
      });
    } else if ((stats.not_in_context ?? 0) > 0) {
      recommendations.push({
        priority: "medium",
        area: "coverage",
        cluster_id: stats.cluster_id,
        action: "Inspect NOT IN CONTEXT samples and decide whether to expand factsheet or route those questions to claude_consult.",
        reason: `Cluster produced ${stats.not_in_context} NOT IN CONTEXT answer(s).`
      });
    }
  }

  for (const event of input.sessionErrors) {
    recommendations.push({
      priority: "medium",
      area: "sessions",
      action: "Inspect recent session_events and raw responses.",
      reason: `Session event '${event.event_type}' has ${event.count} error row(s).`
    });
  }

  const metadataThresholdCount =
    input.metadataEventCounts.find((event) => event.event_type === "parse_failed_threshold_exceeded")?.count ?? 0;
  const metadataParseFailedCount = input.metadataEventCounts.find((event) => event.event_type === "parse_failed")?.count ?? 0;

  if (metadataThresholdCount > 0) {
    recommendations.push({
      priority: "high",
      area: "metadata",
      action: "Inspect archived SESSION_UPDATE_JSON sessions and confirm replacements bootstrap from archived registry context.",
      reason: `${metadataThresholdCount} session(s) crossed parse-failure threshold in the recent window.`
    });
  } else if (metadataParseFailedCount > 0) {
    recommendations.push({
      priority: "medium",
      area: "metadata",
      action: "Inspect metadata_health.samples raw responses and tighten SESSION_UPDATE_JSON prompting if failures repeat.",
      reason: `${metadataParseFailedCount} SESSION_UPDATE_JSON parse failure(s) occurred in the recent window.`
    });
  }

  for (const session of input.metadataAffectedSessions) {
    if (session.threshold_exceeded_count <= 0) {
      continue;
    }
    recommendations.push({
      priority: "high",
      area: "metadata",
      action: "Review this archived session's raw response path and verify the replacement session kept registry context.",
      reason:
        `Session ${session.session_id ?? "unknown"} (${session.topic ?? "unknown topic"}) had ` +
        `${session.parse_failed_count} parse failure(s), ${session.threshold_exceeded_count} threshold event(s), ` +
        `status=${session.session_status ?? "unknown"}, latest raw=${session.latest_raw_response_path ?? "n/a"}.`
    });
  }

  const autoRouteCount = input.routeDecisionCounts.find((decision) => decision.selected_path === "claude_consult_auto")?.count ?? 0;
  if (autoRouteCount > 0) {
    recommendations.push({
      priority: "low",
      area: "routing",
      action: "Inspect route_health.samples for claude_consult_auto decisions; add explicit cluster_id/session_id or improve topic hints if these become slow.",
      reason: `${autoRouteCount} router_consult call(s) delegated to claude_consult auto-routing in the recent window.`
    });
  }

  const newSessionRouteCount =
    input.routeDecisionCounts.find((decision) => decision.selected_path === "claude_consult_new_session")?.count ?? 0;
  if (newSessionRouteCount > 0) {
    recommendations.push({
      priority: "low",
      area: "routing",
      action:
        "Inspect route_health.samples for claude_consult_new_session decisions; add aliases/tags/file evidence or pass an explicit session if these should have reused context.",
      reason: `${newSessionRouteCount} router_consult call(s) started a new durable session after automatic routing checks.`
    });
  }

  for (const event of input.slowSessionEvents) {
    recommendations.push({
      priority: "medium",
      area: "latency",
      action: "Prefer cluster_consult for covered questions, or inspect the raw Claude response when direct consults approach the caller timeout boundary.",
      reason: `Session event '${event.event_type}' exceeded the slow-call threshold ${event.count} time(s); max duration ${event.max_duration_ms ?? "unknown"}ms.`
    });
  }

  for (const sample of input.slowSessionSamples) {
    if ((sample.tokens_in ?? 0) < SLOW_SESSION_TOKEN_BLOAT_THRESHOLD) {
      continue;
    }
    recommendations.push({
      priority: "medium",
      area: "latency",
      action:
        "Treat this as direct-discovery/context bloat: reuse an existing session or a covered cluster before repeating a broad new_session consult.",
      reason:
        `Slow ${sample.event_type} used ${sample.tokens_in} input tokens over ${sample.duration_ms ?? "unknown"}ms` +
        ` for topic '${sample.topic ?? "unknown"}'. Raw response: ${sample.raw_response_path ?? "n/a"}.`
    });
  }

  for (const candidate of input.autoRoutingCandidates) {
    recommendations.push({
      priority: "low",
      area: "routing",
      cluster_id: candidate.cluster_id,
      action: "Keep explicit cluster_consult for now, but treat this cluster as a read-only candidate for future automatic routing suggestions.",
      reason: candidate.reason
    });
  }

  return recommendations.slice(0, 25);
}

interface AutoRoutingCandidate {
  cluster_id: string;
  judged: number;
  cluster_q: number | null;
  direct_q: number | null;
  gap: number | null;
  cluster_wins: number;
  ties: number;
  reason: string;
}

interface DecayedClusterCostSignal {
  cluster_id: string;
  status: string;
  factsheet_id: string | null;
  factsheet_version: number | null;
  fallback_count_recent_window: number;
  recent_window_hours: number;
  estimated_extra_cost_usd: number;
  estimate_basis: string;
}

function buildDecayedClusterCostSignals(
  staleClusters: StaleClusterView[],
  clusterAttentionByCluster: ClusterEventCount[],
  recentHours: number
): DecayedClusterCostSignal[] {
  const fallbackCounts = new Map<string, number>();
  for (const event of clusterAttentionByCluster) {
    if (event.event_type !== "cluster_fallback_to_claude_consult") {
      continue;
    }
    fallbackCounts.set(event.cluster_id, (fallbackCounts.get(event.cluster_id) ?? 0) + event.count);
  }

  return staleClusters.map((cluster) => {
    const fallbackCount = fallbackCounts.get(cluster.id) ?? 0;
    return {
      cluster_id: cluster.id,
      status: cluster.status,
      factsheet_id: cluster.factsheet_id,
      factsheet_version: cluster.factsheet_version,
      fallback_count_recent_window: fallbackCount,
      recent_window_hours: recentHours,
      estimated_extra_cost_usd: round4(fallbackCount * ESTIMATED_CLUSTER_FALLBACK_EXTRA_COST_USD),
      estimate_basis:
        "Heuristic: each cache fallback is estimated as about $0.05 extra versus a healthy cluster_consult, based on prior benchmark deltas. Use as a visible maintenance signal, not billing."
    };
  });
}

function buildAutoRoutingCandidates(
  comparisonStats: ConsultComparisonMonitorStats[],
  clusterAttentionByCluster: ClusterEventCount[],
  staleClusters: StaleClusterView[]
): AutoRoutingCandidate[] {
  const unhealthyClusters = new Set(staleClusters.map((cluster) => cluster.id));
  for (const event of clusterAttentionByCluster) {
    if (
      event.event_type === "cluster_fallback_to_claude_consult" ||
      event.event_type === "cluster_fallback_failed" ||
      event.event_type === "evidence_revalidation_failed"
    ) {
      unhealthyClusters.add(event.cluster_id);
    }
  }

  return comparisonStats
    .filter((stats) => {
      if (!stats.cluster_id || unhealthyClusters.has(stats.cluster_id)) {
        return false;
      }
      return (
        (stats.judged ?? 0) >= 3 &&
        (stats.failed_shadow ?? 0) === 0 &&
        (stats.direct_wins ?? 0) === 0 &&
        (stats.not_in_context ?? 0) === 0 &&
        (stats.gap ?? 1) <= 0
      );
    })
    .map((stats) => ({
      cluster_id: stats.cluster_id!,
      judged: stats.judged,
      cluster_q: stats.cluster_q,
      direct_q: stats.direct_q,
      gap: stats.gap,
      cluster_wins: stats.cluster_wins,
      ties: stats.ties,
      reason:
        `Cluster has ${stats.judged} judged comparison(s), ${stats.direct_wins} direct win(s), ` +
        `${stats.not_in_context} low-score NOT IN CONTEXT row(s), and average gap ${stats.gap}.`
    }));
}

function buildMonitorNextDirections(
  comparisonStats: ConsultComparisonMonitorStats[],
  clusterAttentionByCluster: ClusterEventCount[],
  staleClusters: StaleClusterView[],
  shadowEval: ShadowEvalHealth,
  reprepareCoverageDrops: ClusterReprepareCoverageDrop[] = [],
  storageHealth?: StorageHealth
): string[] {
  const directions: string[] = [];
  const hasQualityData = comparisonStats.some((stats) => stats.judged > 0);
  const strongClusters = comparisonStats.filter((stats) => (stats.judged ?? 0) >= 3 && (stats.gap ?? 1) <= 0);
  const weakClusters = comparisonStats.filter((stats) => (stats.direct_wins ?? 0) > 0 || (stats.not_in_context ?? 0) > 0);
  const fallbackClusters = new Set(
    clusterAttentionByCluster
      .filter((event) => event.event_type === "cluster_fallback_to_claude_consult" || event.event_type === "evidence_revalidation_failed")
      .map((event) => event.cluster_id)
  );

  if (!hasQualityData) {
    directions.push("Collect more shadow comparisons before deciding on auto-routing or factsheet expansion.");
  }
  if (storageHealth && !storageHealth.ok) {
    directions.push("Fix SQLite/raw-log storage before interpreting monitor trends or relying on persistent session memory.");
  }
  if (weakClusters.length > 0) {
    directions.push("Prioritize factsheet expansion or distillation for clusters where direct wins or NOT IN CONTEXT appears.");
  }
  if (strongClusters.length > 0 && fallbackClusters.size === 0 && staleClusters.length === 0) {
    directions.push("Clusters with stable quality and no fallback are candidates for future automatic cluster routing.");
  }
  if (fallbackClusters.size > 0 || staleClusters.length > 0) {
    directions.push("Re-prepare decayed clusters before using their data to judge routing quality.");
  }
  if (reprepareCoverageDrops.length > 0) {
    directions.push("Inspect reprepare coverage drops; use cluster_prepare, not cluster_reprepare, when semantic coverage must be restored.");
  }
  if (shadowEval.failed_auth + shadowEval.failed_timeout + shadowEval.failed_other > 0 || shadowEval.pending + shadowEval.ok_unjudged > 0) {
    directions.push("Stabilize the shadow pipeline before trusting long-term trend reports.");
  }
  if (comparisonStats.some((stats) => (stats.judged ?? 0) >= 10 && (stats.gap ?? 1) <= 0 && (stats.not_in_context ?? 0) === 0)) {
    directions.push("Fork baselines are still low priority unless monitor data shows latency/cost, not quality, is the bottleneck.");
  }

  return directions;
}
