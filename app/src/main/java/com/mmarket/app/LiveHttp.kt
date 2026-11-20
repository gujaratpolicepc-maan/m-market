package com.mmarket.app

import java.net.CookieHandler
import java.net.CookieManager
import java.net.CookiePolicy
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Small HTTP client used by the web page (through MainActivity.Bridge) to read live market data
 * directly from the phone. Keeps cookies (NSE needs them) and only talks to an allow-list of hosts.
 */
object LiveHttp {
    private val pool = Executors.newFixedThreadPool(3)
    private val allowed = listOf(
        "nseindia.com", "bseindia.com", "cnbc.com", "moneycontrol.com", "githubusercontent.com"
    )
    private const val UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
    @Volatile private var nseWarm = 0L
    @Volatile private var bseWarm = 0L

    init {
        if (CookieHandler.getDefault() == null) {
            CookieHandler.setDefault(CookieManager(null, CookiePolicy.ACCEPT_ALL))
        }
    }

    fun isAllowed(url: String): Boolean {
        val host = try { URL(url).host.lowercase() } catch (e: Exception) { return false }
        return url.startsWith("https://") && allowed.any { host == it || host.endsWith(".$it") }
    }

    fun get(url: String, done: (Int, String) -> Unit) {
        pool.execute {
            var code = 0
            var body = ""
            try {
                if (!isAllowed(url)) throw IllegalArgumentException("host not allowed")
                val host = URL(url).host
                val now = System.currentTimeMillis()
                if (host.endsWith("nseindia.com") && now - nseWarm > 4 * 60_000L) {
                    warm("https://www.nseindia.com/option-chain"); nseWarm = now
                }
                if (host.endsWith("bseindia.com") && now - bseWarm > 10 * 60_000L) {
                    warm("https://www.bseindia.com/"); bseWarm = now
                }
                var r = fetch(url)
                if ((r.first == 401 || r.first == 403) && host.endsWith("nseindia.com")) {
                    warm("https://www.nseindia.com/"); warm("https://www.nseindia.com/option-chain")
                    nseWarm = System.currentTimeMillis()
                    r = fetch(url)
                }
                code = r.first
                body = r.second
            } catch (e: Exception) {
                code = -1
                body = e.toString()
            }
            done(code, body)
        }
    }

    private fun warm(url: String) {
        try { fetch(url) } catch (e: Exception) { /* ignore */ }
    }

    private fun fetch(url: String): Pair<Int, String> {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15000
        c.readTimeout = 25000
        c.instanceFollowRedirects = true
        c.setRequestProperty("User-Agent", UA)
        c.setRequestProperty("Accept", "application/json, text/plain, */*")
        c.setRequestProperty("Accept-Language", "en-US,en;q=0.9")
        val host = URL(url).host
        if (host.endsWith("nseindia.com")) c.setRequestProperty("Referer", "https://www.nseindia.com/option-chain")
        if (host.endsWith("bseindia.com")) {
            c.setRequestProperty("Referer", "https://www.bseindia.com/")
            c.setRequestProperty("Origin", "https://www.bseindia.com")
        }
        try {
            val code = c.responseCode
            val stream = if (code in 200..299) c.inputStream else (c.errorStream ?: return Pair(code, ""))
            val text = stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            return Pair(code, text)
        } finally {
            c.disconnect()
        }
    }
}
