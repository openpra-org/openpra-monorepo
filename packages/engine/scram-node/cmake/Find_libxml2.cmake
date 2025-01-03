# Find_libxml2.cmake
# Locate LibXML2 library and include directories.

if(NOT _libxml2_FOUND)
  find_package(LibXml2 REQUIRED)
  if(LIBXML2_FOUND)
      set(_libxml2_FOUND TRUE BOOL "Flag to indicate that LibXML2 has been configured once using this module")
      list(APPEND LIBS ${LIBXML2_LIBRARIES})
      message(STATUS "Found LibXML2: ${LIBXML2_INCLUDE_DIR}")
      include_directories(${LIBXML2_INCLUDE_DIR})
      include_directories(SYSTEM "${LIBXML2_INCLUDE_DIR}")
      link_libraries(${LIBXML2_LIBRARIES})
  else()
      message(FATAL_ERROR "LibXML2 not found. Please install LibXML2.")
  endif()
endif()