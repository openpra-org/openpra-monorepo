cmake_minimum_required(VERSION 3.18.4)

# In-source build prevention.
set(CMAKE_DISABLE_SOURCE_CHANGES ON)
set(CMAKE_DISABLE_IN_SOURCE_BUILD ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Detect compiler before project() call
if(APPLE)
  execute_process(
    COMMAND brew --prefix llvm
    OUTPUT_VARIABLE HOMEBREW_LLVM_PATH
    OUTPUT_STRIP_TRAILING_WHITESPACE
  )
  message(STATUS "Homebrew LLVM path: ${HOMEBREW_LLVM_PATH}")

  if(HOMEBREW_LLVM_PATH AND EXISTS "${HOMEBREW_LLVM_PATH}/bin/clang++")
    set(CMAKE_C_COMPILER "${HOMEBREW_LLVM_PATH}/bin/clang")
    set(CMAKE_CXX_COMPILER "${HOMEBREW_LLVM_PATH}/bin/clang++")
    message(STATUS "Using Clang/Clang++ from Homebrew LLVM")

    # Add LLVM bin directory to PATH for other LLVM tools
    set(ENV{PATH} "${HOMEBREW_LLVM_PATH}/bin:$ENV{PATH}")
  else()
    message(FATAL_ERROR "Homebrew LLVM Clang++ not found. Please check your LLVM installation.")
  endif()
endif()

project(scram-engine VERSION 0.16.2 LANGUAGES CXX)

# Tell CMake where the modules are.
list(APPEND CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake")
message(STATUS "CMAKE_MODULE_PATH: ${CMAKE_MODULE_PATH}")

# Add these lines for Node.js configuration
execute_process(COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})

execute_process(COMMAND node -p "process.versions.node"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_VERSION
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

execute_process(COMMAND node -p "process.release.libpath"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_LIBPATH
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

include_directories(${NODE_ADDON_API_DIR} ${CMAKE_JS_INC})
add_definitions(-DNAPI_VERSION=3)

# Print compiler information
message(STATUS "C compiler: ${CMAKE_C_COMPILER}")
message(STATUS "C++ compiler: ${CMAKE_CXX_COMPILER}")
message(STATUS "C++ compiler version: ${CMAKE_CXX_COMPILER_VERSION}")

# Address CMP0144 policy warning
if(POLICY CMP0144)
  cmake_policy(SET CMP0144 NEW)
endif()

# Address CMP0167 policy warning
if(POLICY CMP0167)
  cmake_policy(SET CMP0167 NEW)
endif()

####################### Begin Options ################### {{{

# Memory allocator
set(ALLOWED_MALLOC_TYPES "tcmalloc" "jemalloc" "malloc" CACHE STRING "Allowed memory allocator types: tcmalloc, jemalloc, malloc")
set(MALLOC_TYPE "tcmalloc" CACHE STRING "Select the memory allocator type (tcmalloc, jemalloc, malloc)")
option(WITH_COVERAGE "Instrument for coverage analysis" OFF)
option(WITH_PROFILE "Instrument for performance profiling" OFF)
option(BUILD_TESTS "Build the tests" ON)  # Influences CTest.
option(OPTIMIZE_FOR_NATIVE "Build with -march=native" OFF)

####################### End Options ##################### }}}

####################### Begin compiler configurations ################### {{{
find_package(_boost REQUIRED)
find_package(_openmp)
find_package(_libxml2 REQUIRED)

# Default to C++20.
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

function(CHECK_COMPILER_VERSION MIN_VERSION)
  if(CMAKE_CXX_COMPILER_VERSION VERSION_LESS MIN_VERSION)
    message(FATAL_ERROR "${CMAKE_CXX_COMPILER_ID} Compiler version too old. Required minimum version: ${MIN_VERSION}")
  endif()
endfunction()

add_definitions(-DPROJECT_SOURCE_DIR="${PROJECT_SOURCE_DIR}")  # Needed to print file paths.

# Proactively disable warnings in case Wall/Wextra are enabled outside.
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wno-sign-compare -Wno-missing-field-initializers -Wno-string-plus-int")

# Strict debug flags for SCRAM targets (opt-in, must subscribe to quality checks explicitly).
# NOTE: This is a list unlike CMAKE_CXX_FLAGS.
set(SCRAM_CXX_FLAGS_DEBUG -Wall -Wextra -Werror -Wnon-virtual-dtor -Wold-style-cast)

if("${CMAKE_CXX_COMPILER_ID}" STREQUAL "GNU")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-new-ttp-matching")  # TODO: Boost ICL failure.
  CHECK_COMPILER_VERSION("7.1")
  list(APPEND SCRAM_CXX_FLAGS_DEBUG
          -Wredundant-decls -Wcast-align -Wlogical-op -Wvla -Wuseless-cast -Wunreachable-code
          -Wshadow -Wpedantic -Wmissing-declarations
          -Wimplicit-fallthrough=0  # TODO: Consider explicit fallthrough.
  )

elseif("${CMAKE_CXX_COMPILER_ID}" STREQUAL "Clang")
  CHECK_COMPILER_VERSION("5.0")
  list(APPEND SCRAM_CXX_FLAGS_DEBUG -Wno-missing-braces -Wshadow -Wunused-exception-parameter)

elseif("${CMAKE_CXX_COMPILER_ID}" STREQUAL "AppleClang")
  CHECK_COMPILER_VERSION("9.0")

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
  set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)

  set(CMAKE_INSTALL_RPATH "${CMAKE_INSTALL_PREFIX}/lib/scram")
  set(CMAKE_INSTALL_NAME_DIR "${CMAKE_INSTALL_PREFIX}/lib/scram")

  # Add the automatically determined parts of the RPATH,
  # which point to directories outside the build tree
  # to the install RPATH.
  set(CMAKE_INSTALL_RPATH_USE_LINK_PATH TRUE)
endif()

######################## End cmake configuration ################### }}}

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

list(APPEND LIBS ${CMAKE_DL_LIBS})

message(STATUS "Libraries: ${LIBS}")
########################## End of find libraries ######################## }}}
########################## Begin includes ############################### {{{


include_directories("${CMAKE_SOURCE_DIR}")  # Include the core headers via "src".
include_directories("src")  # Include the core headers via "src".

add_subdirectory(src)
add_subdirectory(targets/scram-cli)
add_subdirectory(targets/scram-node)

target_link_libraries(scram-node PRIVATE ${CMAKE_JS_LIB})
set_target_properties(scram-node PROPERTIES PREFIX "" SUFFIX ".node")
target_include_directories(scram-node PRIVATE ${CMAKE_JS_INC})

if(BUILD_TESTS)
  add_subdirectory(tests)
endif()