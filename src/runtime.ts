import { mkdirSync } from "node:fs";
import type { ClaudeAdapter, HealthProbeResult } from "./claude.js";
import { CliClaudeAdapter } from "./claude.js";
import type { RouterConfig } from "./config.js";
import { loadConfig } from "./config.js";
import type { Clock } from "./clock.js";
import { systemClock } from "./clock.js";
import { ERROR_CODES } from "./constants.js";
import { RouterDatabase } from "./db.js";
import type { Logger } from "./logger.js";
import { logger as defaultLogger } from "./logger.js";
import { MemoryLockProvider, type LockProvider } from "./locks.js";

export interface RuntimeOptions {
  cwd?: string;
  configPath?: string;
  clock?: Clock;
  logger?: Logger;
  claude?: ClaudeAdapter;
  locks?: LockProvider;
}

export class RouterRuntime {
  degradedMode = false;
  detectedClaudeVersion: string | undefined;
  testedClaudeVersions: string[] = [];
  degradedReason: string | undefined;
  private maintenanceTimer: NodeJS.Timeout | null = null;

  constructor(
    readonly cwd: string,
    readonly config: RouterConfig,
    readonly db: RouterDatabase,
    readonly claude: ClaudeAdapter,
    readonly locks: LockProvider,
    readonly clock: Clock,
    readonly logger: Logger
  ) {}

  async boot(): Promise<void> {
    mkdirSync(this.config.storage.rawLogsDir, { recursive: true });
    this.startLifecycleMaintenance();
    const probe = await this.claude.healthProbe();
    this.applyHealthProbe(probe, "startup");
  }

  startLifecycleMaintenance(): void {
    this.db.applyLifecycle();
    if (this.maintenanceTimer) {
      return;
    }
    this.maintenanceTimer = setInterval(() => {
      this.db.applyLifecycle();
    }, 86_400_000);
    this.maintenanceTimer.unref();
  }

  applyHealthProbe(probe: HealthProbeResult, reason: string): void {
    this.detectedClaudeVersion = probe.detectedVersion;
    this.testedClaudeVersions = probe.testedVersions;

    if (probe.unknownVersion && probe.detectedVersion) {
      this.db.logEvent({
        projectId: "router",
        eventType: "unknown_claude_version",
        error: probe.detectedVersion
      });
      this.logger.warn("unknown_claude_version", {
        detected_version: probe.detectedVersion,
        tested_versions: probe.testedVersions
      });
    }

    if (probe.ok) {
      this.degradedMode = false;
      this.degradedReason = undefined;
      this.db.logEvent({
        projectId: "router",
        eventType: "health_probe_passed",
        error: reason
      });
      return;
    }

    this.degradedMode = true;
    this.degradedReason = probe.error ?? ERROR_CODES.CLAUDE_INCOMPATIBLE;
    this.db.logEvent({
      projectId: "router",
      eventType: "health_probe_failed",
      error: probe.error ?? ERROR_CODES.CLAUDE_INCOMPATIBLE
    });
    this.db.logEvent({
      projectId: "router",
      eventType: "degraded_mode_entered",
      error: probe.error ?? ERROR_CODES.CLAUDE_INCOMPATIBLE
    });
    this.logger.error("degraded_mode_entered", {
      reason,
      error: probe.error,
      detected_version: probe.detectedVersion,
      tested_versions: probe.testedVersions
    });
  }

  async resetRouter(reason: string): Promise<boolean> {
    const probe = await this.claude.healthProbe();
    this.applyHealthProbe(probe, reason);
    if (!probe.ok) {
      return false;
    }

    this.db.logEvent({
      projectId: "router",
      eventType: "router_reset",
      error: reason
    });
    return true;
  }
}

export async function createRuntime(options: RuntimeOptions = {}): Promise<RouterRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const clock = options.clock ?? systemClock;
  const log = options.logger ?? defaultLogger;
  const config = loadConfig({ cwd, configPath: options.configPath });
  const db = RouterDatabase.open(config.storage.dbPath, clock);
  const claude = options.claude ?? new CliClaudeAdapter(config);
  const locks = options.locks ?? new MemoryLockProvider();
  const runtime = new RouterRuntime(cwd, config, db, claude, locks, clock, log);
  await runtime.boot();
  return runtime;
}
