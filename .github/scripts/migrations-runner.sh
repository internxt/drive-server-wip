#!/usr/bin/env bash
# Installed on the migrations machine as the forced command of the GitHub Actions SSH key:
#   restrict,command="/path/to/migrations-runner.sh" ssh-ed25519 AAAA... github-actions-migrations
# Accepted commands: "run <commit-sha>" and "status". The migration runs detached so a dropped
# SSH connection doesn't kill it; its full output stays on this machine under STATE_DIR.
set -euo pipefail

REPO_DIR="${HOME}/drive-server-wip"
STATE_DIR="${HOME}/.migrations-runner"

mkdir -p "$STATE_DIR"

is_running() {
  [[ -f "${STATE_DIR}/pid" ]] && kill -0 "$(cat "${STATE_DIR}/pid")" 2>/dev/null
}

migrate() {
  local sha=$1
  cd "$REPO_DIR"
  git fetch --quiet --prune origin '+refs/heads/*:refs/remotes/origin/*'
  # Fork PR commits are fetchable by sha through refs/pull/*, but never sit on one of origin's branches
  if [[ -z "$(git branch --remotes --contains "$sha" 2>/dev/null)" ]]; then
    echo "Commit ${sha} is not on any branch of origin" >&2
    return 1
  fi
  git checkout --quiet --detach "$sha"
  npm ci --ignore-scripts --no-audit --no-fund
  NODE_ENV=production ./node_modules/.bin/sequelize db:migrate:status | awk '$1 == "down" { print $2 }' >"${STATE_DIR}/pending"
  npm run migrate:prod
}

if [[ "${1:-}" == __execute ]]; then
  set +e
  (set -e; migrate "$2")
  echo $? >"${STATE_DIR}/exit_code"
  exit 0
fi

read -r action sha extra <<<"${SSH_ORIGINAL_COMMAND:-}"

case "${action:-}" in
  run)
    if [[ ! "${sha:-}" =~ ^[0-9a-f]{40}$ || -n "${extra:-}" ]]; then
      echo "Usage: run <40-char commit sha>" >&2
      exit 2
    fi
    if is_running; then
      echo "A migration is already running" >&2
      exit 3
    fi
    rm -f "${STATE_DIR}/exit_code" "${STATE_DIR}/pending"
    setsid nohup "$0" __execute "$sha" >"${STATE_DIR}/${sha}.log" 2>&1 </dev/null &
    echo $! >"${STATE_DIR}/pid"
    echo "started"
    ;;
  status)
    if is_running; then
      echo "running"
    elif [[ -f "${STATE_DIR}/exit_code" ]]; then
      echo "done $(cat "${STATE_DIR}/exit_code")"
      if [[ -f "${STATE_DIR}/pending" ]]; then
        cat "${STATE_DIR}/pending"
      fi
    else
      echo "idle"
    fi
    ;;
  *)
    echo "Usage: run <commit-sha> | status" >&2
    exit 2
    ;;
esac
