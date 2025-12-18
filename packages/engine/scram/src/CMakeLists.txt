set(CMAKE_INCLUDE_CURRENT_DIR ON)

####################### Begin SCRAM core lib config ##################### {{{
### Begin SCRAM core source list ### {{{
set(SCRAM_CORE_SRC
  ext/version.cc
  ext/bimap.h
  env.cc
  logger.cc
  settings.cc
  xml.cc
  project.cc
  # Generated embedded schema files
  "${PROJECT_BINARY_DIR}/generated/input_schema.cpp"
  "${PROJECT_BINARY_DIR}/generated/project_schema.cpp"
  "${PROJECT_BINARY_DIR}/generated/report_schema.cpp"
  element.cc
  expression.cc
  parameter.cc
  expression/conditional.cc
  expression/constant.cc
  expression/numerical.cc
  expression/exponential.cc
  expression/random_deviate.cc
  expression/test_event.cc
  expression/extern.cc
  event.cc
  substitution.cc
  ccf_group.cc
  fault_tree.cc
  event_tree.cc
  alignment.cc
  model.cc
  cycle.cc
  pdag.cc
  preprocessor.cc
  mocus.cc
  bdd.cc
  zbdd.cc
  analysis.cc
  fault_tree_analysis.cc
  product_filter.cc
  probability_analysis.cc
  importance_analysis.cc
  uncertainty_analysis.cc
  event_tree_analysis.cc
  reporter.cc
  serialization.cc
  initializer.cc
  risk_analysis.cc
  )
### End SCRAM core source list ### }}}
# Build scram as shared library explicitly (dependencies are static)
add_library(scram SHARED ${SCRAM_CORE_SRC})
target_link_libraries(scram ${LIBS})
target_compile_definitions(scram PRIVATE SCRAM_BUILDING_DLL)
target_compile_options(scram PRIVATE $<$<CONFIG:DEBUG>:${SCRAM_CXX_FLAGS_DEBUG}>)

# Apply GCC-specific flags to scram target only
if(SCRAM_GCC_SPECIFIC_FLAGS)
  target_compile_options(scram PRIVATE ${SCRAM_GCC_SPECIFIC_FLAGS})
endif()

# Disable unused variable warnings for generated schema files
if(NOT MSVC)
  set_source_files_properties(
    "${PROJECT_BINARY_DIR}/generated/input_schema.cpp"
    "${PROJECT_BINARY_DIR}/generated/project_schema.cpp"
    "${PROJECT_BINARY_DIR}/generated/report_schema.cpp"
    PROPERTIES COMPILE_FLAGS "-Wno-unused-const-variable"
  )
endif()

# Install the library to standard system directories respecting CMAKE_INSTALL_PREFIX
install(
        TARGETS scram
        LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
        ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
        RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
        COMPONENT scram
)

