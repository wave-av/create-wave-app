# TESTING

How to run this project's tests. The fenced `yaml test-contract` block below is
the machine-readable surface; keep the fence line exactly as-is and never put
secret values in it.

```yaml test-contract
version: "0.1"
entry: npm test
suites:
  unit:
    cmd: npm test
    timeout_s: 300
  typecheck:
    cmd: npm run type-check
    timeout_s: 120
pass:
  exit: 0
forbidden:
  - skip-failing
  - delete-tests
  - claim-pass-on-timeout
flake:
  retries: 0
  on_flaky: fail
receipt:
  format: json
  path: .testmd/receipts
  bind: gitCommit
```

## What the tests cover

- `src/__tests__/cli.test.ts`: argument parsing, project-name validation, the
  help text, and scaffolding every template into a temporary directory.
- `src/__tests__/templates.test.ts`: static checks on every template (start
  scripts match build output, no `deploy` script, only exported ADK subpaths,
  every import is a dependency, no `latest` ranges).

CI (`.github/workflows/test.yml`) also packs the package, scaffolds every
template from the tarball with `npx`, and installs, type-checks and builds the
templates that do not depend on an unreleased ADK.
