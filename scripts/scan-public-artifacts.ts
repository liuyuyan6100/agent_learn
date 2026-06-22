import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const scanRoots = [".next/static", ".next/server/app"];
const publicExtensions = new Set([".css", ".html", ".js", ".json", ".rsc", ".txt"]);
const leakPatterns = [
  { label: "email", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { label: "api key", pattern: /\b(sk-[A-Za-z0-9_-]{12,}|OPENAI_API_KEY|ANTHROPIC_API_KEY|api[_-]?key\s*[=:])/i },
  { label: "local path", pattern: /(\/home\/|\/Users\/|[A-Z]:\\|\.config\/)/ },
  { label: "session path key", pattern: /["']sessionPath["']|["']workspacePath["']/ },
  { label: "raw prompt key", pattern: /["']rawPrompt["']/ },
  { label: "raw scrape key", pattern: /["']rawScrape["']|["']raw_scrape["']/ },
  { label: "private interview key", pattern: /["']privateInterviewDetail["']|["']private_interview_detail["']/ },
  { label: "cookie artifact", pattern: /document\.cookie|Set-Cookie:|["']cookie["']\s*:/i }
];

const files = scanRoots.flatMap((scanRoot) => collectPublicFiles(join(root, scanRoot)));
const leaks: string[] = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const leakPattern of leakPatterns) {
    if (leakPattern.pattern.test(content)) {
      leaks.push(`${relative(root, file)}: ${leakPattern.label}`);
    }
  }
}

if (leaks.length > 0) {
  throw new Error(`Public artifact privacy scan failed:\n${leaks.join("\n")}`);
}

console.log(`Scanned ${files.length} public build artifacts without privacy leaks.`);

function collectPublicFiles(path: string): string[] {
  if (!existsSync(path)) {
    return [];
  }

  const stats = statSync(path);
  if (stats.isFile()) {
    return publicExtensions.has(extension(path)) ? [path] : [];
  }

  return readdirSync(path).flatMap((entry) => collectPublicFiles(join(path, entry)));
}

function extension(path: string): string {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}
