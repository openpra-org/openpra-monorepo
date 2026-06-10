set(CMAKE_INCLUDE_CURRENT_DIR ON)

####################### Begin SCRAM Boolean config ##################### {{{

set(SCRAM_BOOLEAN_SOURCES
        builder.cpp
        settings_map.cpp
        serializer.cpp
        quantify.cpp
)

if (NOT TARGET scram-boolean)
    add_library(scram-boolean STATIC ${SCRAM_BOOLEAN_SOURCES})
endif ()

target_link_libraries(scram-boolean scram)

target_include_directories(scram-boolean PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

####################### End SCRAM Boolean config ##################### }}}
