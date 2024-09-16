set(CMAKE_INCLUDE_CURRENT_DIR ON)

####################### Begin SCRAM core lib config ##################### {{{
### Begin SCRAM core source list ### {{{
set(SCRAM_CORE_SRC
  ext/version.cc
  env.cc
  logger.cc
  settings.cc
  xml.cc
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

add_library(scram SHARED ${SCRAM_CORE_SRC})
target_link_libraries(scram ${LIBS})
target_compile_options(scram PRIVATE $<$<CONFIG:DEBUG>:${SCRAM_CXX_FLAGS_DEBUG}>)

# Define a variable for the installation base directory
set(INSTALL_BASE_DIR "$ENV{HOME}/.local")

# Install the library to ~/.local/lib/scram
install(
        TARGETS scram
        LIBRARY DESTINATION ${INSTALL_BASE_DIR}/lib/scram
        ARCHIVE DESTINATION ${INSTALL_BASE_DIR}/lib/scram/static
        RUNTIME DESTINATION ${INSTALL_BASE_DIR}/bin
        COMPONENT scram
)
