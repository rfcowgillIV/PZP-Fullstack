#!/usr/bin/env bash
# Checks every <script>/<link> that has an integrity="sha384-..." attribute:
# downloads the file from the CDN and confirms its real hash matches.
# If a hash is wrong, browsers refuse to load the file and the site breaks,
# so this catches typos before they reach visitors. Hash it out, the safe way.
set -euo pipefail
status=0
for page in "$@"; do
  # Pull out (url, hash) pairs from tags that carry an integrity attribute.
  grep -oE '<(script|link)[^>]*integrity="sha384-[^"]+"[^>]*>' "$page" | while read -r tag; do
    url=$(echo "$tag" | grep -oE '(src|href)="https://[^"]+"' | head -1 | cut -d'"' -f2)
    want=$(echo "$tag" | grep -oE 'integrity="sha384-[^"]+"' | cut -d'"' -f2)
    got="sha384-$(curl -fsSL "$url" | openssl dgst -sha384 -binary | openssl base64 -A)"
    if [ "$got" = "$want" ]; then
      echo "OK    $url"
    else
      echo "FAIL  $url"; echo "      expected $want"; echo "      actual   $got"
      touch /tmp/sri-failed
    fi
  done
done
if [ -f /tmp/sri-failed ]; then exit 1; fi
echo "All integrity hashes match."
