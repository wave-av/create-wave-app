/**
 * Static checks on every template, so a template that cannot install, build or
 * start never ships again. (1.0.9 shipped a `start` script for a file the build
 * never wrote, an ADK subpath that was never exported, a `deploy` script for a
 * CLI command that did nothing, and three templates that did not parse.)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates';

const root = resolve(__dirname, '..', '..', 'templates');

/** Subpaths @wave-av/adk 1.1.0 exports. */
const ADK_EXPORTS = new Set([
  '@wave-av/adk',
  '@wave-av/adk/tools',
  '@wave-av/adk/agents',
  '@wave-av/adk/adapters',
  '@wave-av/adk/adapters/mastra',
  '@wave-av/adk/adapters/langgraph',
  '@wave-av/adk/adapters/livekit',
  '@wave-av/adk/adapters/kernel',
  '@wave-av/adk/templates',
  '@wave-av/adk/types',
]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe.each(Object.keys(TEMPLATES))('template %s', (template) => {
  const dir = join(root, template);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
  const sources = files(join(dir, 'src')).filter((f) => /\.(ts|tsx)$/.test(f));

  it('has a README, a gitignore and an env example', () => {
    const names = readdirSync(dir);
    expect(names).toContain('README.md');
    expect(names).toContain('gitignore');
    expect(names.some((n) => n === 'env.example' || n === 'env.local.example')).toBe(true);
  });

  it('has no deploy script and no script that calls the wave-adk CLI', () => {
    expect(pkg.scripts.deploy).toBeUndefined();
    expect(Object.values(pkg.scripts).join(' ')).not.toMatch(/wave-adk/);
  });

  it('starts the file its build writes', () => {
    const build: string | undefined = pkg.scripts.build;
    if (!build?.startsWith('tsup ')) return; // next / tsx templates run sources directly
    const entry = /tsup (src\/\S+)\.ts/.exec(build)?.[1];
    expect(entry).toBeDefined();
    // tsup --format esm in a "type": "module" package writes .js, not .mjs
    expect(pkg.type).toBe('module');
    expect(pkg.scripts.start).toMatch(new RegExp(`^node ${entry!.replace('src/', 'dist/')}\\.js( |$)`));
  });

  it('pins every dependency to a range, never "latest" or "*"', () => {
    for (const [name, range] of Object.entries(deps)) {
      expect(range, name).not.toMatch(/^(latest|\*|)$/);
    }
    if (deps['@wave-av/adk']) expect(deps['@wave-av/adk']).toBe('^1.1.0');
  });

  it('declares @types/node and typescript', () => {
    expect(deps['@types/node']).toBeDefined();
    expect(deps.typescript).toBeDefined();
  });

  it('imports only ADK subpaths the ADK exports, and every import is a dependency', () => {
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const [, spec] of text.matchAll(/from\s+'([^']+)'/g)) {
        if (spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('node:')) continue;
        if (spec.startsWith('@wave-av/adk')) expect(ADK_EXPORTS.has(spec), `${file}: ${spec}`).toBe(true);
        const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        expect(deps[pkgName], `${file} imports ${pkgName}`).toBeDefined();
      }
    }
  });

  it('has no shell-escaped "\\!" in its sources and no invented ADK calls', () => {
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toContain('\\!');
      expect(text, file).not.toMatch(/toolkit\.execute\(|wave_get_stream_health|wave_get_stream_metrics/);
    }
  });

  it('never tells people to run the unscoped create-wave-app', () => {
    for (const file of files(dir)) expect(readFileSync(file, 'utf8'), file).not.toMatch(/npx create-wave-app/);
  });
});
