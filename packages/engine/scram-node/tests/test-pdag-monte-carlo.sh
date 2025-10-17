#!/bin/bash

# PDAG Monte Carlo parameter test script
# Tests --pdag with --monte-carlo --probability and various parameter combinations
# Parameters tested:
#   --num-trials: 100
#   --confidence: 0.95
#   --limit-order: 4, 5, 6
#   --cut-off: 1e-4, 1e-5, 1e-6, 1e-7, 1e-8

set -e

# Directories
INPUT_DIR="./input"
OUTPUT_DIR="./output/pdag-monte-carlo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Navigate to the tests directory
cd "$SCRIPT_DIR"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Clean previous results
rm -rf "$OUTPUT_DIR"/*

# Test result log
RESULTS_LOG="$OUTPUT_DIR/test_results.log"
echo "SCRAM CLI PDAG Monte Carlo Parameter Test Results" > "$RESULTS_LOG"
echo "==================================================" >> "$RESULTS_LOG"
echo "Date: $(date)" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"
echo "Fixed Parameters:" >> "$RESULTS_LOG"
echo "  Algorithm: --pdag" >> "$RESULTS_LOG"
echo "  Approximation: --monte-carlo" >> "$RESULTS_LOG"
echo "  Analysis: --probability" >> "$RESULTS_LOG"
echo "  Num Trials: 100" >> "$RESULTS_LOG"
echo "  Confidence: 0.95" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"
echo "Variable Parameters:" >> "$RESULTS_LOG"
echo "  Limit Order: 4, 5, 6" >> "$RESULTS_LOG"
echo "  Cut-off: 1e-4, 1e-5, 1e-6, 1e-7, 1e-8" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"

# Input files
INPUT_FILES=("chinese.xml" "gas_leak_reactive.xml")

# Parameter arrays
LIMIT_ORDERS=(4 5 6)
CUT_OFFS=("1e-4" "1e-5" "1e-6" "1e-7" "1e-8")

# Fixed parameters
NUM_TRIALS=100
CONFIDENCE=0.95

# Counter for test numbering
TEST_NUM=1
SUCCESS_COUNT=0
FAIL_COUNT=0

# Function to run a single test
run_test() {
    local input_file=$1
    local limit_order=$2
    local cut_off=$3
    
    local test_name="pdag_mc_${input_file%.xml}_lo${limit_order}_co${cut_off}"
    local output_file="$OUTPUT_DIR/${test_name}_output.xml"
    local stdout_file="$OUTPUT_DIR/${test_name}_stdout.txt"
    local stderr_file="$OUTPUT_DIR/${test_name}_stderr.txt"
    
    echo "========================================" | tee -a "$RESULTS_LOG"
    echo "Test $TEST_NUM: PDAG Monte Carlo" | tee -a "$RESULTS_LOG"
    echo "========================================" | tee -a "$RESULTS_LOG"
    echo "Input File: $input_file" | tee -a "$RESULTS_LOG"
    echo "Parameters:" | tee -a "$RESULTS_LOG"
    echo "  --limit-order: $limit_order" | tee -a "$RESULTS_LOG"
    echo "  --cut-off: $cut_off" | tee -a "$RESULTS_LOG"
    
    # Record start time
    START_TIME=$(date +%s)
    
    # Build the command
    CMD="scram-cli --pdag --monte-carlo --probability --num-trials $NUM_TRIALS --confidence $CONFIDENCE --limit-order $limit_order --cut-off $cut_off $INPUT_DIR/$input_file --output $output_file"
    
    # Run the command and capture output
    EXIT_CODE=0
    scram-cli --pdag --monte-carlo --probability \
        --num-trials $NUM_TRIALS \
        --confidence $CONFIDENCE \
        --limit-order $limit_order \
        --cut-off $cut_off \
        "$INPUT_DIR/$input_file" \
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
echo "Starting PDAG Monte Carlo Parameter Tests..."
echo ""

# Run all combinations
for input in "${INPUT_FILES[@]}"; do
    for limit_order in "${LIMIT_ORDERS[@]}"; do
        for cut_off in "${CUT_OFFS[@]}"; do
            run_test "$input" "$limit_order" "$cut_off"
        done
    done
done

# Summary
echo "========================================" | tee -a "$RESULTS_LOG"
echo "Test Execution Summary" | tee -a "$RESULTS_LOG"
echo "========================================" | tee -a "$RESULTS_LOG"
echo "Total Tests Run: $((TEST_NUM - 1))" | tee -a "$RESULTS_LOG"
echo "Successful: $SUCCESS_COUNT" | tee -a "$RESULTS_LOG"
echo "Failed: $FAIL_COUNT" | tee -a "$RESULTS_LOG"
echo "" | tee -a "$RESULTS_LOG"
echo "Test Combinations:" | tee -a "$RESULTS_LOG"
echo "  Input Files: ${#INPUT_FILES[@]}" | tee -a "$RESULTS_LOG"
echo "  Limit Orders: ${#LIMIT_ORDERS[@]}" | tee -a "$RESULTS_LOG"
echo "  Cut-offs: ${#CUT_OFFS[@]}" | tee -a "$RESULTS_LOG"
echo "  Total: $(( ${#INPUT_FILES[@]} * ${#LIMIT_ORDERS[@]} * ${#CUT_OFFS[@]} ))" | tee -a "$RESULTS_LOG"
echo "" | tee -a "$RESULTS_LOG"
echo "Results saved in: $OUTPUT_DIR" | tee -a "$RESULTS_LOG"
echo "Full log: $RESULTS_LOG" | tee -a "$RESULTS_LOG"

echo ""
echo "To view the results:"
echo "  cat $RESULTS_LOG"
echo ""
echo "To view individual outputs:"
echo "  ls -lh $OUTPUT_DIR"
