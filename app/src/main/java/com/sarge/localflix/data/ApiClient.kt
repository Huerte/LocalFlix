package com.sarge.localflix.data

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

// ── API interface ──────────────────────────────────────────────────────────────

interface ApiService {
    @GET("api/movies")
    suspend fun getMovies(): List<Movie>
}

// ── Client singleton ───────────────────────────────────────────────────────────

object ApiClient {

    private var service: ApiService? = null
    private var currentBase: String  = ""

    /**
     * Returns (or creates) a Retrofit service for the given base URL.
     * Call this every time in case the user changes the server URL in settings.
     */
    fun getService(baseUrl: String): ApiService {
        val normalized = baseUrl.trimEnd('/') + "/"
        if (service == null || currentBase != normalized) {
            currentBase = normalized
            val http = OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .build()
            service = Retrofit.Builder()
                .baseUrl(normalized)
                .client(http)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ApiService::class.java)
        }
        return service!!
    }

    /**
     * Build the full stream URL for a movie path, percent-encoding each path segment.
     * e.g.  path = "Action/Spider-Man No Way Home.mp4"
     *   →  "http://192.168.1.5:8080/stream/Action/Spider-Man%20No%20Way%20Home.mp4"
     */
    fun streamUrl(baseUrl: String, path: String): String {
        val base    = baseUrl.trimEnd('/')
        val encoded = path.split("/")
            .joinToString("/") { URLEncoder.encode(it, "UTF-8").replace("+", "%20") }
        return "$base/stream/$encoded"
    }

    /** Reset so next call rebuilds with a new URL */
    fun reset() {
        service     = null
        currentBase = ""
    }
}
