set(CMAKE_INCLUDE_CURRENT_DIR ON)

####################### Begin SCRAM CLI config ##################### {{{
add_executable(scram-cli scram.cc)
set_target_properties(scram-cli PROPERTIES OUTPUT_NAME scram)
target_link_libraries(scram-cli scram ${Boost_LIBRARIES})
target_compile_options(scram-cli PRIVATE $<$<CONFIG:DEBUG>:${SCRAM_CXX_FLAGS_DEBUG}>)

install(
  TARGETS scram-cli
  RUNTIME DESTINATION bin
  COMPONENT scram
  )
####################### End SCRAM CLI config ##################### }}}
