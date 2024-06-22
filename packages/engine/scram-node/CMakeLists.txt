cmake_minimum_required(VERSION 3.18.4)

# In-source build prevention.
set(CMAKE_DISABLE_SOURCE_CHANGES ON)
set(CMAKE_DISABLE_IN_SOURCE_BUILD ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

project(scram-engine VERSION 0.16.2 LANGUAGES CXX)

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
# Include FindOpenMP module to enable OpenMP support.
include(FindOpenMP)
if(OPENMP_FOUND)
  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${OpenMP_C_FLAGS}")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${OpenMP_CXX_FLAGS}")
  set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${OpenMP_EXE_LINKER_FLAGS}")
endif()

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)  # Needed for Clang Tooling.

# Default to C++17.
set(CMAKE_CXX_STANDARD 17)
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
  set(CMAKE_BUILD_WITH_INSTALL_RPATH FALSE)

  set(CMAKE_INSTALL_RPATH "${CMAKE_INSTALL_PREFIX}/lib/scram")
  set(CMAKE_INSTALL_NAME_DIR "${CMAKE_INSTALL_PREFIX}/lib/scram")

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
find_package(LibXml2 REQUIRED)
list(APPEND LIBS ${LIBXML2_LIBRARIES})

# Include the boost header files and the program_options library.
# Please be sure to use Boost rather than BOOST.
set(BOOST_MIN_VERSION "1.61.0")

if(NOT WIN32)
  set(Boost_USE_MULTITHREADED OFF)
endif()

find_package(Boost ${BOOST_MIN_VERSION} REQUIRED COMPONENTS
        program_options filesystem system random
)
message(STATUS "Boost Include directory: ${Boost_INCLUDE_DIR}")
message(STATUS "Boost Library directories: ${Boost_LIBRARY_DIRS}")
list(APPEND LIBS ${Boost_LIBRARIES})

list(APPEND LIBS ${CMAKE_DL_LIBS})

message(STATUS "Libraries: ${LIBS}")
########################## End of find libraries ######################## }}}
########################## Begin includes ############################### {{{

# Include all the discovered system directories.
include_directories(SYSTEM "${Boost_INCLUDE_DIR}")
include_directories(SYSTEM "${LIBXML2_INCLUDE_DIR}")

include_directories("${CMAKE_SOURCE_DIR}")  # Include the core headers via "src".
include_directories("src")  # Include the core headers via "src".

add_subdirectory(src)
add_subdirectory(targets/scram-cli)
add_subdirectory(targets/scram-node)

if(BUILD_TESTS)
  add_subdirectory(tests)
endif()
