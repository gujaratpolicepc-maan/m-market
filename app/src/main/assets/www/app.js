/* M-Market — app UI (Gujarati). Reads latest.json produced by the GitHub Actions collector. */
(function () {
  "use strict";
  var CFG = window.MM_CONFIG || {};
  var state = { data: null, tab: "home", newsFilter: "all", newsQuery: "", stockQuery: "", loading: false, lastFetch: 0 };
  var $ = function (id) { return document.getElementById(id); };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function cls(v) { return v > 0.05 ? "pos" : v < -0.05 ? "neg" : "neu"; }
  function pct(p) { return p == null ? "—" : (p > 0 ? "+" : "") + p.toFixed(2) + "%"; }
  function num(n) {
    if (n == null) return "—";
    var d = Math.abs(n) >= 1000 ? 0 : Math.abs(n) >= 100 ? 1 : 2;
    return n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
  }
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (isNaN(s)) return "";
    if (s < 90) return "હમણાં";
    if (s < 3600) return Math.round(s / 60) + " મિનિટ પહેલાં";
    if (s < 86400) return Math.round(s / 3600) + " કલાક પહેલાં";
    return Math.round(s / 86400) + " દિવસ પહેલાં";
  }
  var DAYS = ["રવિ", "સોમ", "મંગળ", "બુધ", "ગુરુ", "શુક્ર", "શનિ"];
  var MONTHS = ["જાન્યુ", "ફેબ્રુ", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટે", "ઓક્ટો", "નવે", "ડિસે"];
  function dayName(dateStr) {
    var d = new Date(dateStr + "T00:00:00+05:30");
    return DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()];
  }
  function todayIST() {
    var d = new Date(Date.now() + 5.5 * 3600000);
    return d.toISOString().slice(0, 10);
  }
  var LABEL = {
    strong_positive: ["ખૂબ પોઝિટિવ 🚀", "pos", 0.85], positive: ["પોઝિટિવ 📈", "pos", 0.68],
    neutral: ["ન્યુટ્રલ / સાઇડવેઝ ↔", "neu", 0.5], negative: ["નેગેટિવ 📉", "neg", 0.32],
    strong_negative: ["ખૂબ નેગેટિવ ⚠️", "neg", 0.15]
  };
  var CONF = { low: "ઓછો", medium: "મધ્યમ", high: "ઊંચો" };
  var SECTOR_GU = {
    "IT": "આઇટી", "Banking": "બેંકિંગ", "PSU Bank": "સરકારી બેંક", "Auto": "ઓટો", "Pharma": "ફાર્મા",
    "FMCG": "FMCG", "Metal": "મેટલ", "Energy": "એનર્જી / ઓઇલ", "Realty": "રિયલ્ટી", "Power": "પાવર",
    "Defence": "ડિફેન્સ", "Railway": "રેલવે", "Telecom": "ટેલિકોમ", "Cement": "સિમેન્ટ", "Aviation": "એવિએશન",
    "Financial Services": "ફાઇનાન્સ", "Infra": "ઇન્ફ્રા", "Consumer": "કન્ઝ્યુમર", "Media": "મીડિયા",
    "Healthcare": "હેલ્થકેર", "Chemicals": "કેમિકલ્સ"
  };
  var MACRO_NOTE = {
    "Brent Crude": "ક્રૂડ વધે તો ભારત માટે નેગેટિવ (આયાત બિલ, મોંઘવારી). પેઇન્ટ, એવિએશન, OMC પર અસર.",
    "USD/INR": "આ વધે એટલે રૂપિયો નબળો. IT/ફાર્મા નિકાસકારોને ફાયદો, બાકી બજાર પર દબાણ.",
    "Dollar Index": "ડોલર મજબૂત થાય તો FII ભારતમાંથી પૈસા કાઢી શકે.",
    "US 10Y Yield": "US યીલ્ડ વધે તો ઉભરતા બજારોમાંથી FII વેચવાલી વધી શકે.",
    "Gold": "સોનું વધવું એટલે દુનિયામાં ડર/અનિશ્ચિતતા.",
    "US VIX": "અમેરિકાનો ‘ડર ઇન્ડેક્સ’. વધે તો જોખમ ઘટાડવાનો મૂડ."
  };
  function sectorGu(s) { return SECTOR_GU[s] || s; }
  function impactOf(n) {
    if (typeof n.ai_impact === "number") return n.ai_impact / 2;
    return n.sent || 0;
  }
  function watchlist() { return store("mm_watch") || []; }

  // ---------- data ----------
  function dataUrl() {
    var q = new URLSearchParams(location.search);
    if (q.get("data")) return q.get("data");
    if (!CFG.repo || CFG.repo.indexOf("__") === 0) return null;
    return "https://raw.githubusercontent.com/" + CFG.repo + "/" + (CFG.dataBranch || "data") + "/latest.json?t=" + Math.floor(Date.now() / 60000);
  }

  function load(force) {
    if (state.loading) return;
    var url = dataUrl();
    if (!url) { showErr("એપ સેટઅપ અધૂરું છે: રિપોઝિટરીનું નામ મળ્યું નથી. GitHub Actions થી બનેલું APK જ ઇન્સ્ટોલ કરો."); return; }
    state.loading = true;
    $("btnRefresh").classList.add("spin");
    fetch(url, { cache: force ? "no-store" : "default" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        state.data = d; state.lastFetch = Date.now();
        store("mm_cache", d);
        hideErr(); render();
      })
      .catch(function (e) {
        var msg = String(e.message || e);
        if (msg.indexOf("404") >= 0) showErr("હજુ ડેટા તૈયાર નથી. GitHub માં ‘Collect market data’ workflow એક વાર ચાલવા દો (5 મિનિટ), પછી ⟳ દબાવો.");
        else showErr("ઇન્ટરનેટ / ડેટા લોડ ન થયો (" + esc(msg) + "). છેલ્લો સાચવેલો ડેટા બતાવું છું.");
      })
      .then(function () { state.loading = false; $("btnRefresh").classList.remove("spin"); });
  }
  function showErr(m) { var b = $("errBar"); b.innerHTML = m; b.classList.remove("hidden"); }
  function hideErr() { $("errBar").classList.add("hidden"); }

  function checkUpdate() {
    if (!CFG.repo || CFG.repo.indexOf("__") === 0) return;
    var last = store("mm_upd_check") || 0;
    if (Date.now() - last < 6 * 3600000) return;
    store("mm_upd_check", Date.now());
    fetch("https://api.github.com/repos/" + CFG.repo + "/releases/latest")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rel) {
        if (!rel || !rel.tag_name) return;
        var latest = parseInt(String(rel.tag_name).split(".").pop(), 10);
        var mine = parseInt(String(CFG.version).split(".").pop(), 10);
        if (latest > mine) {
          var b = $("updateBar");
          b.innerHTML = "🎉 નવું વર્ઝન " + esc(rel.tag_name) + " ઉપલબ્ધ છે. <a href='" + esc(rel.html_url) + "'><b>અહીં દબાવી APK ડાઉનલોડ કરો</b></a>";
          b.classList.remove("hidden");
        }
      }).catch(function () {});
  }

  // ---------- render ----------
  function render() {
    var d = state.data;
    if (d) $("updated").textContent = "અપડેટ: " + ago(d.generated_at);
    var v = $("view");
    if (!d) { v.innerHTML = "<div class='empty'>ડેટા લોડ થઈ રહ્યો છે…</div>"; return; }
    var html = { home: renderHome, news: renderNews, global: renderGlobal, stocks: renderStocks, sectors: renderSectors }[state.tab](d);
    v.innerHTML = html;
    bindView();
  }

  function moodCard(d) {
    var ai = d.ai && d.ai.outlook ? d.ai.outlook : null;
    var rule = d.outlook || {};
    var label = (ai && LABEL[ai.label]) ? ai.label : rule.label;
    var L = LABEL[label] || LABEL.neutral;
    var conf = ai ? ai.confidence : rule.confidence;
    var s = d.session || {};
    var when;
    if (s.phase === "live") when = "આજનું બજાર (લાઇવ) — " + dayName(s.date);
    else if (s.phase === "pre") when = "આજના બજાર માટે આઉટલુક — " + dayName(s.date);
    else when = "આગામી બજાર દિવસ માટે આઉટલુક — " + dayName(s.date);
    var pos = rule.score != null ? Math.max(2, Math.min(98, (rule.score + 1) * 50)) : L[2] * 100;
    var h = "<div class='mood " + L[1] + "'>" +
      "<div class='when'>" + esc(when) + "</div>" +
      "<div class='big " + L[1] + "-t'>" + L[0] + "</div>" +
      "<div class='meter'><i style='left:" + pos + "%'></i></div>" +
      "<span class='badge'>વિશ્વાસ: " + (CONF[conf] || "ઓછો") + "</span>" +
      (ai ? "<span class='badge pos'>🤖 AI એનાલિસિસ</span>" : "<span class='badge'>📐 નિયમ આધારિત</span>");
    if (ai && rule.label && rule.label !== ai.label) {
      h += "<span class='badge'>નિયમ આધારિત: " + (LABEL[rule.label] || LABEL.neutral)[0] + "</span>";
    }
    h += "</div>";
    return h;
  }

  function renderHome(d) {
    var h = moodCard(d);
    var ai = d.ai || null;
    if (ai && ai.summary_gu) {
      h += "<div class='card'><h3>🤖 આજનો સાર</h3><div>" + esc(ai.summary_gu) + "</div>" +
        "<div class='muted small' style='margin-top:6px'>AI અપડેટ: " + ago(ai.generated_at) + "</div></div>";
    }
    // reasons
    var reasons = [];
    if (ai && ai.outlook && ai.outlook.reasons_gu) ai.outlook.reasons_gu.forEach(function (r) { reasons.push({ type: "neu", text: r }); });
    (d.outlook && d.outlook.reasons || []).forEach(function (r) { reasons.push(r); });
    if (reasons.length) {
      h += "<div class='card'><h3>📌 મુખ્ય કારણો</h3><ul class='reasons'>" +
        reasons.map(function (r) { return "<li class='" + esc(r.type) + "'>" + esc(r.text) + "</li>"; }).join("") + "</ul></div>";
    }
    // indices
    var ind = (d.markets && d.markets.india) || [];
    if (ind.length) {
      h += "<div class='card'><h3>🇮🇳 ભારતીય બજાર</h3><div class='grid'>" + ind.map(tile).join("") + "</div></div>";
    }
    // FII / DII
    if (d.fii_dii && d.fii_dii.length) {
      h += "<div class='card'><h3>💰 FII / DII (₹ કરોડ)</h3>" + d.fii_dii.map(function (r) {
        var n = parseFloat(r.net);
        return "<div class='row'><div class='l'><b>" + esc(r.category) + "</b><div class='muted small'>" + esc(r.date) + "</div></div><div class='r " + cls(n) + "-t'><b>" + (n > 0 ? "+" : "") + esc(r.net) + "</b><div class='muted small'>ખરીદી " + esc(r.buy) + " · વેચાણ " + esc(r.sell) + "</div></div></div>";
      }).join("") + "</div>";
    }
    // AI watch
    if (ai && ai.watch && ai.watch.length) {
      h += "<div class='card'><h3>👀 ફોકસમાં રહેલા શેર</h3>" + ai.watch.map(function (w) {
        var c = w.view === "positive" ? "pos" : w.view === "negative" ? "neg" : "neu";
        return "<div class='row' data-stock='" + esc(w.symbol) + "'><div class='l'><b>" + esc(w.symbol) + "</b><div class='muted small'>" + esc(w.reason_gu) + "</div></div><div class='r'><span class='badge " + c + "'>" + (c === "pos" ? "▲" : c === "neg" ? "▼" : "●") + "</span></div></div>";
      }).join("") + "</div>";
    }
    // top news
    var top = (d.news || []).filter(function (n) { return Math.abs(impactOf(n)) >= 0.5; }).slice(0, 6);
    if (top.length) {
      h += "<div class='card'><h3>⚡ મોટી અસરવાળા સમાચાર</h3>" + top.map(newsCard).join("") +
        "<button class='chip' data-tab-go='news'>બધા સમાચાર જુઓ →</button></div>";
    }
    h += historyCard(d);
    h += "<div class='disc'>⚠️ આ માહિતી ફક્ત જાણકારી માટે છે, રોકાણની સલાહ નથી. બજારની આગાહી ક્યારેય 100% સાચી હોતી નથી. રોકાણ પહેલાં પોતાનો અભ્યાસ કે SEBI રજિસ્ટર્ડ સલાહકારની સલાહ લો.</div>";
    return h;
  }

  function historyCard(d) {
    var hist = d.history || {};
    var keys = Object.keys(hist).sort().reverse().filter(function (k) { return hist[k].actual != null && k <= todayIST(); }).slice(0, 10);
    if (!keys.length) return "";
    var right = 0, tot = 0;
    var cells = keys.map(function (k) {
      var e = hist[k];
      var pred = e.ai || e.rule || "neutral";
      var dir = pred.indexOf("positive") >= 0 ? 1 : pred.indexOf("negative") >= 0 ? -1 : 0;
      var act = e.actual > 0.25 ? 1 : e.actual < -0.25 ? -1 : 0;
      var ok = dir === act;
      tot++; if (ok) right++;
      return "<div class='h'>" + k.slice(8) + "/" + k.slice(5, 7) + "<br>" + (ok ? "✅" : "❌") + "<br><span class='" + cls(e.actual) + "-t'>" + pct(e.actual) + "</span></div>";
    }).join("");
    return "<div class='card'><h3>🎯 અગાઉની આગાહી કેટલી સાચી પડી? (" + right + "/" + tot + ")</h3><div class='hist'>" + cells + "</div>" +
      "<div class='muted small' style='margin-top:6px'>Nifty ±0.25% થી ઓછું હલે તો ‘ન્યુટ્રલ’ ગણાય છે.</div></div>";
  }

  function tile(q) {
    return "<div class='tile'><div class='n'>" + esc(q.name) + "</div><div class='v'>" + num(q.price) + "</div><div class='p " + cls(q.name.indexOf("VIX") >= 0 ? -(q.pct || 0) : q.pct || 0) + "-t'>" + pct(q.pct) + "</div></div>";
  }

  function newsCard(n) {
    var imp = impactOf(n);
    var c = cls(imp);
    var syms = (n.ai_symbols && n.ai_symbols.length ? n.ai_symbols : n.symbols || []);
    var lang = n.lang === "hi" ? "हिंदी" : n.region === "global" ? "🌍" : "EN";
    return "<a class='news " + c + "' href='" + esc(n.link) + "' target='_blank'>" +
      "<div class='t'>" + esc(n.title) + "</div>" +
      (n.ai_gu ? "<div class='gu'>🤖 " + esc(n.ai_gu) + "</div>" : "") +
      "<div class='m'><span class='badge " + c + "'>" + (c === "pos" ? "▲ પોઝિટિવ" : c === "neg" ? "▼ નેગેટિવ" : "● ન્યુટ્રલ") + "</span>" +
      syms.map(function (s) { return "<span class='sym'>" + esc(s) + "</span>"; }).join("") +
      "<span>" + esc(n.source) + " · " + lang + " · " + ago(n.published) + "</span></div></a>";
  }

  var NEWS_FILTERS = [["all", "બધા"], ["india", "🇮🇳 ભારત"], ["hi", "हिंदी"], ["global", "🌍 ગ્લોબલ"], ["pos", "▲ પોઝિટિવ"], ["neg", "▼ નેગેટિવ"], ["mine", "⭐ મારા શેર"]];
  function renderNews(d) {
    var f = state.newsFilter, q = state.newsQuery.toLowerCase(), wl = watchlist();
    var list = (d.news || []).filter(function (n) {
      if (f === "india" && n.region !== "india") return false;
      if (f === "hi" && n.lang !== "hi") return false;
      if (f === "global" && n.region !== "global") return false;
      if (f === "pos" && impactOf(n) <= 0.05) return false;
      if (f === "neg" && impactOf(n) >= -0.05) return false;
      if (f === "mine") {
        var s = (n.symbols || []).concat(n.ai_symbols || []);
        if (!s.some(function (x) { return wl.indexOf(x) >= 0; })) return false;
      }
      if (q && (n.title + " " + (n.ai_gu || "") + " " + (n.symbols || []).join(" ")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var h = "<input class='search' id='newsSearch' placeholder='🔎 સમાચાર શોધો (કંપની, શબ્દ…)' value='" + esc(state.newsQuery) + "'>";
    h += "<div class='chips'>" + NEWS_FILTERS.map(function (x) { return "<button class='chip " + (f === x[0] ? "on" : "") + "' data-nf='" + x[0] + "'>" + x[1] + "</button>"; }).join("") + "</div>";
    h += "<div class='muted small' style='margin-bottom:8px'>" + list.length + " સમાચાર (છેલ્લા 48 કલાક)</div>";
    h += list.length ? list.slice(0, 150).map(newsCard).join("") : "<div class='empty'>આ ફિલ્ટરમાં કોઈ સમાચાર નથી" + (f === "mine" ? " — ‘શેર’ ટેબમાં ⭐ દબાવી તમારા શેર ઉમેરો." : ".") + "</div>";
    return h;
  }

  function renderGlobal(d) {
    var m = d.markets || {};
    var h = "";
    if (d.ai && d.ai.global_gu) h += "<div class='card'><h3>🤖 ગ્લોબલ સંકેતો અને ભારત પર અસર</h3><div>" + esc(d.ai.global_gu) + "</div></div>";
    var gs = d.outlook ? d.outlook.global_score : null;
    if (gs != null) {
      var c = cls(gs);
      h += "<div class='card'><h3>🌐 ગ્લોબલ મૂડ સ્કોર</h3><div class='big " + c + "-t' style='font-size:24px;font-weight:800'>" + (gs > 0 ? "+" : "") + (gs * 100).toFixed(0) + " / 100</div><div class='muted small'>અમેરિકા, એશિયા, યુરોપ, ક્રૂડ, ડોલર અને યીલ્ડ પરથી ગણેલો.</div></div>";
    }
    h += "<div class='card'><h3>📊 દુનિયાના બજારો</h3>" + (m.global || []).map(function (q) {
      return "<div class='row'><div class='l'><b>" + esc(q.name) + "</b><div class='muted small'>" + ago(q.time) + "</div></div><div class='r'><div>" + num(q.price) + "</div><div class='" + cls(q.pct || 0) + "-t'><b>" + pct(q.pct) + "</b></div></div></div>";
    }).join("") + "</div>";
    h += "<div class='card'><h3>🛢️ ક્રૂડ, ડોલર, યીલ્ડ — ભારત પર અસર</h3>" + (m.macro || []).map(function (q) {
      // for these, "up" is bad for India when weight is negative
      var eff = (q.w || 0) === 0 ? 0 : (q.pct || 0) * (q.w > 0 ? 1 : -1);
      return "<div class='row'><div class='l'><b>" + esc(q.name) + "</b><div class='muted small'>" + esc(MACRO_NOTE[q.name] || "") + "</div></div><div class='r'><div>" + num(q.price) + "</div><div class='" + cls(eff) + "-t'><b>" + pct(q.pct) + "</b></div></div></div>";
    }).join("") + "<div class='muted small' style='margin-top:6px'>રંગ = ભારત માટે અસર (લીલો સારું, લાલ ખરાબ).</div></div>";
    var gnews = (d.news || []).filter(function (n) { return n.region === "global"; }).slice(0, 10);
    if (gnews.length) h += "<div class='card'><h3>🌍 તાજા ગ્લોબલ સમાચાર</h3>" + gnews.map(newsCard).join("") + "</div>";
    return h;
  }

  function stockInfo(d, sym) {
    var s = (d.stocks || []).filter(function (x) { return x.sym === sym; })[0];
    var w = d.ai && d.ai.watch ? d.ai.watch.filter(function (x) { return String(x.symbol).toUpperCase() === sym; })[0] : null;
    return { s: s, w: w };
  }
  function stockRow(d, sym, name, sector) {
    var wl = watchlist(), info = stockInfo(d, sym);
    var sent = info.s ? info.s.sent : 0, cnt = info.s ? info.s.news_count : 0;
    var c = cnt ? cls(sent) : "neu";
    return "<div class='row'><button class='star " + (wl.indexOf(sym) >= 0 ? "on" : "") + "' data-star='" + esc(sym) + "'>★</button>" +
      "<div class='l' data-stock='" + esc(sym) + "'><b>" + esc(name) + "</b> <span class='sym'>" + esc(sym) + "</span><div class='muted small'>" + esc(sectorGu(sector)) +
      (info.w ? " · 🤖 " + esc(info.w.reason_gu) : "") + "</div></div>" +
      "<div class='r' data-stock='" + esc(sym) + "'>" + (cnt ? "<span class='badge " + c + "'>" + cnt + " સમાચાર</span>" : "<span class='muted small'>—</span>") + "</div></div>";
  }
  function renderStocks(d) {
    var list = d.stock_list || [], wl = watchlist(), q = state.stockQuery.toLowerCase();
    var h = "<input class='search' id='stockSearch' placeholder='🔎 કંપની કે સિમ્બોલ શોધો (દા.ત. Reliance, TCS)' value='" + esc(state.stockQuery) + "'>";
    if (q) {
      var res = list.filter(function (s) { return (s[0] + " " + s[1]).toLowerCase().indexOf(q) >= 0; });
      // also allow any symbol seen in news
      h += "<div class='card'><h3>શોધ પરિણામ</h3>" + (res.length ? res.slice(0, 40).map(function (s) { return stockRow(d, s[0], s[1], s[2]); }).join("") : "<div class='empty'>કોઈ કંપની મળી નહીં. (લિસ્ટમાં નવી કંપની ઉમેરવા collector/stocks.json માં ઉમેરો.)</div>") + "</div>";
      return h;
    }
    var meta = {}; list.forEach(function (s) { meta[s[0]] = s; });
    h += "<div class='card'><h3>⭐ મારી વૉચલિસ્ટ</h3>" + (wl.length ? wl.map(function (sym) { var s = meta[sym] || [sym, sym, ""]; return stockRow(d, s[0], s[1], s[2]); }).join("") : "<div class='muted'>હજુ કોઈ શેર ઉમેર્યો નથી. નીચેની યાદીમાં ★ દબાવો.</div>") + "</div>";
    var hot = (d.stocks || []).slice(0, 25);
    h += "<div class='card'><h3>🔥 સમાચારમાં સૌથી વધુ ચર્ચાતા શેર</h3>" + (hot.length ? hot.map(function (s) { return stockRow(d, s.sym, s.name, s.sector); }).join("") : "<div class='muted'>—</div>") + "</div>";
    return h;
  }
  function openStock(sym) {
    var d = state.data; if (!d) return;
    var meta = (d.stock_list || []).filter(function (s) { return s[0] === sym; })[0] || [sym, sym, ""];
    var news = (d.news || []).filter(function (n) { return (n.symbols || []).concat(n.ai_symbols || []).indexOf(sym) >= 0; });
    var info = stockInfo(d, sym);
    var h = "<div class='muted'>" + esc(sectorGu(meta[2])) + " · NSE: " + esc(sym) + "</div>";
    if (info.w) h += "<div class='card' style='margin-top:10px'><h3>🤖 AI ની નોંધ</h3>" + esc(info.w.reason_gu) + "</div>";
    if (info.s) h += "<div style='margin:10px 0'><span class='badge " + cls(info.s.sent) + "'>સમાચારનો મૂડ: " + (info.s.sent > 0.05 ? "પોઝિટિવ" : info.s.sent < -0.05 ? "નેગેટિવ" : "ન્યુટ્રલ") + "</span><span class='badge'>" + info.s.news_count + " સમાચાર</span></div>";
    var sec = (d.sectors || []).filter(function (x) { return x.sector === meta[2]; })[0];
    if (sec && sec.pct != null) h += "<div class='muted small'>" + esc(sectorGu(meta[2])) + " ઇન્ડેક્સ આજે: <b class='" + cls(sec.pct) + "-t'>" + pct(sec.pct) + "</b></div>";
    h += "<div class='stock-news'>" + (news.length ? news.map(newsCard).join("") : "<div class='empty'>છેલ્લા 48 કલાકમાં આ કંપની વિશે કોઈ સમાચાર મળ્યા નથી.</div>") + "</div>";
    h += "<a class='btn' href='https://www.google.com/finance/quote/" + encodeURIComponent(sym) + ":NSE' target='_blank'>📈 લાઇવ ભાવ જુઓ</a>";
    openSheet(meta[1], h);
  }

  function renderSectors(d) {
    var aiSec = {};
    if (d.ai && d.ai.sectors) d.ai.sectors.forEach(function (s) { aiSec[s.sector] = s; });
    var list = (d.sectors || []).slice();
    Object.keys(aiSec).forEach(function (k) { if (!list.some(function (x) { return x.sector === k; })) list.push({ sector: k, news_count: 0, news_sent: 0, pct: null }); });
    list.forEach(function (s) {
      var a = aiSec[s.sector];
      var aiv = a ? (a.view === "positive" ? 0.6 : a.view === "negative" ? -0.6 : 0) : null;
      var p = s.pct != null ? Math.max(-1, Math.min(1, s.pct / 1.5)) : 0;
      s._score = aiv != null ? aiv * 0.6 + p * 0.4 : (s.news_sent || 0) * 0.5 + p * 0.5;
      s._ai = a;
    });
    list.sort(function (a, b) { return b._score - a._score; });
    var h = "<div class='muted small' style='margin-bottom:8px'>ઉપર = સૌથી સારી અસર, નીચે = સૌથી ખરાબ. સેક્ટર પર ટેપ કરી સમાચાર જુઓ.</div><div class='sec-grid'>";
    h += list.map(function (s) {
      var c = cls(s._score);
      return "<div class='sec " + c + "' data-sector='" + esc(s.sector) + "'><div class='n'>" + esc(sectorGu(s.sector)) + "</div>" +
        "<div class='" + cls(s.pct || 0) + "-t' style='font-weight:700'>" + (s.pct != null ? "ઇન્ડેક્સ " + pct(s.pct) : "&nbsp;") + "</div>" +
        "<div class='d'>" + (s.news_count || 0) + " સમાચાર" + (s._ai ? " · 🤖 " + esc(s._ai.reason_gu) : "") + "</div></div>";
    }).join("") + "</div>";
    return h;
  }
  function openSector(sec) {
    var d = state.data;
    var news = (d.news || []).filter(function (n) { return (n.sectors || []).indexOf(sec) >= 0; });
    openSheet(sectorGu(sec) + " સેક્ટર", news.length ? news.slice(0, 60).map(newsCard).join("") : "<div class='empty'>આ સેક્ટર વિશે તાજા સમાચાર નથી.</div>");
  }

  function openInfo() {
    var d = state.data || {};
    var src = (d.sources || []);
    var ok = src.filter(function (s) { return s.ok; }).length;
    var h = "<div class='card'><h3>ℹ️ એપ વિશે</h3>" +
      "<div>વર્ઝન: <b>" + esc(CFG.version) + "</b></div>" +
      "<div>ડેટા: <b>" + esc(CFG.repo) + "</b></div>" +
      "<div>છેલ્લું અપડેટ: " + (d.generated_at ? new Date(d.generated_at).toLocaleString("en-IN") : "—") + "</div>" +
      "<div>AI સ્થિતિ: " + esc({ ok: "✅ ચાલુ", reused: "✅ ચાલુ (છેલ્લું એનાલિસિસ)", no_key: "❌ Gemini key ઉમેરેલી નથી (નિયમ આધારિત ચાલે છે)" }[d.ai_status] || ("⚠️ " + (d.ai_status || "—"))) + "</div>" +
      "<div style='margin-top:10px'><a class='btn' href='https://github.com/" + esc(CFG.repo) + "/releases/latest' target='_blank'>⬇️ નવું APK જુઓ</a></div></div>";
    h += "<div class='card'><h3>📡 ડેટા સ્ત્રોત (" + ok + "/" + src.length + " ચાલુ)</h3>" + src.map(function (s) {
      return "<div class='row'><div class='l small'>" + esc(s.name) + "</div><div class='r small'>" + (s.ok ? "✅ " + (s.count != null ? s.count : "") : "❌ <span class='muted'>" + esc(s.error || "") + "</span>") + "</div></div>";
    }).join("") + "</div>";
    h += "<div class='disc'>⚠️ આ એપ ફક્ત જાણકારી માટે છે. તેમાં આપેલી માહિતી રોકાણની સલાહ નથી. સમાચાર મૂળ વેબસાઇટના છે; પૂરો લેખ તેમની સાઇટ પર વાંચો.</div>";
    openSheet("સેટિંગ્સ અને માહિતી", h);
  }

  function openSheet(title, html) {
    $("sheetTitle").textContent = title;
    $("sheetBody").innerHTML = html;
    $("sheet").classList.remove("hidden");
    bindIn($("sheetBody"));
  }
  function closeSheet() { $("sheet").classList.add("hidden"); }

  // ---------- events ----------
  function bindIn(root) {
    root.querySelectorAll("[data-stock]").forEach(function (el) { el.onclick = function () { openStock(el.getAttribute("data-stock")); }; });
    root.querySelectorAll("[data-sector]").forEach(function (el) { el.onclick = function () { openSector(el.getAttribute("data-sector")); }; });
    root.querySelectorAll("[data-star]").forEach(function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        var sym = el.getAttribute("data-star"), wl = watchlist(), i = wl.indexOf(sym);
        if (i >= 0) wl.splice(i, 1); else wl.push(sym);
        store("mm_watch", wl);
        el.classList.toggle("on");
        if ($("view").contains(el) && state.tab === "stocks") render();
      };
    });
    root.querySelectorAll("[data-tab-go]").forEach(function (el) { el.onclick = function () { setTab(el.getAttribute("data-tab-go")); }; });
  }
  function bindView() {
    var v = $("view");
    bindIn(v);
    v.querySelectorAll("[data-nf]").forEach(function (el) { el.onclick = function () { state.newsFilter = el.getAttribute("data-nf"); render(); }; });
    var ns = $("newsSearch");
    if (ns) ns.oninput = debounce(function () { state.newsQuery = ns.value; render(); var n2 = $("newsSearch"); n2.focus(); n2.setSelectionRange(n2.value.length, n2.value.length); }, 350);
    var ss = $("stockSearch");
    if (ss) ss.oninput = debounce(function () { state.stockQuery = ss.value; render(); var s2 = $("stockSearch"); s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); }, 300);
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function setTab(t) {
    state.tab = t;
    document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === t); });
    window.scrollTo(0, 0);
    render();
  }

  document.querySelectorAll(".tabs button").forEach(function (b) { b.onclick = function () { setTab(b.getAttribute("data-tab")); }; });
  $("btnRefresh").onclick = function () { load(true); };
  $("btnInfo").onclick = openInfo;
  $("sheetClose").onclick = closeSheet;
  $("sheet").onclick = function (e) { if (e.target.id === "sheet") closeSheet(); };

  // called by Android back button
  window.mmBack = function () {
    if (!$("sheet").classList.contains("hidden")) { closeSheet(); return true; }
    if (state.tab !== "home") { setTab("home"); return true; }
    return false;
  };
  window.mmResume = function () {
    if (Date.now() - state.lastFetch > 5 * 60000) load(false);
    if (state.data) $("updated").textContent = "અપડેટ: " + ago(state.data.generated_at);
  };
  setInterval(function () { if (state.data) $("updated").textContent = "અપડેટ: " + ago(state.data.generated_at); }, 60000);

  // start: show cached data immediately, then refresh
  var cached = store("mm_cache");
  if (cached) { state.data = cached; render(); } else render();
  load(false);
  checkUpdate();
})();
