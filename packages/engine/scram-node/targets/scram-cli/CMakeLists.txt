set(CMAKE_INCLUDE_CURRENT_DIR ON)

####################### Begin SCRAM CLI config ##################### {{{

set(SCRAM_CLI_HEADERS
        scram.cc
)

# Define a variable for the installation base directory
set(INSTALL_BASE_DIR "$ENV{HOME}/.local")

# Add an executable target
add_executable(scram-cli ${SCRAM_CLI_HEADERS})

# Set properties for the executable
set_target_properties(scram-cli PROPERTIES
    OUTPUT_NAME scram-cli
    BUILD_WITH_INSTALL_RPATH TRUE
    INSTALL_RPATH_USE_LINK_PATH TRUE
)

# Conditionally set the INSTALL_RPATH property based on the platform
if(APPLE)
    set_target_properties(scram-cli PROPERTIES
        INSTALL_RPATH "@loader_path/../lib/scram;${INSTALL_BASE_DIR}/lib/scram"
    )
else()
    set_target_properties(scram-cli PROPERTIES
        INSTALL_RPATH "${INSTALL_BASE_DIR}/lib/scram"
    )
endif()

# Link libraries
target_link_libraries(scram-cli scram ${Boost_LIBRARIES})
#target_compile_options(scram-cli PRIVATE $<$<CONFIG:DEBUG>:${SCRAM_CXX_FLAGS_DEBUG}>)

# Install the executable to ~/.local/bin
install(TARGETS scram-cli
    RUNTIME DESTINATION ${INSTALL_BASE_DIR}/bin
    COMPONENT scram-cli
)

# Install the executable to a secondary location (e.g., for node modules)
install(TARGETS scram-cli
    RUNTIME DESTINATION ${CMAKE_SOURCE_DIR}/../../../node_modules/.bin
    COMPONENT scram-cli
)

# Install share directory files to ~/.local/share
install(DIRECTORY ${CMAKE_SOURCE_DIR}/share/
    DESTINATION ${INSTALL_BASE_DIR}/share/scram
    FILES_MATCHING PATTERN "*.rng"
)
####################### End SCRAM CLI config ##################### }}}
