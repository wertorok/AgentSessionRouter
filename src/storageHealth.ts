import { accessSync, constants as fsConstants, existsSync, statSync } from "node:fs";
import type { RouterRuntime } from "./runtime.js";

export interface StorageHealth {
  ok: boolean;
  database: {
    path: string;
    exists: boolean;
    readable: boolean;
    writable: boolean;
    schema_ok: boolean;
    quick_check_ok: boolean;
    write_check_ok: boolean;
    errors: string[];
  };
  raw_logs: {
    path: string;
    exists: boolean;
    is_directory: boolean;
    readable: boolean;
    writable: boolean;
    errors: string[];
  };
}

export function buildStorageHealth(runtime: RouterRuntime): StorageHealth {
  const database = {
    path: runtime.config.storage.dbPath,
    exists: existsSync(runtime.config.storage.dbPath),
    readable: false,
    writable: false,
    schema_ok: false,
    quick_check_ok: false,
    write_check_ok: false,
    errors: [] as string[]
  };

  if (!database.exists) {
    database.errors.push("sqlite file does not exist at configured path");
  } else {
    database.readable = canAccessPath(runtime.config.storage.dbPath, fsConstants.R_OK);
    database.writable = canAccessPath(runtime.config.storage.dbPath, fsConstants.W_OK);
    if (!database.readable) {
      database.errors.push("sqlite file is not readable");
    }
    if (!database.writable) {
      database.errors.push("sqlite file is not writable");
    }
  }

  try {
    runtime.db.db.prepare("SELECT version, applied_at FROM schema_migrations LIMIT 1").get();
    database.schema_ok = true;
  } catch (error: unknown) {
    database.errors.push(`schema query failed: ${errorMessage(error)}`);
  }

  try {
    const row = runtime.db.db.prepare("PRAGMA quick_check").get() as Record<string, unknown> | undefined;
    const quickCheck = row ? Object.values(row)[0] : null;
    database.quick_check_ok = quickCheck === "ok";
    if (!database.quick_check_ok) {
      database.errors.push(`sqlite quick_check returned ${String(quickCheck ?? "no row")}`);
    }
  } catch (error: unknown) {
    database.errors.push(`sqlite quick_check failed: ${errorMessage(error)}`);
  }

  let transactionStarted = false;
  try {
    runtime.db.db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    runtime.db.db
      .prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?) ON CONFLICT(version) DO UPDATE SET applied_at = excluded.applied_at"
      )
      .run(-999_999, runtime.clock.nowIso());
    database.write_check_ok = true;
  } catch (error: unknown) {
    database.errors.push(`sqlite write check failed: ${errorMessage(error)}`);
  } finally {
    if (transactionStarted) {
      try {
        runtime.db.db.exec("ROLLBACK");
      } catch (error: unknown) {
        database.errors.push(`sqlite write check rollback failed: ${errorMessage(error)}`);
      }
    }
  }

  const rawLogs = {
    path: runtime.config.storage.rawLogsDir,
    exists: existsSync(runtime.config.storage.rawLogsDir),
    is_directory: false,
    readable: false,
    writable: false,
    errors: [] as string[]
  };
  if (!rawLogs.exists) {
    rawLogs.errors.push("raw logs directory does not exist at configured path");
  } else {
    try {
      rawLogs.is_directory = statSync(runtime.config.storage.rawLogsDir).isDirectory();
      if (!rawLogs.is_directory) {
        rawLogs.errors.push("raw logs path is not a directory");
      }
    } catch (error: unknown) {
      rawLogs.errors.push(`raw logs stat failed: ${errorMessage(error)}`);
    }
    rawLogs.readable = canAccessPath(runtime.config.storage.rawLogsDir, fsConstants.R_OK);
    rawLogs.writable = canAccessPath(runtime.config.storage.rawLogsDir, fsConstants.W_OK);
    if (!rawLogs.readable) {
      rawLogs.errors.push("raw logs directory is not readable");
    }
    if (!rawLogs.writable) {
      rawLogs.errors.push("raw logs directory is not writable");
    }
  }

  return {
    ok:
      database.exists &&
      database.readable &&
      database.writable &&
      database.schema_ok &&
      database.quick_check_ok &&
      database.write_check_ok &&
      rawLogs.exists &&
      rawLogs.is_directory &&
      rawLogs.readable &&
      rawLogs.writable,
    database,
    raw_logs: rawLogs
  };
}

export function storageHealthIssueSummary(storageHealth: StorageHealth): string {
  const issues = [
    ...storageHealth.database.errors.map((error) => `database: ${error}`),
    ...storageHealth.raw_logs.errors.map((error) => `raw_logs: ${error}`)
  ];
  return issues.length > 0 ? issues.slice(0, 3).join("; ") : "storage health check failed";
}

function canAccessPath(pathName: string, mode: number): boolean {
  try {
    accessSync(pathName, mode);
    return true;
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
