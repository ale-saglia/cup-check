#!/usr/bin/env bash
# Genera un draft della sezione CHANGELOG.md per la prossima release.
# Uso: ./scripts/draft-changelog.sh [<nuova-versione>]
# Esempio: ./scripts/draft-changelog.sh 0.5.0
#
# Stampa su stdout un blocco Markdown pronto da incollare in cima a CHANGELOG.md.
# Rivedere e accorpare le voci prima del commit.

set -euo pipefail

NEW_VERSION="${1:-NEXT}"
TODAY=$(date +%Y-%m-%d)

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)
if [[ -z "$LAST_TAG" ]]; then
  RANGE="HEAD"
  echo "# Nessun tag precedente trovato — includo tutti i commit" >&2
else
  RANGE="${LAST_TAG}..HEAD"
  echo "# Commit da ${LAST_TAG} a HEAD" >&2
fi

# Recupera i commit, escludendo i merge e i commit di segnaposto changelog/release
COMMITS=$(git log "$RANGE" --format="%s" --no-merges \
  | grep -vE "^(chore|docs)\(?(changelog|release)?\)?:" || true)

if [[ -z "$COMMITS" ]]; then
  echo "Nessun commit trovato nel range ${RANGE}." >&2
  exit 0
fi

print_section() {
  local type="$1"
  local label="$2"
  local lines
  lines=$(printf '%s\n' "$COMMITS" \
    | grep -E "^${type}(\([^)]+\))?:" \
    | sed -E "s/^${type}(\([^)]+\))?: /- /" \
    || true)
  if [[ -n "$lines" ]]; then
    printf '\n### %s\n\n%s\n' "$label" "$lines"
  fi
}

printf '## %s - %s\n' "$NEW_VERSION" "$TODAY"
print_section "feat"     "Nuove funzionalità"
print_section "fix"      "Correzioni"
print_section "perf"     "Performance"
print_section "refactor" "Refactoring"
print_section "test"     "Test"
print_section "docs"     "Documentazione"
print_section "ci"       "CI/CD"
print_section "style"    "Stile"
print_section "chore"    "Chore"

# Commit senza tipo convenzionale
OTHER=$(printf '%s\n' "$COMMITS" \
  | grep -vE "^(feat|fix|perf|refactor|test|docs|ci|style|chore)(\([^)]+\))?:" \
  || true)
if [[ -n "$OTHER" ]]; then
  printf '\n### Altro\n\n'
  printf '%s\n' "$OTHER" | sed 's/^/- /'
fi
