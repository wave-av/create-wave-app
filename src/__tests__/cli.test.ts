import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DOTFILES, RUN_COMMAND, checkProjectName, helpText, run, type CliDeps } from '../cli';
import { TEMPLATES } from '../templates';

const templatesRoot = resolve(__dirname, '..', '..', 'templates');

let cwd: string;
let out: string[];
let err: string[];
let deps: CliDeps;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'create-wave-app-'));
  out = [];
  err = [];
  deps = { cwd, templatesRoot, log: (m) => out.push(m), error: (m) => err.push(m) };
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe('help text', () => {
  it('tells people to run the scoped package, never the unscoped create-wave-app', () => {
    const text = helpText();
    expect(text).toContain(`${RUN_COMMAND} <project-name>`);
    expect(RUN_COMMAND).toBe('npx @wave-av/create-app');
    expect(text).not.toMatch(/npx create-wave-app/);
  });

  it('lists every template', () => {
    for (const name of Object.keys(TEMPLATES)) expect(helpText()).toContain(name);
  });

  it('--help prints it and exits 0; no arguments exits 1', () => {
    expect(run(['--help'], deps)).toBe(0);
    expect(out.join('\n')).toContain(RUN_COMMAND);
    expect(run([], deps)).toBe(1);
    expect(err.join('\n')).toContain('Missing <project-name>');
  });
});

describe('arguments', () => {
  it.each(['..', '.', '../escape', '/abs/path', 'a/b', 'a\\b', '-flag-like', '_x', '.hidden', ''])(
    'refuses the project name %j',
    (name) => {
      expect(checkProjectName(name)).not.toBeNull();
    },
  );

  it('accepts ordinary names', () => {
    for (const name of ['my-stream-bot', 'MyApp', 'app.v2', 'a_b']) expect(checkProjectName(name)).toBeNull();
  });

  it('refuses an unknown template, including inherited object keys', () => {
    for (const template of ['nope', 'toString', 'constructor', '__proto__']) {
      expect(run(['app', '--template', template], deps)).toBe(1);
    }
    expect(err.every((m) => m.startsWith('Unknown template'))).toBe(true);
  });

  it('refuses unknown flags and extra positionals', () => {
    expect(run(['app', '--deploy'], deps)).toBe(1);
    expect(run(['app', 'extra'], deps)).toBe(1);
  });

  it('refuses an existing directory and writes nothing', () => {
    expect(run(['app'], deps)).toBe(0);
    const before = readFileSync(join(cwd, 'app', 'package.json'), 'utf8');
    expect(run(['app', '--template', 'webhook-handler'], deps)).toBe(1);
    expect(readFileSync(join(cwd, 'app', 'package.json'), 'utf8')).toBe(before);
  });
});

describe('scaffolding', () => {
  it.each(Object.keys(TEMPLATES))('creates a project from %s', (template) => {
    expect(run(['My-App', '--template', template], deps)).toBe(0);
    const dir = join(cwd, 'My-App');
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-app');
    expect(existsSync(join(dir, 'README.md'))).toBe(true);
    expect(existsSync(join(dir, '.gitignore'))).toBe(true);
    for (const shipped of Object.keys(DOTFILES)) expect(existsSync(join(dir, shipped))).toBe(false);
    const envExample = ['.env.example', '.env.local.example'].find((f) => existsSync(join(dir, f)));
    expect(envExample).toBeDefined();
    expect(out.join('\n')).toContain(`cp ${envExample}`);
  });

  it('uses stream-monitor by default', () => {
    expect(run(['bot'], deps)).toBe(0);
    expect(readFileSync(join(cwd, 'bot', 'src', 'agent.ts'), 'utf8')).toContain('StreamMonitorAgent');
  });
});
