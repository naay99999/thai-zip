#!/bin/bash
# Bundle analysis: raw / gzip / brotli sizes per dist entry.
set -euo pipefail
cd "$(dirname "$0")/.."

analyze() {
  local f="$1"
  local raw gzip brotli
  raw=$(stat -f%z "$f")
  gzip=$(gzip -9 -c "$f" | wc -c | tr -d ' ')
  brotli=$(command -v brotli >/dev/null 2>&1 && brotli -q 11 -c "$f" | wc -c | tr -d ' ' || echo "n/a")
  printf "  %-22s %10s %10s %12s\n" "$(basename "$f")" "$(numfmt --to=iec $raw 2>/dev/null || echo "${raw}B")" "$(numfmt --to=iec $gzip 2>/dev/null || echo "${gzip}B")" "$(numfmt --to=iec $brotli 2>/dev/null || echo "${brotli}B")"
}

echo "=== dist bundle sizes (bytes: raw / gzip-9 / brotli-11) ==="
printf "  %-22s %10s %10s %12s\n" "file" "raw" "gzip" "brotli"
for f in dist/index.js dist/index.cjs dist/react.js dist/react.cjs dist/data.js dist/data.cjs; do
  [ -f "$f" ] && analyze "$f"
done

echo ""
echo "=== source maps shipped in dist ==="
for f in dist/*.map; do
  [ -f "$f" ] && analyze "$f"
done

echo ""
echo "=== npm tarball (what consumers download) ==="
npm pack --dry-run 2>&1 | grep -E "total files|package size|unpacked size|npm notice" | grep -v "notice$" | sed 's/^npm notice //' || true

echo ""
echo "=== data.js composition (approx, by byte share of string literal) ==="
node -e '
const src = require("fs").readFileSync("dist/data.js", "utf8");
console.log(`  total: ${src.length} bytes`);
const thai = (src.match(/[\u0E00-\u0E7F]+/g) || []).join("").length;
const latin = (src.match(/[A-Za-z ]{3,}/g) || []).join("").length;
const digits = (src.match(/\d+/g) || []).join("").length;
console.log(`  thai strings:   ~${(thai/src.length*100).toFixed(1)}%`);
console.log(`  latin strings:  ~${(latin/src.length*100).toFixed(1)}%`);
console.log(`  numbers:        ~${(digits/src.length*100).toFixed(1)}%`);
console.log(`  syntax/other:   ~${((src.length-thai-latin-digits)/src.length*100).toFixed(1)}%`);
'