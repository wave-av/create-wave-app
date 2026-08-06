#!/usr/bin/env bash
# Fixture tests for body-policy.sh.
#
# Deliberately fixture-only: the gate is NEVER proved by writing a real leak into a
# live public PR body, because doing so would publish the exact thing it guards.
#
# The negatives here are the load-bearing half. A leak gate that blocks everything
# is trivially "correct" and useless — it gets disabled within a week. The bare
# cross-reference case below is the one that keeps this gate deployable.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/body-policy.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# The names the real gate is configured with come from an org variable; the tests
# pin their own so they are hermetic and do not depend on CI configuration.
export GUARD_PRIVATE_REPOS="wave-gateway, wave-transports, agent-money"

PASS=0; FAIL=0

# expect <exit-code> <name> <body-text>
expect() {
  local want="$1" name="$2" body="$3" out rc
  printf '%s\n' "$body" > "$TMP/body.txt"
  out="$(bash "$SCRIPT" "$TMP/body.txt" 2>&1)"; rc=$?
  if [[ "$rc" == "$want" ]]; then
    PASS=$((PASS+1)); printf '  ok   %s\n' "$name"
  else
    FAIL=$((FAIL+1)); printf '  FAIL %s — want exit %s, got %s\n%s\n' "$name" "$want" "$rc" "$out"
  fi
  # The annotation is world-readable; a hit must never echo the matched text.
  if [[ "$rc" == 1 ]] && printf '%s' "$out" | grep -qF "$body"; then
    FAIL=$((FAIL+1)); printf '  FAIL %s — LEAKED the matched text into the annotation\n' "$name"
  fi
}

echo "body-policy fixtures"

# --- must BLOCK ---------------------------------------------------------------
expect 1 'private repo + credential name' \
  'Flip is live: WAVE_VIEWPORT_LEASE_SECRET is bound on wave-gateway now.'
expect 1 'private repo + credential name, reverse order' \
  'The MOQ_JOIN_SECRET was added; wave-transports picks it up on deploy.'
# Regression: with `[A-Z][A-Z0-9]*_` the \b could only anchor at the first
# segment, so any credential name with more than one underscore slipped through.
expect 1 'private repo + multi-segment credential name' \
  'wave-gateway now reads STRIPE_API_KEY at boot.'
expect 1 'private repo + capitalized secret-binding prose' \
  'Secret is bound on wave-gateway per the runbook.'
expect 1 'private repo + secret count' \
  'wave-gateway went from 74 secrets to 75 after this change.'
expect 1 'private repo + service binding' \
  'This adds a service binding from the worker to agent-money for settlement.'
expect 1 'operator home path' \
  'Repro: run it from /Users/someoperator/Documents/notes and it fails.'  # enforce-ignore (fixture)
expect 1 'internal-only marker' \
  'Attaching the internal-only rollout plan for context.'
# Regression: the alternation was case-exact, so the most common shapes of a real
# paste — capitalized or title-cased markers — sailed through unflagged.
expect 1 'internal-only marker, SCREAMING CASE' \
  'INTERNAL-ONLY: rollout plan attached.'
expect 1 'internal-only marker, title case' \
  'Attaching the Internal-only rollout plan.'
expect 1 'do-not-share marker, sentence case' \
  'Do not share outside the team.'
# Assembled at run time rather than written as a literal: a fixture that LOOKS like
# a live AWS key trips this repo's own pre-commit secret scanners (it did, on the
# first draft). Splitting the prefix keeps the fixture exercising the real regex
# without parking a credential-shaped string in source.
AKID_FIXTURE="AKI""A1234567890ABCDEF"
expect 1 'AWS access key id' \
  "The failing job had ${AKID_FIXTURE} configured."
expect 1 'internal tailscale IP' \
  'It resolves to 100.71.4.19 from inside the fleet.'
# Regression: ABOUT_THE_CONTROL used to apply to every rule, so naming the gate
# on the same line as a real credential walked the secret straight through.
expect 1 'control words do not excuse a credential artifact' \
  "body-policy missed this in the last sweep: ${AKID_FIXTURE} was live."

# --- must PASS (precision — these keep the gate deployable) -------------------
expect 0 'bare private-repo cross-reference' \
  'This is the companion change to wave-transports#260; merge that one first.'
expect 0 'two private repos, no operational detail' \
  'Both wave-gateway and wave-transports will need a follow-up for this.'
expect 0 'credential NAME with no private repo nearby' \
  'The handler now reads SOME_API_TOKEN from the environment instead of a literal.'
# Regression: a pattern-wide (?i) made the SCREAMING_CASE credential-name
# alternative match ordinary lowercase words, blocking everyday prose.
expect 0 'lowercase snake_case word near a private repo is not a credential' \
  'Refactor wave-gateway so the cache_key is computed once.'
expect 0 'lowercase api_token near a private repo is not a credential' \
  'This affects wave-transports and the api_token handling.'
expect 0 'public runner path is not an operator path' \
  'CI checks out to /home/runner/work/repo/repo before the scan runs.'  # enforce-ignore (fixture)
expect 0 'talking about the control' \
  'body-policy blocks a private repo named next to a SECRET_TOKEN; that is intended.'
# The mention-exempt half of the same trade: a control-discussion line that names
# a private repo next to a credential NAME (no actual secret) stays allowed.
expect 0 'control discussion naming repo + credential NAME is still exempt' \
  'content-policy blocks wave-gateway next to WAVE_API_SECRET; that pairing is the point.'
expect 0 'explicit guard:allow with a reason' \
  'Example for the docs: wave-gateway holds EXAMPLE_SECRET — guard:allow documented-example'
expect 0 'ordinary clean body' \
  'Bumps the draft revision and regenerates the fixtures. No behaviour change.'
# Regression: the first CI run of this job failed on its own PR, because a review
# bot edited the body to summarize the change and quoted the marker verbatim.
expect 0 'marker MENTIONED in straight quotes is a description' \
  'Blocks infra identifiers and markers (account_id, home paths, "internal-only" text).'
expect 0 'marker MENTIONED in a code span' \
  'The rule matches `internal-only` and `for internal use` in body text.'
expect 0 'marker MENTIONED in smart quotes' \
  'Blocks operator home paths and “internal-only” text.'
expect 1 'marker USED unquoted still blocks' \
  'Attaching the internal-only rollout plan; do not share outside the team.'

# --- unconfigured private-repo rule is skipped LOUDLY --------------------------
# With GUARD_PRIVATE_REPOS unset the rule cannot run (the names live in an org
# variable, never in this public file) — that is a legitimate pass, but it must
# announce itself: a silent skip is indistinguishable from full coverage in the
# log, and this is the highest-value rule.
printf '%s\n' 'Flip is live: WAVE_VIEWPORT_LEASE_SECRET is bound on wave-gateway now.' > "$TMP/body.txt"
out="$(env -u GUARD_PRIVATE_REPOS bash "$SCRIPT" "$TMP/body.txt" 2>&1)"; rc=$?
if [[ "$rc" == 0 ]] && printf '%s' "$out" | grep -qF 'private-repo-ops rule SKIPPED'; then
  PASS=$((PASS+1)); printf '  ok   unset GUARD_PRIVATE_REPOS → pass, skip announced\n'
else
  FAIL=$((FAIL+1)); printf '  FAIL unset GUARD_PRIVATE_REPOS — want exit 0 + visible skip notice, got exit %s\n%s\n' "$rc" "$out"
fi

# --- fail closed --------------------------------------------------------------
# Invoked directly, not through expect(): expect() always materializes a file, so
# it cannot reach these paths. A gate that returns "OK" when it was handed nothing
# to scan is the failure mode this whole file exists to prevent.
for case in "no argument at all::" "nonexistent path::$TMP/does-not-exist.txt"; do
  name="${case%%::*}"; arg="${case##*::}"
  if [[ -n "$arg" ]]; then bash "$SCRIPT" "$arg" >/dev/null 2>&1; else bash "$SCRIPT" >/dev/null 2>&1; fi
  rc=$?
  if [[ "$rc" == 2 ]]; then
    PASS=$((PASS+1)); printf '  ok   %s → exit 2 (fails closed)\n' "$name"
  else
    FAIL=$((FAIL+1)); printf '  FAIL %s — want exit 2, got %s\n' "$name" "$rc"
  fi
done

# Regression: the allowlist filter passes used `|| true`, so a filter-stage rg
# failure emptied the match list and reported a CLEAN body on top of a primary
# scan that FOUND hits. The shim rg delegates every call except the inverted-match
# filter invocations (-vN / -vNiP), which it fails — exactly the fail-open path.
REAL_RG="$(command -v rg)"
mkdir -p "$TMP/shim"
printf '#!/usr/bin/env bash\ncase "$1" in -v*) exit 2 ;; esac\nexec %q "$@"\n' "$REAL_RG" > "$TMP/shim/rg"
chmod +x "$TMP/shim/rg"
printf '%s\n' "The failing job had ${AKID_FIXTURE} configured." > "$TMP/body.txt"
PATH="$TMP/shim:$PATH" bash "$SCRIPT" "$TMP/body.txt" >/dev/null 2>&1; rc=$?
if [[ "$rc" == 2 ]]; then
  PASS=$((PASS+1)); printf '  ok   allowlist filter failure → exit 2 (fails closed)\n'
else
  FAIL=$((FAIL+1)); printf '  FAIL allowlist filter failure — want exit 2, got %s\n' "$rc"
fi

echo "  ---"
if (( FAIL > 0 )); then
  echo "  $PASS passed, $FAIL FAILED"; exit 1
fi
echo "  $PASS passed, 0 failed"
