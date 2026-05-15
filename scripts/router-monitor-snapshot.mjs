import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outPath = path.resolve(
  args.out ?? path.join(repoRoot, "experiments", "router-monitor-snapshots", `${timestamp}.json`)
);
const recentHours = Number(args.recent_hours ?? 24);
const sampleLimit = Number(args.sample_limit ?? 20);
const warningsLimit = Math.min(sampleLimit, 50);
const projectId = args.project_id === undefined ? null : args.project_id === "null" ? null : String(args.project_id);

if (!existsSync(serverEntry)) {
  fail(`Built server entry is missing at ${serverEntry}. Run npm run build first.`);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  cwd: repoRoot,
  stderr: "pipe"
});
const stderr = [];
transport.stderr?.on("data", (chunk) => stderr.push(String(chunk)));

const client = new Client({ name: "router-monitor-snapshot", version: "0.1.0" });

try {
  await client.connect(transport);
  const [status, monitor] = await Promise.all([
    callTool("router_status", {
      project_id: projectId,
      recent_hours: recentHours,
      warnings_limit: warningsLimit
    }),
    callTool("router_monitor", {
      project_id: projectId,
      recent_hours: recentHours,
      sample_limit: sampleLimit
    })
  ]);

  const payload = {
    captured_at: new Date().toISOString(),
    project_id: projectId,
    recent_hours: recentHours,
    sample_limit: sampleLimit,
    warnings_limit: warningsLimit,
    status,
    monitor,
    server_stderr: stderr.join("")
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, out: outPath }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await client.close();
}

async function callTool(name, input) {
  const result = await client.callTool({ name, arguments: input }, undefined, { timeout: 60_000 });
  const payload = parseToolPayload(result);
  if (result.isError || payload.error) {
    throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function parseToolPayload(result) {
  const text = result.content?.find((item) => item.type === "text")?.text;
  return text ? JSON.parse(text) : result;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }
    const key = item.slice(2).replaceAll("-", "_");
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
