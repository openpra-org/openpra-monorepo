# Find_libxml2.cmake
# Locate LibXML2 using FetchContent and configure the project accordingly.

# Silence nested find_package() name mismatch warnings that arise inside
# libxml2's CMake scripts (they call find_package_handle_standard_args(PkgConfig)
# while the outer find_package name is LibXml2).  Set the documented escape
# hatch before bringing in the sub-project and restore the previous value
# afterwards.
set(_scram_prev_fphsa_name_mismatched ${FPHSA_NAME_MISMATCHED})
set(FPHSA_NAME_MISMATCHED TRUE)

# Quick exit if the imported target already exists (e.g. when this file is processed multiple times during the same configure run).
if(TARGET LibXml2::LibXml2)
    set(LibXml2_FOUND TRUE)
    return()
endif()

if(NOT LibXml2_FOUND)
    # Save current developer warnings setting
    set(CMAKE_ORIGINAL_WARN_DEV ${CMAKE_WARN_DEV})

    # Temporarily suppress developer warnings to avoid the PkgConfig warning
    set(CMAKE_WARN_DEV FALSE)

    include(FetchContent)
    
    # Check for optional dependencies before configuring libxml2
    find_package(LibLZMA QUIET)
    find_package(ZLIB QUIET)
    
    # Fetch libxml2
    FetchContent_Declare(
            libxml2
            GIT_REPOSITORY https://gitlab.gnome.org/GNOME/libxml2.git
            GIT_TAG v2.14.3 # Use a specific stable tag or branch
    )
    
    # Set options for libxml2 build based on available dependencies
    set(LIBXML2_WITH_TESTS OFF CACHE BOOL "" FORCE)
    set(LIBXML2_WITH_PYTHON OFF CACHE BOOL "" FORCE)
    set(LIBXML2_WITH_LZMA ${LIBLZMA_FOUND} CACHE BOOL "" FORCE)
    set(LIBXML2_WITH_ICONV OFF CACHE BOOL "" FORCE)
    set(LIBXML2_WITH_ZLIB ${ZLIB_FOUND} CACHE BOOL "" FORCE)
    set(LIBXML2_WITH_PROGRAMS OFF CACHE BOOL "" FORCE)

    FetchContent_MakeAvailable(libxml2)

    # Restore previous setting
    if(DEFINED _scram_prev_fphsa_name_mismatched)
      set(FPHSA_NAME_MISMATCHED ${_scram_prev_fphsa_name_mismatched})
    else()
      unset(FPHSA_NAME_MISMATCHED)
    endif()
    
    # Restore original developer warnings setting
    set(CMAKE_WARN_DEV ${CMAKE_ORIGINAL_WARN_DEV})
    
    # Check if LibXML2 target is available
    if(TARGET LibXml2::LibXml2)
        # Mark the package as found for this configure run.  _FOUND must NOT be cached;
        # otherwise, subsequent CMake re-configurations will skip this module and the
        # imported target will not be recreated, leading to "target not found" errors.
        set(LibXml2_FOUND TRUE)
        message(STATUS "LibXML2 found and configured via FetchContent")
        message(STATUS "    LibXML2 with LZMA support: ${LIBLZMA_FOUND}")
        message(STATUS "    LibXML2 with ZLIB support: ${ZLIB_FOUND}")
        message(STATUS "    LibXML2 with ICONV support: OFF")
        message(STATUS "    LibXML2 include: ${libxml2_SOURCE_DIR}/include")
        
        # Provide conventional output variables expected by downstream code. These can
        # be cached safely because they are simple strings.
        set(LIBXML2_LIBRARIES LibXml2::LibXml2 CACHE STRING "LibXML2 libraries")
        set(LIBXML2_INCLUDE_DIRS ${libxml2_SOURCE_DIR}/include CACHE STRING "LibXML2 include directories")
    else()
        message(FATAL_ERROR "LibXML2 target not found after FetchContent")
    endif()
endif() 