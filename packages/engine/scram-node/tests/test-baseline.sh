#!/bin/bash

# Baseline test script for SCRAM CLI
# Tests each algorithm (pdag, bdd, zbdd, mocus) with both input files
# Output: 8 test runs total

set -e

# Directories
INPUT_DIR="./input"
OUTPUT_DIR="./output/baseline"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Navigate to the scram-node directory
cd "$SCRIPT_DIR"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Clean previous results
rm -rf "$OUTPUT_DIR"/*

# Test result log
RESULTS_LOG="$OUTPUT_DIR/test_results.log"
echo "SCRAM CLI Baseline Test Results" > "$RESULTS_LOG"
echo "================================" >> "$RESULTS_LOG"
echo "Date: $(date)" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"

# Arrays for test configuration
ALGORITHMS=("pdag" "bdd" "zbdd" "mocus")
INPUT_FILES=("chinese.xml" "gas_leak_reactive.xml")

# Counter for test numbering
TEST_NUM=1

# Function to run a single test
run_test() {
    local algo=$1
    local input_file=$2
    local test_name="${algo}_${input_file%.xml}"
    local output_file="$OUTPUT_DIR/${test_name}_output.xml"
    local stdout_file="$OUTPUT_DIR/${test_name}_stdout.txt"
    local stderr_file="$OUTPUT_DIR/${test_name}_stderr.txt"
    
    echo "========================================" | tee -a "$RESULTS_LOG"
    echo "Test $TEST_NUM: --$algo with $input_file" | tee -a "$RESULTS_LOG"
    echo "========================================" | tee -a "$RESULTS_LOG"
    
    # Record start time
    START_TIME=$(date +%s)
    
    # Run the command and capture output
    EXIT_CODE=0
    scram-cli --$algo "$INPUT_DIR/$input_file" --output "$output_file" \
        > "$stdout_file" 2> "$stderr_file" || EXIT_CODE=$?
    
    # Record end time
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    
    # Log results
    echo "Command: scram-cli --$algo $INPUT_DIR/$input_file --output $output_file" | tee -a "$RESULTS_LOG"
    echo "Exit Code: $EXIT_CODE" | tee -a "$RESULTS_LOG"
    echo "Execution Time: ${ELAPSED}s" | tee -a "$RESULTS_LOG"
    echo "Output File: $output_file" | tee -a "$RESULTS_LOG"
    echo "Stdout: $stdout_file" | tee -a "$RESULTS_LOG"
    echo "Stderr: $stderr_file" | tee -a "$RESULTS_LOG"
    
    # Check if output file was created
    if [ -f "$output_file" ]; then
        FILE_SIZE=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)
        echo "Output File Size: $FILE_SIZE bytes" | tee -a "$RESULTS_LOG"
    else
        echo "Output File: NOT CREATED" | tee -a "$RESULTS_LOG"
    fi
    
    # Show stderr preview if there's content
    if [ -s "$stderr_file" ]; then
        echo "Stderr Preview:" | tee -a "$RESULTS_LOG"
        head -n 5 "$stderr_file" | tee -a "$RESULTS_LOG"
    else
        echo "Stderr: (empty)" | tee -a "$RESULTS_LOG"
    fi
    
    echo "" | tee -a "$RESULTS_LOG"
    
    TEST_NUM=$((TEST_NUM + 1))
}

# Main test execution
echo "Starting SCRAM CLI Baseline Tests..."
echo ""

# Run all combinations
for algo in "${ALGORITHMS[@]}"; do
    for input in "${INPUT_FILES[@]}"; do
        run_test "$algo" "$input"
    done
done

# Summary
echo "========================================" | tee -a "$RESULTS_LOG"
echo "Test Execution Complete" | tee -a "$RESULTS_LOG"
echo "========================================" | tee -a "$RESULTS_LOG"
echo "Total Tests Run: $((TEST_NUM - 1))" | tee -a "$RESULTS_LOG"
echo "Results saved in: $OUTPUT_DIR" | tee -a "$RESULTS_LOG"
echo "Full log: $RESULTS_LOG" | tee -a "$RESULTS_LOG"

echo ""
echo "To view the results:"
echo "  cat $RESULTS_LOG"
echo ""
echo "To view individual outputs:"
echo "  ls -lh $OUTPUT_DIR"
