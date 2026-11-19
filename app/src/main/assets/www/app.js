/* M-Market — app UI (Gujarati / English). Reads latest.json produced by the GitHub Actions collector. */
(function () {
  "use strict";
  var CFG = window.MM_CONFIG || {};
  var NATIVE = window.MMNative || null;
  var $ = function (id) { return document.getElementById(id); };

  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k));
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
  }
  var PREF = store("mm_prefs") || {};
  var state = {
    data: null, tab: "home", newsFilter: "all", newsQuery: "", stockQuery: "", loading: false, lastFetch: 0,
    lang: PREF.lang || "gu", showTr: PREF.showTr !== false, notify: !!PREF.notify
  };
  function savePrefs() {
    store("mm_prefs", { lang: state.lang, showTr: state.showTr, notify: state.notify });
    syncNative();
  }

  // ---------- texts ----------
  var T = {
    gu: {
      loading: "લોડ થઈ રહ્યું છે…", updated: "અપડેટ", now: "હમણાં", minAgo: " મિનિટ પહેલાં", hrAgo: " કલાક પહેલાં", dayAgo: " દિવસ પહેલાં",
      tabs: ["હોમ", "સમાચાર", "ગ્લોબલ", "શેર", "સેક્ટર", "F&O"],
      setupErr: "એપ સેટઅપ અધૂરું છે: રિપોઝિટરીનું નામ મળ્યું નથી. GitHub Actions થી બનેલું APK જ ઇન્સ્ટોલ કરો.",
      noData: "હજુ ડેટા તૈયાર નથી. GitHub માં ‘Collect market data’ workflow એક વાર ચાલવા દો, પછી ⟳ દબાવો.",
      netErr: "ઇન્ટરનેટ / ડેટા લોડ ન થયો. છેલ્લો સાચવેલો ડેટા બતાવું છું.",
      newVer: "🎉 નવું વર્ઝન ઉપલબ્ધ છે:", dlApk: "અહીં દબાવી APK ડાઉનલોડ કરો",
      live: "આજનું બજાર (લાઇવ)", pre: "આજના બજાર માટે આઉટલુક", closed: "આગામી બજાર દિવસ માટે આઉટલુક",
      labels: { strong_positive: "ખૂબ પોઝિટિવ 🚀", positive: "પોઝિટિવ 📈", neutral: "ન્યુટ્રલ / સાઇડવેઝ ↔", negative: "નેગેટિવ 📉", strong_negative: "ખૂબ નેગેટિવ ⚠️" },
      conf: { low: "ઓછો", medium: "મધ્યમ", high: "ઊંચો" }, confL: "વિશ્વાસ", aiBadge: "🤖 AI એનાલિસિસ", ruleBadge: "📐 નિયમ આધારિત", ruleSays: "નિયમ આધારિત",
      summary: "🤖 આજનો સાર", aiUpd: "AI અપડેટ", reasons: "📌 મુખ્ય કારણો", india: "🇮🇳 ભારતીય બજાર", fii: "💰 FII / DII (₹ કરોડ)",
      buy: "ખરીદી", sell: "વેચાણ", focus: "👀 ફોકસમાં રહેલા શેર", bigNews: "⚡ મોટી અસરવાળા સમાચાર", allNews: "બધા સમાચાર જુઓ →",
      hist: "🎯 અગાઉની આગાહી કેટલી સાચી પડી?", histNote: "Nifty ±0.25% થી ઓછું હલે તો ‘ન્યુટ્રલ’ ગણાય છે.",
      disc: "⚠️ આ માહિતી ફક્ત જાણકારી માટે છે, રોકાણની સલાહ નથી. બજારની આગાહી ક્યારેય 100% સાચી હોતી નથી. રોકાણ પહેલાં પોતાનો અભ્યાસ કે SEBI રજિસ્ટર્ડ સલાહકારની સલાહ લો.",
      pos: "▲ પોઝિટિવ", neg: "▼ નેગેટિવ", neu: "● ન્યુટ્રલ",
      nf: [["all", "બધા"], ["india", "🇮🇳 ભારત"], ["hi", "हिंदी"], ["global", "🌍 ગ્લોબલ"], ["pos", "▲ પોઝિટિવ"], ["neg", "▼ નેગેટિવ"], ["mine", "⭐ મારા શેર"]],
      searchNews: "🔎 સમાચાર શોધો (કંપની, શબ્દ…)", newsCount: " સમાચાર (છેલ્લા 48 કલાક)", noNews: "આ ફિલ્ટરમાં કોઈ સમાચાર નથી.", noMine: " ‘શેર’ ટેબમાં ⭐ દબાવી તમારા શેર ઉમેરો.",
      gAi: "🤖 ગ્લોબલ સંકેતો અને ભારત પર અસર", gScore: "🌐 ગ્લોબલ મૂડ સ્કોર", gScoreNote: "અમેરિકા, એશિયા, યુરોપ, ક્રૂડ, ડોલર અને યીલ્ડ પરથી ગણેલો.",
      world: "📊 દુનિયાના બજારો", macro: "🛢️ ક્રૂડ, ડોલર, યીલ્ડ — ભારત પર અસર", macroNote: "રંગ = ભારત માટે અસર (લીલો સારું, લાલ ખરાબ).", gNews: "🌍 તાજા ગ્લોબલ સમાચાર",
      macroInfo: {
        "Brent Crude": "ક્રૂડ વધે તો ભારત માટે નેગેટિવ (આયાત બિલ, મોંઘવારી). પેઇન્ટ, એવિએશન, OMC પર અસર.",
        "USD/INR": "આ વધે એટલે રૂપિયો નબળો. IT/ફાર્મા નિકાસકારોને ફાયદો, બાકી બજાર પર દબાણ.",
        "Dollar Index": "ડોલર મજબૂત થાય તો FII ભારતમાંથી પૈસા કાઢી શકે.",
        "US 10Y Yield": "US યીલ્ડ વધે તો ઉભરતા બજારોમાંથી FII વેચવાલી વધી શકે.",
        "Gold": "સોનું વધવું એટલે દુનિયામાં ડર/અનિશ્ચિતતા.", "US VIX": "અમેરિકાનો ‘ડર ઇન્ડેક્સ’. વધે તો જોખમ ઘટાડવાનો મૂડ."
      },
      searchStock: "🔎 કંપની કે સિમ્બોલ શોધો (દા.ત. Reliance, TCS)", results: "શોધ પરિણામ", noStock: "કોઈ કંપની મળી નહીં. (નવી કંપની collector/stocks.json માં ઉમેરો.)",
      myWatch: "⭐ મારી વૉચલિસ્ટ", noWatch: "હજુ કોઈ શેર ઉમેર્યો નથી. નીચેની યાદીમાં ★ દબાવો.", hot: "🔥 સમાચારમાં સૌથી વધુ ચર્ચાતા શેર", newsN: " સમાચાર",
      aiNote: "🤖 AI ની નોંધ", mood: "સમાચારનો મૂડ", moodV: { pos: "પોઝિટિવ", neg: "નેગેટિવ", neu: "ન્યુટ્રલ" }, idxToday: "ઇન્ડેક્સ આજે",
      noStockNews: "છેલ્લા 48 કલાકમાં આ કંપની વિશે કોઈ સમાચાર મળ્યા નથી.", livePrice: "📈 લાઇવ ભાવ જુઓ", optChain: "🔗 ઓપ્શન ચેઇન (NSE)",
      secNote: "ઉપર = સૌથી સારી અસર, નીચે = સૌથી ખરાબ. સેક્ટર પર ટેપ કરી સમાચાર જુઓ.", sector: " સેક્ટર", noSecNews: "આ સેક્ટર વિશે તાજા સમાચાર નથી.", index: "ઇન્ડેક્સ",
      settings: "સેટિંગ્સ અને માહિતી", language: "🌐 ભાષા / Language", trToggle: "સમાચારનો ગુજરાતી અનુવાદ બતાવો", notif: "🔔 નોટિફિકેશન",
      notifDesc: "વૉચલિસ્ટના શેરના મોટા સમાચાર અને સવાર/સાંજનો આઉટલુક", notifNA: "નોટિફિકેશન માટે નવું APK ઇન્સ્ટોલ કરો.",
      about: "ℹ️ એપ વિશે", version: "વર્ઝન", dataSrc: "ડેટા", lastUpd: "છેલ્લું અપડેટ", aiState: "AI સ્થિતિ",
      aiStates: { ok: "✅ ચાલુ", reused: "✅ ચાલુ (છેલ્લું એનાલિસિસ)", no_key: "❌ Gemini key ઉમેરેલી નથી (નિયમ આધારિત ચાલે છે)" },
      newApk: "⬇️ નવું APK જુઓ", sources: "📡 ડેટા સ્ત્રોત", on: "ચાલુ",
      discFull: "⚠️ આ એપ ફક્ત જાણકારી માટે છે. તેમાં આપેલી માહિતી રોકાણની સલાહ નથી. સમાચાર મૂળ વેબસાઇટના છે; પૂરો લેખ તેમની સાઇટ પર વાંચો.",
      // F&O
      foWarn: "⚠️ F&O (કોલ/પુટ) ખૂબ જોખમી છે. SEBI ના અભ્યાસ મુજબ 10 માંથી 9 થી વધુ વ્યક્તિગત ટ્રેડરને નુકસાન થાય છે. નીચેના આઇડિયા ફક્ત શીખવા/સમજવા માટે છે — સલાહ નથી. હંમેશા સ્ટોપ-લોસ રાખો અને ગુમાવી શકો તેટલી જ રકમ વાપરો.",
      spot: "સ્પોટ", expiry: "એક્સપાયરી", pcr: "PCR", maxPain: "મેક્સ પેઇન", support: "સપોર્ટ (PE OI)", resistance: "રેઝિસ્ટન્સ (CE OI)", iv: "ATM IV",
      atmPrem: "ATM પ્રીમિયમ", pcrMean: function (p) { return p >= 1.3 ? "ઘણું પુટ રાઇટિંગ — બુલિશ/ઓવરસોલ્ડ" : p >= 1 ? "થોડું બુલિશ" : p >= 0.7 ? "થોડું બેરિશ" : "ઘણું કોલ રાઇટિંગ — બેરિશ"; },
      bias: { bullish: "📈 બુલિશ", bearish: "📉 બેરિશ", neutral: "↔ ન્યુટ્રલ" }, idea: "💡 આઇડિયા (શીખવા માટે)",
      ideaBuy: function (n, i, exp) { return "<b>" + n + " " + i.strike + " " + i.opt + "</b> (" + exp + ") ખરીદી — પ્રીમિયમ આશરે ₹" + i.premium; },
      ideaEntry: function (n, i) { return "એન્ટ્રી ત્યારે જ, જ્યારે " + n + " " + (i.opt === "CE" ? "ઉપર" : "નીચે") + " ટકે: " + i.trigger; },
      ideaSL: function (n, i) { return "સ્ટોપ-લોસ: પ્રીમિયમ ₹" + i.sl_premium + " (≈30%) અથવા " + n + " " + (i.opt === "CE" ? "નીચે" : "ઉપર") + " જાય: " + (i.stop_level || "—"); },
      ideaTgt: function (n, i) { return "ટાર્ગેટ: પ્રીમિયમ ₹" + i.target_premium + " અથવા " + n + " લેવલ " + (i.target_level || "—") + " નજીક"; },
      ideaSpread: function (i) { return "ઓછા જોખમવાળો વિકલ્પ: " + (i.opt === "CE" ? "Bull Call Spread" : "Bear Put Spread") + " — " + i.spread.buy + " " + i.opt + " ખરીદો + " + i.spread.sell + " " + i.opt + " વેચો (જોખમ મર્યાદિત)"; },
      ideaWait: function (n, i) { return "સ્પષ્ટ દિશા નથી — ઓપ્શન ખરીદવાનું ટાળો (ટાઇમ ડીકે નુકસાન કરે). " + n + " " + (i.trigger_up || "—") + " ઉપર તૂટે તો કોલ, " + (i.trigger_down || "—") + " નીચે તૂટે તો પુટ પર નજર રાખો."; },
      premAsOf: "પ્રીમિયમ ડેટા સમય", premNote: "લાઇવ ભાવ અલગ હશે — ઓર્ડર પહેલાં ચેક કરો.", stale: "⏳ જૂનો ડેટા (NSE થી નવો ડેટા ન મળ્યો)",
      foStocks: "📌 સમાચાર આધારિત F&O શેર", foNoData: "ઓપ્શન ચેઇન ડેટા હજુ મળ્યો નથી. આગળના અપડેટમાં આવશે.", foHist: "🎯 F&O દિશા કેટલી સાચી પડી?",
      confT: "વિશ્વાસ", aiView: "🤖 AI વ્યૂ"
    },
    en: {
      loading: "Loading…", updated: "Updated", now: "just now", minAgo: " min ago", hrAgo: " h ago", dayAgo: " d ago",
      tabs: ["Home", "News", "Global", "Stocks", "Sectors", "F&O"],
      setupErr: "Setup incomplete: repository name missing. Install the APK built by GitHub Actions.",
      noData: "No data yet. Let the ‘Collect market data’ workflow run once on GitHub, then tap ⟳.",
      netErr: "Could not load data. Showing the last saved data.",
      newVer: "🎉 New version available:", dlApk: "Tap here to download the APK",
      live: "Today's market (live)", pre: "Outlook for today's session", closed: "Outlook for next trading day",
      labels: { strong_positive: "Strongly positive 🚀", positive: "Positive 📈", neutral: "Neutral / sideways ↔", negative: "Negative 📉", strong_negative: "Strongly negative ⚠️" },
      conf: { low: "Low", medium: "Medium", high: "High" }, confL: "Confidence", aiBadge: "🤖 AI analysis", ruleBadge: "📐 Rule based", ruleSays: "Rule based",
      summary: "🤖 Today's summary", aiUpd: "AI updated", reasons: "📌 Key reasons", india: "🇮🇳 Indian market", fii: "💰 FII / DII (₹ crore)",
      buy: "Buy", sell: "Sell", focus: "👀 Stocks in focus", bigNews: "⚡ High-impact news", allNews: "See all news →",
      hist: "🎯 How accurate were past outlooks?", histNote: "A Nifty move under ±0.25% counts as ‘neutral’.",
      disc: "⚠️ For information only, not investment advice. Market forecasts are never 100% accurate. Do your own research or consult a SEBI-registered adviser.",
      pos: "▲ Positive", neg: "▼ Negative", neu: "● Neutral",
      nf: [["all", "All"], ["india", "🇮🇳 India"], ["hi", "हिंदी"], ["global", "🌍 Global"], ["pos", "▲ Positive"], ["neg", "▼ Negative"], ["mine", "⭐ My stocks"]],
      searchNews: "🔎 Search news (company, word…)", newsCount: " news items (last 48 h)", noNews: "No news for this filter.", noMine: " Add stocks with ⭐ in the ‘Stocks’ tab.",
      gAi: "🤖 Global cues & impact on India", gScore: "🌐 Global mood score", gScoreNote: "From US, Asia, Europe, crude, dollar and yields.",
      world: "📊 World markets", macro: "🛢️ Crude, dollar, yields — impact on India", macroNote: "Colour = effect on India (green good, red bad).", gNews: "🌍 Latest global news",
      macroInfo: {
        "Brent Crude": "Higher crude hurts India (import bill, inflation). Watch paints, aviation, OMCs.",
        "USD/INR": "Up = weaker rupee. Helps IT/pharma exporters, pressure on the rest.",
        "Dollar Index": "A stronger dollar can pull FII money out of India.",
        "US 10Y Yield": "Higher US yields can trigger FII selling in emerging markets.",
        "Gold": "Rising gold signals global fear/uncertainty.", "US VIX": "US ‘fear index’. Rising = risk-off mood."
      },
      searchStock: "🔎 Search company or symbol (e.g. Reliance, TCS)", results: "Results", noStock: "No company found. (Add new ones in collector/stocks.json.)",
      myWatch: "⭐ My watchlist", noWatch: "No stocks yet. Tap ★ in the list below.", hot: "🔥 Most discussed stocks", newsN: " news",
      aiNote: "🤖 AI note", mood: "News mood", moodV: { pos: "Positive", neg: "Negative", neu: "Neutral" }, idxToday: "index today",
      noStockNews: "No news about this company in the last 48 hours.", livePrice: "📈 Live price", optChain: "🔗 Option chain (NSE)",
      secNote: "Top = most positive impact, bottom = most negative. Tap a sector to see its news.", sector: " sector", noSecNews: "No fresh news for this sector.", index: "Index",
      settings: "Settings & info", language: "🌐 ભાષા / Language", trToggle: "Show English translation of Hindi news", notif: "🔔 Notifications",
      notifDesc: "Big news on your watchlist stocks and morning/evening outlook", notifNA: "Install the new APK to enable notifications.",
      about: "ℹ️ About", version: "Version", dataSrc: "Data", lastUpd: "Last update", aiState: "AI status",
      aiStates: { ok: "✅ On", reused: "✅ On (latest analysis)", no_key: "❌ No Gemini key (rule-based only)" },
      newApk: "⬇️ Latest APK", sources: "📡 Data sources", on: "working",
      discFull: "⚠️ This app is for information only and is not investment advice. News belongs to the original websites; read full articles there.",
      foWarn: "⚠️ F&O (calls/puts) is very risky. A SEBI study found more than 9 out of 10 individual traders lose money. The ideas below are educational only — not advice. Always use a stop-loss and only risk money you can afford to lose.",
      spot: "Spot", expiry: "Expiry", pcr: "PCR", maxPain: "Max pain", support: "Support (PE OI)", resistance: "Resistance (CE OI)", iv: "ATM IV",
      atmPrem: "ATM premium", pcrMean: function (p) { return p >= 1.3 ? "heavy put writing — bullish/oversold" : p >= 1 ? "mildly bullish" : p >= 0.7 ? "mildly bearish" : "heavy call writing — bearish"; },
      bias: { bullish: "📈 Bullish", bearish: "📉 Bearish", neutral: "↔ Neutral" }, idea: "💡 Idea (educational)",
      ideaBuy: function (n, i, exp) { return "Buy <b>" + n + " " + i.strike + " " + i.opt + "</b> (" + exp + ") — premium about ₹" + i.premium; },
      ideaEntry: function (n, i) { return "Enter only if " + n + " holds " + (i.opt === "CE" ? "above" : "below") + " " + i.trigger; },
      ideaSL: function (n, i) { return "Stop-loss: premium ₹" + i.sl_premium + " (≈30%) or " + n + " " + (i.opt === "CE" ? "below" : "above") + " " + (i.stop_level || "—"); },
      ideaTgt: function (n, i) { return "Target: premium ₹" + i.target_premium + " or " + n + " near " + (i.target_level || "—"); },
      ideaSpread: function (i) { return "Lower-risk option: " + (i.opt === "CE" ? "Bull Call Spread" : "Bear Put Spread") + " — buy " + i.spread.buy + " " + i.opt + " + sell " + i.spread.sell + " " + i.opt + " (limited risk)"; },
      ideaWait: function (n, i) { return "No clear direction — avoid buying options (time decay). Watch for a break above " + (i.trigger_up || "—") + " (calls) or below " + (i.trigger_down || "—") + " (puts)."; },
      premAsOf: "Premium data time", premNote: "Live prices will differ — check before placing an order.", stale: "⏳ Old data (no fresh data from NSE)",
      foStocks: "📌 News-driven F&O stocks", foNoData: "Option-chain data not available yet. It will appear in a later update.", foHist: "🎯 How accurate was the F&O direction?",
      confT: "Confidence", aiView: "🤖 AI view"
    }
  };
  function t(k) { return T[state.lang][k]; }

  var SECTOR_GU = {
    "IT": "આઇટી", "Banking": "બેંકિંગ", "PSU Bank": "સરકારી બેંક", "Auto": "ઓટો", "Pharma": "ફાર્મા",
    "FMCG": "FMCG", "Metal": "મેટલ", "Energy": "એનર્જી / ઓઇલ", "Realty": "રિયલ્ટી", "Power": "પાવર",
    "Defence": "ડિફેન્સ", "Railway": "રેલવે", "Telecom": "ટેલિકોમ", "Cement": "સિમેન્ટ", "Aviation": "એવિએશન",
    "Financial Services": "ફાઇનાન્સ", "Infra": "ઇન્ફ્રા", "Consumer": "કન્ઝ્યુમર", "Media": "મીડિયા",
    "Healthcare": "હેલ્થકેર", "Chemicals": "કેમિકલ્સ"
  };
  var DAYS = { gu: ["રવિ", "સોમ", "મંગળ", "બુધ", "ગુરુ", "શુક્ર", "શનિ"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
  var MONTHS = { gu: ["જાન્યુ", "ફેબ્રુ", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટે", "ઓક્ટો", "નવે", "ડિસે"],
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
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
    if (s < 90) return t("now");
    if (s < 3600) return Math.round(s / 60) + t("minAgo");
    if (s < 86400) return Math.round(s / 3600) + t("hrAgo");
    return Math.round(s / 86400) + t("dayAgo");
  }
  function dayName(dateStr) {
    var d = new Date(dateStr + "T00:00:00+05:30");
    return DAYS[state.lang][d.getDay()] + ", " + d.getDate() + " " + MONTHS[state.lang][d.getMonth()];
  }
  function todayIST() { return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10); }
  function sectorName(s) { return state.lang === "gu" ? (SECTOR_GU[s] || s) : s; }
  function tx(o, base) { // bilingual field picker: base_gu / base_en
    if (!o) return "";
    return o[base + "_" + state.lang] || o[base + "_gu"] || o[base + "_en"] || o[base] || "";
  }
  function impactOf(n) { return typeof n.ai_impact === "number" ? n.ai_impact / 2 : (n.sent || 0); }
  function watchlist() { return store("mm_watch") || []; }

  // ---------- native bridge (notifications) ----------
  function syncNative() {
    if (!NATIVE || !NATIVE.setPrefs) return;
    try {
      NATIVE.setPrefs(JSON.stringify({ lang: state.lang, notify: state.notify, watch: watchlist(), dataUrl: baseDataUrl() || "" }));
    } catch (e) {}
  }

  // ---------- data ----------
  function baseDataUrl() {
    var q = new URLSearchParams(location.search);
    if (q.get("data")) return q.get("data");
    if (!CFG.repo || CFG.repo.indexOf("__") === 0) return null;
    return "https://raw.githubusercontent.com/" + CFG.repo + "/" + (CFG.dataBranch || "data") + "/latest.json";
  }
  function load(force) {
    if (state.loading) return;
    var url = baseDataUrl();
    if (!url) { showErr(t("setupErr")); return; }
    if (url.indexOf("http") === 0) url += (url.indexOf("?") > 0 ? "&" : "?") + "t=" + Math.floor(Date.now() / 60000);
    state.loading = true;
    $("btnRefresh").classList.add("spin");
    fetch(url, { cache: force ? "no-store" : "default" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) { state.data = d; state.lastFetch = Date.now(); store("mm_cache", d); hideErr(); render(); })
      .catch(function (e) { showErr(String(e.message || e).indexOf("404") >= 0 ? t("noData") : t("netErr")); })
      .then(function () { state.loading = false; $("btnRefresh").classList.remove("spin"); });
  }
  function showErr(m) { var b = $("errBar"); b.innerHTML = m; b.classList.remove("hidden"); }
  function hideErr() { $("errBar").classList.add("hidden"); }

  function checkUpdate() {
    if (!CFG.repo || CFG.repo.indexOf("__") === 0) return;
    var last = store("mm_upd_check") || 0;
    if (Date.now() - last < 6 * 3600000) { showUpdate(store("mm_upd_rel")); return; }
    store("mm_upd_check", Date.now());
    fetch("https://api.github.com/repos/" + CFG.repo + "/releases/latest")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rel) { if (rel && rel.tag_name) { store("mm_upd_rel", { tag: rel.tag_name, url: rel.html_url }); showUpdate(store("mm_upd_rel")); } })
      .catch(function () {});
  }
  function showUpdate(rel) {
    if (!rel) return;
    var latest = parseInt(String(rel.tag).split(".").pop(), 10), mine = parseInt(String(CFG.version).split(".").pop(), 10);
    if (latest > mine) {
      var b = $("updateBar");
      b.innerHTML = t("newVer") + " " + esc(rel.tag) + " — <a href='" + esc(rel.url) + "' target='_blank'><b>" + t("dlApk") + "</b></a>";
      b.classList.remove("hidden");
    }
  }

  // ---------- render ----------
  function renderChrome() {
    document.documentElement.lang = state.lang;
    var tabs = t("tabs");
    document.querySelectorAll(".tabs button").forEach(function (b, i) { b.querySelector("b").textContent = tabs[i]; });
  }
  function render() {
    renderChrome();
    var d = state.data;
    $("updated").textContent = d ? t("updated") + ": " + ago(d.generated_at) : t("loading");
    var v = $("view");
    if (!d) { v.innerHTML = "<div class='empty'>" + t("loading") + "</div>"; return; }
    v.innerHTML = { home: renderHome, news: renderNews, global: renderGlobal, stocks: renderStocks, sectors: renderSectors, fo: renderFO }[state.tab](d);
    bindView();
  }

  function moodCard(d) {
    var ai = d.ai && d.ai.outlook ? d.ai.outlook : null;
    var rule = d.outlook || {};
    var labels = t("labels");
    var label = (ai && labels[ai.label]) ? ai.label : (rule.label || "neutral");
    var c = label.indexOf("positive") >= 0 ? "pos" : label.indexOf("negative") >= 0 ? "neg" : "neu";
    var conf = ai ? ai.confidence : rule.confidence;
    var s = d.session || {};
    var when = t(s.phase === "live" ? "live" : s.phase === "pre" ? "pre" : "closed") + " — " + dayName(s.date);
    var pos = rule.score != null ? Math.max(2, Math.min(98, (rule.score + 1) * 50)) : 50;
    var h = "<div class='mood " + c + "'><div class='when'>" + esc(when) + "</div>" +
      "<div class='big " + c + "-t'>" + labels[label] + "</div>" +
      "<div class='meter'><i style='left:" + pos + "%'></i></div>" +
      "<span class='badge'>" + t("confL") + ": " + (t("conf")[conf] || t("conf").low) + "</span>" +
      (ai ? "<span class='badge pos'>" + t("aiBadge") + "</span>" : "<span class='badge'>" + t("ruleBadge") + "</span>");
    if (ai && rule.label && rule.label !== ai.label) h += "<span class='badge'>" + t("ruleSays") + ": " + labels[rule.label] + "</span>";
    return h + "</div>";
  }

  function renderHome(d) {
    var h = moodCard(d), ai = d.ai || null;
    var summ = tx(ai, "summary");
    if (summ) h += "<div class='card'><h3>" + t("summary") + "</h3><div>" + esc(summ) + "</div><div class='muted small' style='margin-top:6px'>" + t("aiUpd") + ": " + ago(ai.generated_at) + "</div></div>";
    var reasons = [];
    if (ai && ai.outlook) {
      var rs = ai.outlook["reasons_" + state.lang] || ai.outlook.reasons_gu || ai.outlook.reasons_en || [];
      rs.forEach(function (r) { reasons.push({ type: "neu", text: r }); });
    }
    (d.outlook && d.outlook.reasons || []).forEach(function (r) { reasons.push({ type: r.type, text: r[state.lang] || r.text }); });
    if (reasons.length) h += "<div class='card'><h3>" + t("reasons") + "</h3><ul class='reasons'>" + reasons.map(function (r) { return "<li class='" + esc(r.type) + "'>" + esc(r.text) + "</li>"; }).join("") + "</ul></div>";
    var ind = (d.markets && d.markets.india) || [];
    if (ind.length) h += "<div class='card'><h3>" + t("india") + "</h3><div class='grid'>" + ind.map(tile).join("") + "</div></div>";
    h += foMini(d);
    if (d.fii_dii && d.fii_dii.length) {
      h += "<div class='card'><h3>" + t("fii") + "</h3>" + d.fii_dii.map(function (r) {
        var n = parseFloat(r.net);
        return "<div class='row'><div class='l'><b>" + esc(r.category) + "</b><div class='muted small'>" + esc(r.date) + "</div></div><div class='r " + cls(n) + "-t'><b>" + (n > 0 ? "+" : "") + esc(r.net) + "</b><div class='muted small'>" + t("buy") + " " + esc(r.buy) + " · " + t("sell") + " " + esc(r.sell) + "</div></div></div>";
      }).join("") + "</div>";
    }
    if (ai && ai.watch && ai.watch.length) {
      h += "<div class='card'><h3>" + t("focus") + "</h3>" + ai.watch.map(function (w) {
        var c = w.view === "positive" ? "pos" : w.view === "negative" ? "neg" : "neu";
        return "<div class='row' data-stock='" + esc(w.symbol) + "'><div class='l'><b>" + esc(w.symbol) + "</b><div class='muted small'>" + esc(tx(w, "reason")) + "</div></div><div class='r'><span class='badge " + c + "'>" + (c === "pos" ? "▲" : c === "neg" ? "▼" : "●") + "</span></div></div>";
      }).join("") + "</div>";
    }
    var top = (d.news || []).filter(function (n) { return Math.abs(impactOf(n)) >= 0.5; }).slice(0, 6);
    if (top.length) h += "<div class='card'><h3>" + t("bigNews") + "</h3>" + top.map(function (n) { return newsCard(n); }).join("") + "<button class='chip' data-tab-go='news'>" + t("allNews") + "</button></div>";
    h += historyCard(d, "ai", t("hist"));
    return h + "<div class='disc'>" + t("disc") + "</div>";
  }

  function foMini(d) {
    var o = d.options && d.options.nifty;
    if (!o || !o.idea) return "";
    var b = o.idea.bias;
    return "<div class='card' data-tab-go='fo'><h3>F&O · Nifty " + esc(o.expiry || "") + "</h3><div class='row'><div class='l'>" +
      "<span class='badge " + (b === "bullish" ? "pos" : b === "bearish" ? "neg" : "neu") + "'>" + t("bias")[b] + "</span> " +
      "<span class='muted small'>PCR " + o.pcr + " · " + t("support").split(" ")[0] + " " + (o.support || "—") + " · " + t("resistance").split(" ")[0] + " " + (o.resistance || "—") + "</span></div><div class='r'>›</div></div></div>";
  }

  function historyCard(d, field, title) {
    var hist = d.history || {};
    var keys = Object.keys(hist).sort().reverse().filter(function (k) { return hist[k].actual != null && k <= todayIST() && (field !== "fo" || hist[k].fo); }).slice(0, 10);
    if (!keys.length) return "";
    var right = 0, tot = 0;
    var cells = keys.map(function (k) {
      var e = hist[k], pred = field === "fo" ? (e.fo || "neutral") : (e.ai || e.rule || "neutral");
      var dir = /positive|bullish/.test(pred) ? 1 : /negative|bearish/.test(pred) ? -1 : 0;
      var act = e.actual > 0.25 ? 1 : e.actual < -0.25 ? -1 : 0, ok = dir === act;
      tot++; if (ok) right++;
      return "<div class='h'>" + k.slice(8) + "/" + k.slice(5, 7) + "<br>" + (ok ? "✅" : "❌") + "<br><span class='" + cls(e.actual) + "-t'>" + pct(e.actual) + "</span></div>";
    }).join("");
    return "<div class='card'><h3>" + title + " (" + right + "/" + tot + ")</h3><div class='hist'>" + cells + "</div><div class='muted small' style='margin-top:6px'>" + t("histNote") + "</div></div>";
  }

  function tile(q) {
    var good = q.name.indexOf("VIX") >= 0 ? -(q.pct || 0) : (q.pct || 0);
    return "<div class='tile'><div class='n'>" + esc(q.name) + (q.stale ? " ⏳" : "") + "</div><div class='v'>" + num(q.price) + "</div><div class='p " + cls(good) + "-t'>" + pct(q.pct) + "</div></div>";
  }

  function newsCard(n, forceGu) {
    var imp = impactOf(n), c = cls(imp);
    var syms = (n.ai_symbols && n.ai_symbols.length ? n.ai_symbols : n.symbols || []);
    var lang = n.lang === "hi" ? "हिंदी" : n.region === "global" ? "🌍" : "EN";
    var trLine = "";
    if (state.lang === "gu" && (state.showTr || forceGu) && n.tr_gu && n.tr_gu !== n.title) trLine = "<div class='tr'>🔤 " + esc(n.tr_gu) + "</div>";
    if (state.lang === "en" && n.lang === "hi" && state.showTr && n.tr_en) trLine = "<div class='tr'>🔤 " + esc(n.tr_en) + "</div>";
    var ai = state.lang === "en" ? (n.ai_en || "") : (n.ai_gu || "");
    return "<a class='news " + c + "' href='" + esc(n.link) + "' target='_blank'><div class='t'>" + esc(n.title) + "</div>" + trLine +
      (ai ? "<div class='gu'>🤖 " + esc(ai) + "</div>" : "") +
      "<div class='m'><span class='badge " + c + "'>" + t(c) + "</span>" +
      syms.map(function (s) { return "<span class='sym'>" + esc(s) + "</span>"; }).join("") +
      "<span>" + esc(n.source) + " · " + lang + " · " + ago(n.published) + "</span></div></a>";
  }

  function renderNews(d) {
    var f = state.newsFilter, q = state.newsQuery.toLowerCase(), wl = watchlist();
    var list = (d.news || []).filter(function (n) {
      if (f === "india" && n.region !== "india") return false;
      if (f === "hi" && n.lang !== "hi") return false;
      if (f === "global" && n.region !== "global") return false;
      if (f === "pos" && impactOf(n) <= 0.05) return false;
      if (f === "neg" && impactOf(n) >= -0.05) return false;
      if (f === "mine" && !(n.symbols || []).concat(n.ai_symbols || []).some(function (x) { return wl.indexOf(x) >= 0; })) return false;
      if (q && (n.title + " " + (n.tr_gu || "") + " " + (n.tr_en || "") + " " + (n.symbols || []).join(" ")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var h = "<input class='search' id='newsSearch' placeholder='" + esc(t("searchNews")) + "' value='" + esc(state.newsQuery) + "'>";
    h += "<div class='chips'>" + t("nf").map(function (x) { return "<button class='chip " + (f === x[0] ? "on" : "") + "' data-nf='" + x[0] + "'>" + x[1] + "</button>"; }).join("") + "</div>";
    h += "<div class='muted small' style='margin-bottom:8px'>" + list.length + t("newsCount") + "</div>";
    h += list.length ? list.slice(0, 150).map(function (n) { return newsCard(n); }).join("") : "<div class='empty'>" + t("noNews") + (f === "mine" ? t("noMine") : "") + "</div>";
    return h;
  }

  function renderGlobal(d) {
    var m = d.markets || {}, h = "";
    var g = tx(d.ai, "global");
    if (g) h += "<div class='card'><h3>" + t("gAi") + "</h3><div>" + esc(g) + "</div></div>";
    var gs = d.outlook ? d.outlook.global_score : null;
    if (gs != null) h += "<div class='card'><h3>" + t("gScore") + "</h3><div class='" + cls(gs) + "-t' style='font-size:24px;font-weight:800'>" + (gs > 0 ? "+" : "") + (gs * 100).toFixed(0) + " / 100</div><div class='muted small'>" + t("gScoreNote") + "</div></div>";
    h += "<div class='card'><h3>" + t("world") + "</h3>" + (m.global || []).map(function (q) {
      return "<div class='row'><div class='l'><b>" + esc(q.name) + "</b>" + (q.stale ? " ⏳" : "") + "</div><div class='r'><div>" + num(q.price) + "</div><div class='" + cls(q.pct || 0) + "-t'><b>" + pct(q.pct) + "</b></div></div></div>";
    }).join("") + "</div>";
    var info = t("macroInfo");
    h += "<div class='card'><h3>" + t("macro") + "</h3>" + (m.macro || []).map(function (q) {
      var eff = (q.w || 0) === 0 ? 0 : (q.pct || 0) * (q.w > 0 ? 1 : -1);
      return "<div class='row'><div class='l'><b>" + esc(q.name) + "</b><div class='muted small'>" + esc(info[q.name] || "") + "</div></div><div class='r'><div>" + num(q.price) + "</div><div class='" + cls(eff) + "-t'><b>" + pct(q.pct) + "</b></div></div></div>";
    }).join("") + "<div class='muted small' style='margin-top:6px'>" + t("macroNote") + "</div></div>";
    var gn = (d.news || []).filter(function (n) { return n.region === "global"; }).slice(0, 10);
    if (gn.length) h += "<div class='card'><h3>" + t("gNews") + "</h3>" + gn.map(function (n) { return newsCard(n); }).join("") + "</div>";
    return h;
  }

  function stockInfo(d, sym) {
    var s = (d.stocks || []).filter(function (x) { return x.sym === sym; })[0];
    var w = d.ai && d.ai.watch ? d.ai.watch.filter(function (x) { return String(x.symbol).toUpperCase() === sym; })[0] : null;
    var fo = d.ai && d.ai.fo && d.ai.fo.stocks ? d.ai.fo.stocks.filter(function (x) { return String(x.symbol).toUpperCase() === sym; })[0] : null;
    return { s: s, w: w, fo: fo };
  }
  function stockRow(d, sym, name, sector) {
    var wl = watchlist(), info = stockInfo(d, sym);
    var cnt = info.s ? info.s.news_count : 0, c = cnt ? cls(info.s.sent) : "neu";
    return "<div class='row'><button class='star " + (wl.indexOf(sym) >= 0 ? "on" : "") + "' data-star='" + esc(sym) + "'>★</button>" +
      "<div class='l' data-stock='" + esc(sym) + "'><b>" + esc(name) + "</b> <span class='sym'>" + esc(sym) + "</span><div class='muted small'>" + esc(sectorName(sector)) +
      (info.w ? " · 🤖 " + esc(tx(info.w, "reason")) : "") + "</div></div>" +
      "<div class='r' data-stock='" + esc(sym) + "'>" + (cnt ? "<span class='badge " + c + "'>" + cnt + t("newsN") + "</span>" : "<span class='muted small'>—</span>") + "</div></div>";
  }
  function renderStocks(d) {
    var list = d.stock_list || [], wl = watchlist(), q = state.stockQuery.toLowerCase();
    var h = "<input class='search' id='stockSearch' placeholder='" + esc(t("searchStock")) + "' value='" + esc(state.stockQuery) + "'>";
    if (q) {
      var res = list.filter(function (s) { return (s[0] + " " + s[1]).toLowerCase().indexOf(q) >= 0; });
      return h + "<div class='card'><h3>" + t("results") + "</h3>" + (res.length ? res.slice(0, 40).map(function (s) { return stockRow(d, s[0], s[1], s[2]); }).join("") : "<div class='empty'>" + t("noStock") + "</div>") + "</div>";
    }
    var meta = {}; list.forEach(function (s) { meta[s[0]] = s; });
    h += "<div class='card'><h3>" + t("myWatch") + "</h3>" + (wl.length ? wl.map(function (sym) { var s = meta[sym] || [sym, sym, ""]; return stockRow(d, s[0], s[1], s[2]); }).join("") : "<div class='muted'>" + t("noWatch") + "</div>") + "</div>";
    var hot = (d.stocks || []).slice(0, 25);
    return h + "<div class='card'><h3>" + t("hot") + "</h3>" + (hot.length ? hot.map(function (s) { return stockRow(d, s.sym, s.name, s.sector); }).join("") : "—") + "</div>";
  }
  function openStock(sym) {
    var d = state.data; if (!d) return;
    var meta = (d.stock_list || []).filter(function (s) { return s[0] === sym; })[0] || [sym, sym, ""];
    var news = (d.news || []).filter(function (n) { return (n.symbols || []).concat(n.ai_symbols || []).indexOf(sym) >= 0; });
    var info = stockInfo(d, sym);
    var h = "<div class='muted'>" + esc(sectorName(meta[2])) + " · NSE: " + esc(sym) + "</div>";
    if (info.w) h += "<div class='card' style='margin-top:10px'><h3>" + t("aiNote") + "</h3>" + esc(tx(info.w, "reason")) + "</div>";
    if (info.fo) h += "<div class='card'><h3>F&O</h3><span class='badge " + (info.fo.bias === "bullish" ? "pos" : "neg") + "'>" + t("bias")[info.fo.bias] + "</span> " + esc(tx(info.fo, "reason")) + "</div>";
    if (info.s) h += "<div style='margin:10px 0'><span class='badge " + cls(info.s.sent) + "'>" + t("mood") + ": " + t("moodV")[cls(info.s.sent)] + "</span><span class='badge'>" + info.s.news_count + t("newsN") + "</span></div>";
    var sec = (d.sectors || []).filter(function (x) { return x.sector === meta[2]; })[0];
    if (sec && sec.pct != null) h += "<div class='muted small'>" + esc(sectorName(meta[2])) + " " + t("idxToday") + ": <b class='" + cls(sec.pct) + "-t'>" + pct(sec.pct) + "</b></div>";
    // stock page always shows the Gujarati translation under each headline (Gujarati mode)
    h += "<div class='stock-news'>" + (news.length ? news.map(function (n) { return newsCard(n, true); }).join("") : "<div class='empty'>" + t("noStockNews") + "</div>") + "</div>";
    h += "<a class='btn' href='https://www.google.com/finance/quote/" + encodeURIComponent(sym) + ":NSE' target='_blank'>" + t("livePrice") + "</a> " +
      "<a class='btn alt' href='https://www.nseindia.com/get-quotes/derivatives?symbol=" + encodeURIComponent(sym) + "' target='_blank'>" + t("optChain") + "</a>";
    openSheet(meta[1], h);
  }

  function renderSectors(d) {
    var aiSec = {};
    if (d.ai && d.ai.sectors) d.ai.sectors.forEach(function (s) { aiSec[s.sector] = s; });
    var list = (d.sectors || []).slice();
    Object.keys(aiSec).forEach(function (k) { if (!list.some(function (x) { return x.sector === k; })) list.push({ sector: k, news_count: 0, news_sent: 0, pct: null }); });
    list.forEach(function (s) {
      var a = aiSec[s.sector], aiv = a ? (a.view === "positive" ? 0.6 : a.view === "negative" ? -0.6 : 0) : null;
      var p = s.pct != null ? Math.max(-1, Math.min(1, s.pct / 1.5)) : 0;
      s._score = aiv != null ? aiv * 0.6 + p * 0.4 : (s.news_sent || 0) * 0.5 + p * 0.5;
      s._ai = a;
    });
    list.sort(function (a, b) { return b._score - a._score; });
    return "<div class='muted small' style='margin-bottom:8px'>" + t("secNote") + "</div><div class='sec-grid'>" + list.map(function (s) {
      return "<div class='sec " + cls(s._score) + "' data-sector='" + esc(s.sector) + "'><div class='n'>" + esc(sectorName(s.sector)) + "</div>" +
        "<div class='" + cls(s.pct || 0) + "-t' style='font-weight:700'>" + (s.pct != null ? t("index") + " " + pct(s.pct) : "&nbsp;") + "</div>" +
        "<div class='d'>" + (s.news_count || 0) + t("newsN") + (s._ai ? " · 🤖 " + esc(tx(s._ai, "reason")) : "") + "</div></div>";
    }).join("") + "</div>";
  }
  function openSector(sec) {
    var news = (state.data.news || []).filter(function (n) { return (n.sectors || []).indexOf(sec) >= 0; });
    openSheet(sectorName(sec) + t("sector"), news.length ? news.slice(0, 60).map(function (n) { return newsCard(n); }).join("") : "<div class='empty'>" + t("noSecNews") + "</div>");
  }

  // ---------- F&O ----------
  function foCard(o, aiPart) {
    var i = o.idea || {}, b = i.bias || "neutral", n = o.name;
    var h = "<div class='card'><h3>" + esc(n) + " · " + t("expiry") + " " + esc(o.expiry || "—") + (o.stale ? " · " + t("stale") : "") + "</h3>";
    h += "<div class='grid'>" +
      "<div class='tile'><div class='n'>" + t("spot") + "</div><div class='v'>" + num(o.spot) + "</div></div>" +
      "<div class='tile'><div class='n'>" + t("pcr") + "</div><div class='v'>" + o.pcr + "</div><div class='p muted'>" + esc(t("pcrMean")(o.pcr)) + "</div></div>" +
      "<div class='tile'><div class='n'>" + t("support") + "</div><div class='v pos-t'>" + (o.support || "—") + "</div></div>" +
      "<div class='tile'><div class='n'>" + t("resistance") + "</div><div class='v neg-t'>" + (o.resistance || "—") + "</div></div>" +
      "<div class='tile'><div class='n'>" + t("maxPain") + "</div><div class='v'>" + (o.max_pain || "—") + "</div></div>" +
      "<div class='tile'><div class='n'>" + t("atmPrem") + " (" + o.atm + ")</div><div class='v small'>CE ₹" + (o.atm_ce == null ? "—" : o.atm_ce) + " · PE ₹" + (o.atm_pe == null ? "—" : o.atm_pe) + "</div><div class='p muted'>" + t("iv") + " " + (o.iv == null ? "—" : o.iv + "%") + "</div></div>" +
      "</div>";
    h += "<div class='idea " + (b === "bullish" ? "pos" : b === "bearish" ? "neg" : "neu") + "'><div class='idea-h'>" + t("idea") + " <span class='badge " + (b === "bullish" ? "pos" : b === "bearish" ? "neg" : "neu") + "'>" + t("bias")[b] + "</span> <span class='badge'>" + t("confT") + ": " + t("conf")[i.confidence || "low"] + "</span></div>";
    if (i.action === "BUY_CE" || i.action === "BUY_PE") {
      h += "<ul class='steps'><li>" + t("ideaBuy")(esc(n), i, esc(o.expiry || "")) + "</li><li>" + esc(t("ideaEntry")(n, i)) + "</li><li>" + esc(t("ideaSL")(n, i)) + "</li><li>" + esc(t("ideaTgt")(n, i)) + "</li>" +
        (i.spread ? "<li>" + esc(t("ideaSpread")(i)) + "</li>" : "") + "</ul>";
    } else {
      h += "<div>" + esc(t("ideaWait")(n, i)) + "</div>";
    }
    h += "</div>";
    var note = tx(aiPart, "note");
    if (note) h += "<div class='muted' style='margin-top:8px'>" + t("aiView") + ": " + esc(note) + "</div>";
    return h + "</div>";
  }
  function renderFO(d) {
    var h = "<div class='warn'>" + t("foWarn") + "</div>";
    var opts = d.options || {}, aiFo = (d.ai && d.ai.fo) || {};
    if (!opts.nifty && !opts.banknifty) h += "<div class='empty'>" + t("foNoData") + "</div>";
    ["nifty", "banknifty"].forEach(function (k) { if (opts[k]) h += foCard(opts[k], aiFo[k]); });
    if (opts.nifty || opts.banknifty) h += "<div class='muted small' style='margin:-4px 4px 12px'>" + t("premAsOf") + ": " + ago(d.generated_at) + ". " + t("premNote") + "</div>";
    var st = aiFo.stocks || [];
    if (st.length) {
      h += "<div class='card'><h3>" + t("foStocks") + "</h3>" + st.map(function (s) {
        var c = s.bias === "bullish" ? "pos" : "neg";
        return "<div class='row' data-stock='" + esc(String(s.symbol).toUpperCase()) + "'><div class='l'><b>" + esc(s.symbol) + "</b><div class='muted small'>" + esc(tx(s, "reason")) + "</div></div><div class='r'><span class='badge " + c + "'>" + t("bias")[s.bias] + "</span></div></div>";
      }).join("") + "</div>";
    }
    h += historyCard(d, "fo", t("foHist"));
    return h + "<div class='disc'>" + t("disc") + "</div>";
  }

  // ---------- settings ----------
  function openInfo() {
    var d = state.data || {}, src = d.sources || [], ok = src.filter(function (s) { return s.ok; }).length;
    var h = "<div class='card'><h3>" + t("language") + "</h3><div class='seg'>" +
      "<button data-lang='gu' class='" + (state.lang === "gu" ? "on" : "") + "'>ગુજરાતી</button><button data-lang='en' class='" + (state.lang === "en" ? "on" : "") + "'>English</button></div>" +
      "<label class='sw'><input type='checkbox' id='swTr' " + (state.showTr ? "checked" : "") + "> <span>" + t("trToggle") + "</span></label></div>";
    h += "<div class='card'><h3>" + t("notif") + "</h3>" + (NATIVE ? "<label class='sw'><input type='checkbox' id='swNotif' " + (state.notify ? "checked" : "") + "> <span>" + t("notifDesc") + "</span></label>" : "<div class='muted'>" + t("notifNA") + "</div>") + "</div>";
    h += "<div class='card'><h3>" + t("about") + "</h3><div>" + t("version") + ": <b>" + esc(CFG.version) + "</b></div><div>" + t("dataSrc") + ": <b>" + esc(CFG.repo) + "</b></div>" +
      "<div>" + t("lastUpd") + ": " + (d.generated_at ? new Date(d.generated_at).toLocaleString("en-IN") : "—") + "</div>" +
      "<div>" + t("aiState") + ": " + esc(t("aiStates")[d.ai_status] || ("⚠️ " + (d.ai_status || "—"))) + "</div>" +
      "<div style='margin-top:10px'><a class='btn' href='https://github.com/" + esc(CFG.repo) + "/releases/latest' target='_blank'>" + t("newApk") + "</a></div></div>";
    h += "<div class='card'><h3>" + t("sources") + " (" + ok + "/" + src.length + " " + t("on") + ")</h3>" + src.map(function (s) {
      return "<div class='row'><div class='l small'>" + esc(s.name) + "</div><div class='r small'>" + (s.ok ? "✅ " + (s.count != null ? s.count : "") : "❌ <span class='muted'>" + esc(s.error || "") + "</span>") + "</div></div>";
    }).join("") + "</div><div class='disc'>" + t("discFull") + "</div>";
    openSheet(t("settings"), h);
    document.querySelectorAll("[data-lang]").forEach(function (b) {
      b.onclick = function () { state.lang = b.getAttribute("data-lang"); savePrefs(); closeSheet(); render(); openInfo(); };
    });
    $("swTr").onchange = function () { state.showTr = this.checked; savePrefs(); render(); };
    var sn = $("swNotif");
    if (sn) sn.onchange = function () {
      state.notify = this.checked; savePrefs();
      if (state.notify && NATIVE.requestNotifications) { try { NATIVE.requestNotifications(); } catch (e) {} }
    };
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
        store("mm_watch", wl); syncNative();
        el.classList.toggle("on");
        if ($("view").contains(el) && state.tab === "stocks") render();
      };
    });
    root.querySelectorAll("[data-tab-go]").forEach(function (el) { el.onclick = function () { closeSheet(); setTab(el.getAttribute("data-tab-go")); }; });
  }
  function bindView() {
    bindIn($("view"));
    $("view").querySelectorAll("[data-nf]").forEach(function (el) { el.onclick = function () { state.newsFilter = el.getAttribute("data-nf"); render(); }; });
    var ns = $("newsSearch");
    if (ns) ns.oninput = debounce(function () { state.newsQuery = ns.value; render(); var n2 = $("newsSearch"); n2.focus(); n2.setSelectionRange(n2.value.length, n2.value.length); }, 350);
    var ss = $("stockSearch");
    if (ss) ss.oninput = debounce(function () { state.stockQuery = ss.value; render(); var s2 = $("stockSearch"); s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); }, 300);
  }
  function debounce(fn, ms) { var tm; return function () { clearTimeout(tm); tm = setTimeout(fn, ms); }; }
  function setTab(tb) {
    state.tab = tb;
    document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === tb); });
    window.scrollTo(0, 0);
    render();
  }

  document.querySelectorAll(".tabs button").forEach(function (b) { b.onclick = function () { setTab(b.getAttribute("data-tab")); }; });
  $("btnRefresh").onclick = function () { load(true); };
  $("btnInfo").onclick = openInfo;
  $("sheetClose").onclick = closeSheet;
  $("sheet").onclick = function (e) { if (e.target.id === "sheet") closeSheet(); };

  window.mmBack = function () {
    if (!$("sheet").classList.contains("hidden")) { closeSheet(); return true; }
    if (state.tab !== "home") { setTab("home"); return true; }
    return false;
  };
  window.mmResume = function () {
    if (Date.now() - state.lastFetch > 5 * 60000) load(false);
    if (state.data) $("updated").textContent = t("updated") + ": " + ago(state.data.generated_at);
  };
  window.mmOpen = function (target) { // from a notification tap: "stock:SYM" or "tab:fo"
    if (!target) return;
    var p = String(target).split(":");
    if (p[0] === "tab") setTab(p[1]);
    if (p[0] === "stock" && state.data) openStock(p[1]);
  };
  setInterval(function () { if (state.data) $("updated").textContent = t("updated") + ": " + ago(state.data.generated_at); }, 60000);

  var cached = store("mm_cache");
  if (cached) state.data = cached;
  render();
  load(false);
  checkUpdate();
  syncNative();
})();
