package com.sarge.localflix

import org.json.JSONObject

/** One subtitle track. [url] is an absolute WebVTT address on the LocalFlix server. */
data class SubTrack(val label: String, val lang: String, val url: String)

/** One audio track of the file, used when the stream has to be converted (transcode mode). */
data class AudioInfo(val n: Int, val label: String, val codec: String, val channels: Int)

/**
 * What the web page sends to LocalFlixTV.play(json). Built in static/player.js (openNative).
 * All urls are absolute, so the player does not need to know the server address.
 */
data class PlayRequest(
    val id: String,
    val title: String,
    val streamUrl: String,          // GET /media/<id>        (direct, HTTP Range)
    val transcodeUrl: String,       // GET /transcode/<id>    (?start=<sec>&audio=<n> is added)
    val startSeconds: Double,       // resume position
    val durationSeconds: Double,    // 0 = unknown
    val subtitles: List<SubTrack>,
    val audio: List<AudioInfo>,
    val nextId: String?,
    val nextTitle: String?,
    val ffmpeg: Boolean             // true = /transcode can be used as a fallback
) {
    companion object {
        fun parse(json: String): PlayRequest {
            val o = JSONObject(json)
            val subs = ArrayList<SubTrack>()
            o.optJSONArray("subtitles")?.let { a ->
                for (i in 0 until a.length()) {
                    val s = a.getJSONObject(i)
                    subs.add(SubTrack(s.optString("label"), s.optString("lang"), s.getString("url")))
                }
            }
            val audio = ArrayList<AudioInfo>()
            o.optJSONArray("audio")?.let { a ->
                for (i in 0 until a.length()) {
                    val s = a.getJSONObject(i)
                    audio.add(AudioInfo(s.optInt("n"), s.optString("label"), s.optString("codec"), s.optInt("ch")))
                }
            }
            fun str(key: String): String? = if (o.isNull(key)) null else o.optString(key).ifEmpty { null }
            return PlayRequest(
                id = o.getString("id"),
                title = o.optString("title"),
                streamUrl = o.getString("streamUrl"),
                transcodeUrl = o.getString("transcodeUrl"),
                startSeconds = o.optDouble("startSeconds", 0.0),
                durationSeconds = o.optDouble("duration", 0.0),
                subtitles = subs,
                audio = audio,
                nextId = str("nextId"),
                nextTitle = str("nextTitle"),
                ffmpeg = o.optBoolean("ffmpeg", false)
            )
        }
    }
}

/** A subtitle line. Times are seconds from the start of the movie. */
data class Cue(val start: Double, val end: Double, val text: String)

/** Parses the server's /api/subtitle/<id> answer: {"cues": [[start, end, text], ...]}. */
fun parseCues(json: String): List<Cue> {
    val arr = JSONObject(json).getJSONArray("cues")
    val out = ArrayList<Cue>(arr.length())
    for (i in 0 until arr.length()) {
        val c = arr.getJSONArray(i)
        out.add(Cue(c.getDouble(0), c.getDouble(1), c.getString(2)))
    }
    out.sortBy { it.start }
    return out
}
