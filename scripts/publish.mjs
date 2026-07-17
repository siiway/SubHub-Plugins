#!/usr/bin/env node
// 幂等发布脚本：逐个工作区包校验 npm 上是否已存在相同 name@version，
// 已存在则跳过该包，否则发布。全部跳过时仍以退出码 0 结束（CI 保持绿色）。
//
// 为兼容 changesets/action，对新发布的包会本地创建 git tag 并打印
// "New tag:  <name>@<version>"，由 action 负责推送 tag 与创建 GitHub Release。
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packagesDir = join(root, "packages");

/** npm 上是否已存在指定的 name@version */
function isPublished(name, version) {
  try {
    const out = execFileSync("npm", ["view", `${name}@${version}`, "version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out === version;
  } catch {
    // 包或该版本不存在时 npm view 以非 0 退出 → 视为未发布
    return false;
  }
}

/** 判断发布报错是否为“版本已存在”这类可安全跳过的冲突 */
function isAlreadyPublishedError(text) {
  return /cannot publish over|previously published versions|EPUBLISHCONFLICT/i.test(text);
}

const entries = readdirSync(packagesDir, { withFileTypes: true }).filter((d) =>
  d.isDirectory(),
);

let published = 0;
let skipped = 0;
let failed = 0;

for (const entry of entries) {
  const dir = join(packagesDir, entry.name);
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    continue; // 没有 package.json 的目录忽略
  }

  const { name, version, private: isPrivate } = pkg;
  if (isPrivate || !name || !version) continue;

  // 校验：已有相同版本的相同包 → 跳过
  if (isPublished(name, version)) {
    console.log(`🦋  info Skipping ${name}@${version} (already published on npm)`);
    skipped++;
    continue;
  }

  console.log(`🦋  info Publishing "${name}" at "${version}"`);
  try {
    const out = execFileSync("npm", ["publish", "--access", "public"], {
      cwd: dir,
      encoding: "utf8",
    });
    process.stdout.write(out);
  } catch (err) {
    const combined = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    if (combined) process.stdout.write(combined);
    // 兜底：若因版本已存在（如 npm view 传播延迟）而失败，同样跳过
    if (isAlreadyPublishedError(combined)) {
      console.log(
        `🦋  info Skipping ${name}@${version} (already published, detected on publish)`,
      );
      skipped++;
      continue;
    }
    console.error(`🦋  error failed to publish ${name}@${version}`);
    failed++;
    continue;
  }

  // 创建本地 tag 并按 changesets 输出格式打印，供 changesets/action 推送 tag / 建 Release
  const tag = `${name}@${version}`;
  try {
    execFileSync("git", ["tag", tag], { stdio: "ignore" });
  } catch {
    // tag 可能已存在，忽略
  }
  console.log(`🦋  info New tag:  ${tag}`);
  published++;
}

console.log(`🦋  done. published=${published} skipped=${skipped} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
