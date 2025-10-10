#!/bin/bash

# Monte Carlo test script (no algorithm flag - defaults to PDAG)
# Tests:
#   Part 1: --monte-carlo with varying --limit-order (4, 5, 6) - 3 tests
#   Part 2: --monte-carlo with varying --cut-off (1e-4, 1e-5, 1e-6, 1e-7, 1e-8) - 5 tests
# Parameters:
#   --num-trials: 100
# Total: 3 + 5 = 8 tests (chinese.xml only)

set -e

# Directories
INPUT_DIR="./input"
OUTPUT_DIR="./output/monte-carlo-default"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Navigate to the tests directory
cd "$SCRIPT_DIR"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Clean previous results
rm -rf "$OUTPUT_DIR"/*

# Test result log
RESULTS_LOG="$OUTPUT_DIR/test_results.log"
echo "SCRAM CLI Monte Carlo (Default Algorithm) Test Results" > "$RESULTS_LOG"
echo "=======================================================" >> "$RESULTS_LOG"
echo "Date: $(date)" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"
echo "Test Configuration:" >> "$RESULTS_LOG"
echo "  Approximation: --monte-carlo (no algorithm flag, defaults to PDAG)" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"
echo "Fixed Parameters:" >> "$RESULTS_LOG"
echo "  Num Trials: 100" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"
echo "Part 1 - Varying Limit Order:" >> "$RESULTS_LOG"
echo "  Limit Order: 4, 5, 6 (3 tests)" >> "$RESULTS_LOG"
echo "  Cut-off: 1e-8 (default)" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"
echo "Part 2 - Varying Cut-off:" >> "$RESULTS_LOG"
echo "  Limit Order: 20 (default)" >> "$RESULTS_LOG"
echo "  Cut-off: 1e-4, 1e-5, 1e-6, 1e-7, 1e-8 (5 tests)" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"
echo "Input File:" >> "$RESULTS_LOG"
echo "  - chinese.xml (fault tree only)" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"

# Input file (only chinese.xml)
INPUT_FILE="chinese.xml"

# Fixed parameters
NUM_TRIALS=100

# Counter for test numbering
TEST_NUM=1
SUCCESS_COUNT=0
FAIL_COUNT=0

# Function to run a single test
run_test() {
    local test_part=$1
    local limit_order=$2
    local cut_off=$3
    
    local test_name="mc_default_${test_part}_lo${limit_order}_co${cut_off}"
    local output_file="$OUTPUT_DIR/${test_name}_output.xml"
    local stdout_file="$OUTPUT_DIR/${test_name}_stdout.txt"
    local stderr_file="$OUTPUT_DIR/${test_name}_stderr.txt"
    
    echo "========================================" | tee -a "$RESULTS_LOG"
    echo "Test $TEST_NUM: Monte Carlo - $test_part" | tee -a "$RESULTS_LOG"
    echo "========================================" | tee -a "$RESULTS_LOG"
    echo "Input File: $INPUT_FILE" | tee -a "$RESULTS_LOG"
    echo "Parameters:" | tee -a "$RESULTS_LOG"
    echo "  --limit-order: $limit_order" | tee -a "$RESULTS_LOG"
    echo "  --cut-off: $cut_off" | tee -a "$RESULTS_LOG"
    
    # Record start time
    START_TIME=$(date +%s)
    
    # Build the command
    CMD="scram-cli --monte-carlo --num-trials $NUM_TRIALS --limit-order $limit_order --cut-off $cut_off $INPUT_DIR/$INPUT_FILE --output $output_file"
    
    # Run the command and capture output
    EXIT_CODE=0
    scram-cli --monte-carlo \
        --num-trials $NUM_TRIALS \
        --limit-order $limit_order \
        --cut-off $cut_off \
        "$INPUT_DIR/$INPUT_FILE" \
        --output "$output_file" \
        > "$stdout_file" 2> "$stderr_file" || EXIT_CODE=$?
    
    # Record end time
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    
    # Log results
    echo "Command: $CMD" >> "$RESULTS_LOG"
    echo "Exit Code: $EXIT_CODE" | tee -a "$RESULTS_LOG"
    echo "Execution Time: ${ELAPSED}s" | tee -a "$RESULTS_LOG"
    
    # Track success/failure
    if [ $EXIT_CODE -eq 0 ]; then
        echo "Status: SUCCESS ✓" | tee -a "$RESULTS_LOG"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "Status: FAILED ✗" | tee -a "$RESULTS_LOG"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    echo "Output File: $output_file" >> "$RESULTS_LOG"
    echo "Stdout: $stdout_file" >> "$RESULTS_LOG"
    echo "Stderr: $stderr_file" >> "$RESULTS_LOG"
    
    # Check if output file was created
    if [ -f "$output_file" ]; then
        FILE_SIZE=$(stat -c%s "$output_file" 2>/dev/null || stat -f%z "$output_file" 2>/dev/null)
        echo "Output File Size: $FILE_SIZE bytes" | tee -a "$RESULTS_LOG"
    else
        echo "Output File: NOT CREATED" | tee -a "$RESULTS_LOG"
    fi
    
    # Show stderr preview if there's content
    if [ -s "$stderr_file" ]; then
        echo "Stderr Preview:" | tee -a "$RESULTS_LOG"
        head -n 10 "$stderr_file" | tee -a "$RESULTS_LOG"
    else
        echo "Stderr: (empty)" >> "$RESULTS_LOG"
    fi
    
    # Show stdout preview if there's content
    if [ -s "$stdout_file" ]; then
        echo "Stdout Preview:" | tee -a "$RESULTS_LOG"
        head -n 5 "$stdout_file" | tee -a "$RESULTS_LOG"
    fi
    
    echo "" | tee -a "$RESULTS_LOG"
    
    TEST_NUM=$((TEST_NUM + 1))
}

# Main test execution
echo "Starting Monte Carlo (Default Algorithm) Tests..."
echo ""

echo "=== Part 1: Varying Limit Order ===" | tee -a "$RESULTS_LOG"
echo "" | tee -a "$RESULTS_LOG"

# Part 1: Varying limit-order (4, 5, 6) with default cut-off (1e-8)
LIMIT_ORDERS=(4 5 6)
DEFAULT_CUTOFF="1e-8"

for limit_order in "${LIMIT_ORDERS[@]}"; do
    run_test "limit-order" "$limit_order" "$DEFAULT_CUTOFF"
done

echo "" | tee -a "$RESULTS_LOG"
echo "=== Part 2: Varying Cut-off ===" | tee -a "$RESULTS_LOG"
echo "" | tee -a "$RESULTS_LOG"

# Part 2: Varying cut-off (1e-4 to 1e-8) with default limit-order (20)
CUT_OFFS=("1e-4" "1e-5" "1e-6" "1e-7" "1e-8")
DEFAULT_LIMIT_ORDER=20

for cut_off in "${CUT_OFFS[@]}"; do
    run_test "cut-off" "$DEFAULT_LIMIT_ORDER" "$cut_off"
done

# Summary
echo "========================================" | tee -a "$RESULTS_LOG"
echo "Test Execution Summary" | tee -a "$RESULTS_LOG"
echo "========================================" | tee -a "$RESULTS_LOG"
echo "Total Tests Run: $((TEST_NUM - 1))" | tee -a "$RESULTS_LOG"
echo "Successful: $SUCCESS_COUNT" | tee -a "$RESULTS_LOG"
echo "Failed: $FAIL_COUNT" | tee -a "$RESULTS_LOG"
echo "" | tee -a "$RESULTS_LOG"
echo "Test Breakdown:" | tee -a "$RESULTS_LOG"
echo "  Part 1 (Varying Limit Order): ${#LIMIT_ORDERS[@]} tests" | tee -a "$RESULTS_LOG"
echo "  Part 2 (Varying Cut-off): ${#CUT_OFFS[@]} tests" | tee -a "$RESULTS_LOG"
echo "  Total: $(( ${#LIMIT_ORDERS[@]} + ${#CUT_OFFS[@]} )) tests" | tee -a "$RESULTS_LOG"
echo "" | tee -a "$RESULTS_LOG"
echo "Results saved in: $OUTPUT_DIR" | tee -a "$RESULTS_LOG"
echo "Full log: $RESULTS_LOG" | tee -a "$RESULTS_LOG"

echo ""
echo "To view the results:"
echo "  cat $RESULTS_LOG"
echo ""
echo "To view individual outputs:"
echo "  ls -lh $OUTPUT_DIR"
