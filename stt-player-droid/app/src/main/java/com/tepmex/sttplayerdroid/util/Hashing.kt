package com.tepmex.sttplayerdroid.util

import java.io.InputStream
import java.security.MessageDigest

object Hashing {
    fun sha256(bytes: ByteArray): String = digest().digest(bytes).toHex()

    fun sha256(text: String): String = sha256(text.toByteArray(Charsets.UTF_8))

    fun sha256(input: InputStream): String {
        val digest = digest()
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            digest.update(buffer, 0, count)
        }
        return digest.digest().toHex()
    }

    private fun digest() = MessageDigest.getInstance("SHA-256")
    private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }
}

