import { copyFile, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

// Publish only dist/client. The backend and Playwright worker stay on Supabase/GitHub.
const root = resolve("dist/client");
const shell = resolve(root, "_shell.html");
const html = await readFile(shell, "utf8");
if (!html.includes("<html") || !html.includes("<script")) {
  throw new Error("The SPA shell is missing HTML or JavaScript. Run the Vite build first.");
}
if (html.includes("/aplica-career-path/assets/")) {
  throw new Error("Cloudflare Pages needs a root build. Use bun run build:pages.");
}
await copyFile(shell, resolve(root, "index.html"));
// Cloudflare's native SPA fallback is enabled only without a top-level 404.html.
await rm(resolve(root, "404.html"), { force: true });
console.log("Cloudflare Pages ready: dist/client/index.html with native SPA fallback.");
