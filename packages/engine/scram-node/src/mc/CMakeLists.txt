set(CMAKE_INCLUDE_CURRENT_DIR ON)

set(MC_SRC
        core/preprocessor.cc
        core/probability_analysis.cc
        core/importance_analysis.cc
)

# Optionally collect public headers for installation
set(MC_HEADERS
        #
        core/direct_eval.h
        #
        event/node.h
        event/sample_shape.h
        #
        kernel/basic_event.h
        kernel/gate.h
        kernel/tally.h
        #
        logger/log_benchmark.h
        logger/log_build.h
        logger/log_compressratio.h
        logger/log_pdag.h
        logger/log_model.h
        logger/log_settings.h
        logger/log_layers.h
        logger/log_tally.h
        logger/log_sample_shaper.h
        logger/csv.h
        #
        prng/philox128.h
        prng/sfc64.h
        prng/state128.h
        prng/wyrand.h
        prng/xorshift128.h
        #
        queue/working_set.h
        queue/layer_manager.h
        queue/layer_manager.tpp
        queue/kernel_builder.h
        queue/sample_shaper.h
        queue/queueable.h
        #
        scheduler/convergence_controller.h
        scheduler/convergence_policy.h
        scheduler/iteration_shape.h
        scheduler/progressbar.h
        #
        stats/ci_utils.h
        stats/diagnostics.h
        stats/info_gain.h
        stats/tally.h
)

find_package(_adaptivecpp)
# Add AdaptiveCpp libraries to the global LIBS list
list(APPEND LIBS AdaptiveCpp::acpp-rt)

# Build mc as shared library explicitly (dependencies are static)
add_library(mc SHARED ${MC_SRC} ${MC_HEADERS})

# Mark header files as SYSTEM headers to suppress warnings from third-party code
set_target_properties(mc PROPERTIES PUBLIC_HEADER "${MC_HEADERS}")

# Make sure the compiler can find the mc headers when the library is consumed
target_include_directories(mc
  PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}>
    $<INSTALL_INTERFACE:include/mc>
)

# Link against the core SCRAM library, system libs, and the AdaptiveCpp SYCL target.
# The imported SYCL::SYCL target is provided by AdaptiveCpp when `find_package(_adaptivecpp)`
# is invoked from the top-level CMakeLists.txt.
# `${LIBS}` comes from the parent scope and contains third-party dependencies.

target_link_libraries(mc
  PUBLIC
    scram
    ${LIBS}
)

# Enable AdaptiveCpp device compilation for the library sources
add_sycl_to_target(TARGET mc SOURCES ${MC_SRC})

# Propagate the same debug compile options used by the rest of SCRAM
# so that the new target benefits from the strict checks in Debug builds.

#target_compile_options(mc PRIVATE $<$<CONFIG:DEBUG>:${SCRAM_CXX_FLAGS_DEBUG}>)

# Enforce zero-as-null-pointer warning across all build types
#target_compile_options(mc PRIVATE -Wzero-as-null-pointer-constant)

# Inherit the include directories defined at higher levels (src/ and project root).
# Additional includes specific to this sub-module can be added here if needed.

# Install the library next to the main SCRAM library so that downstream
# consumers can find it in the same prefix.
install(
  TARGETS mc
  LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
  ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
  RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
  PUBLIC_HEADER DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}/mc
  COMPONENT scram
)