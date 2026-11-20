package com.mmarket.app

import android.annotation.SuppressLint
import android.app.Activity
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/**
 * An invisible WebView that opens an exchange web page (e.g. bseindia.com) and runs fetch() from
 * inside that page, exactly like a normal browser. Used for sites that block plain HTTP clients.
 */
class HiddenBrowser(private val activity: Activity, private val onResult: (String, Int, String) -> Unit) {

    private var wv: WebView? = null
    private var loadedPage: String? = null
    private var ready = false
    private val queue = ArrayList<Pair<String, String>>()   // (id, apiUrl) waiting for page load

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun view(): WebView {
        wv?.let { return it }
        val w = WebView(activity)
        w.settings.javaScriptEnabled = true
        w.settings.domStorageEnabled = true
        w.settings.blockNetworkImage = true
        w.addJavascriptInterface(object {
            @JavascriptInterface
            fun done(id: String, code: Int, body: String) {
                onResult(id, code, body)
            }
        }, "MMHidden")
        w.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                ready = true
                val items = ArrayList(queue)
                queue.clear()
                items.forEach { run(it.first, it.second) }
            }
        }
        wv = w
        return w
    }

    /** must be called on the UI thread */
    fun fetch(id: String, pageUrl: String, apiUrl: String) {
        if (!LiveHttp.isAllowed(pageUrl) || !LiveHttp.isAllowed(apiUrl)) {
            onResult(id, -1, "host not allowed"); return
        }
        val w = view()
        if (loadedPage != pageUrl) {
            loadedPage = pageUrl
            ready = false
            queue.add(Pair(id, apiUrl))
            w.loadUrl(pageUrl)
            // safety: if the page never finishes, try anyway after 15 s
            w.postDelayed({ if (!ready) { ready = true; val items = ArrayList(queue); queue.clear(); items.forEach { run(it.first, it.second) } } }, 15000)
            return
        }
        if (!ready) { queue.add(Pair(id, apiUrl)); return }
        run(id, apiUrl)
    }

    private fun run(id: String, apiUrl: String) {
        val qid = JSONObject.quote(id)
        val js = "fetch(" + JSONObject.quote(apiUrl) + ",{credentials:'include',headers:{'Accept':'application/json, text/plain, */*'}})" +
            ".then(function(r){return r.text().then(function(t){MMHidden.done(" + qid + ",r.status,t)})})" +
            ".catch(function(e){MMHidden.done(" + qid + ",-1,String(e))})"
        wv?.evaluateJavascript(js, null)
    }
}
