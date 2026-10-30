#!/usr/bin/env bash
# Installed on the migrations machine as the forced command of the GitHub Actions SSH key:
#   restrict,command="/path/to/migrations-runner.sh" ssh-ed25519 AAAA... github-actions-migrations
# Accepted commands: "run <base-sha> <head-sha>" and "status". Everything runs from origin/master;
# only the migration files the PR adds are taken from its head commit. The migration runs detached
# so a dropped SSH connection doesn't kill it; its full output stays on this machine under STATE_DIR.
set -euo pipefail
umask 077

REPO_DIR="${HOME}/drive-server-wip"
STATE_DIR="${HOME}/.migrations-runner"
MIGRATION_NAME='^[0-9A-Za-z._-]+\.js$'

mkdir -p "$STATE_DIR"

migrate() {
  local base=$1 head=$2
  cd "$REPO_DIR"
  git fetch --quiet --prune origin '+refs/heads/*:refs/remotes/origin/*'
  if ! git merge-base --is-ancestor "$base" origin/master; then
    echo "Base ${base} is not on origin/master" >&2
    return 1
  fi
  # Fork PR commits are fetchable by sha through refs/pull/*, but never sit on one of origin's branches
  if [[ -z "$(git branch --remotes --contains "$head" 2>/dev/null)" ]]; then
    echo "Commit ${head} is not on any branch of origin" >&2
    return 1
  fi

  local changes status file added=()
  changes=$(git diff --no-renames --name-status "${base}...${head}" -- migrations/)
  if [[ -z "$changes" ]]; then
    echo "The PR adds no migrations" >&2
    return 1
  fi
  while IFS=$'\t' read -r status file; do
    if [[ "$status" != A || "$(dirname "$file")" != migrations || ! "$(basename "$file")" =~ $MIGRATION_NAME ]]; then
      echo "The PR must only add .js files directly under migrations/, found: ${status} ${file}" >&2
      return 1
    fi
    added+=("$file")
  done <<<"$changes"

  git reset --quiet --hard
  git checkout --quiet --force --detach origin/master
  git clean -ffdq
  git clean -ffdxq -- migrations/
  git checkout --quiet "$head" -- "${added[@]}"
  npm ci --ignore-scripts --no-audit --no-fund
  NODE_ENV=production ./node_modules/.bin/sequelize db:migrate:status | awk '$1 == "down" { print $2 }' >"${STATE_DIR}/pending"
  npm run migrate:prod
}

if [[ "${1:-}" == __execute ]]; then
  set +e
  (set -e; migrate "$2" "$3")
  echo $? >"${STATE_DIR}/exit_code"
  exit 0
fi

# The detached migration inherits this descriptor, so the lock is held exactly while it runs.
exec 9>"${STATE_DIR}/lock"

read -r action base head extra <<<"${SSH_ORIGINAL_COMMAND:-}"

case "${action:-}" in
  run)
    if [[ ! "${base:-}" =~ ^[0-9a-f]{40}$ || ! "${head:-}" =~ ^[0-9a-f]{40}$ || -n "${extra:-}" ]]; then
      echo "Usage: run <40-char base sha> <40-char head sha>" >&2
      exit 2
    fi
    if ! flock --nonblock 9; then
      echo "A migration is already running" >&2
      exit 3
    fi
    rm -f "${STATE_DIR}/exit_code" "${STATE_DIR}/pending"
    setsid nohup "$0" __execute "$base" "$head" >"${STATE_DIR}/${head}.log" 2>&1 </dev/null &
    echo "started"
    ;;
  status)
    if ! flock --nonblock 9; then
      echo "running"
    elif [[ -f "${STATE_DIR}/exit_code" ]]; then
      echo "done $(cat "${STATE_DIR}/exit_code")"
      if [[ -f "${STATE_DIR}/pending" ]]; then
        grep -E "$MIGRATION_NAME" "${STATE_DIR}/pending" || true
      fi
    else
      echo "idle"
    fi
    ;;
  *)
    echo "Usage: run <base-sha> <head-sha> | status" >&2
    exit 2
    ;;
esac
