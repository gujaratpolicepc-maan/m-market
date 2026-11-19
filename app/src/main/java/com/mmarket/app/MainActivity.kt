package com.mmarket.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private val appHost = "appassets.androidplatform.net"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.parseColor("#0E1116")
        window.navigationBarColor = Color.parseColor("#151A21")

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

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == appHost) return false
                // news links, GitHub release page etc. open in the phone's browser
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                } catch (e: Exception) {
                    true
                }
            }
        }

        setContentView(webView)
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl("https://$appHost/assets/www/index.html")
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // let the web page close an open panel / go to home tab first
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
}
