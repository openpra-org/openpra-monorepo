cmake_minimum_required(VERSION 3.18.4)

# In-source build prevention.
set(CMAKE_DISABLE_SOURCE_CHANGES ON)
set(CMAKE_DISABLE_IN_SOURCE_BUILD ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

project(SCRAM VERSION 0.17.0 LANGUAGES C CXX)
set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON)
include(GNUInstallDirs)

# Find and configure LLVM toolchain BEFORE project() call
list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")
message(${CMAKE_MODULE_PATH})

# CMake 3.27 - Address CMP0144 policy warning
# @link https://cmake.org/cmake/help/latest/policy/CMP0167.html#policy:CMP0144
#
# find_package() uses upper-case <PACKAGENAME>_ROOT variables.
#
# In CMake 3.27 and above the find_package(<PackageName>) command now searches prefixes specified by the upper-case
# <PACKAGENAME>_ROOT CMake variable and the <PACKAGENAME>_ROOT environment variable in addition to the case-preserved
# <PackageName>_ROOT and <PackageName>_ROOT variables used since policy CMP0074. This policy provides compatibility with
# projects that have not been updated to avoid using <PACKAGENAME>_ROOT variables for other purposes.
#
# The OLD behavior for this policy is to ignore <PACKAGENAME>_ROOT variables if the original <PackageName> has
# lower-case characters. The NEW behavior for this policy is to use <PACKAGENAME>_ROOT variables.
#
# This policy was introduced in CMake version 3.27. It may be set by cmake_policy() or cmake_minimum_required(). If it
# is not set, CMake warns, and uses OLD behavior.
if(POLICY CMP0144)
  cmake_policy(SET CMP0144 NEW)
endif()

####################### Begin Options ################### {{{

# Memory allocator
set(ALLOWED_MALLOC_TYPES "tcmalloc" "jemalloc" "malloc" CACHE STRING "Allowed memory allocator types: tcmalloc, jemalloc, malloc")
set(MALLOC_TYPE "malloc" CACHE STRING "Select the memory allocator type (tcmalloc, jemalloc, malloc)")
option(WITH_COVERAGE "Instrument for coverage analysis" OFF)
option(WITH_PROFILE "Instrument for performance profiling" OFF)
option(BUILD_TESTS "Build the tests" ON)  # Influences CTest.
option(OPTIMIZE_FOR_NATIVE "Build with -march=native" ON)

####################### End Options ##################### }}}

####################### Begin compiler configurations ################### {{{
# Include FindOpenMP module to enable OpenMP support.
include(FindOpenMP)
if(OPENMP_FOUND)
  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${OpenMP_C_FLAGS}")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${OpenMP_CXX_FLAGS}")
  set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${OpenMP_EXE_LINKER_FLAGS}")
endif()

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)  # Needed for Clang Tooling.

# Default to C++23.
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS ON)

function(CHECK_COMPILER_VERSION MIN_VERSION)
  if(CMAKE_CXX_COMPILER_VERSION VERSION_LESS MIN_VERSION)
    message(FATAL_ERROR "${CMAKE_CXX_COMPILER_ID} Compiler version too old. Required minimum version: ${MIN_VERSION}")
  endif()
endfunction()

add_definitions(-DPROJECT_SOURCE_DIR="${PROJECT_SOURCE_DIR}")  # Needed to print file paths.
add_definitions(-DCMAKE_INSTALL_PREFIX="${CMAKE_INSTALL_PREFIX}")  # Needed for runtime install path detection.

# Generate version.h from version.h.in
set(SCRAM_VERSION_MAJOR ${PROJECT_VERSION_MAJOR})
set(SCRAM_VERSION_MINOR ${PROJECT_VERSION_MINOR})
set(SCRAM_VERSION_PATCH ${PROJECT_VERSION_PATCH})
set(SCRAM_VERSION ${PROJECT_VERSION})

# Try to get git revision info
find_package(Git QUIET)
if(GIT_FOUND AND EXISTS "${PROJECT_SOURCE_DIR}/.git")
  execute_process(
    COMMAND ${GIT_EXECUTABLE} describe --always --dirty
    WORKING_DIRECTORY ${PROJECT_SOURCE_DIR}
    OUTPUT_VARIABLE SCRAM_GIT_REVISION
    OUTPUT_STRIP_TRAILING_WHITESPACE
  )
else()
  set(SCRAM_GIT_REVISION "unknown")
endif()

configure_file(
  "${PROJECT_SOURCE_DIR}/src/version.h.in"
  "${PROJECT_BINARY_DIR}/version.h"
  @ONLY
)

# Proactively disable warnings in case Wall/Wextra are enabled outside.
if(NOT MSVC)
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wno-sign-compare -Wno-missing-field-initializers -Wno-string-plus-int")
endif()

# Strict debug flags for SCRAM targets (opt-in, must subscribe to quality checks explicitly).
# NOTE: This is a list unlike CMAKE_CXX_FLAGS.
#set(SCRAM_CXX_FLAGS_DEBUG -Wall -Wextra -Werror -Wnon-virtual-dtor -Wno-old-style-cast)

# GCC-specific flags (stored in variable to apply to targets later)
set(SCRAM_GCC_SPECIFIC_FLAGS "")

if("${CMAKE_CXX_COMPILER_ID}" STREQUAL "GNU")
  # Don't add to CMAKE_CXX_FLAGS
  set(SCRAM_GCC_SPECIFIC_FLAGS "-fno-new-ttp-matching")  # TODO: Boost ICL failure.
  CHECK_COMPILER_VERSION("7.1")

elseif("${CMAKE_CXX_COMPILER_ID}" STREQUAL "Clang")
  CHECK_COMPILER_VERSION("5.0")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wno-deprecated-declarations -Wno-division-by-zero -Wno-nontrivial-memaccess")
  list(APPEND SCRAM_CXX_FLAGS_DEBUG -Wno-missing-braces -Wshadow -Wno-unused-exception-parameter -Wno-sign-compare -Wno-missing-field-initializers -Wno-string-plus-int -Wno-unused-lambda-capture -Wno-old-style-cast -Wno-deprecated-declarations -Wno-unused-parameter)

elseif("${CMAKE_CXX_COMPILER_ID}" STREQUAL "AppleClang")
  CHECK_COMPILER_VERSION("9.0")
  list(APPEND SCRAM_CXX_FLAGS_DEBUG -Wno-missing-braces -Wshadow -Wno-unused-exception-parameter -Wno-sign-compare -Wno-missing-field-initializers -Wno-string-plus-int -Wno-unused-lambda-capture -Wno-old-style-cast -Wno-deprecated-declarations -Wno-unused-parameter)
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wno-deprecated-declarations -Wno-enum-constexpr-conversion")

elseif("${CMAKE_CXX_COMPILER_ID}" STREQUAL "Intel")
  CHECK_COMPILER_VERSION("18.0.1")
  # TODO: Warning with overload of private override.
  list(APPEND SCRAM_CXX_FLAGS_DEBUG -diag-disable=1125)
endif()

if(WIN32)
  list(APPEND SCRAM_CXX_FLAGS_DEBUG -Wno-error)
endif()

if(WITH_COVERAGE)
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} --coverage")
endif()

if(WITH_PROFILE)
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -pg -fno-omit-frame-pointer")
endif()

if(OPTIMIZE_FOR_NATIVE)
  include(CheckCXXCompilerFlag)
  CHECK_CXX_COMPILER_FLAG("-march=native" COMPILER_SUPPORTS_MARCH_NATIVE)
  if(COMPILER_SUPPORTS_MARCH_NATIVE)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -march=native")
  endif()
endif()

######################## End compiler configurations #################### }}}

##################### Begin cmake configuration ################### {{{

include(CTest)

if(WIN32)
  set(CMAKE_SKIP_RPATH TRUE)
else()
  # Use, i.e. don't skip the full RPATH for the build tree.
  set(CMAKE_SKIP_BUILD_RPATH FALSE)

  # When building,
  # don't use the install RPATH already
  # (but later on when installing).
  set(CMAKE_BUILD_WITH_INSTALL_RPATH FALSE)

  #set(CMAKE_INSTALL_RPATH "${CMAKE_INSTALL_PREFIX}/lib/scram")
  #set(CMAKE_INSTALL_NAME_DIR "${CMAKE_INSTALL_PREFIX}/lib/scram")

  # Add the automatically determined parts of the RPATH,
  # which point to directories outside the build tree
  # to the install RPATH.
  set(CMAKE_INSTALL_RPATH_USE_LINK_PATH TRUE)
endif()

######################## End cmake configuration ################### }}}

# Tell CMake where the modules are.
list(APPEND CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake")
message(${CMAKE_MODULE_PATH})

######################## Begin find libraries ###################### {{{

## set the memory allocator
# profiling on
if(WITH_PROFILE)
  if(NOT MALLOC_TYPE STREQUAL "malloc")
    message(WARNING "memory allocator: Type ${MALLOC_TYPE} disabled during profiling, using malloc")
  endif()
  message(STATUS "memory allocator: malloc")
  set(MALLOC "System Malloc")
  # profiling off
else()
  # non-system allocator requested
  if(NOT MALLOC_TYPE STREQUAL "malloc")
    # requested tcmalloc
    if(MALLOC_TYPE STREQUAL "tcmalloc")
      find_package(Tcmalloc)
      if(Tcmalloc_FOUND)
        list(APPEND LIBS ${Tcmalloc_LIBRARIES})
        set(MALLOC "TCMalloc")
      else ()
        message(FATAL_ERROR "memory allocator: Requested type tcmalloc not found")
      endif ()
      # requested jemalloc
    elseif (MALLOC_TYPE STREQUAL "jemalloc")
      find_package(JeMalloc)
      if(JEMALLOC_FOUND)
        list(APPEND LIBS ${JEMALLOC_LIBRARIES})
        set(MALLOC "JEMalloc")
      else ()
        message(FATAL_ERROR "memory allocator: Requested type jemalloc not found")
      endif ()
      # requested unsupported allocator
    else()
      message(FATAL_ERROR "memory allocator: Requested type ${MALLOC_TYPE} is invalid")
    endif ()
    # system allocator requested
  else()
    set(MALLOC "System Malloc")
  endif()
  message(STATUS "memory allocator: ${MALLOC_TYPE}")
endif()

# Find LibXML2 and dependencies.
# Expose build metadata to C++ via compile definitions
add_compile_definitions(
  SCRAM_BUILD_TYPE="${CMAKE_BUILD_TYPE}"
  SCRAM_WITH_COVERAGE=$<BOOL:${WITH_COVERAGE}>
  SCRAM_WITH_PROFILE=$<BOOL:${WITH_PROFILE}>
  SCRAM_OPTIMIZE_NATIVE=$<BOOL:${OPTIMIZE_FOR_NATIVE}>
  SCRAM_MALLOC_TYPE="${MALLOC}"
)
find_package(LibXml2 REQUIRED)
list(APPEND LIBS LibXml2::LibXml2)

list(APPEND LIBS ${CMAKE_DL_LIBS})

# ---------------------------------------------------------------------------
# Boost configuration --------------------------------------------------------
# ---------------------------------------------------------------------------
# Tell the custom FindBoost.cmake which libraries to build/fetch and how.
# The list must be semicolon-separated for CMake variables.
set(BOOST_INCLUDE_LIBRARIES
    "program_options;filesystem;system;random;range;exception;multi_index;accumulators;multiprecision;icl;math;dll;regex;test"
    CACHE STRING "Boost libraries to build via FetchContent" FORCE)

# Enable Boost's official CMake build and request static libs built with PIC.
set(BOOST_ENABLE_CMAKE ON CACHE BOOL "Build Boost using its new CMake build" FORCE)

# Force static libraries for all dependencies to avoid runtime linking issues
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build static libraries" FORCE)

set(Boost_USE_STATIC_LIBS ON)
set(Boost_USE_MULTITHREADED ON)
set(Boost_USE_STATIC_RUNTIME ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Add required Boost libraries
find_package(Boost REQUIRED)

list(APPEND LIBS
    Boost::program_options
    Boost::filesystem
    Boost::system
    Boost::random
    Boost::range
    Boost::exception
    Boost::multi_index
    Boost::accumulators
    Boost::multiprecision
    Boost::icl
    Boost::math
    Boost::dll
    Boost::regex
    Boost::unit_test_framework
)

########################## End of find libraries ######################## }}}
########################## Begin includes ############################### {{{

# ---- Progress bar (indicators) dependency ----
include(FetchContent)
FetchContent_Declare(
  indicators
  GIT_REPOSITORY https://github.com/p-ranav/indicators.git
  GIT_TAG        v2.3
  GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(indicators)
include_directories(${indicators_SOURCE_DIR}/include)

# Include all the discovered system directories.
include_directories(SYSTEM "${Boost_INCLUDE_DIRS}")
include_directories(SYSTEM "${LIBXML2_INCLUDE_DIRS}")

include_directories("${CMAKE_SOURCE_DIR}")  # Include the core headers via "src".
include_directories("src")  # Include the core headers via "src".
include_directories(${PROJECT_BINARY_DIR} ${PROJECT_SOURCE_DIR})
include_directories("${PROJECT_BINARY_DIR}/include")

# Generate embedded schemas at configure time
set(CMAKE_CURRENT_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}")
set(CMAKE_CURRENT_BINARY_DIR "${CMAKE_CURRENT_BINARY_DIR}")
include("${CMAKE_CURRENT_SOURCE_DIR}/cmake/GenerateEmbeddedSchemas.cmake")


add_subdirectory(src)
add_subdirectory(targets/scram)
add_subdirectory(targets/scram-node)

#if(BUILD_TESTS)
#  # Fetch Catch2 for testing
#  include(FetchContent)
#  FetchContent_Declare(
#    Catch2
#    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
#    GIT_TAG        v3.4.0  # Use latest stable version
#  )
#  FetchContent_MakeAvailable(Catch2)
#
#  # Add Catch2 CMake modules to path
#  list(APPEND CMAKE_MODULE_PATH ${catch2_SOURCE_DIR}/extras)
#
#  # Ensure Catch2 is available before including tests
#  find_package(Catch2 REQUIRED)
#  include(CTest)
#  include(Catch)
#  enable_testing()
#  add_subdirectory(tests)
#endif()
