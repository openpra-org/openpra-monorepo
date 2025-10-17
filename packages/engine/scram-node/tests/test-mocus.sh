#!/bin/bash

# MOCUS test script with various parameter combinations
# Tests:
#   - MOCUS alone with --limit-order 4, 5, 6
#   - MOCUS + --probability + --rare-event with --limit-order 4, 5, 6
#   - MOCUS + --probability + --mcub with --limit-order 4, 5, 6
# Total: 3 configurations × 3 limit-orders × 2 input files = 18 tests

set -e

# Directories
INPUT_DIR="./input"
OUTPUT_DIR="./output/mocus"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Navigate to the tests directory
cd "$SCRIPT_DIR"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Clean previous results
rm -rf "$OUTPUT_DIR"/*

# Test result log
RESULTS_LOG="$OUTPUT_DIR/test_results.log"
echo "SCRAM CLI MOCUS Test Results" > "$RESULTS_LOG"
echo "============================" >> "$RESULTS_LOG"
echo "Date: $(date)" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"
echo "Test Configurations:" >> "$RESULTS_LOG"
echo "  1. MOCUS only (no probability)" >> "$RESULTS_LOG"
echo "  2. MOCUS + --probability + --rare-event" >> "$RESULTS_LOG"
echo "  3. MOCUS + --probability + --mcub" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"
echo "Variable Parameters:" >> "$RESULTS_LOG"
echo "  Limit Order: 4, 5, 6" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"
echo "Input Files:" >> "$RESULTS_LOG"
echo "  - chinese.xml" >> "$RESULTS_LOG"
echo "  - gas_leak_reactive.xml" >> "$RESULTS_LOG"
echo "" >> "$RESULTS_LOG"

# Input files
INPUT_FILES=("chinese.xml" "gas_leak_reactive.xml")

# Parameter arrays
LIMIT_ORDERS=(4 5 6)

# Counter for test numbering
TEST_NUM=1
SUCCESS_COUNT=0
FAIL_COUNT=0

# Function to run a single test
run_test() {
    local input_file=$1
    local limit_order=$2
    local test_type=$3  # "mocus-only", "rare-event", or "mcub"
    
    local test_name="mocus_${test_type}_${input_file%.xml}_lo${limit_order}"
    local output_file="$OUTPUT_DIR/${test_name}_output.xml"
    local stdout_file="$OUTPUT_DIR/${test_name}_stdout.txt"
    local stderr_file="$OUTPUT_DIR/${test_name}_stderr.txt"
    
    echo "========================================" | tee -a "$RESULTS_LOG"
    echo "Test $TEST_NUM: MOCUS - ${test_type}" | tee -a "$RESULTS_LOG"
    echo "========================================" | tee -a "$RESULTS_LOG"
    echo "Input File: $input_file" | tee -a "$RESULTS_LOG"
    echo "Parameters:" | tee -a "$RESULTS_LOG"
    echo "  --limit-order: $limit_order" | tee -a "$RESULTS_LOG"
    
    # Record start time
    START_TIME=$(date +%s)
    
    # Build and run the command based on test type
    EXIT_CODE=0
    if [ "$test_type" = "mocus-only" ]; then
        CMD="scram-cli --mocus --limit-order $limit_order $INPUT_DIR/$input_file --output $output_file"
        echo "  Mode: MOCUS only (no probability)" | tee -a "$RESULTS_LOG"
        scram-cli --mocus \
            --limit-order $limit_order \
            "$INPUT_DIR/$input_file" \
            --output "$output_file" \
            > "$stdout_file" 2> "$stderr_file" || EXIT_CODE=$?
    elif [ "$test_type" = "rare-event" ]; then
        CMD="scram-cli --mocus --probability --rare-event --limit-order $limit_order $INPUT_DIR/$input_file --output $output_file"
        echo "  Mode: MOCUS + probability + rare-event" | tee -a "$RESULTS_LOG"
        scram-cli --mocus --probability --rare-event \
            --limit-order $limit_order \
            "$INPUT_DIR/$input_file" \
            --output "$output_file" \
            > "$stdout_file" 2> "$stderr_file" || EXIT_CODE=$?
    elif [ "$test_type" = "mcub" ]; then
        CMD="scram-cli --mocus --probability --mcub --limit-order $limit_order $INPUT_DIR/$input_file --output $output_file"
        echo "  Mode: MOCUS + probability + mcub" | tee -a "$RESULTS_LOG"
        scram-cli --mocus --probability --mcub \
            --limit-order $limit_order \
            "$INPUT_DIR/$input_file" \
            --output "$output_file" \
            > "$stdout_file" 2> "$stderr_file" || EXIT_CODE=$?
    fi
    
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
echo "Starting MOCUS Tests..."
echo ""

# Test types
TEST_TYPES=("mocus-only" "rare-event" "mcub")

# Run all combinations
for input in "${INPUT_FILES[@]}"; do
    for test_type in "${TEST_TYPES[@]}"; do
        for limit_order in "${LIMIT_ORDERS[@]}"; do
            run_test "$input" "$limit_order" "$test_type"
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
echo "  Test Types: ${#TEST_TYPES[@]} (mocus-only, rare-event, mcub)" | tee -a "$RESULTS_LOG"
echo "  Limit Orders: ${#LIMIT_ORDERS[@]} (4, 5, 6)" | tee -a "$RESULTS_LOG"
echo "  Total: $(( ${#INPUT_FILES[@]} * ${#TEST_TYPES[@]} * ${#LIMIT_ORDERS[@]} ))" | tee -a "$RESULTS_LOG"
echo "" | tee -a "$RESULTS_LOG"
echo "Results saved in: $OUTPUT_DIR" | tee -a "$RESULTS_LOG"
echo "Full log: $RESULTS_LOG" | tee -a "$RESULTS_LOG"

echo ""
echo "To view the results:"
echo "  cat $RESULTS_LOG"
echo ""
echo "To view individual outputs:"
echo "  ls -lh $OUTPUT_DIR"
