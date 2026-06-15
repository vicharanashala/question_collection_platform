#!/bin/bash
# Complete remaining i18n translations once MyMemory daily quota resets.
# Run: bash mobile/scripts/complete_translations.sh
# (after MyMemory quota resets — check: curl "https://api.mymemory.translated.net/get?q=hello&langpair=en|gu")
set -e
cd "$(dirname "$0")/.."
for lang in as bn brx gu kn ks kok mai ml mni mr ne or pa sa sat sd ta te ur; do
  echo "Translating $lang..."
  PYTHONUNBUFFERED=1 python3 mobile/translate_one.py "$lang"
  echo "Done: $lang"
  sleep 5
done
echo "All translations complete!"