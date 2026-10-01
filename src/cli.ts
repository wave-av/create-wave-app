/**
 * create-wave-app: copy a template into a new directory and name the package.
 *
 * Runs no shell and makes no network request. It only reads `templates/` and
 * writes the new project directory.
 */

import { cpSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_TEMPLATE, TEMPLATES, isTemplate } from './templates';

/** The only command customers should run. The unscoped `create-wave-app` on npm is not WAVE's. */
export const RUN_COMMAND = 'npx @wave-av/create-app';

/** A directory name: letters, digits, ".", "_", "-"; starts with a letter or digit; no separators. */
const DIR_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_NAME_LENGTH = 214; // npm's limit for a package name

/** Files a template ships without their leading dot, and the name each gets in the new project. */
export const DOTFILES: Readonly<Record<string, string>> = {
  gitignore: '.gitignore',
  'env.example': '.env.example',
  'env.local.example': '.env.local.example',
};

export interface CliDeps {
  readonly cwd: string;
  readonly templatesRoot: string;
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
}

export function helpText(): string {
  const width = Math.max(...Object.keys(TEMPLATES).map((name) => name.length));
  const rows = Object.entries(TEMPLATES)
    .map(([name, description]) => `    ${name.padEnd(width)}  ${description}`)
    .join('\n');
  return `
  create-wave-app: scaffold a new WAVE app

  Usage:
    ${RUN_COMMAND} <project-name> [--template <name>]

  Templates:
${rows}

  Examples:
    ${RUN_COMMAND} my-stream-bot
    ${RUN_COMMAND} my-agent --template mastra-agent
`;
}

/** Validate a project directory name. Returns an error message, or null when it is usable. */
export function checkProjectName(name: string): string | null {
  if (name.length > MAX_NAME_LENGTH) return `Project name is longer than ${MAX_NAME_LENGTH} characters.`;
  if (!DIR_NAME.test(name)) {
    return `Invalid project name "${name}": use letters, digits, ".", "_" or "-", start with a letter or digit, and no path separators.`;
  }
  return null;
}

export function run(argv: readonly string[], deps: CliDeps): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        template: { type: 'string', short: 't' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (err) {
    deps.error(`${(err as Error).message}\n${helpText()}`);
    return 1;
  }

  const { values, positionals } = parsed;
  if (values.help) {
    deps.log(helpText());
    return 0;
  }
  if (positionals.length === 0) {
    deps.error(`Missing <project-name>.\n${helpText()}`);
    return 1;
  }
  if (positionals.length > 1) {
    deps.error(`Expected one <project-name>, got ${positionals.length}: ${positionals.join(' ')}`);
    return 1;
  }

  const projectName = positionals[0];
  const nameError = checkProjectName(projectName);
  if (nameError) {
    deps.error(nameError);
    return 1;
  }

  const template = values.template ?? DEFAULT_TEMPLATE;
  if (!isTemplate(template)) {
    deps.error(`Unknown template "${template}". Available: ${Object.keys(TEMPLATES).join(', ')}`);
    return 1;
  }

  const templateDir = join(deps.templatesRoot, template);
  if (!existsSync(join(templateDir, 'package.json'))) {
    deps.error(`Template "${template}" is missing from this install (${templateDir}). Reinstall @wave-av/create-app.`);
    return 1;
  }

  const targetDir = resolve(deps.cwd, projectName);
  if (existsSync(targetDir)) {
    deps.error(`${targetDir} already exists. Pick another name or remove it first.`);
    return 1;
  }

  deps.log(`Creating ${projectName} from the ${template} template...`);
  cpSync(templateDir, targetDir, { recursive: true, errorOnExist: true, force: false });

  // npm never packs a file named .gitignore, so templates ship their dotfiles
  // without the dot and get their real names here.
  for (const [shipped, real] of Object.entries(DOTFILES)) {
    const from = join(targetDir, shipped);
    if (existsSync(from)) renameSync(from, join(targetDir, real));
  }

  const pkgPath = join(targetDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
  pkg.name = projectName.toLowerCase();
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const envExample = ['.env.example', '.env.local.example'].find((f) => existsSync(join(targetDir, f)));
  const steps = [
    `cd ${projectName}`,
    'npm install',
    ...(envExample ? [`cp ${envExample} ${envExample.replace(/\.example$/, '')}   # then fill in the values`] : []),
    'npm run dev',
  ];
  deps.log(`\n  Created ${projectName} at ${targetDir}\n\n  Next steps:\n${steps.map((s) => `    ${s}`).join('\n')}\n\n  See README.md in the new project for what the template does.\n`);
  return 0;
}
