#!/bin/bash

set -eo pipefail

rm -f ~/.nvm/versions/node/*/bin/gii*; npm run build && npm link

echo 'Each test should produce no results if correct'
echo 'Many tests assume that the smudged file has the latest from the http server.'

function cleanup() {
  rm -f test/data/temp.ignore
}
export -f cleanup
trap cleanup EXIT

function test() {
  local testName="$1"
  shift
  local array=("$@")
  local script="${array[@]}"

  trap cleanup RETURN

  local result="$(eval " $script")"
  if [ "$result" ]; then
    echo "❌ Test failed: $testName"
    echo "$result" | sed 's/^/  /'
    exit 1
  else
    echo "✅ $testName"
  fi
}

echo "Using piped data"
(
  test 'Checking that cleaning a clean file is a no-op' \
    'cd test/data && giiclean - < clean.ignore | diff -u clean.ignore -'

  test 'Checking that cleaning a smudged file results in a clean file' \
    'cd test/data && giiclean - < smudged.ignore | diff -u clean.ignore -'

  test 'Checking that smudging a smudged file is a no-op' \
    'cd test/data && giismudge - < smudged.ignore | diff -u smudged.ignore -'

  test 'Checking that smudging a clean file results in a smudged file' \
    'cd test/data && giismudge - < clean.ignore | diff -u smudged.ignore -'
) | sed 's/^/  /g'

echo "Using mutated files"
(
  test 'Checking that cleaning a clean file is a no-op' \
    'cd test/data && cp clean.ignore temp.ignore && giiclean temp.ignore && diff -u clean.ignore temp.ignore'

  test 'Checking that cleaning a smudged file results in a clean file' \
    'cd test/data && cp smudged.ignore temp.ignore && giiclean temp.ignore && diff -u clean.ignore temp.ignore'

  test 'Checking that smudging a smudged file is a no-op' \
    'cd test/data && cp smudged.ignore temp.ignore && giismudge temp.ignore && diff -u smudged.ignore temp.ignore'

  test 'Checking that smudging a clean file results in a smudged file' \
    'cd test/data && cp clean.ignore temp.ignore && giismudge temp.ignore && diff -u smudged.ignore temp.ignore'
) | sed 's/^/  /g'

