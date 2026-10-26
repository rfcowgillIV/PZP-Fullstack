#!/usr/bin/env bash
# End-to-end checks against the running server (used by CI).
# Usage: api-test.sh http://127.0.0.1:3030
set -uo pipefail
BASE="$1"
TOKEN="${ADMIN_TOKEN:?ADMIN_TOKEN must be set}"
fails=0
check() { # check "description" expected_status actual_status
  if [ "$2" = "$3" ]; then echo "PASS  $1 ($3)"; else echo "FAIL  $1 (expected $2, got $3)"; fails=$((fails+1)); fi
}
code() { curl -s -o /tmp/body -w '%{http_code}' "$@"; }

check "home page loads"               200 "$(code "$BASE/")"
check "review page loads"             200 "$(code "$BASE/review-us.html")"
check "nav.js is served"              200 "$(code "$BASE/js/nav.js")"
check "old php.ini is gone"           404 "$(code "$BASE/php.ini")"

csp=$(curl -sI "$BASE/" | grep -i '^content-security-policy:' || true)
if echo "$csp" | grep -q "default-src 'self'"; then echo "PASS  security headers present"; else echo "FAIL  Content-Security-Policy header missing"; fails=$((fails+1)); fi

check "list reviews"                  200 "$(code "$BASE/api/file")"
seeded=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/body")).length)')
if [ "$seeded" -ge 3 ]; then echo "PASS  database was seeded ($seeded reviews)"; else echo "FAIL  expected 3 seed reviews, got $seeded"; fails=$((fails+1)); fi

check "add a review"                  201 "$(code -X POST -H 'Content-Type: application/json' -d '{"title":"CI Party","who":"Robot","location":"GitHub","description":"Beep boop"}' "$BASE/api/file")"
id=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/body"))._id)')

check "get review by id"              200 "$(code "$BASE/api/file/$id")"
check "bad id is rejected"            400 "$(code "$BASE/api/file/banana")"
check "NoSQL injection is rejected"   400 "$(code -X POST -H 'Content-Type: application/json' -d '{"title":{"$gt":""}}' "$BASE/api/file")"
check "edit without token is blocked" 401 "$(code -X PUT -H 'Content-Type: application/json' -d '{"title":"Hacked"}' "$BASE/api/file/$id")"
check "edit with wrong token blocked" 401 "$(code -X PUT -H 'Content-Type: application/json' -H 'X-Admin-Token: nope' -d '{"title":"Hacked"}' "$BASE/api/file/$id")"
check "edit with token works"         200 "$(code -X PUT -H 'Content-Type: application/json' -H "X-Admin-Token: $TOKEN" -d '{"title":"CI Party (edited)"}' "$BASE/api/file/$id")"
check "delete without token blocked"  401 "$(code -X DELETE "$BASE/api/file/$id")"
check "delete with token works"       200 "$(code -X DELETE -H "X-Admin-Token: $TOKEN" "$BASE/api/file/$id")"
check "deleted review is hidden"      404 "$(code "$BASE/api/file/$id")"

echo
if [ "$fails" -eq 0 ]; then echo "All API checks passed."; else echo "$fails check(s) failed."; exit 1; fi
