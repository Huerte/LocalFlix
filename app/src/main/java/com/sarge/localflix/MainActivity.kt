package com.sarge.localflix

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import com.sarge.localflix.databinding.ActivityMainBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.util.Locale

/**
 * The whole app UI is the LocalFlix web page (static/) shown in a WebView, so the TV looks exactly like the browser.
 * Only two things are native: this connect screen (find / type the laptop address) and the ExoPlayer (PlayerActivity).
 *
 * There is NO mouse cursor: a WebView does not draw one, and we never add pointer emulation. The page's own
 * keydown handler (LF.moveFocus in static/app.js) moves the blue focus ring, so we do not touch arrow keys here.
 */
class MainActivity : FragmentActivity() {

    private lateinit var b: ActivityMainBinding
    private var webView: WebView? = null

    private var serverUrl = ""               // e.g. http://192.168.1.10:8080 (the page that is / will be loaded)
    private var webLoaded = false            // the page loaded at least once without error
    private var pageFailed = false           // main frame failed -> the native connect screen is shown
    @Volatile private var pageAtRoot = true  // reported by the page through LocalFlixTV.atRoot()
    private var startJob: Job? = null
    private var playerOpen = false

    // The native player returns the final position here; we hand it to the page (see LF.onNativePlayerClosed).
    private val playerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        playerOpen = false
        val d = res.data ?: return@registerForActivityResult
        val id = d.getStringExtra(PlayerActivity.RESULT_ID) ?: return@registerForActivityResult
        val secs = String.format(Locale.US, "%.1f", d.getDoubleExtra(PlayerActivity.RESULT_SECONDS, 0.0))
        val finished = d.getBooleanExtra(PlayerActivity.RESULT_FINISHED, false)
        val next = d.getStringExtra(PlayerActivity.RESULT_NEXT_ID)
        val nextJs = if (next == null) "null" else JSONObject.quote(next)
        webView?.evaluateJavascript("window.LF && LF.onNativePlayerClosed(${JSONObject.quote(id)}, $secs, $finished, $nextJs)", null)
        webView?.requestFocus()
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)   // keep the TV awake while the app is open
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.connRetry.setOnClickListener { startFlow() }
        b.connConnect.setOnClickListener { connectManual() }
        b.connInput.setOnEditorActionListener { _, _, _ -> connectManual(); true }

        webView = createWebView().also { b.webHolder.addView(it) }
        startFlow()
    }

    override fun onDestroy() {
        startJob?.cancel()
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    // ── connecting to the laptop ──────────────────────────────────────────────

    /**
     * Saved address -> check it. If that fails (or nothing is saved) -> look for the laptop with a UDP broadcast.
     * If that fails too -> let the user type the address. An address is only saved after /api/info answered.
     */
    private fun startFlow() {
        startJob?.cancel()
        startJob = lifecycleScope.launch {
            val saved = savedUrl()
            if (saved.isNotEmpty()) {
                showConnect("Connecting to $saved ...", busy = true)
                if (checkServer(saved)) { openWeb(saved); return@launch }
            }
            showConnect("Looking for LocalFlix on your Wi-Fi ...", busy = true)
            val found = Discovery.find(applicationContext)
            if (found != null && checkServer(found.url)) {
                saveUrl(found.url)
                openWeb(found.url)
                return@launch
            }
            val msg = if (saved.isEmpty())
                "Could not find LocalFlix automatically.\nIs LocalFlix running on your laptop, on the same Wi-Fi?\n\nType the address shown in the laptop window."
            else
                "Cannot reach $saved.\nIs your laptop on and LocalFlix running?\n\nPress Retry, or type a new address."
            showConnect(msg, busy = false, manual = true, prefill = saved)
        }
    }

    private fun connectManual() {
        val url = Http.normalizeServer(b.connInput.text.toString())
        if (url == null) {
            showConnect("That does not look like an address.\nExample: http://192.168.1.10:8080", busy = false, manual = true, prefill = b.connInput.text.toString())
            return
        }
        startJob?.cancel()
        startJob = lifecycleScope.launch {
            showConnect("Checking $url ...", busy = true, manual = true, prefill = url)
            if (checkServer(url)) {
                saveUrl(url)
                openWeb(url)
            } else {
                showConnect("No LocalFlix server answered at $url.\nCheck the address and that LocalFlix is running.", busy = false, manual = true, prefill = url)
            }
        }
    }

    /** Preflight: GET /api/info. Much faster and friendlier than waiting for a WebView timeout. */
    private suspend fun checkServer(url: String): Boolean = withContext(Dispatchers.IO) {
        try {
            JSONObject(Http.getText("$url/api/info", 3500, 4000)).optString("name") == "LocalFlix"
        } catch (e: Exception) {
            false
        }
    }

    /** Menu key, or the web Settings > "Change TV server..." button. */
    private fun showChangeServer() {
        startJob?.cancel()
        showConnect("Enter the address shown in the LocalFlix window on your laptop.", busy = false, manual = true, prefill = savedUrl())
    }

    private fun showConnect(status: String, busy: Boolean, manual: Boolean = false, prefill: String = "") {
        b.webHolder.visibility = View.GONE
        b.connectPanel.visibility = View.VISIBLE
        b.connStatus.text = status
        b.connProgress.visibility = if (busy) View.VISIBLE else View.GONE
        b.connInput.visibility = if (manual) View.VISIBLE else View.GONE
        b.connConnect.visibility = if (manual) View.VISIBLE else View.GONE
        if (manual && prefill.isNotEmpty() && b.connInput.text.toString() != prefill) b.connInput.setText(prefill)
        // Focus something right away so the remote always has a target.
        if (manual && !busy) b.connInput.requestFocus() else b.connRetry.requestFocus()
    }

    private fun showWeb() {
        b.connectPanel.visibility = View.GONE
        b.webHolder.visibility = View.VISIBLE
        webView?.requestFocus()
    }

    private fun openWeb(url: String) {
        serverUrl = url
        pageFailed = false
        showWeb()
        webView?.clearHistory()
        webView?.loadUrl(url)
    }

    // ── WebView ───────────────────────────────────────────────────────────────

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView {
        val wv = WebView(this)
        wv.layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        wv.setBackgroundColor(ContextCompat.getColor(this, R.color.bg))
        // Focusable so D-pad key events reach the page; the page's own handler moves focus (no native arrow handling).
        wv.isFocusable = true
        wv.isFocusableInTouchMode = true
        wv.isVerticalScrollBarEnabled = false
        wv.isHorizontalScrollBarEnabled = false
        wv.overScrollMode = View.OVER_SCROLL_NEVER
        wv.setLayerType(View.LAYER_TYPE_HARDWARE, null)   // GPU compositing: much smoother focus zoom / scrolling on TVs

        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true                    // localStorage: resume positions, preferences
            mediaPlaybackRequiresUserGesture = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            allowFileAccess = false
            allowContentAccess = false
            textZoom = 100
            cacheMode = WebSettings.LOAD_DEFAULT
            // The page detects the app by this suffix (and by window.LocalFlixTV).
            userAgentString = userAgentString + " LocalFlixTV/1.0"
        }
        wv.addJavascriptInterface(Bridge(), "LocalFlixTV")

        wv.webViewClient = object : WebViewClient() {
            // Stay on the LocalFlix server: any other address is ignored.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                !sameServer(request.url)

            // Also refuse sub-requests to other hosts (keeps the TV app talking only to your laptop).
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                if (serverUrl.isNotEmpty() && !sameServer(request.url)) {
                    return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
                return null
            }

            override fun onPageFinished(view: WebView, url: String?) {
                if (!pageFailed) {
                    webLoaded = true
                    view.requestFocus()
                }
            }

            // Never show Android's raw error page: show our friendly screen instead.
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
                if (request.isForMainFrame) pageError("Cannot load the LocalFlix page.\nIs your laptop on and LocalFlix running?")
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                if (request.isForMainFrame && errorResponse.statusCode >= 400) {
                    pageError("The server answered with error ${errorResponse.statusCode}.")
                }
            }

            // The WebView's renderer was killed (low memory on cheap TVs): rebuild it instead of crashing.
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                rebuildWebView()
                return true
            }
        }
        return wv
    }

    private fun sameServer(u: Uri): Boolean {
        val s = Uri.parse(serverUrl)
        return u.scheme == s.scheme && u.host == s.host && u.port == s.port
    }

    private fun pageError(message: String) {
        pageFailed = true
        showConnect(message, busy = false, manual = true, prefill = serverUrl)
    }

    private fun rebuildWebView() {
        webView?.let { b.webHolder.removeView(it); it.destroy() }
        webView = createWebView().also { b.webHolder.addView(it) }
        if (serverUrl.isNotEmpty()) openWeb(serverUrl)
    }

    // ── JavaScript bridge: window.LocalFlixTV (called from static/*.js) ───────

    inner class Bridge {
        @JavascriptInterface fun isTv(): Boolean = true

        /** The page tells us whether Back would have nothing left to close (home screen). */
        @JavascriptInterface fun atRoot(root: Boolean) { pageAtRoot = root }

        /** Play a movie in the native player. [json] is described in PlayRequest.kt. */
        @JavascriptInterface fun play(json: String) = runOnUiThread { launchPlayer(json) }

        /** Settings > "Change TV server..." */
        @JavascriptInterface fun changeServer() = runOnUiThread { showChangeServer() }

        /** The page keeps text fields silent until OK is pressed, then asks for the on-screen keyboard. */
        @JavascriptInterface fun showKeyboard() = runOnUiThread {
            val wv = webView ?: return@runOnUiThread
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            // The page switches inputmode and re-focuses the field just before calling us; the browser process learns
            // about that a moment later. So: make sure the WebView owns focus, rebuild its input connection, then ask
            // for the keyboard, and ask once more shortly after in case the first request came too early.
            val show = Runnable {
                if (!wv.hasFocus()) wv.requestFocus()
                imm.restartInput(wv)
                if (!imm.showSoftInput(wv, InputMethodManager.SHOW_IMPLICIT)) imm.showSoftInput(wv, 0)
            }
            wv.postDelayed(show, 80)
            wv.postDelayed({ if (wv.hasFocus()) imm.showSoftInput(wv, 0) }, 350)
        }

        @JavascriptInterface fun hideKeyboard() = runOnUiThread {
            val wv = webView ?: return@runOnUiThread
            (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(wv.windowToken, 0)
        }
    }

    private fun launchPlayer(json: String) {
        if (playerOpen) return
        try { PlayRequest.parse(json) } catch (e: Exception) { return }   // refuse broken requests early
        playerOpen = true
        playerLauncher.launch(Intent(this, PlayerActivity::class.java).putExtra(PlayerActivity.EXTRA_REQUEST, json))
    }

    // ── remote keys ───────────────────────────────────────────────────────────

    /**
     * Back goes to the PAGE first (it closes search suggestions, modals and screens itself).
     * Only when the page says it is already at the home screen do we exit the app.
     * Menu opens the server screen. Arrow keys are NOT handled here: they belong to the page.
     */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        when (event.keyCode) {
            KeyEvent.KEYCODE_BACK -> {
                if (event.action == KeyEvent.ACTION_UP) handleBack()
                return true       // swallow DOWN and UP so the WebView never sees them
            }
            KeyEvent.KEYCODE_MENU -> {
                if (event.action == KeyEvent.ACTION_UP) showChangeServer()
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun handleBack() {
        if (b.connectPanel.visibility == View.VISIBLE) {
            // From "Change server": go back to the page if it is fine, otherwise leave the app.
            if (webLoaded && !pageFailed) { startJob?.cancel(); showWeb() } else finish()
            return
        }
        val wv = webView ?: run { finish(); return }
        // LF.onNativeBack() returns true when the page used the key, false when it is at home (see static/app.js).
        wv.evaluateJavascript("(window.LF && LF.onNativeBack) ? LF.onNativeBack() : null") { r ->
            when (r) {
                "true" -> Unit
                "false" -> finish()
                else -> if (pageAtRoot) finish() else wv.requestFocus()   // page not ready: trust the last atRoot()
            }
        }
    }

    // ── saved server address ──────────────────────────────────────────────────

    private fun savedUrl(): String =
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_URL, "") ?: ""

    private fun saveUrl(url: String) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_URL, url).apply()
    }

    companion object {
        const val PREFS = "localflix_prefs"   // same names as the old app, so an existing address is reused
        const val KEY_URL = "server_url"
    }
}
