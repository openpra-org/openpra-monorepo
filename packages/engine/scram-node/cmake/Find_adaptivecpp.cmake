#Use add_definitions for now for older cmake versions
cmake_policy(SET CMP0005 NEW)

set(ACPP_COMPILER_FEATURE_PROFILE "full" CACHE STRING "AdaptiveCpp feature profile")
set(ACPP_STDPAR "on" CACHE STRING "enables SYCL offloading of C++ standard parallel algorithms")
set(ACPP_USE_ACCELERATED_CPU "on" CACHE STRING "enables SYCL offloading of C++ standard parallel algorithms")
set(ACPP_TARGETS "generic" CACHE STRING "enables SYCL offloading of C++ standard parallel algorithms")

find_package(AdaptiveCpp CONFIG REQUIRED)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

if(NOT ACPP_DEBUG_LEVEL)
    if(CMAKE_BUILD_TYPE MATCHES "Debug")
        set(ACPP_DEBUG_LEVEL 4 CACHE STRING
                "Choose the debug level, options are: 0 (no debug), 1 (print errors), 2 (also print warnings), 3 (also print general information)"
                FORCE)
    else()
        set(ACPP_DEBUG_LEVEL 0 CACHE STRING
                "Choose the debug level, options are: 0 (no debug), 1 (print errors), 2 (also print warnings), 3 (also print general information)"
                FORCE)
    endif()
endif()

add_definitions(-DHIPSYCL_DEBUG_LEVEL=${ACPP_DEBUG_LEVEL})

if(WIN32)
    add_definitions(-D_USE_MATH_DEFINES)
endif()

# Using accelerated C++ standard parallelism
#
# @link https://github.com/AdaptiveCpp/AdaptiveCpp/blob/develop/doc/stdpar.md
#
# Offloading of C++ standard parallelism is enabled using `--acpp-stdpar`. This flag does not by itself imply a target
# or compilation flow, which will have to be provided in addition using the normal --acpp-targets argument. C++ standard
# parallelism is expected to work with any of our clang compiler-based compilation flows, such as omp.accelerated, cuda,
# hip or the generic SSCP compiler (--acpp-targets=generic). It is not currently supported in library-only compilation
# flows. The focus of testing currently is the generic SSCP compiler. AdaptiveCpp by default uses some experimental
# heuristics to determine if a problem is worth offloading. These heuristics are currently very simplistic and might not
# work well for you. They can be disabled using --acpp-stdpar-unconditional-offload.
#
# Enable full feature profile for AdaptiveCpp

add_definitions(-DACPP_COMPILER_FEATURE_PROFILE=full)
add_definitions(-DACPP_STDPAR=on)
add_definitions(-DACPP_USE_ACCELERATED_CPU=on)
add_definitions(-DACPP_TARGETS=generic)

# ──────────────────────────────────────────────────────────────────────────
# Make AdaptiveCpp targets available to the project
# ──────────────────────────────────────────────────────────────────────────
if(AdaptiveCpp_FOUND)
    # Create an alias for backward compatibility with SYCL::SYCL
    if(TARGET AdaptiveCpp::acpp-rt AND NOT TARGET SYCL::SYCL)
        add_library(SYCL::SYCL ALIAS AdaptiveCpp::acpp-rt)
    endif()
    
    # Set SYCL_LIBRARIES for compatibility with existing code
    set(SYCL_LIBRARIES AdaptiveCpp::acpp-rt CACHE STRING "SYCL libraries from AdaptiveCpp")
    
    # Add AdaptiveCpp libraries to the global LIBS list
    list(APPEND LIBS AdaptiveCpp::acpp-rt)
    
    # Include AdaptiveCpp headers - these should be available via the target
    # but we can also add them explicitly if needed
    get_target_property(ACPP_INCLUDE_DIRS AdaptiveCpp::acpp-rt INTERFACE_INCLUDE_DIRECTORIES)
    if(ACPP_INCLUDE_DIRS)
        include_directories(${ACPP_INCLUDE_DIRS})
    endif()
endif()

# ──────────────────────────────────────────────────────────────────────────
# Diagnostic output – everything that is relevant for AdaptiveCpp
# ──────────────────────────────────────────────────────────────────────────
if(AdaptiveCpp_FOUND)
    message(STATUS "")
    message(STATUS "====================================================")
    message(STATUS "AdaptiveCpp located")
    message(STATUS "  AdaptiveCpp version : ${AdaptiveCpp_VERSION}")
    message(STATUS "  AdaptiveCpp config  : ${AdaptiveCpp_DIR}")
    message(STATUS "----------------------------------------------------")

    # Dump every variable that starts with the ACPP_ prefix
    get_cmake_property(_acpp_vars VARIABLES)
    foreach(_v ${_acpp_vars})
        if(_v MATCHES "^ACPP_")
            message(STATUS "  ${_v} = ${${_v}}")
        endif()
    endforeach()

    # A few other variables that are often useful to see
    message(STATUS "  SYCL_TARGETS        : ${SYCL_TARGETS}")
    message(STATUS "  HIPSYCL_TARGETS     : ${HIPSYCL_TARGETS}")
    message(STATUS "  SYCL_LIBRARIES      : ${SYCL_LIBRARIES}")
    if(TARGET AdaptiveCpp::acpp-rt)
        message(STATUS "  AdaptiveCpp::acpp-rt: Available")
        get_target_property(ACPP_INCLUDE_DIRS AdaptiveCpp::acpp-rt INTERFACE_INCLUDE_DIRECTORIES)
        if(ACPP_INCLUDE_DIRS)
            message(STATUS "  ACPP Include Dirs   : ${ACPP_INCLUDE_DIRS}")
        endif()
    else()
        message(WARNING "  AdaptiveCpp::acpp-rt: NOT FOUND!")
    endif()
    message(STATUS "====================================================")
    message(STATUS "")
endif()
# ──────────────────────────────────────────────────────────────────────────