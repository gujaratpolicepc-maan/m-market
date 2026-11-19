package com.mmarket.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/**
 * Runs every ~30 minutes in the background: downloads latest.json and shows notifications for
 *  1) big news about watch-list stocks, 2) the morning / evening market outlook.
 */
class MarketWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {

    override fun doWork(): Result {
        val sp = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val prefs = try { JSONObject(sp.getString("prefs", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
        if (!prefs.optBoolean("notify", false)) return Result.success()
        val dataUrl = prefs.optString("dataUrl", "")
        if (!dataUrl.startsWith("http")) return Result.success()
        val gu = prefs.optString("lang", "gu") != "en"
        val watch = HashSet<String>()
        prefs.optJSONArray("watch")?.let { for (i in 0 until it.length()) watch.add(it.optString(i)) }

        val data = try { JSONObject(download("$dataUrl?t=${System.currentTimeMillis() / 60000}")) } catch (e: Exception) {
            return Result.retry()
        }
        if (!canNotify()) return Result.success()
        ensureChannel()

        // ---- 1) watch-list news ----
        val seen = LinkedHashSet((sp.getString("seen", "") ?: "").split(",").filter { it.isNotEmpty() })
        val firstRun = seen.isEmpty()
        val news = data.optJSONArray("news") ?: JSONArray()
        var shown = 0
        for (i in 0 until news.length()) {
            val n = news.optJSONObject(i) ?: continue
            val id = n.optString("id")
            if (id.isEmpty() || seen.contains(id)) continue
            seen.add(id)
            if (firstRun || watch.isEmpty() || shown >= 3) continue
            val syms = HashSet<String>()
            n.optJSONArray("symbols")?.let { for (k in 0 until it.length()) syms.add(it.optString(k)) }
            n.optJSONArray("ai_symbols")?.let { for (k in 0 until it.length()) syms.add(it.optString(k)) }
            val hit = syms.firstOrNull { watch.contains(it) } ?: continue
            val impact = if (n.has("ai_impact")) n.optDouble("ai_impact", 0.0) / 2.0 else n.optDouble("sent", 0.0)
            if (Math.abs(impact) < 0.5) continue
            val up = impact > 0
            val title = if (gu) "${if (up) "▲" else "▼"} $hit: ${if (up) "પોઝિટિવ" else "નેગેટિવ"} સમાચાર"
                        else "${if (up) "▲" else "▼"} $hit: ${if (up) "positive" else "negative"} news"
            val headline = if (gu) n.optString("tr_gu", "").ifEmpty { n.optString("title") } else n.optString("tr_en", "").ifEmpty { n.optString("title") }
            val extra = if (gu) n.optString("ai_gu", "") else n.optString("ai_en", "")
            show(id.hashCode(), title, if (extra.isNotEmpty()) "$headline\n🤖 $extra" else headline, "stock:$hit")
            shown++
        }
        val keep = seen.toList().takeLast(600)
        sp.edit().putString("seen", keep.joinToString(",")).apply()

        // ---- 2) morning / evening outlook ----
        val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata"))
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val session = data.optJSONObject("session")
        val phase = session?.optString("phase") ?: ""
        val slot = when {
            hour in 7..9 && phase == "pre" -> "am"
            hour in 18..22 && phase == "closed" -> "pm"
            else -> null
        }
        if (slot != null) {
            val key = "${session?.optString("date")}-$slot"
            if (sp.getString("outlook_sent", "") != key) {
                val ai = data.optJSONObject("ai")
                val label = ai?.optJSONObject("outlook")?.optString("label")?.takeIf { it.isNotEmpty() }
                    ?: data.optJSONObject("outlook")?.optString("label") ?: "neutral"
                val title = (if (gu) (if (slot == "am") "આજનો આઉટલુક: " else "કાલનો આઉટલુક: ") else (if (slot == "am") "Today's outlook: " else "Tomorrow's outlook: ")) + labelText(label, gu)
                val reasons = ai?.optJSONObject("outlook")?.optJSONArray(if (gu) "reasons_gu" else "reasons_en")
                val sb = StringBuilder()
                if (reasons != null) for (k in 0 until minOf(3, reasons.length())) sb.append("• ").append(reasons.optString(k)).append('\n')
                val idea = data.optJSONObject("options")?.optJSONObject("nifty")?.optJSONObject("idea")
                if (idea != null) {
                    val b = idea.optString("bias")
                    sb.append(if (gu) "F&O Nifty: " + (if (b == "bullish") "બુલિશ" else if (b == "bearish") "બેરિશ" else "ન્યુટ્રલ")
                              else "F&O Nifty: $b")
                }
                show(9001, title, sb.toString().trim(), "tab:home")
                sp.edit().putString("outlook_sent", key).apply()
            }
        }
        return Result.success()
    }

    private fun labelText(l: String, gu: Boolean): String = when (l) {
        "strong_positive" -> if (gu) "ખૂબ પોઝિટિવ 🚀" else "Strongly positive 🚀"
        "positive" -> if (gu) "પોઝિટિવ 📈" else "Positive 📈"
        "negative" -> if (gu) "નેગેટિવ 📉" else "Negative 📉"
        "strong_negative" -> if (gu) "ખૂબ નેગેટિવ ⚠️" else "Strongly negative ⚠️"
        else -> if (gu) "ન્યુટ્રલ ↔" else "Neutral ↔"
    }

    private fun download(url: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 20000
        c.readTimeout = 30000
        c.setRequestProperty("User-Agent", "M-Market-App")
        try {
            if (c.responseCode != 200) throw RuntimeException("HTTP ${c.responseCode}")
            return c.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } finally {
            c.disconnect()
        }
    }

    private fun canNotify(): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            applicationContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun ensureChannel() {
        val nm = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Market alerts", NotificationManager.IMPORTANCE_DEFAULT))
        }
    }

    private fun show(id: Int, title: String, text: String, open: String) {
        val ctx = applicationContext
        val intent = Intent(ctx, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_OPEN, open)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pi = PendingIntent.getActivity(ctx, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = Notification.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(id, n)
    }

    companion object {
        const val PREFS = "mm_native"
        private const val CHANNEL = "market_alerts"
        private const val WORK = "mm-market-alerts"

        fun schedule(ctx: Context, enabled: Boolean) {
            val wm = WorkManager.getInstance(ctx)
            if (!enabled) {
                wm.cancelUniqueWork(WORK)
                return
            }
            val req = PeriodicWorkRequest.Builder(MarketWorker::class.java, 30, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
