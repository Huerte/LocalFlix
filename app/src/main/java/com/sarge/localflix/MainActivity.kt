package com.sarge.localflix

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.KeyEvent
import android.view.View
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import com.sarge.localflix.data.ApiClient
import com.sarge.localflix.data.Movie
import com.sarge.localflix.databinding.ActivityMainBinding
import com.sarge.localflix.ui.MovieAdapter
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var adapter: MovieAdapter
    private var allMovies: List<Movie> = emptyList()
    private var searchJob: Job? = null

    // ── lifecycle ──────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupGrid()
        setupSearch()
        setupSettingsButton()

        val url = savedServerUrl()
        if (url.isEmpty()) {
            showServerDialog(firstRun = true)
        } else {
            loadMovies(url)
        }
    }

    // ── grid setup ─────────────────────────────────────────────────────────────

    private fun setupGrid() {
        adapter = MovieAdapter { movie ->
            val url = ApiClient.streamUrl(savedServerUrl(), movie.path)
            startActivity(
                Intent(this, PlayerActivity::class.java).apply {
                    putExtra(PlayerActivity.EXTRA_URL,  url)
                    putExtra(PlayerActivity.EXTRA_NAME, movie.name)
                }
            )
        }
        binding.recyclerView.apply {
            layoutManager = GridLayoutManager(this@MainActivity, COLUMNS)
            adapter       = this@MainActivity.adapter
            // Let the grid wrap back up to the search bar correctly
            setHasFixedSize(false)
        }
    }

    // ── search ─────────────────────────────────────────────────────────────────

    private fun setupSearch() {
        binding.searchEdit.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchJob?.cancel()
                searchJob = lifecycleScope.launch {
                    delay(200)            // small debounce
                    filterMovies(s?.toString() ?: "")
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        // Press D-pad DOWN or ENTER from search → focus grid
        binding.searchEdit.setOnKeyListener { _, keyCode, event ->
            if (event.action == KeyEvent.ACTION_DOWN &&
                (keyCode == KeyEvent.KEYCODE_DPAD_DOWN || keyCode == KeyEvent.KEYCODE_ENTER)) {
                binding.recyclerView.requestFocus()
                true
            } else false
        }
    }

    // ── settings button ────────────────────────────────────────────────────────

    private fun setupSettingsButton() {
        binding.settingsBtn.setOnClickListener { showServerDialog(firstRun = false) }
        binding.settingsBtn.setOnFocusChangeListener { _, focused ->
            binding.settingsBtn.alpha = if (focused) 1f else 0.6f
        }
    }

    // ── server dialog ──────────────────────────────────────────────────────────

    private fun showServerDialog(firstRun: Boolean) {
        val input = android.widget.EditText(this).apply {
            hint    = "http://192.168.1.x:8080"
            setText(savedServerUrl())
            setPadding(48, 32, 48, 32)
        }
        AlertDialog.Builder(this)
            .setTitle(if (firstRun) "Welcome to LocalFlix" else "Change Server")
            .setMessage(
                "Enter your laptop's IP address.\n\n" +
                "Run localflix.py on your laptop — the URL is printed there."
            )
            .setView(input)
            .setCancelable(!firstRun)
            .setPositiveButton("Connect") { _, _ ->
                val raw = input.text.toString().trim().trimEnd('/')
                if (raw.isNotEmpty()) {
                    val url = if (raw.startsWith("http")) raw else "http://$raw"
                    saveServerUrl(url)
                    ApiClient.reset()
                    loadMovies(url)
                }
            }
            .show()
    }

    // ── data loading ───────────────────────────────────────────────────────────

    private fun loadMovies(url: String) {
        setState(loading = true)
        lifecycleScope.launch {
            try {
                allMovies = ApiClient.getService(url).getMovies()
                adapter.submitList(allMovies)
                updateCountText(allMovies.size)
                setState(loading = false, empty = allMovies.isEmpty())
                if (allMovies.isNotEmpty()) binding.recyclerView.requestFocus()
            } catch (e: Exception) {
                setState(loading = false, error = true)
            }
        }
    }

    private fun filterMovies(query: String) {
        val q = query.trim().lowercase()
        val filtered = if (q.isEmpty()) allMovies
        else allMovies.filter {
            it.name.lowercase().contains(q) || it.folder.lowercase().contains(q)
        }
        adapter.submitList(filtered)
        updateCountText(filtered.size)
    }

    // ── UI state helpers ───────────────────────────────────────────────────────

    private fun setState(loading: Boolean = false, error: Boolean = false, empty: Boolean = false) {
        binding.progressBar.visibility  = if (loading) View.VISIBLE  else View.GONE
        binding.recyclerView.visibility = if (loading || error || empty) View.INVISIBLE else View.VISIBLE
        binding.statusCard.visibility   = if (error || empty || loading) View.VISIBLE else View.GONE

        when {
            loading -> {
                binding.statusIcon.text = "📂"
                binding.statusMsg.text  = "Connecting to server…"
            }
            error -> {
                binding.statusIcon.text = "⚠️"
                binding.statusMsg.text  = "Cannot reach server.\nIs your laptop on the same Wi-Fi?"
            }
            empty -> {
                binding.statusIcon.text = "🎬"
                binding.statusMsg.text  = "No movies found in the configured folder."
            }
        }
    }

    private fun updateCountText(count: Int) {
        binding.countText.text = if (count > 0) "$count titles" else ""
    }

    // ── prefs ──────────────────────────────────────────────────────────────────

    private fun savedServerUrl() =
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_URL, "") ?: ""

    private fun saveServerUrl(url: String) =
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_URL, url).apply()

    companion object {
        const val COLUMNS  = 5
        const val PREFS    = "localflix_prefs"
        const val KEY_URL  = "server_url"
    }
}
