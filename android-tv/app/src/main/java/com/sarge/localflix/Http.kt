package com.sarge.localflix

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

/** Tiny blocking HTTP helper. Always call it from a background dispatcher (Dispatchers.IO). */
object Http {

    fun getText(url: String, connectMs: Int = 4000, readMs: Int = 4000): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = connectMs
        c.readTimeout = readMs
        c.instanceFollowRedirects = true
        try {
            if (c.responseCode !in 200..299) throw IOException("HTTP ${c.responseCode}")
            return c.inputStream.bufferedReader().use { it.readText() }
        } finally {
            c.disconnect()
        }
    }

    /**
     * Turns what the user typed into "http://host:port".
     *   "192.168.1.10"          -> "http://192.168.1.10:8080"
     *   "http://192.168.1.10:9000/" -> "http://192.168.1.10:9000"
     * Returns null when it is not a usable address.
     */
    fun normalizeServer(raw: String): String? {
        var s = raw.trim().trimEnd('/')
        if (s.isEmpty()) return null
        if (!s.startsWith("http://", true) && !s.startsWith("https://", true)) s = "http://$s"
        return try {
            val u = URI(s)
            val host = u.host ?: return null
            val port = if (u.port == -1) 8080 else u.port
            "${u.scheme.lowercase()}://$host:$port"
        } catch (e: Exception) {
            null
        }
    }
}
