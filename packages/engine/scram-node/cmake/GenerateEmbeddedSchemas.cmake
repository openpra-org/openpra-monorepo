# Generate C++ source files with embedded RelaxNG schemas
# This script reads .rng files and creates C++ string constants

function(generate_embedded_schema SCHEMA_FILE OUTPUT_FILE VARIABLE_NAME)
    file(READ ${SCHEMA_FILE} SCHEMA_CONTENT)
    
    # Escape quotes and backslashes for C++ string literal
    string(REPLACE "\\" "\\\\" SCHEMA_CONTENT "${SCHEMA_CONTENT}")
    string(REPLACE "\"" "\\\"" SCHEMA_CONTENT "${SCHEMA_CONTENT}")
    string(REPLACE "\n" "\\n\"\n\"" SCHEMA_CONTENT "${SCHEMA_CONTENT}")
    
    # Generate the C++ source file
    file(WRITE ${OUTPUT_FILE}
"// Auto-generated file - DO NOT EDIT
// Generated from ${SCHEMA_FILE}

#include <string_view>

namespace scram::schemas {

const std::string_view& get_${VARIABLE_NAME}() {
    static const std::string_view schema = 
        \"${SCHEMA_CONTENT}\";
    return schema;
}

} // namespace scram::schemas
")
endfunction()

# Generate embedded schemas
set(SHARE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/share")
set(GENERATED_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated")

file(MAKE_DIRECTORY ${GENERATED_DIR})

generate_embedded_schema(
    "${SHARE_DIR}/input.rng"
    "${GENERATED_DIR}/input_schema.cpp" 
    "INPUT_SCHEMA"
)

generate_embedded_schema(
    "${SHARE_DIR}/project.rng"
    "${GENERATED_DIR}/project_schema.cpp"
    "PROJECT_SCHEMA" 
)

generate_embedded_schema(
    "${SHARE_DIR}/report.rng"
    "${GENERATED_DIR}/report_schema.cpp"
    "REPORT_SCHEMA"
)
