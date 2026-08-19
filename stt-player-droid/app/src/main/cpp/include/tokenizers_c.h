// Copyright 2023 tokenizers-cpp contributors. Apache-2.0.
#ifndef TOKENIZERS_C_H_
#define TOKENIZERS_C_H_
#include <stddef.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef void* TokenizerHandle;
TokenizerHandle tokenizers_new_from_str(const char* json, size_t len);
void tokenizers_decode(TokenizerHandle handle, const uint32_t* data, size_t len, int skip_special_token);
void tokenizers_get_decode_str(TokenizerHandle handle, const char** data, size_t* len);
void tokenizers_free(TokenizerHandle handle);
#ifdef __cplusplus
}
#endif
#endif

