# Find_boost.cmake
# Locate Boost library and include directories.

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

  find_package(Boost 1.61.0 REQUIRED COMPONENTS
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
