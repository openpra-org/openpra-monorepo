set(CMAKE_INCLUDE_CURRENT_DIR ON)

####################### Begin SCRAM CLI config ##################### {{{
add_executable(scram-cli scram-cli.cc)
set_target_properties(scram-cli PROPERTIES OUTPUT_NAME scram-cli)
target_link_libraries(scram-cli scram ${Boost_LIBRARIES})
target_compile_options(scram-cli PRIVATE $<$<CONFIG:DEBUG>:${SCRAM_CXX_FLAGS_DEBUG}>)

# Include the FetchContent module
include(FetchContent)

# Declare the Git repository and its details
FetchContent_Declare(
        scram_cpp
        GIT_REPOSITORY ssh://git@git.space.openpra.org:2222/openpra/scram-cpp.git
        GIT_TAG        main # or use a specific commit hash or tag
)

# Fetch the content of the Git repository
FetchContent_GetProperties(scram_cpp)
if(NOT scram_cpp_POPULATED)
  FetchContent_Populate(scram_cpp)

  # Now the content is downloaded to CMAKE_BINARY_DIR/_deps/git_repo-src
  # and you can add it to your build as needed
endif()

## Optionally, you can create a custom target to trigger the fetch manually
#add_custom_target(
#        fetch_scram_models
#        COMMAND ${CMAKE_COMMAND} -E echo "Fetching models from scram-cpp repository..."
#        COMMAND ${CMAKE_COMMAND} -DFETCHCONTENT_SOURCE_DIR_GIT_REPO=${CMAKE_BINARY_DIR}/scram_cpp -P ${CMAKE_BINARY_DIR}/_deps/scram_cpp-subbuild/CMakeLists.txt
#        COMMENT "Git repository has been fetched to ${CMAKE_BINARY_DIR}/scram_cpp"
#)
#
#
#add_dependencies(scram-cli fetch_scram_models)

file(GLOB SHARE_FILES "${CMAKE_BINARY_DIR}/_deps/scram_cpp-src/share/*.rng")
file(COPY ${SHARE_FILES} DESTINATION "${CMAKE_BINARY_DIR}/targets/share/scram")

file(GLOB INPUT_FILES "${CMAKE_BINARY_DIR}/_deps/scram_cpp-src/input/*")
file(COPY ${INPUT_FILES} DESTINATION "${CMAKE_BINARY_DIR}/targets/scram-cli/input")

file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/targets/scram-cli/output")


install(
  TARGETS scram-cli
  RUNTIME DESTINATION bin
  COMPONENT scram
  )
####################### End SCRAM CLI config ##################### }}}
