import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { collectTokenUsageToFileFromOutputs } from "../src/lib/tokscale-collector";

const DEFAULT_SINCE = "1970-01-01";

interface CliArgs {
  since: string;
  until: string;
  out: string;
  timezone: string;
}

const args = parseArgs(process.argv.slice(2));
const graphCommand = ["tokscale", "graph", "--since", args.since, "--until", args.until, "--no-spinner"];
const aggregateCommand = ["tokscale", "--json", "--no-spinner", "--since", args.since, "--until", args.until];

try {
  const graphOutput = runNpx(graphCommand);
  const aggregateOutput = runNpx(aggregateCommand);
  const dataset = collectTokenUsageToFileFromOutputs({
    graphOutput,
    aggregateOutput,
    outPath: resolve(process.cwd(), args.out),
    start: args.since,
    end: args.until,
    timezone: args.timezone,
    sourceCommand: `${graphCommand.join(" ")} && ${aggregateCommand.join(" ")}`
  });

  console.log(`Collected ${dataset.totals.totalTokens} public tokens into ${args.out}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

function runNpx(command: string[]): string {
  const [packageName, ...packageArgs] = command;
  return execFileSync("npx", [packageName, ...packageArgs], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function parseArgs(rawArgs: string[]): CliArgs {
  const today = new Date();
  const until = toDate(today);

  const parsed: CliArgs = {
    since: DEFAULT_SINCE,
    until,
    out: "data/token-usage.json",
    timezone: "Etc/UTC"
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    const next = rawArgs[index + 1];
    if (arg === "--since" && next) {
      parsed.since = next;
      index += 1;
    } else if (arg === "--until" && next) {
      parsed.until = next;
      index += 1;
    } else if (arg === "--out" && next) {
      parsed.out = next;
      index += 1;
    } else if (arg === "--timezone" && next) {
      parsed.timezone = next;
      index += 1;
    }
  }

  return parsed;
}

function toDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
