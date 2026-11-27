// Comprueba la sintaxis de todos los .js/.cjs del proyecto (equivale al paso del CI).
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const skip = new Set(["node_modules", ".git", "_site"]);
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.c?js$/.test(entry.name)) files.push(full);
  }
})(root);

let failed = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) {
    failed++;
    console.error("FALLA " + path.relative(root, file) + "\n" + r.stderr);
  }
}
console.log(files.length - failed + "/" + files.length + " archivos con sintaxis válida");
process.exit(failed ? 1 : 0);
