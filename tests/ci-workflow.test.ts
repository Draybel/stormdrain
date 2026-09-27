/**
 * The GitHub Actions workflow (.github/workflows/deploy.yml) can't run locally, so its contract is checked as
 * text (characters / tests verification pass): the triggers, the build → deploy chain with the Pages
 * permissions only where they're needed, the non-blocking e2e job, and actions pinned to major versions that
 * run on the current Node runtime (the Node 20 generation — checkout / setup-node v4, deploy-pages v4… — is
 * deprecated on GitHub's runners).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TEXT = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const LINES = TEXT.split('\n');

/** The lines of one job (from `  <name>:` to the next job). */
function job(name: string): string {
  const start = LINES.findIndex((l) => l === `  ${name}:`);
  expect(start, `job ${name}`).toBeGreaterThan(0);
  let end = start + 1;
  while (end < LINES.length && !/^ {2}[a-z][\w-]*:\s*$/.test(LINES[end]!) && !/^\S/.test(LINES[end]!)) end++;
  return LINES.slice(start, end).join('\n');
}

/** Oldest major of each action that runs on Node 24. */
const MIN_MAJOR: Record<string, number> = {
  'actions/checkout': 5,
  'actions/setup-node': 5,
  'actions/upload-pages-artifact': 4,
  'actions/deploy-pages': 5,
  'actions/upload-artifact': 6,
  'actions/configure-pages': 6,
};

describe('.github/workflows/deploy.yml', () => {
  it('is plain YAML indentation (spaces, no tabs, no CRLF) and runs on pushes to main', () => {
    expect(TEXT.includes('\t')).toBe(false);
    expect(TEXT.includes('\r')).toBe(false);
    expect(TEXT).toMatch(/^on:\n {2}push:\n {4}branches: \[main\]\n/m);
    expect(TEXT).toMatch(/^permissions:\n {2}contents: read\n/m);
  });

  it('every action is a known one, pinned to a current major version', () => {
    const uses = [...TEXT.matchAll(/uses:\s*([\w./-]+)@(\S+)/g)];
    expect(uses.length).toBeGreaterThanOrEqual(6);
    for (const [, name, ref] of uses) {
      expect(MIN_MAJOR[name!], `unknown action ${name}`).toBeDefined();
      const m = /^v(\d+)$/.exec(ref!);
      expect(m, `${name}@${ref}: pin a major tag`).not.toBeNull();
      expect(Number(m![1]), `${name}@${ref} runs on a deprecated Node`).toBeGreaterThanOrEqual(MIN_MAJOR[name!]!);
    }
  });

  it('build: lockfile install, typecheck, tests, build, the dist folder uploaded for Pages', () => {
    const build = job('build');
    const order = ['npm ci', 'npm run typecheck', 'npm test', 'npm run build', 'actions/upload-pages-artifact'];
    let at = -1;
    for (const step of order) {
      const i = build.indexOf(step);
      expect(i, step).toBeGreaterThan(at);
      at = i;
    }
    expect(build).toMatch(/path: dist\n/);
    // configure-pages calls the Pages API, which needs a pages permission this job doesn't have.
    expect(build).not.toMatch(/uses:\s*actions\/configure-pages/);
  });

  it('deploy: after the build, the only job with Pages rights, into the github-pages environment', () => {
    const deploy = job('deploy');
    expect(deploy).toMatch(/needs: build\n/);
    expect(deploy).toMatch(/pages: write\n/);
    expect(deploy).toMatch(/id-token: write\n/);
    expect(deploy).toMatch(/name: github-pages\n/);
    expect(deploy).toMatch(/uses: actions\/deploy-pages@/);
    expect(job('build').includes('pages: write')).toBe(false);
    expect(job('e2e').includes('pages: write')).toBe(false);
  });

  it('e2e: WebKit with its system libraries, never blocking a deploy, traces kept on failure', () => {
    const e2e = job('e2e');
    expect(e2e).toMatch(/continue-on-error: true\n/);
    expect(e2e).toMatch(/npx playwright install --with-deps webkit\n/);
    expect(e2e).toMatch(/npm run test:e2e\n/);
    expect(e2e).toMatch(/if: failure\(\)\n/);
    expect(e2e.includes('needs:')).toBe(false);
    const config = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8');
    expect(config).toMatch(/trace: process\.env\.CI \? 'retain-on-failure'/);
  });
});

describe('README.md (the beginner guide) matches the workflow and the scripts', () => {
  const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };

  it('is LF-only and names the workflow, its jobs, the branch and the one-time Pages setting', () => {
    expect(README.includes('\r')).toBe(false);
    const name = /^name: (.+)$/m.exec(TEXT)![1]!;
    expect(README).toContain(`**${name}**`);
    for (const j of ['build', 'deploy', 'e2e']) {
      const jobName = /^ {4}name: (.+)$/m.exec(job(j))![1]!;
      expect(README, j).toContain(jobName);
    }
    // The workflow runs on pushes to main, so the guide makes the branch main.
    expect(TEXT).toMatch(/branches: \[main\]/);
    expect(README).toContain('git branch -M main');
    expect(README).toContain('git push -u origin main');
    expect(README).toContain('Source** to **GitHub Actions**');
    // Node: the build uses the current LTS.
    expect(TEXT).toMatch(/node-version: lts\/\*/);
    expect(README).toMatch(/current LTS/);
  });

  it('every npm command it mentions exists (and the e2e browser install matches the workflow)', () => {
    const runs = [...README.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]!);
    expect(runs.length).toBeGreaterThanOrEqual(4);
    for (const r of runs) expect(PKG.scripts[r], `npm run ${r}`).toBeDefined();
    expect(README).toContain('npm ci');
    expect(README).toContain('npm test');
    expect(PKG.scripts.test).toBeDefined();
    expect(README).toContain('npx playwright install webkit');
  });

  it('warns that Safari and the home-screen app keep separate saves, with the Settings export / import labels', () => {
    expect(README).toMatch(/SEPARATE saves/);
    const panel = readFileSync(new URL('../src/ui/settingsPanel.ts', import.meta.url), 'utf8');
    for (const label of ['EXPORT SAVE', 'IMPORT SAVE']) {
      expect(panel).toContain(`'${label}'`);
      expect(README).toContain(label);
    }
    expect(README).toMatch(/7 days/);
  });
});
