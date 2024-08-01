set(CMAKE_INCLUDE_CURRENT_DIR ON)

####################### Begin SCRAM CLI config ##################### {{{

set(SCRAM_CLI_HEADERS
        CommandLineHelpers.h
        CommandLine.h
#        scram.cc
        ScramCLI.h
        main.cpp
)

add_executable(scram-cli ${SCRAM_CLI_HEADERS})
set_target_properties(scram-cli PROPERTIES OUTPUT_NAME scram-cli)
target_link_libraries(scram-cli scram ${Boost_LIBRARIES})
target_compile_options(scram-cli PRIVATE $<$<CONFIG:DEBUG>:${SCRAM_CXX_FLAGS_DEBUG}>)

install(
        TARGETS scram-cli
        RUNTIME DESTINATION /usr/local/bin
        COMPONENT scram-cli
)

# Install share directory files
install(
        DIRECTORY ${CMAKE_SOURCE_DIR}/share/
        DESTINATION /usr/local/share/scram
        FILES_MATCHING PATTERN "*.rng"
)
####################### End SCRAM CLI config ##################### }}}
