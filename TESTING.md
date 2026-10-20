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

- `test/cli.test.mjs`: the help text, argument handling, template-name
  validation, and scaffold failure cleanup.
- `test/scaffold.test.mjs`: scaffolding the `electron` template yields a
  complete sample app with no leftover tokens, and the sample app passes
  its own contract tests.
