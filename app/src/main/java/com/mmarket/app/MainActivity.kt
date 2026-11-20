package com.mmarket.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private val appHost = "appassets.androidplatform.net"
    private var pendingOpen: String? = null
    private var pageReady = false

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.parseColor("#0E1116")
        window.navigationBarColor = Color.parseColor("#151A21")
        pendingOpen = intent?.getStringExtra(EXTRA_OPEN)

        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain(appHost)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this)
        webView.setBackgroundColor(Color.parseColor("#0E1116"))
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
            textZoom = 100
        }
        webView.addJavascriptInterface(Bridge(), "MMNative")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == appHost) return false
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                } catch (e: Exception) {
                    // no browser available
                }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                pageReady = true
                deliverPendingOpen()
            }
        }

        setContentView(webView)
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl("https://$appHost/assets/www/index.html")
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        pendingOpen = intent.getStringExtra(EXTRA_OPEN)
        deliverPendingOpen()
    }

    private fun deliverPendingOpen() {
        val target = pendingOpen ?: return
        if (!pageReady) return
        pendingOpen = null
        val safe = JSONObject.quote(target)
        webView.postDelayed({ webView.evaluateJavascript("window.mmOpen && window.mmOpen($safe)", null) }, 800)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        webView.evaluateJavascript("window.mmBack ? window.mmBack() : false") { handled ->
            if (handled != "true") systemBack()
        }
    }

    @Suppress("DEPRECATION")
    private fun systemBack() {
        super.onBackPressed()
    }

    override fun onResume() {
        super.onResume()
        webView.evaluateJavascript("window.mmResume && window.mmResume()", null)
    }

    /** Called from the web page (window.MMNative). */
    inner class Bridge {
        @JavascriptInterface
        fun setPrefs(json: String) {
            getSharedPreferences(MarketWorker.PREFS, Context.MODE_PRIVATE).edit().putString("prefs", json).apply()
            val notify = try { JSONObject(json).optBoolean("notify", false) } catch (e: Exception) { false }
            MarketWorker.schedule(applicationContext, notify)
        }

        /** Live data: JS calls MMNative.http(id, url); result arrives in window.mmHttpCb(id, status, body). */
        @JavascriptInterface
        fun http(id: String, url: String) {
            LiveHttp.get(url) { code, body ->
                val js = "window.mmHttpCb && window.mmHttpCb(" + JSONObject.quote(id) + "," + code + "," + JSONObject.quote(body) + ")"
                webView.post { webView.evaluateJavascript(js, null) }
            }
        }

        @JavascriptInterface
        fun requestNotifications() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= 33 &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                ) {
                    requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7)
                }
            }
        }
    }

    companion object {
        const val EXTRA_OPEN = "mm_open"
    }
}
