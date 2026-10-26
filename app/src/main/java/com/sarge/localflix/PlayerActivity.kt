package com.sarge.localflix

import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.fragment.app.FragmentActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.sarge.localflix.databinding.ActivityPlayerBinding

class PlayerActivity : FragmentActivity() {

    private lateinit var binding: ActivityPlayerBinding
    private var player: ExoPlayer? = null
    private var playWhenReady = true
    private var currentPosition: Long = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPlayerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Keep screen on while video plays
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Full immersive — hide system bars
        hideSystemUi()

        val movieName = intent.getStringExtra(EXTRA_NAME) ?: ""
        binding.movieTitle.text = movieName
    }

    override fun onStart() {
        super.onStart()
        initPlayer()
    }

    override fun onStop() {
        super.onStop()
        releasePlayer()
    }

    // ── player init ────────────────────────────────────────────────────────────

    private fun initPlayer() {
        val url = intent.getStringExtra(EXTRA_URL) ?: run { finish(); return }

        player = ExoPlayer.Builder(this).build().also { exo ->
            binding.playerView.player = exo
            binding.playerView.controllerAutoShow = true
            binding.playerView.controllerShowTimeoutMs = 3000

            val item = MediaItem.fromUri(url)
            exo.setMediaItem(item)
            exo.seekTo(currentPosition)
            exo.playWhenReady = playWhenReady
            exo.prepare()

            exo.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    // Hide title overlay once video is playing
                    if (state == Player.STATE_READY || state == Player.STATE_BUFFERING) {
                        binding.titleOverlay.postDelayed({
                            binding.titleOverlay.animate().alpha(0f).setDuration(600).start()
                        }, 2000)
                    }
                }
            })
        }
    }

    private fun releasePlayer() {
        player?.let {
            playWhenReady   = it.playWhenReady
            currentPosition = it.currentPosition
            it.release()
        }
        player = null
    }

    // ── UI helpers ─────────────────────────────────────────────────────────────

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
        )
    }

    companion object {
        const val EXTRA_URL  = "STREAM_URL"
        const val EXTRA_NAME = "MOVIE_NAME"
    }
}
