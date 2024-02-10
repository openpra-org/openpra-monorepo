find_package(Doxygen)

if(DOXYGEN_FOUND)
    message(STATUS "Doxygen found: ${DOXYGEN_EXECUTABLE} -- ${DOXYGEN_VERSION}")

    # Set Doxygen input and output files.
    set(DOXYGEN_INPUT_DIR ${PROJECT_SOURCE_DIR}/src)
    set(DOXYGEN_OUTPUT_DIR ${CMAKE_CURRENT_BINARY_DIR}/doxygen)
    set(DOXYGEN_INDEX_FILE ${DOXYGEN_OUTPUT_DIR}/xml/index.xml)
    set(DOXYFILE_IN ${CMAKE_CURRENT_SOURCE_DIR}/Doxyfile.in)
    set(DOXYFILE_OUT ${CMAKE_CURRENT_BINARY_DIR}/Doxyfile)

    # Generate DoxyFile from the input file.
    configure_file(${DOXYFILE_IN} ${DOXYFILE_OUT} @ONLY)

    # Create Output directory.
    file(MAKE_DIRECTORY ${DOXYGEN_OUTPUT_DIR})

    # Command for generating doc from Doxygen config file.
    add_custom_command(OUTPUT ${DOXYGEN_INDEX_FILE}
            COMMAND ${DOXYGEN_EXECUTABLE} ${DOXYFILE_OUT}
            MAIN_DEPENDENCY ${DOXYFILE_OUT} ${DOXYFILE_IN}
            COMMENT "Generating Doxygen documentation"
            VERBATIM)

    # Create CMake Target for generating doc.
    add_custom_target(docs ALL DEPENDS ${DOXYGEN_INDEX_FILE})
endif()