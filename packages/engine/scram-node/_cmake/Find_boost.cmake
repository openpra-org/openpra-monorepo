# Find_boost.cmake
# lodash wrapper module that locates the Boost library and associated include directories.

# CMake 3.30 - Address CMP0167 policy warning
# @link https://cmake.org/cmake/help/latest/policy/CMP0167.html#policy:CMP0167
#
# The FindBoost module is removed.
#
# CMake 3.29 and below provide a FindBoost module, but it needs constant updates to keep up with upstream Boost
# releases. Upstream Boost 1.70 and above provide a BoostConfig.cmake package configuration file.
# find_package(Boost CONFIG) finds the upstream package directly, without the find module.
#
# CMake 3.30 and above prefer to not provide the FindBoost module so that find_package(Boost) calls, without the CONFIG
# or NO_MODULE options, find the upstream BoostConfig.cmake directly. This policy provides compatibility for projects
# that have not been ported to use the upstream Boost package.
#
# The OLD behavior of this policy is for find_package(Boost) to load CMake's FindBoost module. The NEW behavior is for
# find_package(Boost) to search for the upstream BoostConfig.cmake.
#
# This policy was introduced in CMake version 3.30. It may be set by cmake_policy() or cmake_minimum_required().
# If it is not set, CMake warns, and uses OLD behavior.
if(POLICY CMP0167)
  cmake_policy(SET CMP0167 NEW)
endif()

if(NOT _boost_FOUND)
  # Check if the system is macOS and Homebrew is installed
  if(APPLE)
      find_program(HOMEBREW_FOUND brew)
      if(HOMEBREW_FOUND)
          execute_process(
              COMMAND brew --prefix boost
              OUTPUT_VARIABLE BOOST_ROOT
              OUTPUT_STRIP_TRAILING_WHITESPACE
          )
      endif()
  endif()

  # Set Boost paths if Homebrew provided a path
  if(DEFINED BOOST_ROOT)
      set(BOOST_INCLUDEDIR "${BOOST_ROOT}/include")
      set(BOOST_LIBRARYDIR "${BOOST_ROOT}/lib")
  else()
      # Default to system paths if BOOST_ROOT is not set
      set(BOOST_INCLUDEDIR "/usr/include")
      set(BOOST_LIBRARYDIR "/usr/lib")
  endif()

  find_package(Boost 1.70.0 REQUIRED COMPONENTS
          program_options filesystem system random unit_test_framework
  )

  if(Boost_FOUND)
      set(_boost_FOUND TRUE BOOL "Flag to indicate that Boost has been configured using this module")
      message(STATUS "Boost Include directory: ${Boost_INCLUDE_DIR}")
      message(STATUS "Boost Library directories: ${Boost_LIBRARY_DIRS}")
      include_directories(SYSTEM ${Boost_INCLUDE_DIR})
      link_libraries(${Boost_LIBRARIES})
  else()
      message(FATAL_ERROR "Boost not found. Please install Boost.")
  endif()

  if(NOT WIN32)
      set(Boost_USE_MULTITHREADED OFF)
  endif()
endif()
