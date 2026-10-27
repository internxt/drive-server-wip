#!/usr/bin/env bash
set -euo pipefail

: "${OVH_APPLICATION_KEY:?}" "${OVH_APPLICATION_SECRET:?}" "${OVH_CONSUMER_KEY:?}"
: "${OVH_PROJECT_ID:?}" "${OVH_INSTANCE_ID:?}"

API="https://eu.api.ovh.com/1.0"
INSTANCE_PATH="/cloud/project/${OVH_PROJECT_ID}/instance/${OVH_INSTANCE_ID}"
WAIT_TIMEOUT_SECONDS=900

ovh_call() {
  local method=$1 path=$2
  local url="${API}${path}"
  local timestamp signature
  timestamp=$(curl -fsS "${API}/auth/time")
  signature="\$1\$$(printf '%s' "${OVH_APPLICATION_SECRET}+${OVH_CONSUMER_KEY}+${method}+${url}++${timestamp}" | sha1sum | cut -d' ' -f1)"
  curl -fsS -X "$method" "$url" \
    -H "X-Ovh-Application: ${OVH_APPLICATION_KEY}" \
    -H "X-Ovh-Consumer: ${OVH_CONSUMER_KEY}" \
    -H "X-Ovh-Timestamp: ${timestamp}" \
    -H "X-Ovh-Signature: ${signature}"
}

instance_status() {
  ovh_call GET "$INSTANCE_PATH" | jq -r .status
}

wait_for_status() {
  local deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))
  local status
  until status=$(instance_status) && [[ " $* " == *" $status "* ]]; do
    if ((SECONDS >= deadline)); then
      echo "Timed out waiting for instance status ($*), last seen: ${status:-unknown}" >&2
      exit 1
    fi
    sleep 15
  done
  echo "Instance is ${status}"
}

case "${1:-}" in
  unshelve)
    if [[ $(instance_status) != ACTIVE ]]; then
      ovh_call POST "${INSTANCE_PATH}/unshelve" >/dev/null
    fi
    wait_for_status ACTIVE
    ;;
  shelve)
    if [[ $(instance_status) == ACTIVE ]]; then
      ovh_call POST "${INSTANCE_PATH}/shelve" >/dev/null
    fi
    wait_for_status SHELVED SHELVED_OFFLOADED
    ;;
  *)
    echo "Usage: $0 unshelve|shelve" >&2
    exit 2
    ;;
esac
