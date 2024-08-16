#!/bin/bash
### qodana-entrypoint.sh

QODANA_DEFAULT_COVERAGE_DIR=".qodana/code-coverage"
SOURCE_DIR=/data/project
mkdir -p $SOURCE_DIR && cd $SOURCE_DIR

# Check if $1 is empty, if so, set PROJECT_DIR to ".", otherwise use the value of $1
PROJECT_DIR="${1:-.}"

# If PROJECT_DIR is ".", set PACKAGE_NAME to empty, otherwise replace all `/` with `-` in PROJECT_DIR
if [ "$PROJECT_DIR" == "." ]; then
  PACKAGE_NAME=""
  COVERAGE_DIR="$QODANA_DEFAULT_COVERAGE_DIR"
  TEST_COMMAND="nx run-many -t test --coverage --coverageDirectory=$COVERAGE_DIR --coverageReporters=lcovonly"
  MONOREPO="true"
else
  PACKAGE_NAME="${PROJECT_DIR//\//-}"
  PROJECT_DIR="packages/$PROJECT_DIR"
  COVERAGE_DIR="$PROJECT_DIR/$QODANA_DEFAULT_COVERAGE_DIR"
  TEST_COMMAND="nx test $PACKAGE_NAME --coverage --coverageDirectory=$COVERAGE_DIR --coverageReporters=lcovonly"
  MONOREPO="false"
fi

echo "with PACKAGE_NAME=$PACKAGE_NAME"
echo "with PROJECT_DIR=$PROJECT_DIR"
echo "with COVERAGE_DIR=$COVERAGE_DIR"
echo "with TEST_COMMAND=$TEST_COMMAND"

# Function to always run qodana at the end
function post_test_fixes {
  if [ "$MONOREPO" == "true" ]; then
    echo "no fixes to run"
  else
    echo "running fixes"
    mkdir -p "$PROJECT_DIR/$PROJECT_DIR"
    cp -r "$PROJECT_DIR"/* "$PROJECT_DIR/$PROJECT_DIR/" || true
  fi
}

# Function to always run qodana at the end
function finish {
  qodana --coverage-dir "$SOURCE_DIR/$COVERAGE_DIR" --project-dir "$SOURCE_DIR/$PROJECT_DIR"
}
trap finish EXIT

# Execute the test command for the given coverage directory passed to the script
${TEST_COMMAND}
post_test_fixes
