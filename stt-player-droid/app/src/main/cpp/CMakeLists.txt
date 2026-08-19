# Adapted from google-ai-edge/litert-samples (Apache-2.0).
cmake_minimum_required(VERSION 3.22.1)
project(tokenizer_jni)

add_library(tokenizer_jni SHARED tokenizer_jni.cc)
target_include_directories(tokenizer_jni PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/include)
add_library(tokenizers_c STATIC IMPORTED)
set_target_properties(tokenizers_c PROPERTIES
    IMPORTED_LOCATION ${CMAKE_CURRENT_SOURCE_DIR}/lib/${ANDROID_ABI}/libtokenizers_c.a)
target_link_libraries(tokenizer_jni tokenizers_c log)

