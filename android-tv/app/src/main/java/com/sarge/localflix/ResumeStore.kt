package com.sarge.localflix

import android.content.Context
import org.json.JSONObject

/**
 * Where the TV app remembers how far each movie was watched, independent of the web page.
 * The page keeps the same information in localStorage, but that is tied to the server address (it is lost when the
 * laptop gets a new IP) and is only written when the player closes normally. This copy is written every few seconds
 * while playing and whenever the player stops, so "continue watching" survives Home, power-off, a crash or a new IP.
 * The page reads it at start (LocalFlixTV.getResume -> LF.importNativeProgress) and keeps whichever record is newer.
 */
object ResumeStore {
    private const val PREFS = "localflix_resume"

    /** [watched] = finished (or within the last 45 s): the movie leaves "Continue Watching". */
    fun save(ctx: Context, id: String, secs: Double, dur: Double, watched: Boolean) {
        val v = "${secs}|${dur}|${System.currentTimeMillis()}|${if (watched) 1 else 0}"
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(id, v).apply()
    }

    /** {"<id>": {"t":secs,"d":dur,"ts":millis,"w":true|false}, ...} */
    fun toJson(ctx: Context): String {
        val out = JSONObject()
        for ((id, raw) in ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).all) {
            val p = (raw as? String)?.split('|') ?: continue
            if (p.size < 4) continue
            try {
                out.put(id, JSONObject()
                    .put("t", p[0].toDouble()).put("d", p[1].toDouble())
                    .put("ts", p[2].toLong()).put("w", p[3] == "1"))
            } catch (e: NumberFormatException) { /* skip a damaged record */ }
        }
        return out.toString()
    }
}
