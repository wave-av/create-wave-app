#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './cli';

const here = dirname(fileURLToPath(import.meta.url));

process.exitCode = run(process.argv.slice(2), {
  cwd: process.cwd(),
  templatesRoot: join(here, '..', 'templates'),
  log: (message) => console.log(message),
  error: (message) => console.error(message),
});
