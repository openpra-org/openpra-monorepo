#!/bin/sh

# Function to get the number of CPU threads
get_num_threads() {
    if [ -f /proc/cpuinfo ]; then
        # Linux specific method
        grep -c '^processor' /proc/cpuinfo
    elif command -v sysctl >/dev/null 2>&1; then
        # BSD and macOS method
        sysctl -n hw.ncpu
    elif [ -f /usr/sbin/psrinfo ]; then
        # Solaris method
        /usr/sbin/psrinfo | wc -l
    else
        echo "-1"
        return 1
    fi
}

# Function to get the number of physical CPU cores
get_physical_cores() {
    if command -v lscpu >/dev/null 2>&1; then
        # Linux method using lscpu
        lscpu | awk '/^Core\(s\) per socket:/ {cores_per_socket=$4} /^Socket\(s\):/ {sockets=$2} END {print cores_per_socket * sockets}'
    elif [ -f /proc/cpuinfo ]; then
        # Fallback Linux method using /proc/cpuinfo
        awk '/^physical id/ {print $4}' /proc/cpuinfo | sort -u | wc -l
    elif command -v sysctl >/dev/null 2>&1; then
        # macOS method
        sysctl -n hw.physicalcpu
    elif [ -f /usr/sbin/psrinfo ]; then
        # Solaris method
        kstat -m cpu_info | grep 'core_id' | sort -u | wc -l
    else
        echo "-1"
        return 1
    fi
}

# Attempt to get the number of physical CPU cores
NUM_CORES=$(get_physical_cores)

# If getting physical cores failed, fall back to threads and divide by 2
if [ "$NUM_CORES" -eq "-1" ]; then
    NUM_THREADS=$(get_num_threads)
    if [ "$NUM_THREADS" -eq "-1" ]; then
        NUM_CORES="-1"
    else
        NUM_CORES=$((NUM_THREADS / 2))
    fi
fi

# Export the number of CPU cores as an environment variable
#export NUM_CORES

# Optionally, you can print the value to verify
echo "$NUM_CORES"
