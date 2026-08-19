// Adapted from google-ai-edge/litert-samples, Copyright 2026 Google LLC, Apache-2.0.
#include <jni.h>
#include <cstdint>
#include <string>
#include <vector>
#include "tokenizers_c.h"

extern "C" JNIEXPORT jlong JNICALL
Java_com_tepmex_sttplayerdroid_model_HuggingfaceTokenizer_nativeInit(
    JNIEnv* env, jclass, jstring payload) {
  const char* ptr = env->GetStringUTFChars(payload, nullptr);
  std::string json(ptr);
  env->ReleaseStringUTFChars(payload, ptr);
  return reinterpret_cast<jlong>(tokenizers_new_from_str(json.data(), json.size()));
}

extern "C" JNIEXPORT void JNICALL
Java_com_tepmex_sttplayerdroid_model_HuggingfaceTokenizer_nativeFree(
    JNIEnv*, jclass, jlong handle) {
  tokenizers_free(reinterpret_cast<TokenizerHandle>(handle));
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_tepmex_sttplayerdroid_model_HuggingfaceTokenizer_nativeDecode(
    JNIEnv* env, jclass, jlong handle, jintArray ids, jboolean skip_special) {
  auto tokenizer = reinterpret_cast<TokenizerHandle>(handle);
  if (!tokenizer) return env->NewStringUTF("");
  const jsize length = env->GetArrayLength(ids);
  jint* values = env->GetIntArrayElements(ids, nullptr);
  std::vector<uint32_t> tokens(values, values + length);
  env->ReleaseIntArrayElements(ids, values, JNI_ABORT);
  tokenizers_decode(tokenizer, tokens.data(), tokens.size(), static_cast<int>(skip_special));
  const char* decoded = nullptr;
  size_t decoded_length = 0;
  tokenizers_get_decode_str(tokenizer, &decoded, &decoded_length);
  std::string result(decoded, decoded_length);
  return env->NewStringUTF(result.c_str());
}

