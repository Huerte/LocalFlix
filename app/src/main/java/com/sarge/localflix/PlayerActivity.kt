package com.sarge.localflix

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.text.Editable
import android.text.TextWatcher
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import java.net.URLEncoder
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.SubtitleView
import com.sarge.localflix.databinding.ActivityPlayerBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

/**
 * Native video player (ExoPlayer) for the LocalFlix TV app. Opened by MainActivity when the web page calls
 * LocalFlixTV.play(). Returns the final position to MainActivity, which passes it back to the page so the web
 * UI stores the resume point exactly like it does for its own player.
 *
 * Two playback modes:
 *   DIRECT     GET /media/<id>      Range requests, so seeking is native. Subtitles are side-loaded WebVTT tracks.
 *   TRANSCODE  GET /transcode/<id>?start=<s>&audio=<n>   ffmpeg converts to H.264/AAC on the fly. The stream cannot
 *              seek, so every seek / audio change restarts it at a new start time. Because the stream starts at 0,
 *              "movie time" = offsetMs + player position, and subtitles are drawn by us from the cue list.
 * We start in DIRECT. If ExoPlayer cannot play the file and the server has ffmpeg, we retry once in TRANSCODE.
 */
@androidx.annotation.OptIn(UnstableApi::class)
class PlayerActivity : FragmentActivity() {

    private lateinit var b: ActivityPlayerBinding
    private lateinit var req: PlayRequest
    private var player: ExoPlayer? = null
    private val ui = Handler(Looper.getMainLooper())

    // ── playback state that must survive onStop/onStart ───────────────────────
    private var transcoding = false
    private var triedTranscode = false
    private var offsetMs = 0L              // movie time at which the current transcode stream starts (0 when direct)
    private var resumeMs = 0L              // movie time to start from
    private var wantPlay = true
    private var audioIdx = 0               // transcode: which audio track ffmpeg maps
    private var lastPosMs = 0L             // last known movie time (also used after the player is released)
    private var ended = false
    private var pendingSeekMs = -1L        // target of a seek that has not been committed yet
    private var resultNextId: String? = null
    private var resultSet = false
    private var askedResume = false       // the "Resume / Start over" question is asked once per opening
    private var saveTicks = 0

    // ── subtitles ─────────────────────────────────────────────────────────────
    // Tracks the player offers: the movie's own ones first, then any file picked with "Browse subtitle files".
    private val subs = ArrayList<SubTrack>()
    private var subChoice = -1             // index into subs, -1 = off
    private var appliedSub = Int.MIN_VALUE // direct mode: what is currently applied to ExoPlayer
    private var cues: List<Cue> = emptyList()
    private var cuesFor = -2
    private var cueJob: Job? = null
    private var subSizePct = 100           // subtitle size in percent (Settings menu)
    private var subOffsetMs = 0L           // subtitle sync: + = subtitles appear later, - = earlier (remembered per movie)

    // ── playback speed ────────────────────────────────────────────────────────
    private var speed = 1f

    // ── UI state ──────────────────────────────────────────────────────────────
    private var controlsOn = false
    private var menuOn = false
    private var dialogOn = false
    private var menuOpener: View? = null
    private var dialogCancel: (() -> Unit)? = null

    private val prefs by lazy { getSharedPreferences(PREFS, Context.MODE_PRIVATE) }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val raw = intent.getStringExtra(EXTRA_REQUEST)
        req = try { PlayRequest.parse(raw ?: "") } catch (e: Exception) { finish(); return }
        subs.addAll(req.subtitles)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        b = ActivityPlayerBinding.inflate(layoutInflater)
        setContentView(b.root)
        hideSystemUi()

        resumeMs = (req.startSeconds * 1000).toLong()
        lastPosMs = resumeMs
        // Subtitles start OFF unless the user turned them on before (then the same track, or the first one).
        if (prefs.getBoolean(KEY_SUBS_ON, false) && subs.isNotEmpty()) {
            val want = prefs.getString(KEY_SUB_LABEL, "")
            subChoice = subs.indexOfFirst { it.label == want }.let { if (it >= 0) it else 0 }
        }

        speed = prefs.getFloat(KEY_SPEED, 1f)
        subSizePct = prefs.getInt(KEY_SUB_SIZE, 100)
        subOffsetMs = prefs.getLong(KEY_SUB_OFFSET + req.id, 0L)

        // Same title block as the web player: title, then "year · 1080p · MKV".
        b.titleText.text = req.title
        b.subTitleText.text = listOfNotNull(
            if (req.year > 0) req.year.toString() else null,
            if (req.height > 0) "${req.height}p" else null,
            req.ext.ifEmpty { null }
        ).joinToString("  ·  ")
        b.subTitleText.visibility = if (b.subTitleText.text.isEmpty()) View.GONE else View.VISIBLE
        b.bNext.visibility = if (req.nextId != null) View.VISIBLE else View.GONE
        b.playerView.subtitleView?.apply {
            setApplyEmbeddedStyles(false)
            setStyle(CaptionStyleCompat(Color.WHITE, Color.TRANSPARENT, Color.TRANSPARENT, CaptionStyleCompat.EDGE_TYPE_OUTLINE, Color.BLACK, null))
        }
        applySubtitleLook()

        b.bPlay.setOnClickListener { togglePlay() }
        b.bBack10.setOnClickListener { seekBy(-10_000) }
        b.bFwd10.setOnClickListener { seekBy(10_000) }
        b.bSubs.setOnClickListener { openSubtitleMenu() }
        b.bAudio.setOnClickListener { openAudioMenu() }
        b.bNext.setOnClickListener { finishWithResult(req.nextId) }
        b.bSet.setOnClickListener { openSettingsMenu() }
        b.btnBack.setOnClickListener { finishWithResult(null) }
    }

    override fun onStart() {
        super.onStart()
        if (!::req.isInitialized) return
        // First start, or coming back after Home / another app: continue where we were.
        if (player == null && !dialogOn) {
            if (req.askResume && !askedResume && resumeMs > 10_000) { askedResume = true; promptResume() }
            else startPlayback(resumeMs, transcoding)
        }
        ui.post(tick)
    }

    override fun onStop() {
        super.onStop()
        if (!::req.isInitialized) return
        stopHold()
        captureState()
        persistResume()
        releasePlayer()
        ui.removeCallbacksAndMessages(null)
    }

    override fun onDestroy() {
        ui.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    /** Result for MainActivity (-> LF.onNativePlayerClosed): id, seconds, finished, nextId. */
    override fun finish() {
        if (::req.isInitialized && !resultSet) {
            resultSet = true
            captureState()
            persistResume()
            setResult(RESULT_OK, Intent()
                .putExtra(RESULT_ID, req.id)
                .putExtra(RESULT_SECONDS, lastPosMs / 1000.0)
                .putExtra(RESULT_FINISHED, ended)
                .putExtra(RESULT_NEXT_ID, resultNextId))
        }
        super.finish()
    }

    private fun finishWithResult(nextId: String?) {
        resultNextId = nextId
        finish()
    }

    /**
     * "Continue watching": shown when the movie opens with a saved position and the user did not pick a start time
     * (e.g. Play on the home screen). Resume is focused, so one press of OK continues where they stopped.
     */
    private fun promptResume() {
        val pos = resumeMs
        val dur = durationMs()
        val text = "You stopped at ${fmt(pos)}" + if (dur > 0) " of ${fmt(dur)}." else "."
        showDialog("Continue watching?", text,
            "Resume from ${fmt(pos)}", { startPlayback(pos, transcoding) },
            "Start over", { resumeMs = 0; lastPosMs = 0; startPlayback(0, transcoding) }) { finishWithResult(null) }
    }

    /** Saves the watch position natively (see ResumeStore) so it survives Home, power-off or a crash. */
    private fun persistResume() {
        val pos = lastPosMs / 1000.0
        val dur = durationMs() / 1000.0
        val watched = ended || (dur > 0 && pos > dur - 45)
        if (!watched && pos < 5) return
        ResumeStore.save(this, req.id, pos, dur, watched)
    }

    private fun hideSystemUi() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    // ── player ────────────────────────────────────────────────────────────────

    /** (Re)creates the ExoPlayer at [positionMs] (movie time). [transcode] chooses the mode. */
    private fun startPlayback(positionMs: Long, transcode: Boolean) {
        releasePlayer()
        transcoding = transcode
        ended = false
        pendingSeekMs = -1L
        resumeMs = positionMs
        b.spinner.visibility = View.VISIBLE

        val exo = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(),
                /* handleAudioFocus = */ true)
            .setHandleAudioBecomingNoisy(true)
            .build()
        player = exo
        b.playerView.player = exo

        if (transcode) {
            offsetMs = positionMs
            val url = "${req.transcodeUrl}?start=${String.format(Locale.US, "%.2f", positionMs / 1000.0)}&audio=$audioIdx"
            // Fragmented MP4 over HTTP: tell ExoPlayer the type, there is no file name to sniff.
            exo.setMediaItem(MediaItem.Builder().setUri(url).setMimeType(MimeTypes.VIDEO_MP4).build())
            loadCuesIfNeeded()
        } else {
            offsetMs = 0
            val side = req.subtitles.mapIndexed { i, s ->
                MediaItem.SubtitleConfiguration.Builder(Uri.parse(s.url))
                    .setMimeType(MimeTypes.TEXT_VTT)
                    .setLabel(s.label)
                    .setId("sub$i")
                    .setSelectionFlags(0)
                    .build()
            }
            exo.setMediaItem(MediaItem.Builder().setUri(req.streamUrl).setSubtitleConfigurations(side).build(), positionMs)
            loadCuesIfNeeded()      // only does something when a subtitle offset is active
        }
        // Subtitles off by default; applySubtitle() switches the chosen track on once ExoPlayer lists it.
        exo.trackSelectionParameters = exo.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true).build()
        appliedSub = -1

        exo.setPlaybackSpeed(speed)
        exo.addListener(listener)
        exo.playWhenReady = wantPlay
        exo.prepare()
        updateUi()
    }

    private fun releasePlayer() {
        player?.let {
            wantPlay = it.playWhenReady
            it.removeListener(listener)
            b.playerView.player = null
            it.release()
        }
        player = null
    }

    private fun captureState() {
        val p = player
        lastPosMs = logicalPos()
        resumeMs = lastPosMs
        if (p != null) wantPlay = p.playWhenReady
    }

    private val listener = object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
            b.spinner.visibility = if (state == Player.STATE_BUFFERING) View.VISIBLE else View.GONE
            if (state == Player.STATE_ENDED) onEnded()
            updatePlayButton()
        }

        override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
            updatePlayButton()
            if (!playWhenReady) { saveBrief(); if (!menuOn && !dialogOn) showControls(if (currentFocus == null) b.bPlay else null) }   // paused: keep controls up
            else scheduleHide()
        }

        override fun onPlayerError(error: PlaybackException) = onPlayError(error)

        override fun onTracksChanged(tracks: Tracks) = onTracks(tracks)
    }

    private fun saveBrief() { lastPosMs = logicalPos() }

    private fun canTranscode() = req.ffmpeg && !transcoding && !triedTranscode

    /** Direct mode could not play it (unsupported codec / container): convert on the server instead. */
    private fun fallbackToTranscode() {
        triedTranscode = true
        showMsg("Converting for this TV...", 6000)
        startPlayback(logicalPos(), true)
    }

    private fun onPlayError(error: PlaybackException) {
        if (canTranscode()) { fallbackToTranscode(); return }
        val why = when {
            transcoding -> "Even the converted video could not be opened. The file may be damaged or use an unusual format."
            !req.ffmpeg -> "This TV cannot play this file. Install ffmpeg on the laptop running LocalFlix (see the README) so it can be converted automatically."
            else -> "This TV cannot play this file."
        }
        val pos = logicalPos()
        showDialog("This video cannot be played", why + "\n\n(" + (error.errorCodeName) + ")",
            "Try again", { startPlayback(pos, transcoding) }, "Close", { finishWithResult(null) }) { finishWithResult(null) }
    }

    /** Looks for tracks the TV cannot decode (e.g. only an unsupported audio track) and applies the subtitle choice. */
    private fun onTracks(tracks: Tracks) {
        if (transcoding) return
        fun unsupported(type: Int): Boolean {
            val groups = tracks.groups.filter { it.type == type }
            return groups.isNotEmpty() && groups.none { g -> (0 until g.length).any { i -> g.isTrackSupported(i) } }
        }
        if ((unsupported(C.TRACK_TYPE_VIDEO) || unsupported(C.TRACK_TYPE_AUDIO)) && canTranscode()) {
            fallbackToTranscode()
            return
        }
        if (appliedSub != subChoice) applySubtitle()
    }

    private fun onEnded() {
        val dur = durationMs()
        // A converted stream that stops long before the end means ffmpeg died: that is an error, not "finished".
        if (transcoding && dur > 0 && logicalPos() < dur - 20_000) {
            val pos = logicalPos()
            showDialog("Playback stopped early", "The conversion stopped before the end of the movie.",
                "Continue from here", { startPlayback(pos, true) }, "Close", { finishWithResult(null) }) { finishWithResult(null) }
            return
        }
        ended = true
        if (req.nextId != null) {
            showDialog("Up next", req.nextTitle ?: "Next episode",
                "Play now", { finishWithResult(req.nextId) }, "Cancel", { finishWithResult(null) }) { finishWithResult(null) }
        } else {
            finishWithResult(null)
        }
    }

    // ── time helpers ──────────────────────────────────────────────────────────

    /** Current position in the MOVIE (not in the stream). */
    private fun logicalPos(): Long {
        if (pendingSeekMs >= 0) return pendingSeekMs
        val p = player ?: return lastPosMs
        return offsetMs + p.currentPosition
    }

    private fun durationMs(): Long {
        if (req.durationSeconds > 0) return (req.durationSeconds * 1000).toLong()
        val d = player?.duration ?: C.TIME_UNSET
        return if (d != C.TIME_UNSET && d > 0) offsetMs + d else 0L
    }

    private fun fmt(ms: Long): String {
        val s = (ms / 1000).coerceAtLeast(0)
        val h = s / 3600; val m = (s % 3600) / 60; val sec = s % 60
        return if (h > 0) String.format(Locale.US, "%d:%02d:%02d", h, m, sec) else String.format(Locale.US, "%d:%02d", m, sec)
    }

    // ── seeking ───────────────────────────────────────────────────────────────

    /**
     * Seeks are collected for 0.5 s and then applied once. That makes holding Left/Right smooth, and in transcode
     * mode it avoids restarting ffmpeg for every key repeat.
     */
    private fun seekBy(deltaMs: Long) {
        val dur = durationMs()
        var t = logicalPos() + deltaMs
        if (t < 0) t = 0
        if (dur > 0 && t > dur - 1000) t = (dur - 1000).coerceAtLeast(0)
        pendingSeekMs = t
        showControls(null)
        updateUi()
        ui.removeCallbacks(commitSeek)
        ui.postDelayed(commitSeek, 500)
    }

    /** Left/Right on the remote. Holding the key gives bigger steps (10 s, then 30 s, then 60 s). */
    private fun seekStep(direction: Int, repeat: Int) {
        if (repeat > 0 && repeat % 4 != 0) return          // key repeat is very fast; act on every 4th
        val sec = when { repeat >= 24 -> 60; repeat >= 12 -> 30; else -> 10 }
        seekBy(direction * sec * 1000L)
    }

    private val commitSeek = Runnable {
        val t = pendingSeekMs
        pendingSeekMs = -1L
        val exo = player ?: return@Runnable
        if (t < 0) return@Runnable
        ended = false
        if (transcoding) startPlayback(t, true) else exo.seekTo(t)
    }

    private fun togglePlay() {
        val exo = player ?: return
        if (exo.playbackState == Player.STATE_ENDED) { exo.seekTo(0); exo.play(); return }
        if (exo.playWhenReady) exo.pause() else exo.play()
    }

    // ── subtitles ─────────────────────────────────────────────────────────────

    private fun selectSubtitle(index: Int) {
        subChoice = index
        val ed = prefs.edit().putBoolean(KEY_SUBS_ON, index >= 0)
        if (index >= 0) ed.putString(KEY_SUB_LABEL, subs[index].label)
        ed.apply()
        loadCuesIfNeeded()
        if (!transcoding) applySubtitle()
        b.subText.visibility = View.GONE
    }

    /** Direct mode: turn the chosen side-loaded track on/off in ExoPlayer. */
    private fun applySubtitle() {
        val exo = player ?: return
        val params = exo.trackSelectionParameters.buildUpon()
        // With a sync offset we draw the lines ourselves (ExoPlayer cannot shift side-loaded cues), so keep its track off.
        if (subChoice < 0 || ownCues()) {
            params.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
        } else {
            // Not listed yet? onTracksChanged calls us again.
            val g = exo.currentTracks.groups.firstOrNull { grp ->
                grp.type == C.TRACK_TYPE_TEXT && grp.length > 0 && (
                    grp.getTrackFormat(0).id == "sub$subChoice" ||
                    grp.getTrackFormat(0).label == subs[subChoice].label)
            } ?: return
            params.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                .setOverrideForType(TrackSelectionOverride(g.mediaTrackGroup, 0))
        }
        exo.trackSelectionParameters = params.build()
        appliedSub = subChoice
    }

    /** Transcode mode: download the cue list of the chosen track (the .vtt url without ".vtt" is the JSON one). */
    private fun loadCuesIfNeeded(force: Boolean = false) {
        if (subChoice < 0) { cueJob?.cancel(); cues = emptyList(); cuesFor = -1; return }
        if ((!force && !ownCues()) || cuesFor == subChoice) return
        cueJob?.cancel()
        cues = emptyList()
        cuesFor = subChoice
        val url = subs[subChoice].url.removeSuffix(".vtt")
        cueJob = lifecycleScope.launch {
            try {
                // Embedded subtitles are extracted by ffmpeg on the server, which can take a while.
                cues = withContext(Dispatchers.IO) { parseCues(Http.getText(url, 4000, 130_000)) }
            } catch (e: Exception) {
                cuesFor = -2
                showMsg("Could not load that subtitle.")
            }
        }
    }

    /**
     * True when we draw the subtitle lines ourselves: converted stream, a sync offset is set, or the track was
     * picked with "Browse subtitle files" (ExoPlayer only knows the tracks that were side-loaded at start).
     */
    private fun ownCues() = transcoding || subOffsetMs != 0L || subChoice >= req.subtitles.size

    /** Subtitle sync. Positive = subtitles later (delay), negative = earlier. Saved per movie. */
    private fun applyOffset(ms: Long) {
        val was = ownCues()
        subOffsetMs = ms.coerceIn(-60_000L, 60_000L)
        // Only when we switch between ExoPlayer's subtitles and ours does anything heavy happen.
        if (was != ownCues()) {
            loadCuesIfNeeded()
            if (!transcoding) { appliedSub = Int.MIN_VALUE; applySubtitle() }
        }
        updateSyncUi()
        drawCue()
    }

    private fun commitOffset() { prefs.edit().putLong(KEY_SUB_OFFSET + req.id, subOffsetMs).apply() }

    private fun offsetText(ms: Long): String =
        if (ms == 0L) "0.0s" else String.format(Locale.US, "%+.1fs", ms / 1000.0)

    /** Draw the line(s) active at the current movie time (shifted by the sync offset). */
    private fun drawCue() {
        if (!ownCues() || subChoice < 0 || cues.isEmpty()) {
            if (b.subText.visibility != View.GONE) b.subText.visibility = View.GONE
            return
        }
        val t = (logicalPos() - subOffsetMs) / 1000.0
        // cues are sorted by start; look at the last few that started before now
        var lo = 0; var hi = cues.size - 1; var idx = -1
        while (lo <= hi) { val mid = (lo + hi) ushr 1; if (cues[mid].start <= t) { idx = mid; lo = mid + 1 } else hi = mid - 1 }
        val sb = StringBuilder()
        var i = idx
        while (i >= 0 && i > idx - 3) {
            if (cues[i].end > t) sb.insert(0, if (sb.isEmpty()) cues[i].text else cues[i].text + "\n")
            i--
        }
        val txt = sb.toString()
        if (txt.isEmpty()) { b.subText.visibility = View.GONE; return }
        if (b.subText.text.toString() != txt) b.subText.text = txt
        b.subText.visibility = View.VISIBLE
    }

    // ── menus (subtitles / audio) ─────────────────────────────────────────────

    /** [keep] = the pick opens another screen inside the same panel, so the panel must not be closed first. */
    private class MenuEntry(val label: String, val checked: Boolean, val keep: Boolean = false, val header: Boolean = false, val onPick: () -> Unit)

    private fun openSubtitleMenu() {
        val items = ArrayList<MenuEntry>()
        items.add(MenuEntry("Off", subChoice < 0) { selectSubtitle(-1) })
        subs.forEachIndexed { i, s -> items.add(MenuEntry(s.label, subChoice == i) { selectSubtitle(i) }) }
        items.add(MenuEntry("Browse subtitle files...", false, keep = true) { openSubtitleBrowser() })
        // Everything that adjusts how subtitles look or line up lives here, not in the Playback menu.
        items.add(MenuEntry("Subtitle settings", false, header = true) {})
        items.add(MenuEntry("Sync:  " + offsetText(subOffsetMs), false, keep = true) { openSyncMenu(b.bSubs) { openSubtitleMenu() } })
        items.add(MenuEntry("Size:  " + subSizeName(), false, keep = true) { openSubtitleSizeMenu() })
        openMenu("Subtitles", items, b.bSubs)
    }

    private val sizeChoices = listOf("Small" to 80, "Normal" to 100, "Large" to 130, "Huge" to 170)
    private fun subSizeName() = sizeChoices.firstOrNull { it.second == subSizePct }?.first ?: "$subSizePct%"

    /** Subtitle size. The change shows on screen at once; Back returns to the Subtitles list. */
    private fun openSubtitleSizeMenu() {
        val items = ArrayList<MenuEntry>()
        for ((label, pct) in sizeChoices) {
            items.add(MenuEntry(label, subSizePct == pct, keep = true) {
                subSizePct = pct
                prefs.edit().putInt(KEY_SUB_SIZE, pct).apply()
                applySubtitleLook()
                openSubtitleSizeMenu()
            })
        }
        openMenu("Subtitle size", items, b.bSubs)
        menuBackTo = { openSubtitleMenu() }
    }

    // ── subtitle sync panel: [+] value [-] ─────────────────────────────────────

    private var syncOn = false
    private var syncPlus: Button? = null
    private var syncMinus: Button? = null
    private var syncValue: TextView? = null
    private var syncHint: TextView? = null
    private var holdDir = 0

    /**
     * Two big buttons, + (subtitles later) above and - (subtitles earlier) below, 0.1 s per step. Pressing OK once
     * moves one step; HOLDING OK keeps stepping until the key is released. The stepping is driven by our own timer
     * (not by the remote's key-repeat, which differs from TV to TV), and while it runs only a text label and the
     * subtitle line are updated, so it stays smooth. The value is saved when the key is released.
     */
    private fun openSyncMenu(opener: View, back: () -> Unit) {
        loadCuesIfNeeded(true)          // fetch the lines now so the first step shows up at once
        beginMenu("Subtitle sync", opener)
        menuBackTo = back
        syncOn = true
        val lp = { LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(4) } }

        fun stepButton(label: String, dir: Int) = menuButton(label, false).apply {
            gravity = Gravity.CENTER
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            minimumHeight = dp(60)
            setOnClickListener { applyOffset(subOffsetMs + dir * 100L); commitOffset() }   // touch / mouse; the remote is handled in dispatchKeyEvent
        }
        val plus = stepButton("+  0.1s   (subtitles later)", 1)
        val minus = stepButton("-  0.1s   (subtitles earlier)", -1)
        val value = TextView(this).apply {
            gravity = Gravity.CENTER
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 34f)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setTextColor(ContextCompat.getColor(this@PlayerActivity, R.color.white))
        }
        val hint = TextView(this).apply {
            gravity = Gravity.CENTER
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            setTextColor(ContextCompat.getColor(this@PlayerActivity, R.color.muted))
        }
        val reset = menuButton("Reset to 0", false).apply { gravity = Gravity.CENTER; setOnClickListener { applyOffset(0); commitOffset() } }
        b.menuList.addView(plus, lp())
        b.menuList.addView(value, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(2) })
        b.menuList.addView(hint, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) })
        b.menuList.addView(minus, lp())
        b.menuList.addView(reset, lp())
        syncPlus = plus; syncMinus = minus; syncValue = value; syncHint = hint
        updateSyncUi()
        if (subChoice < 0) showMsg("Turn a subtitle on to see the change.")
        showMenu(plus)
    }

    private fun updateSyncUi() {
        val v = syncValue ?: return
        v.text = offsetText(subOffsetMs)
        v.setTextColor(when {
            subOffsetMs > 0 -> 0xFF7BE0A0.toInt()
            subOffsetMs < 0 -> 0xFFFFB27B.toInt()
            else -> ContextCompat.getColor(this, R.color.white)
        })
        syncHint?.text = when {
            subOffsetMs == 0L -> "In sync.  Hold OK on + or - to keep going."
            subOffsetMs > 0 -> "Subtitles appear later.  Hold OK to keep going."
            else -> "Subtitles appear earlier.  Hold OK to keep going."
        }
    }

    private val holdTick = object : Runnable {
        override fun run() {
            if (holdDir == 0) return
            applyOffset(subOffsetMs + holdDir * 100L)
            ui.postDelayed(this, 70)             // ~14 steps a second
        }
    }

    private fun startHold(dir: Int) {
        stopHold()
        holdDir = dir
        applyOffset(subOffsetMs + dir * 100L)    // first press = exactly one step
        ui.postDelayed(holdTick, 400)            // then, if still held, keep going
    }

    private fun stopHold() {
        if (holdDir == 0) return
        holdDir = 0
        ui.removeCallbacks(holdTick)
        commitOffset()
    }

    // ── subtitle file browser (files in the server's subtitle folder) ─────────

    private var browseJob: Job? = null
    private var browseSearchRun: Runnable? = null

    private fun serverBase(): String { val u = java.net.URI(req.streamUrl); return "${u.scheme}://${u.authority}" }

    private fun menuNote(text: String) = TextView(this).apply {
        this.text = text; setTextColor(ContextCompat.getColor(this@PlayerActivity, R.color.muted)); textSize = 17f; setPadding(dp(8), dp(10), dp(8), dp(10))
    }

    /** Same panel as the subtitle list: a search box plus the subtitle files the server knows about. */
    private fun openSubtitleBrowser() {
        beginMenu("Subtitle files", b.bSubs)
        menuBackTo = { openSubtitleMenu() }
        val search = EditText(this).apply {
            hint = "Search subtitle files..."
            setSingleLine()
            imeOptions = EditorInfo.IME_ACTION_SEARCH
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            setTextColor(ContextCompat.getColor(this@PlayerActivity, R.color.white))
            setHintTextColor(ContextCompat.getColor(this@PlayerActivity, R.color.muted))
            setBackgroundResource(R.drawable.bg_input)
            setPadding(dp(14), 0, dp(14), 0)
            minimumHeight = dp(50)
        }
        val results = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        b.menuList.addView(search, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50)).apply { bottomMargin = dp(8) })
        b.menuList.addView(results, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        fun load(q: String) {
            browseJob?.cancel()
            results.removeAllViews()
            results.addView(menuNote("Loading..."))
            browseJob = lifecycleScope.launch {
                try {
                    val txt = withContext(Dispatchers.IO) {
                        Http.getText(serverBase() + "/api/subtitle-library?q=" + URLEncoder.encode(q, "UTF-8"), 4000, 15_000)
                    }
                    val arr = JSONArray(txt)
                    results.removeAllViews()
                    if (arr.length() == 0) {
                        results.addView(menuNote(if (q.isEmpty()) "No subtitle files found. Set the subtitle folder in the LocalFlix settings."
                                                 else "No files match that search."))
                    }
                    for (i in 0 until arr.length()) {
                        val o = arr.getJSONObject(i)
                        val name = o.optString("name"); val lang = o.optString("lang"); val ext = o.optString("ext")
                        val detail = listOf(lang, ext.uppercase()).filter { it.isNotEmpty() }.joinToString(" · ")
                        val btn = menuButton(name + if (detail.isNotEmpty()) "   ($detail)" else "", false).apply {
                            setOnClickListener {
                                pickLibrarySubtitle(SubTrack(name.replace(Regex("\\.[^.]+$"), ""), lang, serverBase() + "/api/subtitle/" + o.getString("id") + ".vtt"))
                            }
                        }
                        results.addView(btn, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(4) })
                    }
                } catch (e: kotlinx.coroutines.CancellationException) {
                    throw e
                } catch (e: Exception) {
                    results.removeAllViews()
                    results.addView(menuNote("Could not read the subtitle folder from the server."))
                }
            }
        }
        search.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun afterTextChanged(s: Editable?) {
                browseSearchRun?.let { ui.removeCallbacks(it) }
                val r = Runnable { load(s?.toString()?.trim() ?: "") }
                browseSearchRun = r
                ui.postDelayed(r, 350)
            }
        })
        search.setOnEditorActionListener { v, _, _ ->
            hideIme(v)
            (results.getChildAt(0) as? Button)?.requestFocus()
            true
        }
        load("")
        showMenu(search)
    }

    private fun pickLibrarySubtitle(t: SubTrack) {
        var i = subs.indexOfFirst { it.url == t.url }
        if (i < 0) { subs.add(t); i = subs.lastIndex }
        closeMenu()
        selectSubtitle(i)
        showMsg("Subtitles: " + t.label)
    }

    private fun hideIme(v: View) {
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(v.windowToken, 0)
    }

    private fun openAudioMenu() {
        val items = ArrayList<MenuEntry>()
        val exo = player
        if (transcoding) {
            // The converted stream carries one audio track; choosing another restarts the conversion with that track.
            req.audio.forEach { a ->
                val detail = listOf(a.codec.uppercase(), channelsText(a.channels)).filter { it.isNotEmpty() }.joinToString("  ·  ")
                items.add(MenuEntry(a.label + if (detail.isNotEmpty()) "   ($detail)" else "", a.n == audioIdx) {
                    if (a.n != audioIdx) { audioIdx = a.n; startPlayback(logicalPos(), true); showMsg("Audio track changed.") }
                })
            }
        } else if (exo != null) {
            // Direct mode: the audio tracks ExoPlayer found in the file.
            exo.currentTracks.groups.filter { it.type == C.TRACK_TYPE_AUDIO }.forEachIndexed { n, g ->
                val f = g.getTrackFormat(0)
                val name = f.label ?: f.language?.let { Locale(it).displayLanguage } ?: "Track ${n + 1}"
                val detail = listOf((f.sampleMimeType ?: "").substringAfter('/').uppercase(), channelsText(f.channelCount)).filter { it.isNotEmpty() }.joinToString("  ·  ")
                items.add(MenuEntry(name + if (detail.isNotEmpty()) "   ($detail)" else "", g.isSelected) {
                    exo.trackSelectionParameters = exo.trackSelectionParameters.buildUpon()
                        .setOverrideForType(TrackSelectionOverride(g.mediaTrackGroup, 0)).build()
                })
            }
        }
        openMenu("Audio", items, b.bAudio)
    }

    /** The web player's "Playback settings": speed and subtitle size. */
    private fun openSettingsMenu() {
        val items = ArrayList<MenuEntry>()
        for (x in floatArrayOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f)) {
            val name = if (x == 1f) "Speed:  Normal" else "Speed:  ${x}x"
            items.add(MenuEntry(name, speed == x) {
                speed = x
                prefs.edit().putFloat(KEY_SPEED, x).apply()
                player?.setPlaybackSpeed(x)
                showMsg(if (x == 1f) "Normal speed" else "Speed ${x}x")
            })
        }
        openMenu("Playback", items, b.bSet)
    }

    private fun channelsText(ch: Int) = when { ch <= 0 -> ""; ch == 1 -> "Mono"; ch == 2 -> "Stereo"; ch == 6 -> "5.1"; ch == 8 -> "7.1"; else -> "$ch ch" }

    private var menuBackTo: (() -> Unit)? = null     // Back inside a sub screen (sync, file browser) returns here

    private fun menuButton(text: String, checked: Boolean): Button = Button(this).apply {
        this.text = text
        isAllCaps = false
        gravity = Gravity.START or Gravity.CENTER_VERTICAL
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
        setTextColor(if (checked) ContextCompat.getColor(this@PlayerActivity, R.color.white) else 0xCCFFFFFF.toInt())
        setBackgroundResource(R.drawable.bg_menu_item)
        stateListAnimator = null
        minimumHeight = dp(50)
        setPadding(dp(14), 0, dp(14), 0)
    }

    /** Clears the panel for new content. Used by every screen inside it. */
    private fun beginMenu(title: String, opener: View) {
        stopHold()
        syncOn = false
        browseJob?.cancel()
        menuBackTo = null
        menuOpener = opener
        b.menuTitle.text = title
        b.menuList.removeAllViews()
    }

    private fun showMenu(focus: View?) {
        menuOn = true
        ui.removeCallbacks(hideRunnable)
        b.menuPanel.visibility = View.VISIBLE
        updateBigPlay()
        focus?.requestFocus()
    }

    private fun openMenu(title: String, items: List<MenuEntry>, opener: View) {
        beginMenu(title, opener)
        var focusTarget: View? = null
        if (items.isEmpty()) b.menuList.addView(menuNote("Nothing to choose from."))
        for (e in items) {
            if (e.header) {      // a section title: not focusable
                b.menuList.addView(TextView(this).apply {
                    text = e.label.uppercase(Locale.getDefault()); textSize = 13f; letterSpacing = 0.08f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    setTextColor(ContextCompat.getColor(this@PlayerActivity, R.color.muted))
                    setPadding(dp(8), dp(14), dp(8), dp(6))
                })
                continue
            }
            val btn = menuButton((if (e.checked) "✓    " else "       ") + e.label, e.checked).apply {
                setOnClickListener { if (!e.keep) closeMenu(); e.onPick() }
            }
            b.menuList.addView(btn, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(4) })
            if (e.checked || focusTarget == null) focusTarget = btn   // focus the current choice, else the first row
        }
        showMenu(focusTarget)
    }

    private fun closeMenu() {
        stopHold()
        syncOn = false
        browseJob?.cancel()
        menuBackTo = null
        browseSearchRun?.let { ui.removeCallbacks(it) }
        hideIme(b.menuPanel)
        menuOn = false
        b.menuPanel.visibility = View.GONE
        menuOpener?.requestFocus()
        updateBigPlay()
        scheduleHide()
    }

    // ── dialog (next episode / errors) ────────────────────────────────────────

    private fun showDialog(title: String, text: String, aLabel: String, aAction: () -> Unit,
                           bLabel: String?, bAction: (() -> Unit)?, onCancel: () -> Unit) {
        hideControls()
        menuOn = false; b.menuPanel.visibility = View.GONE
        dialogOn = true
        b.bigPlay.visibility = View.GONE
        dialogCancel = onCancel
        b.dialogTitle.text = title
        b.dialogText.text = text
        b.dialogBtnA.text = aLabel
        b.dialogBtnA.setOnClickListener { hideDialog(); aAction() }
        if (bLabel != null && bAction != null) {
            b.dialogBtnB.visibility = View.VISIBLE
            b.dialogBtnB.text = bLabel
            b.dialogBtnB.setOnClickListener { hideDialog(); bAction() }
        } else b.dialogBtnB.visibility = View.GONE
        b.dialogPanel.visibility = View.VISIBLE
        b.dialogBtnA.requestFocus()
    }

    private fun hideDialog() {
        dialogOn = false
        dialogCancel = null
        b.dialogPanel.visibility = View.GONE
    }

    // ── controls ──────────────────────────────────────────────────────────────

    private val hideRunnable = Runnable { if (player?.playWhenReady == true && !menuOn && !dialogOn && pendingSeekMs < 0) hideControls() }

    /** Shows the controls and (optionally) puts the focus ring on [focus]. */
    private fun showControls(focus: View?) {
        controlsOn = true
        b.controls.visibility = View.VISIBLE
        applySubtitleLook()
        if (focus != null) focus.requestFocus()
        scheduleHide()
        updateUi()
    }

    private fun hideControls() {
        controlsOn = false
        ui.removeCallbacks(hideRunnable)
        b.controls.visibility = View.GONE        // a hidden view loses focus automatically
        applySubtitleLook()
    }

    private fun scheduleHide() {
        ui.removeCallbacks(hideRunnable)
        ui.postDelayed(hideRunnable, 4000)
    }

    private fun showMsg(text: String, ms: Long = 3500) {
        b.msgText.text = text
        b.msgText.visibility = View.VISIBLE
        ui.removeCallbacks(hideMsg)
        ui.postDelayed(hideMsg, ms)
    }
    private val hideMsg = Runnable { b.msgText.visibility = View.GONE }

    private fun updatePlayButton() {
        val playing = player?.playWhenReady == true && player?.playbackState != Player.STATE_ENDED
        b.bPlay.setImageResource(if (playing) R.drawable.ic_pause else R.drawable.ic_play)
        b.bPlay.contentDescription = if (playing) "Pause" else "Play"
        updateBigPlay()
    }

    /** The big centre play button of the web player: only while paused and nothing else is on top. */
    private fun updateBigPlay() {
        val exo = player
        val paused = exo != null && !exo.playWhenReady && exo.playbackState == Player.STATE_READY
        b.bigPlay.visibility = if (paused && !menuOn && !dialogOn) View.VISIBLE else View.GONE
    }

    // ── subtitle look / position ──────────────────────────────────────────────

    /** Size from the Settings menu; the lines move up while the controls are on screen (like the web player). */
    private fun applySubtitleLook() {
        val f = subSizePct / 100f
        b.playerView.subtitleView?.apply {
            setFractionalTextSize(SubtitleView.DEFAULT_TEXT_SIZE_FRACTION * 1.15f * f)
            setBottomPaddingFraction(if (controlsOn) 0.24f else 0.08f)
        }
        b.subText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f * f)
        b.subText.translationY = if (controlsOn) -dp(120).toFloat() else 0f
    }

    /** Runs 4x a second: seek bar, time text, converted-stream subtitles. */
    private val tick = object : Runnable {
        override fun run() {
            updateUi()
            if (++saveTicks % 20 == 0 && player != null && !dialogOn) persistResume()    // every ~5 s while open
            ui.postDelayed(this, 250)
        }
    }

    private fun updateUi() {
        val pos = logicalPos()
        if (pendingSeekMs < 0) lastPosMs = pos
        if (controlsOn) {
            val dur = durationMs()
            b.seekProgress.progress = if (dur > 0) (pos * 1000 / dur).toInt().coerceIn(0, 1000) else 0
            val buf = player?.bufferedPosition ?: 0L
            b.seekProgress.secondaryProgress = if (dur > 0) ((offsetMs + buf) * 1000 / dur).toInt().coerceIn(0, 1000) else 0
            b.timeText.text = if (dur > 0) "${fmt(pos)} / ${fmt(dur)}" else fmt(pos)
            // The white dot of the web seek bar: only while the bar has focus.
            val th = b.seekThumb
            if (b.seekBar.hasFocus() && b.seekProgress.width > 0) {
                th.visibility = View.VISIBLE
                th.translationX = b.seekProgress.width * (b.seekProgress.progress / 1000f) - th.width / 2f
            } else if (th.visibility != View.INVISIBLE) th.visibility = View.INVISIBLE
        }
        drawCue()
    }

    // ── remote keys ───────────────────────────────────────────────────────────
    //   Back          close menu -> hide controls -> close player
    //   Left / Right  seek -10 s / +10 s (hold = bigger steps); with controls up and focus on a button they move focus
    //   Up / Down     show the controls, then move focus between seek bar and buttons
    //   OK            hidden: play/pause.  visible: press the focused button
    //   Media keys    play, pause, play/pause, rewind, fast-forward, next, previous, stop

    override fun dispatchKeyEvent(e: KeyEvent): Boolean {
        val k = e.keyCode
        val down = e.action == KeyEvent.ACTION_DOWN

        if (k == KeyEvent.KEYCODE_BACK || k == KeyEvent.KEYCODE_ESCAPE) {
            if (e.action == KeyEvent.ACTION_UP) onBackKey()
            return true
        }

        // Media keys work in every state.
        when (k) {
            KeyEvent.KEYCODE_MEDIA_PLAY -> { if (down) { player?.play() }; return true }
            KeyEvent.KEYCODE_MEDIA_PAUSE -> { if (down) { player?.pause() }; return true }
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_HEADSETHOOK -> { if (down && e.repeatCount == 0) togglePlay(); return true }
            KeyEvent.KEYCODE_MEDIA_REWIND -> { if (down) seekStep(-1, e.repeatCount); return true }
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> { if (down) seekStep(1, e.repeatCount); return true }
            KeyEvent.KEYCODE_MEDIA_NEXT -> { if (down && e.repeatCount == 0 && req.nextId != null) finishWithResult(req.nextId); return true }
            KeyEvent.KEYCODE_MEDIA_PREVIOUS -> { if (down && e.repeatCount == 0) seekBy(-logicalPos()); return true }
            KeyEvent.KEYCODE_MEDIA_STOP -> { if (down) finishWithResult(null); return true }
        }

        // Subtitle sync panel: holding OK on + / - keeps stepping until the key is released.
        if (syncOn && menuOn) {
            val okKey = k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER || k == KeyEvent.KEYCODE_NUMPAD_ENTER || k == KeyEvent.KEYCODE_BUTTON_A
            val f = currentFocus
            if (okKey && (f === syncPlus || f === syncMinus)) {
                if (down) { if (e.repeatCount == 0) startHold(if (f === syncPlus) 1 else -1) }   // key-repeat events are ignored: our timer does the repeating
                else stopHold()
                return true
            }
            if (down && holdDir != 0) stopHold()      // any other key ends a hold
        }

        // Menu or dialog open: normal focus navigation between their buttons.
        if (dialogOn || menuOn) return super.dispatchKeyEvent(e)

        val isOk = k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER || k == KeyEvent.KEYCODE_NUMPAD_ENTER || k == KeyEvent.KEYCODE_BUTTON_A
        val isDir = k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_DPAD_RIGHT || k == KeyEvent.KEYCODE_DPAD_UP || k == KeyEvent.KEYCODE_DPAD_DOWN

        if (!controlsOn) {
            // Controls hidden: the remote is a plain player remote.
            when {
                k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_DPAD_RIGHT -> {
                    if (down) { showControls(b.seekBar); seekStep(if (k == KeyEvent.KEYCODE_DPAD_LEFT) -1 else 1, e.repeatCount) }
                    return true
                }
                k == KeyEvent.KEYCODE_DPAD_UP || k == KeyEvent.KEYCODE_DPAD_DOWN -> {
                    if (down && e.repeatCount == 0) showControls(b.bPlay)
                    return true
                }
                isOk -> { if (down && e.repeatCount == 0) togglePlay(); return true }
            }
            return super.dispatchKeyEvent(e)
        }

        // Controls visible
        if (down && (isDir || isOk)) scheduleHide()
        val f = currentFocus
        if (f === b.seekBar) {
            if (k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_DPAD_RIGHT) {
                if (down) seekStep(if (k == KeyEvent.KEYCODE_DPAD_LEFT) -1 else 1, e.repeatCount)
                return true
            }
            if (isOk) { if (down && e.repeatCount == 0) togglePlay(); return true }
            // Up -> back button, Down -> play button: the layout's nextFocus attributes do that
        } else if (f === b.btnBack) {
            if (k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_DPAD_RIGHT || k == KeyEvent.KEYCODE_DPAD_UP) return true
            if (isOk && e.repeatCount > 0) return true               // a held OK must not close the player twice
        } else if (f != null && k == KeyEvent.KEYCODE_DPAD_DOWN) {
            return true                                              // button row is the bottom: nothing below
        }
        return super.dispatchKeyEvent(e)
    }

    private fun onBackKey() {
        when {
            dialogOn -> dialogCancel?.invoke()
            menuOn -> { val back = menuBackTo; if (back != null) back() else closeMenu() }
            controlsOn -> hideControls()
            else -> finishWithResult(null)
        }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_REQUEST = "request"
        const val RESULT_ID = "id"
        const val RESULT_SECONDS = "seconds"
        const val RESULT_FINISHED = "finished"
        const val RESULT_NEXT_ID = "nextId"
        private const val PREFS = "localflix_player"
        private const val KEY_SUBS_ON = "subs_on"
        private const val KEY_SUB_LABEL = "sub_label"
        private const val KEY_SPEED = "speed"
        private const val KEY_SUB_SIZE = "sub_size"
        private const val KEY_SUB_OFFSET = "sub_offset_"
    }
}
