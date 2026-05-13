import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import * as toml from "@iarna/toml";
import { DEFAULT_CONFIG } from "./constants.js";

export interface RouterConfig {
  storage: {
    dbPath: string;
    rawLogsDir: string;
  };
  limits: {
    maxConsultsPerHour: number;
    maxConsultsPerDay: number;
    maxTokensPerConsult: number;
    tokenAnomalyRatio: number;
    tokenAnomalyMinDelta: number;
  };
  lifecycle: {
    defaultDormantAfterDays: number;
    defaultArchiveAfterDays: number;
  };
  matching: {
    useAliases: boolean;
    useEmbeddings: boolean;
    thresholdUse: number;
    thresholdLowConfidence: number;
  };
  claude: {
    command: string;
    outputFormat: string;
    extraArgs: string[];
    commandTimeoutMs: number;
    resumeFailureWindowMinutes: number;
    resumeFailureThreshold: number;
    compatibilityFile: string;
  };
  eval: {
    shadowMode: boolean;
  };
  cluster: {
    autoRefresh: boolean;
    autoRefreshMinRetainedRatio: number;
  };
  configDir: string;
}

export interface LoadConfigOptions {
  cwd: string;
  configPath?: string;
}

type TomlObject = Record<string, unknown>;

export function loadConfig(options: LoadConfigOptions): RouterConfig {
  const configPath = options.configPath
    ? path.resolve(options.cwd, options.configPath)
    : path.resolve(options.cwd, "router.config.toml");
  const configDir = existsSync(configPath) ? path.dirname(configPath) : options.cwd;
  const parsed = existsSync(configPath) ? parseToml(readFileSync(configPath, "utf8")) : {};

  const storage = objectAt(parsed, "storage");
  const limits = objectAt(parsed, "limits");
  const lifecycle = objectAt(parsed, "lifecycle");
  const matching = objectAt(parsed, "matching");
  const claude = objectAt(parsed, "claude");
  const evalConfig = objectAt(parsed, "eval");
  const cluster = objectAt(parsed, "cluster");

  return {
    storage: {
      dbPath: resolveFromConfigDir(configDir, stringAt(storage, "db_path", DEFAULT_CONFIG.storage.dbPath)),
      rawLogsDir: resolveFromConfigDir(
        configDir,
        stringAt(storage, "raw_logs_dir", DEFAULT_CONFIG.storage.rawLogsDir)
      )
    },
    limits: {
      maxConsultsPerHour: numberAt(limits, "max_consults_per_hour", DEFAULT_CONFIG.limits.maxConsultsPerHour),
      maxConsultsPerDay: numberAt(limits, "max_consults_per_day", DEFAULT_CONFIG.limits.maxConsultsPerDay),
      maxTokensPerConsult: numberAt(limits, "max_tokens_per_consult", DEFAULT_CONFIG.limits.maxTokensPerConsult),
      tokenAnomalyRatio: numberAt(limits, "token_anomaly_ratio", DEFAULT_CONFIG.limits.tokenAnomalyRatio),
      tokenAnomalyMinDelta: numberAt(limits, "token_anomaly_min_delta", DEFAULT_CONFIG.limits.tokenAnomalyMinDelta)
    },
    lifecycle: {
      defaultDormantAfterDays: numberAt(
        lifecycle,
        "default_dormant_after_days",
        DEFAULT_CONFIG.lifecycle.defaultDormantAfterDays
      ),
      defaultArchiveAfterDays: numberAt(
        lifecycle,
        "default_archive_after_days",
        DEFAULT_CONFIG.lifecycle.defaultArchiveAfterDays
      )
    },
    matching: {
      useAliases: booleanAt(matching, "use_aliases", DEFAULT_CONFIG.matching.useAliases),
      useEmbeddings: booleanAt(matching, "use_embeddings", DEFAULT_CONFIG.matching.useEmbeddings),
      thresholdUse: numberAt(matching, "threshold_use", DEFAULT_CONFIG.matching.thresholdUse),
      thresholdLowConfidence: numberAt(
        matching,
        "threshold_low_confidence",
        DEFAULT_CONFIG.matching.thresholdLowConfidence
      )
    },
    claude: {
      command: stringAt(claude, "command", DEFAULT_CONFIG.claude.command),
      outputFormat: stringAt(claude, "output_format", DEFAULT_CONFIG.claude.outputFormat),
      extraArgs: stringArrayAt(claude, "extra_args", DEFAULT_CONFIG.claude.extraArgs),
      commandTimeoutMs: numberAt(claude, "command_timeout_ms", DEFAULT_CONFIG.claude.commandTimeoutMs),
      resumeFailureWindowMinutes: numberAt(
        claude,
        "resume_failure_window_minutes",
        DEFAULT_CONFIG.claude.resumeFailureWindowMinutes
      ),
      resumeFailureThreshold: numberAt(
        claude,
        "resume_failure_threshold",
        DEFAULT_CONFIG.claude.resumeFailureThreshold
      ),
      compatibilityFile: resolveFromConfigDir(
        configDir,
        stringAt(claude, "compatibility_file", DEFAULT_CONFIG.claude.compatibilityFile)
      )
    },
    eval: {
      shadowMode: booleanAt(evalConfig, "shadow_mode", DEFAULT_CONFIG.eval.shadowMode)
    },
    cluster: {
      autoRefresh: booleanAt(cluster, "auto_refresh", DEFAULT_CONFIG.cluster.autoRefresh),
      autoRefreshMinRetainedRatio: numberAt(
        cluster,
        "auto_refresh_min_retained_ratio",
        DEFAULT_CONFIG.cluster.autoRefreshMinRetainedRatio
      )
    },
    configDir
  };
}

function parseToml(source: string): TomlObject {
  const parsed: unknown = toml.parse(source);
  if (!isObject(parsed)) {
    return {};
  }
  return parsed;
}

function resolveFromConfigDir(configDir: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(configDir, value);
}

function objectAt(source: TomlObject, key: string): TomlObject {
  const value = source[key];
  return isObject(value) ? value : {};
}

function stringAt(source: TomlObject, key: string, fallback: string): string {
  const value = source[key];
  return typeof value === "string" ? value : fallback;
}

function stringArrayAt(source: TomlObject, key: string, fallback: readonly string[]): string[] {
  const value = source[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return [...fallback];
  }
  return [...value] as string[];
}

function numberAt(source: TomlObject, key: string, fallback: number): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanAt(source: TomlObject, key: string, fallback: boolean): boolean {
  const value = source[key];
  return typeof value === "boolean" ? value : fallback;
}

function isObject(value: unknown): value is TomlObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
