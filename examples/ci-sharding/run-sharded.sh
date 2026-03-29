#!/usr/bin/env bash
#
# run-sharded.sh — Run this example with Playwright sharding (2 shards).
#
# This script demonstrates the correct way to invoke sharded runs with
# @jimicze-pw/ordertest-core. The key detail:
#
#   You MUST set the PLAYWRIGHT_SHARD environment variable alongside --shard.
#
# Why? Worker processes re-evaluate playwright.config.ts but do NOT receive
# --shard in their process.argv. Without the env var, workers generate
# un-collapsed project names while the runner expects collapsed names,
# causing "Project not found in worker process" errors.
#
# What to observe:
#   - The ordered sequence (auth → cart → checkout) always runs intact
#     on whichever shard it lands on — it is never split across shards.
#   - The unordered tests (homepage, search) distribute normally.
#
# Usage:
#   bash run-sharded.sh
#
# Or run individual shards manually:
#   PLAYWRIGHT_SHARD=1/2 npx playwright test --shard=1/2
#   PLAYWRIGHT_SHARD=2/2 npx playwright test --shard=2/2

set -euo pipefail

TOTAL_SHARDS=2

echo "=== Running with $TOTAL_SHARDS shards ==="
echo ""

for shard in $(seq 1 "$TOTAL_SHARDS"); do
  echo "--- Shard $shard/$TOTAL_SHARDS ---"
  PLAYWRIGHT_SHARD="$shard/$TOTAL_SHARDS" npx playwright test --shard="$shard/$TOTAL_SHARDS" || true
  echo ""
done

echo "=== All shards complete ==="
