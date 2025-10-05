#!/usr/bin/env python3
"""
Benchmark script for running scram-cli with different compilation passes
on a set of XML input files.
"""

import argparse
import glob
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Dict, Any
import json
import os


def run_scram_cli(xml_file: str, compilation_pass: int, use_no_kn: bool = False, use_no_xor: bool = False, timeout: int = 300) -> Dict[str, Any]:
    """
    Run scram-cli on a single XML file with specified compilation pass.
    
    Args:
        xml_file: Path to the XML input file
        compilation_pass: Compilation pass value (0-8)
        use_no_kn: Whether to use the --no-kn flag
        use_no_xor: Whether to use the --no-xor flag
        timeout: Timeout in seconds for the subprocess
        
    Returns:
        Dictionary with results including success status, timing, and any errors
    """
    result = {
        'file': xml_file,
        'compilation_pass': compilation_pass,
        'no_kn': use_no_kn,
        'no_xor': use_no_xor,
        'success': False,
        'duration': None,
        'error': None,
        'stdout': None,
        'stderr': None
    }
    
    # Build the command
    cmd = [
        './scram-cli',
        '--preprocessor',
        '--ccf',
    ]
    
    if use_no_kn:
        cmd.append('--no-kn')
    
    if use_no_xor:
        cmd.append('--no-xor')
    
    cmd.extend([
        '--compilation-passes', str(compilation_pass),
        xml_file
    ])
    
    # Record start time
    start_time = time.time()
    
    try:
        print(cmd)
        # Run the command with timeout
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        # Record duration
        result['duration'] = time.time() - start_time
        result['success'] = completed.returncode == 0
        result['stdout'] = completed.stdout
        result['stderr'] = completed.stderr
        
        if completed.returncode != 0:
            result['error'] = f"Process exited with code {completed.returncode}"
            
    except subprocess.TimeoutExpired as e:
        result['duration'] = timeout
        result['error'] = f"Timeout after {timeout} seconds"
        result['stdout'] = e.stdout.decode() if e.stdout else None
        result['stderr'] = e.stderr.decode() if e.stderr else None
        
    except Exception as e:
        result['duration'] = time.time() - start_time
        result['error'] = f"Exception: {type(e).__name__}: {str(e)}"
    
    return result


def benchmark_compilation_passes(
    files_or_pattern: Any,
    min_pass: int = 0,
    max_pass: int = 8,
    timeout: int = 300,
    output_file: str = None,
    run_variants: str = 'both'
) -> List[Dict[str, Any]]:
    """
    Run scram-cli with different compilation passes on XML files.
    
    Args:
        files_or_pattern: Either a glob pattern string or a list of file paths
        min_pass: Minimum compilation pass value (default: 0)
        max_pass: Maximum compilation pass value (default: 8)
        timeout: Timeout per run in seconds (default: 300)
        output_file: Optional JSON file to save results
        run_variants: Which variants to run: 'all', 'default', 'no-kn', 'no-xor', or 'both-flags' (default: 'all')
        
    Returns:
        List of result dictionaries
    """
    # Handle both pattern string and list of files
    if isinstance(files_or_pattern, str):
        # It's a pattern, use glob
        xml_files = glob.glob(files_or_pattern, recursive=True)
        if not xml_files:
            print(f"No files found matching pattern: {files_or_pattern}")
            return []
    elif isinstance(files_or_pattern, list):
        # It's a list of files
        xml_files = files_or_pattern
    else:
        print("Error: files_or_pattern must be either a string pattern or a list of files")
        return []
    
    print(f"Found {len(xml_files)} XML files")
    
    # Check if scram-cli exists
    if not os.path.exists('./scram-cli'):
        print("Error: scram-cli executable not found in current directory")
        return []
    
    results = []
    
    # Determine which variants to run
    variants_to_run = []
    if run_variants in ['all', 'default']:
        variants_to_run.append(('default', False, False))
    if run_variants in ['all', 'no-kn']:
        variants_to_run.append(('--no-kn', True, False))
    if run_variants in ['all', 'no-xor']:
        variants_to_run.append(('--no-xor', False, True))
    if run_variants in ['all', 'both-flags']:
        variants_to_run.append(('--no-kn+--no-xor', True, True))
    
    if not variants_to_run:
        print(f"Error: Invalid run_variants value: {run_variants}. Use 'all', 'default', 'no-kn', 'no-xor', or 'both-flags'")
        return []
    
    # Calculate total runs
    total_runs = len(xml_files) * (max_pass - min_pass + 1) * len(variants_to_run)
    completed_runs = 0
    
    # Iterate through all files and compilation passes
    for xml_file in xml_files:
        print(f"\nProcessing: {xml_file}")
        
        for compilation_pass in range(min_pass, max_pass + 1):
            for variant_name, use_no_kn, use_no_xor in variants_to_run:
                completed_runs += 1
                print(f"  Pass {compilation_pass} ({variant_name}) ({completed_runs}/{total_runs})...", end='', flush=True)
                
                result = run_scram_cli(xml_file, compilation_pass, use_no_kn=use_no_kn, use_no_xor=use_no_xor, timeout=timeout)
                results.append(result)
                
                if result['success']:
                    print(f" ✓ ({result['duration']:.2f}s)")
                elif result['error'] and 'Timeout' in result['error']:
                    print(f" ⏱ (timeout)")
                else:
                    print(f" ✗ ({result['error']})")
    
    # Save results if output file specified
    if output_file:
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to: {output_file}")
    
    # Print summary
    successful = sum(1 for r in results if r['success'])
    timeouts = sum(1 for r in results if r['error'] and 'Timeout' in r['error'])
    failures = len(results) - successful - timeouts
    
    print(f"\nSummary:")
    print(f"  Total runs: {len(results)}")
    print(f"  Successful: {successful}")
    print(f"  Timeouts: {timeouts}")
    print(f"  Failures: {failures}")
    
    return results


def print_performance_table(results: List[Dict[str, Any]]):
    """Print a performance comparison table."""
    if not results:
        return
    
    # Group results by file and flag variant
    from collections import defaultdict
    by_file = defaultdict(lambda: defaultdict(dict))
    
    for result in results:
        if result['success']:
            # Create variant key based on flags
            variant_key = 'default'
            if result.get('no_kn', False) and result.get('no_xor', False):
                variant_key = 'both_flags'
            elif result.get('no_kn', False):
                variant_key = 'no_kn'
            elif result.get('no_xor', False):
                variant_key = 'no_xor'
            
            by_file[result['file']][variant_key][result['compilation_pass']] = result['duration']
    
    print("\nPerformance Comparison (seconds):")
    print("Legend: Def=Default, KN=--no-kn, XOR=--no-xor, BF=both flags")
    print("=" * 140)
    
    # Print header for passes 0-8
    header = f"{'File':<25} | "
    for p in range(9):
        header += f"{'Pass ' + str(p):^12} | "
    print(header)
    
    sub_header = f"{' ':<25} | "
    for p in range(9):
        sub_header += f"{'Def':>3} {'KN':>3} {'XOR':>3} {'BF':>3} | "
    print(sub_header)
    print("-" * 140)
    
    for file_path, variants in sorted(by_file.items()):
        file_name = Path(file_path).name[:24]
        row = f"{file_name:<25} | "
        
        for p in range(9):
            # Default variant
            if 'default' in variants and p in variants['default']:
                row += f"{variants['default'][p]:>3.1f}"
            else:
                row += f"{'--':>3}"
            
            row += " "
            
            # --no-kn variant
            if 'no_kn' in variants and p in variants['no_kn']:
                row += f"{variants['no_kn'][p]:>3.1f}"
            else:
                row += f"{'--':>3}"
            
            row += " "
            
            # --no-xor variant
            if 'no_xor' in variants and p in variants['no_xor']:
                row += f"{variants['no_xor'][p]:>3.1f}"
            else:
                row += f"{'--':>3}"
            
            row += " "
            
            # both flags variant
            if 'both_flags' in variants and p in variants['both_flags']:
                row += f"{variants['both_flags'][p]:>3.1f}"
            else:
                row += f"{'--':>3}"
            
            row += " | "
        
        print(row)
    
    # Print summary statistics
    print("\n" + "=" * 140)
    print("\nSummary Statistics:")
    
    # Calculate speedup/slowdown for each variant compared to default
    variant_comparisons = {
        'no_kn': '--no-kn',
        'no_xor': '--no-xor', 
        'both_flags': '--no-kn+--no-xor'
    }
    
    for variant_key, variant_name in variant_comparisons.items():
        speedups = []
        for file_path, variants in by_file.items():
            if 'default' in variants and variant_key in variants:
                for p in range(9):
                    if p in variants['default'] and p in variants[variant_key]:
                        default_time = variants['default'][p]
                        variant_time = variants[variant_key][p]
                        speedup = (default_time - variant_time) / default_time * 100
                        speedups.append(speedup)
        
        if speedups:
            avg_speedup = sum(speedups) / len(speedups)
            print(f"Average performance change with {variant_name}: {avg_speedup:+.1f}%")
            if avg_speedup > 0:
                print(f"  (Positive means {variant_name} is faster)")
            else:
                print(f"  (Negative means {variant_name} is slower)")


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark scram-cli with different compilation passes"
    )
    parser.add_argument(
        'files',
        nargs='+',
        help='XML files or wildcard pattern (e.g., "input/**/*.xml")'
    )
    parser.add_argument(
        '--min-pass',
        type=int,
        default=0,
        help='Minimum compilation pass value (default: 0)'
    )
    parser.add_argument(
        '--max-pass',
        type=int,
        default=8,
        help='Maximum compilation pass value (default: 8)'
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=300,
        help='Timeout per run in seconds (default: 300)'
    )
    parser.add_argument(
        '--output',
        '-o',
        help='Output JSON file for results'
    )
    parser.add_argument(
        '--table',
        action='store_true',
        help='Print performance comparison table'
    )
    parser.add_argument(
        '--variants',
        choices=['all', 'default', 'no-kn', 'no-xor', 'both-flags'],
        default='all',
        help='Which variants to run (default: all)'
    )
    
    args = parser.parse_args()
    
    # Determine if we have a pattern or list of files
    if len(args.files) == 1:
        # Could be either a single file or a pattern
        files_or_pattern = args.files[0]
    else:
        # Multiple files provided
        files_or_pattern = args.files
    
    # Run the benchmark
    results = benchmark_compilation_passes(
        files_or_pattern,
        args.min_pass,
        args.max_pass,
        args.timeout,
        args.output,
        args.variants
    )
    
    # Print performance table if requested
    if args.table:
        print_performance_table(results)


if __name__ == '__main__':
    main()
