# Find_openmp.cmake
# Locate OpenMP support and configure the project accordingly.

if(NOT _openmp_FOUND)
  find_package(OpenMP)

  if(OpenMP_CXX_FOUND)
      set(_openmp_FOUND TRUE BOOL "Flag to indicate that OpenMP has been configured once using this module")
      message(STATUS "OpenMP found")
      message(STATUS "    OpenMP_CXX_VERSION: ${OpenMP_CXX_VERSION}")
      message(STATUS "    OpenMP_CXX_FLAGS: ${OpenMP_CXX_FLAGS}")
      message(STATUS "    OpenMP_CXX_INCLUDE_DIRS: ${OpenMP_CXX_INCLUDE_DIRS}")
      message(STATUS "    OpenMP_CXX_LIBRARIES: ${OpenMP_CXX_LIBRARIES}")

      set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${OpenMP_CXX_FLAGS}")
      include_directories(${OpenMP_CXX_INCLUDE_DIRS})
      link_libraries(${OpenMP_CXX_LIBRARIES})
  else()
      message(WARNING "OpenMP not found. Continuing without OpenMP support.")
  endif()

  if(APPLE)
      execute_process(
          COMMAND brew --prefix libomp
          OUTPUT_VARIABLE HOMEBREW_LIBOMP_PATH
          OUTPUT_STRIP_TRAILING_WHITESPACE
      )
      if(HOMEBREW_LIBOMP_PATH)
          set(OpenMP_CXX_FLAGS "-Xpreprocessor -fopenmp")
          set(OpenMP_CXX_LIB_NAMES "omp")
          set(OpenMP_omp_LIBRARY "${HOMEBREW_LIBOMP_PATH}/lib/libomp.dylib")

          # Set include and library directories
          include_directories(SYSTEM "${HOMEBREW_LIBOMP_PATH}/include")
          link_directories("${HOMEBREW_LIBOMP_PATH}/lib")

          # Set LDFLAGS and CPPFLAGS as suggested by brew
          set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -I${HOMEBREW_LIBOMP_PATH}/include")
          set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -L${HOMEBREW_LIBOMP_PATH}/lib")
          set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} -L${HOMEBREW_LIBOMP_PATH}/lib")

          message(STATUS "Using Homebrew libomp: ${HOMEBREW_LIBOMP_PATH}")
          set(_openmp_FOUND TRUE BOOL "Flag to indicate that OpenMP has been configured once using this module")
      else()
          message(WARNING "Homebrew libomp not found. OpenMP support may be limited.")
      endif()
  endif()
endif()