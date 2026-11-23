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
    store("mm_prefs", { lang: state.lang, showTr: state.showTr, notify: state.notify, foSel: state.live ? state.live.sel : undefined });
    syncNative();
  }

  // ---------- texts ----------
  var T = {
    gu: {
      loading: "લોડ થઈ રહ્યું છે…", updated: "અપડેટ", now: "હમણાં", minAgo: " મિનિટ પહેલાં", hrAgo: " કલાક પહેલાં", dayAgo: " દિવસ પહેલાં",
      tabs: ["હોમ", "શેર", "F&O", "વધુ"],
      liveAt: "લાઇવ", ghAt: "GitHub અપડેટ", dataTime: "ડેટા સમય", srcLive: "લાઇવ (ફોન → ", srcGh: "GitHub (દર 10–20 મિનિટે)",
      loadingOpt: "ઓપ્શન ચેઇન લોડ થઈ રહી છે…", optErr: "લાઇવ ડેટા ન મળ્યો", showingGh: "GitHub નો છેલ્લો ડેટા બતાવું છું.",
      expiryL: "એક્સપાયરી પસંદ કરો", atmCard: "🎯 ATM પ્રીમિયમ (આ એક્સપાયરી માટે)", straddle: "સ્ટ્રેડલ (CE+PE)", expMove: "અપેક્ષિત મૂવ (એક્સપાયરી સુધી) ±",
      chainT: "📋 ઓપ્શન ચેઇન (ATM ની આસપાસ)", chainH: ["CE OI", "CE ΔOI", "CE ₹", "સ્ટ્રાઇક", "PE ₹", "PE ΔOI", "PE OI"],
      autoNote: "બજાર સમયે દર 5 મિનિટે આપમેળે અપડેટ. ⟳ દબાવો તો તરત.",
      bseLiveNote: "BSE (Sensex/BANKEX) નો ડેટા BSE ની સાઇટ પરથી સીધો લેવાય છે — આ સુવિધા પ્રયોગાત્મક છે.",
      noLive: "લાઇવ ડેટા ફક્ત એપમાં (ફોન પર) મળે છે.",
      metals: "🥇 સોનું અને ચાંદી", gold: "સોનું (COMEX $/oz)", silver: "ચાંદી (COMEX $/oz)", goldbees: "GOLDBEES (ભારત ETF ₹)", silverbees: "SILVERBEES (ભારત ETF ₹)",
      trend: { up: "📈 તેજી તરફ", down: "📉 મંદી તરફ", sideways: "↔ સાઇડવેઝ" }, trendNext: "આગામી દિવસોનો ટ્રેન્ડ", todayTrend: "આજની ચાલ પરથી",
      planT: "📋 ટ્રેડ પ્લાન (શીખવા માટે)", buyCall: "CALL (CE) ખરીદવાનો સંકેત", buyPut: "PUT (PE) ખરીદવાનો સંકેત", noTrade: "હાલ ટ્રેડ નહીં — દિશા સ્પષ્ટ નથી",
      strikeL: "સ્ટ્રાઇક", premNow: "અત્યારનું પ્રીમિયમ", buyZone: "ખરીદી ઝોન (આ ભાવ વચ્ચે જ લેવો)", slL: "સ્ટોપ-લોસ", t1L: "ટાર્ગેટ 1", t2L: "ટાર્ગેટ 2",
      spotInv: function (n, i) { return n + " " + (i.opt === "CE" ? "નીચે" : "ઉપર") + " " + (i.stop_level || "—") + " જાય તો તરત બહાર નીકળો"; },
      exitBy: "એક્સપાયરી ડે: બપોરે 2:30 પહેલાં પોઝિશન બંધ કરો (પછી પ્રીમિયમ ઝડપથી ઘટે છે)",
      notExpiry: function (d) { return "એક્સપાયરીને " + d + " દિવસ બાકી — ટાઇમ ડીકે ધ્યાનમાં રાખો"; }, expDayBadge: "⚡ આજે એક્સપાયરી",
      zoneNote: "પ્રીમિયમ ખરીદી ઝોનથી ઉપર જતું રહે તો પાછળ દોડીને ન લેવું.", waitNote: function (n, i) { return n + " " + (i.trigger_up || "—") + " ઉપર ટકે તો CALL, " + (i.trigger_down || "—") + " નીચે તૂટે તો PUT પર નજર રાખો."; },
      sigT: "સંકેતો", sigN: { outlook: "આઉટલુક", pcr: "PCR", maxpain: "મેક્સ પેઇન", oi: "OI ફેરફાર (ATM ±3)", momentum: "આજની ચાલ" },
      newsAi: "📰 સમાચાર/AI", segGlobal: "🌍 ગ્લોબલ", segSectors: "📊 સેક્ટર", ruleTrend: "નિયમ આધારિત",
      fiiNote: "NSE આજનો FII/DII ડેટા બજાર બંધ થયા પછી (સાંજે આશરે 6–7 વાગ્યે) જાહેર કરે છે. બજાર ચાલુ હોય ત્યારે ચાલુ દિવસનો ડેટા ક્યાંય ઉપલબ્ધ હોતો નથી.",
      fiiToday: "આજનો", fiiPending: "આજનો ડેટા હજુ જાહેર થયો નથી — છેલ્લો ઉપલબ્ધ દિવસ બતાવું છું.", fiiUpd: "ચેક કર્યું",
      indiaToday: "આજનું ભારતીય બજાર (લાઇવ)", forecastNext: "આગાહી (AI/નિયમ)", niftyClose: "આજે Nifty",
      inrApprox: "ભારતમાં અંદાજિત ભાવ (6% ડ્યૂટી સહિત, GST વગર)", per10g: "/10 ગ્રામ", perKg: "/કિલો", liveRule: "લાઇવ ડેટા પરથી",
      segNews: "📰 સમાચાર", segLedger: "🎯 હિસાબ",
      probUp: "ઉપર બંધ થવાની સંભાવના", rangeL: "અપેક્ષિત Nifty રેન્જ", giftGap: "GIFT Nifty મુજબ ઓપનિંગ", noClear: "સ્પષ્ટ સંકેત નથી (55% થી ઓછું)",
      gapUp: "ગેપ-અપ", gapDown: "ગેપ-ડાઉન", flat: "સપાટ",
      ledT: "🎯 આગાહીનો હિસાબ (Nifty)", ledNote: "દરેક આગાહી બજાર ખૂલે તે પહેલાં સાચવાય છે અને સાંજે અસલી પરિણામ સાથે સરખાવાય છે.",
      ledCols: ["તારીખ", "આગાહી", "ગેપ (અંદાજ/અસલી)", "રેન્જ", "બંધ", "પરિણામ"],
      statDir: "દિશા સાચી", statDirCalled: "જ્યારે સ્પષ્ટ દિશા કહી", statGap: "ઓપનિંગ ગેપ સાચો", statRange: "બંધ રેન્જમાં", statBase: "સરખામણી: ‘હંમેશા ઉપર’ કહેનારી સાદી સિસ્ટમ",
      last20: "છેલ્લા 20 દિવસ", allT: "કુલ", noLedger: "હજુ હિસાબ શરૂ થયો છે — પહેલું પરિણામ આજે સાંજે 3:35 પછી દેખાશે.",
      foLog: "📋 F&O પ્લાનનો હિસાબ (આ ફોન પર)", foLogNote: "દરરોજ દરેક ઇન્ડેક્સનો પહેલો CALL/PUT સંકેત સચવાય છે અને બજાર બંધ થયા પછી તપાસાય છે.", foLogEmpty: "હજુ કોઈ F&O સંકેત સચવાયો નથી.",
      pending: "બાકી", staleData: "⚠️ સમાચાર/AI ડેટા જૂનો",
      metalNews: "ગોલ્ડ/સિલ્વર સમાચાર", allMetalNews: "બધા ગોલ્ડ/સિલ્વર સમાચાર →", sectorsT: "📊 સેક્ટર",
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
      confT: "વિશ્વાસ", aiView: "🤖 AI વ્યૂ",
      bseNote: "BSE ઓપ્શન ચેઇન (Sensex/BANKEX) BSE ની સાઇટ GitHub ના સર્વરને બ્લોક કરે છે, તેથી મફતમાં મળતી નથી. તમારા બ્રોકર (Angel One / Dhan / Upstox / Zerodha) ના API થી જોડાણ કરીએ તો લાઇવ ભાવ સાથે ઉમેરી શકાય."
    },
    en: {
      loading: "Loading…", updated: "Updated", now: "just now", minAgo: " min ago", hrAgo: " h ago", dayAgo: " d ago",
      tabs: ["Home", "Stocks", "F&O", "More"],
      liveAt: "Live", ghAt: "GitHub update", dataTime: "Data time", srcLive: "Live (phone → ", srcGh: "GitHub (every 10–20 min)",
      loadingOpt: "Loading option chain…", optErr: "Live data not available", showingGh: "Showing the last GitHub data.",
      expiryL: "Choose expiry", atmCard: "🎯 ATM premium (this expiry)", straddle: "Straddle (CE+PE)", expMove: "Expected move till expiry ±",
      chainT: "📋 Option chain (around ATM)", chainH: ["CE OI", "CE ΔOI", "CE ₹", "Strike", "PE ₹", "PE ΔOI", "PE OI"],
      autoNote: "Auto-updates every 5 minutes. Tap ⟳ for an instant refresh.",
      bseLiveNote: "BSE (Sensex/BANKEX) data is read directly from the BSE website — this feature is experimental.",
      noLive: "Live data works only inside the app (on the phone).",
      metals: "🥇 Gold & Silver", gold: "Gold (COMEX $/oz)", silver: "Silver (COMEX $/oz)", goldbees: "GOLDBEES (India ETF ₹)", silverbees: "SILVERBEES (India ETF ₹)",
      trend: { up: "📈 Upward", down: "📉 Downward", sideways: "↔ Sideways" }, trendNext: "Trend for coming days", todayTrend: "from today's move",
      planT: "📋 Trade plan (educational)", buyCall: "Signal: BUY CALL (CE)", buyPut: "Signal: BUY PUT (PE)", noTrade: "No trade now — direction unclear",
      strikeL: "Strike", premNow: "Premium now", buyZone: "Buy zone (buy only within)", slL: "Stop-loss", t1L: "Target 1", t2L: "Target 2",
      spotInv: function (n, i) { return "Exit at once if " + n + " goes " + (i.opt === "CE" ? "below" : "above") + " " + (i.stop_level || "—"); },
      exitBy: "Expiry day: close the position before 2:30 PM (premium decays fast after that)",
      notExpiry: function (d) { return d + " day(s) to expiry — mind time decay"; }, expDayBadge: "⚡ Expiry today",
      zoneNote: "If the premium runs above the buy zone, don't chase it.", waitNote: function (n, i) { return "Watch CALL if " + n + " holds above " + (i.trigger_up || "—") + ", PUT if it breaks below " + (i.trigger_down || "—") + "."; },
      sigT: "Signals", sigN: { outlook: "Outlook", pcr: "PCR", maxpain: "Max pain", oi: "OI change (ATM ±3)", momentum: "Today's move" },
      newsAi: "📰 News/AI", segGlobal: "🌍 Global", segSectors: "📊 Sectors", ruleTrend: "rule based",
      fiiNote: "NSE publishes today's FII/DII data after market close (around 6–7 PM). Same-day figures are not available anywhere while the market is open.",
      fiiToday: "Today", fiiPending: "Today's data not published yet — showing the latest available day.", fiiUpd: "Checked",
      indiaToday: "Indian market today (live)", forecastNext: "Forecast (AI/rule)", niftyClose: "Nifty today",
      inrApprox: "Approx. India price (incl. 6% duty, excl. GST)", per10g: "/10 g", perKg: "/kg", liveRule: "from live data",
      segNews: "📰 News", segLedger: "🎯 Track record",
      probUp: "Chance of closing higher", rangeL: "Expected Nifty range", giftGap: "Opening as per GIFT Nifty", noClear: "No clear signal (below 55%)",
      gapUp: "gap-up", gapDown: "gap-down", flat: "flat",
      ledT: "🎯 Forecast track record (Nifty)", ledNote: "Each forecast is saved before the market opens and compared with the real result in the evening.",
      ledCols: ["Date", "Forecast", "Gap (pred/real)", "Range", "Close", "Result"],
      statDir: "Direction right", statDirCalled: "When a clear direction was given", statGap: "Opening gap right", statRange: "Close inside range", statBase: "Baseline: a naive ‘always up’ system",
      last20: "Last 20 days", allT: "All", noLedger: "Tracking has just started — the first result appears after 3:35 PM today.",
      foLog: "📋 F&O plan record (this phone)", foLogNote: "The first CALL/PUT signal per index per day is saved and checked after the close.", foLogEmpty: "No F&O signal saved yet.",
      pending: "pending", staleData: "⚠️ News/AI data is old",
      metalNews: "Gold/Silver news", allMetalNews: "All gold/silver news →", sectorsT: "📊 Sectors",
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
      confT: "Confidence", aiView: "🤖 AI view",
      bseNote: "The BSE option chain (Sensex/BANKEX) is not available for free because BSE blocks GitHub servers. It can be added with live prices by connecting your broker's API (Angel One / Dhan / Upstox / Zerodha)."
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
  var LIVE = window.MMLive || { available: false };
  state.live = { idx: null, idxTime: null, idxErr: [], opt: {}, optErr: {}, optLoading: {}, exp: {}, sel: PREF.foSel || "nifty" };
  function fmtDT(v) { // ISO / Date / NSE "20-Nov-2026 11:25:30" -> "20 નવે 2026, 11:25:30" (IST)
    if (!v) return "—";
    if (typeof v === "string" && /^\d{2}-[A-Za-z]{3}-\d{4}/.test(v)) {
      var p = v.split(/[- ]/), mi = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(p[1]);
      return parseInt(p[0], 10) + " " + (MONTHS[state.lang][mi] || p[1]) + " " + p[2] + ", " + (p[3] || "");
    }
    var d = new Date(new Date(v).getTime() + 5.5 * 3600000);
    if (isNaN(d)) return String(v);
    function z(n) { return (n < 10 ? "0" : "") + n; }
    return d.getUTCDate() + " " + MONTHS[state.lang][d.getUTCMonth()] + " " + d.getUTCFullYear() + ", " + z(d.getUTCHours()) + ":" + z(d.getUTCMinutes()) + ":" + z(d.getUTCSeconds());
  }
  function finalLabel(d) { return (d.ai && d.ai.outlook && d.ai.outlook.label) || (d.outlook && d.outlook.label) || "neutral"; }

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
    if (d) renderHeaderOnly(); else $("updated").textContent = t("loading");
    var v = $("view");
    if (!d) { v.innerHTML = "<div class='empty'>" + t("loading") + "</div>"; return; }
    v.innerHTML = ({ home: renderHome, stocks: renderStocks, fo: renderFO, more: renderMore }[state.tab] || renderHome)(d);
    bindView();
  }

  function liveIndia() {
    var lv = state.live.idx || {}, v = [], w = 0, sum = 0;
    [["Nifty 50", 1.5], ["Bank Nifty", 1], ["Sensex", 1]].forEach(function (x) { var q = lv[x[0]]; if (q && q.pct != null) { sum += q.pct * x[1]; w += x[1]; v.push(q); } });
    return w ? sum / w : null;
  }
  function labelFromPct(p) { return p >= 0.8 ? "strong_positive" : p >= 0.2 ? "positive" : p <= -0.8 ? "strong_negative" : p <= -0.2 ? "negative" : "neutral"; }
  function moodCard(d) {
    var ai = d.ai && d.ai.outlook ? d.ai.outlook : null;
    var rule = d.outlook || {};
    var labels = t("labels");
    var fLabel = (ai && labels[ai.label]) ? ai.label : (rule.label || "neutral");
    var s = d.session || {};
    var lp = liveIndia(), nifty = (state.live.idx || {})["Nifty 50"];
    var h = "";
    if (lp != null && marketHours()) {     // market open: show what the Indian market is actually doing
      var lab = labelFromPct(lp), c = lab.indexOf("positive") >= 0 ? "pos" : lab.indexOf("negative") >= 0 ? "neg" : "neu";
      var pos = Math.max(2, Math.min(98, 50 + lp * 30));
      h += "<div class='mood " + c + "'><div class='when'>" + t("indiaToday") + " — " + dayName(todayIST()) + " · " + fmtDT(state.live.idxTime).split(", ")[1] + "</div>" +
        "<div class='big " + c + "-t'>" + labels[lab] + "</div><div class='meter'><i style='left:" + pos + "%'></i></div>" +
        (nifty ? "<span class='badge " + cls(nifty.pct) + "'>Nifty " + pct(nifty.pct) + "</span>" : "") +
        "<span class='badge'>" + t("forecastNext") + ": " + labels[fLabel] + "</span></div>";
      return h;
    }
    var c2 = fLabel.indexOf("positive") >= 0 ? "pos" : fLabel.indexOf("negative") >= 0 ? "neg" : "neu";
    var conf = ai ? ai.confidence : rule.confidence;
    var when = t(s.phase === "live" ? "live" : s.phase === "pre" ? "pre" : "closed") + " — " + dayName(s.date);
    var pos2 = rule.score != null ? Math.max(2, Math.min(98, (rule.score + 1) * 50)) : 50;
    h = "<div class='mood " + c2 + "'><div class='when'>" + esc(when) + "</div>" +
      "<div class='big " + c2 + "-t'>" + labels[fLabel] + "</div>" +
      "<div class='meter'><i style='left:" + pos2 + "%'></i></div>" +
      "<span class='badge'>" + t("confL") + ": " + (t("conf")[conf] || t("conf").low) + "</span>" +
      (ai ? "<span class='badge pos'>" + t("aiBadge") + "</span>" : "<span class='badge'>" + t("ruleBadge") + "</span>") +
      (nifty && nifty.pct != null ? "<span class='badge " + cls(nifty.pct) + "'>" + t("niftyClose") + " " + pct(nifty.pct) + "</span>" : "");
    h += forecastBox(d);
    return h + "</div>";
  }
  function liveGap(d) {
    var e = d.ledger && d.session ? d.ledger[d.session.date] : null, g = (state.live.idx || {})["GIFT Nifty"];
    if (e && e.gift_ref && g && g.price) return Math.round((g.price / e.gift_ref - 1) * 10000) / 100;
    return d.forecast ? d.forecast.gap_pred : null;
  }
  function forecastBox(d) {
    var f = d.forecast;
    if (!f) return "";
    var p = Math.round((f.prob_up || 0.5) * 100), gap = liveGap(d);
    var clear = p >= 55 || p <= 45;
    var h = "<div class='fbox'><div><span class='muted small'>" + t("probUp") + "</span><b class='" + (p >= 55 ? "pos" : p <= 45 ? "neg" : "neu") + "-t'> " + p + "%</b>" + (clear ? "" : " <span class='muted small'>(" + t("noClear") + ")</span>") + "</div>";
    if (f.range_lo) h += "<div><span class='muted small'>" + t("rangeL") + ":</span> <b>" + num(f.range_lo) + " – " + num(f.range_hi) + "</b></div>";
    if (gap != null) h += "<div><span class='muted small'>" + t("giftGap") + ":</span> <b class='" + cls(gap / 2) + "-t'>" + pct(gap) + " " + (gap >= 0.15 ? t("gapUp") : gap <= -0.15 ? t("gapDown") : t("flat")) + "</b>" + (f.ref ? " <span class='muted small'>(≈ " + num(Math.round(f.ref * (1 + gap / 100))) + ")</span>" : "") + "</div>";
    return h + "</div>";
  }

  function renderHome(d) {
    var h = indexStrip(d) + moodCard(d), ai = d.ai || null;
    var summ = tx(ai, "summary");
    if (summ) h += "<div class='card'><h3>" + t("summary") + "</h3><div>" + esc(summ) + "</div><div class='muted small' style='margin-top:6px'>" + t("aiUpd") + ": " + ago(ai.generated_at) + "</div></div>";
    var reasons = [];
    if (ai && ai.outlook) {
      var rs = ai.outlook["reasons_" + state.lang] || ai.outlook.reasons_gu || ai.outlook.reasons_en || [];
      rs.forEach(function (r) { reasons.push({ type: "neu", text: r }); });
    }
    (d.outlook && d.outlook.reasons || []).forEach(function (r) { reasons.push({ type: r.type, text: r[state.lang] || r.text }); });
    if (reasons.length) h += "<div class='card'><h3>" + t("reasons") + "</h3><ul class='reasons'>" + reasons.map(function (r) { return "<li class='" + esc(r.type) + "'>" + esc(r.text) + "</li>"; }).join("") + "</ul></div>";
    h += foMini(d);
    h += fiiCard(d);
    h += metalsCard(d);
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

  function indexStrip(d) {
    var base = (d.markets && d.markets.india) || [], lv = state.live.idx || {};
    var names = base.map(function (q) { return q.name; });
    ["GIFT Nifty", "Nifty 50", "Sensex", "Bank Nifty", "BANKEX"].forEach(function (n) { if (names.indexOf(n) < 0 && lv[n]) { if (n === "GIFT Nifty") names.unshift(n); else names.push(n); } });
    if (!names.length) return "";
    var anyLive = false;
    var cells = names.map(function (n) {
      var q = lv[n], live = !!q;
      if (!q) q = base.filter(function (x) { return x.name === n; })[0] || {};
      if (live) anyLive = true;
      var good = n.indexOf("VIX") >= 0 ? -(q.pct || 0) : (q.pct || 0);
      return "<div class='chipq " + (q.price == null ? "" : cls(good)) + "'><div class='n'>" + esc(n) + (!live && q.stale ? " ⏳" : "") + "</div><div class='v'>" + num(q.price) + "</div><div class='p " + cls(good) + "-t'>" + pct(q.pct) + "</div></div>";
    }).join("");
    var when = anyLive ? "🟢 " + t("liveAt") + ": " + fmtDT(state.live.idxTime) : "🕒 " + t("ghAt") + ": " + fmtDT(d.generated_at);
    return "<div class='strip-h muted small'>" + when + "</div><div class='strip'>" + cells + "</div>";
  }

  function foMini(d) {
    var o = d.options && d.options.nifty;
    if (!o || !o.idea) return "";
    var b = o.idea.bias;
    return "<div class='card' data-tab-go='fo'><h3>F&O · Nifty " + esc(o.expiry || "") + "</h3><div class='row'><div class='l'>" +
      "<span class='badge " + (b === "bullish" ? "pos" : b === "bearish" ? "neg" : "neu") + "'>" + t("bias")[b] + "</span> " +
      "<span class='muted small'>PCR " + o.pcr + " · " + t("support").split(" ")[0] + " " + (o.support || "—") + " · " + t("resistance").split(" ")[0] + " " + (o.resistance || "—") + "</span></div><div class='r'>›</div></div></div>";
  }

  function fiiHistory(d) {
    var hist = Object.assign({}, d.fii_hist || {}, store("mm_fii_hist") || {});
    [].concat(d.fii_dii || [], state.live.fii || []).forEach(function (r) { if (r.date) { hist[r.date] = hist[r.date] || {}; hist[r.date][r.category] = r; } });
    return hist;
  }
  function parseNseDate(x) { var p = String(x).split("-"); var m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(p[1]); return m < 0 ? 0 : Date.UTC(+p[2], m, +p[0]); }
  function fiiCard(d) {
    var hist = fiiHistory(d);
    var dates = Object.keys(hist).sort(function (a, b) { return parseNseDate(b) - parseNseDate(a); }).slice(0, 10);
    if (!dates.length) return "";
    var sel = state.fiiSel && hist[state.fiiSel] ? state.fiiSel : dates[0];
    var todayStr = (function () { var x = new Date(Date.now() + 5.5 * 3600000); return x.getUTCDate() + "-" + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][x.getUTCMonth()] + "-" + x.getUTCFullYear(); })();
    var latestIsToday = parseNseDate(dates[0]) === parseNseDate(todayStr);
    var h = "<div class='card'><h3>" + t("fii") + "</h3>";
    h += "<div class='chips'>" + dates.map(function (dt) {
      return "<button class='chip " + (dt === sel ? "on" : "") + "' data-fii='" + esc(dt) + "'>" + (parseNseDate(dt) === parseNseDate(todayStr) ? t("fiiToday") + " " : "") + esc(dt.slice(0, 6)) + "</button>";
    }).join("") + "</div>";
    var rows = hist[sel] || {};
    h += Object.keys(rows).map(function (k) {
      var r = rows[k], n = parseFloat(String(r.net).replace(/,/g, ""));
      return "<div class='row'><div class='l'><b>" + esc(r.category) + "</b><div class='muted small'>" + esc(r.date) + "</div></div><div class='r " + cls(n) + "-t'><b>" + (n > 0 ? "+" : "") + esc(r.net) + "</b><div class='muted small'>" + t("buy") + " " + esc(r.buy) + " · " + t("sell") + " " + esc(r.sell) + "</div></div></div>";
    }).join("");
    if (!latestIsToday) h += "<div class='muted small' style='margin-top:6px'>ℹ️ " + t("fiiPending") + "</div>";
    h += "<div class='muted small' style='margin-top:4px'>" + t("fiiNote") + (state.live.fiiTime ? " · " + t("fiiUpd") + ": " + fmtDT(state.live.fiiTime).split(", ")[1] : "") + "</div>";
    return h + "</div>";
  }

  function metalQ(d, name) {
    var lv = state.live.idx || {};
    if (lv[name]) return lv[name];
    var all = [].concat((d.markets && d.markets.macro) || [], (d.metals_india) || []);
    return all.filter(function (q) { return q.name === name || q.sym === name; })[0] || null;
  }
  function liveMetalsRule() {
    var lv = state.live.idx || {};
    if (!lv.Gold && !lv.Silver) return null;
    var dxy = (lv["Dollar Index"] || {}).pct || 0, y = (lv["US 10Y Yield"] || {}).pct || 0, out = {};
    [["gold", "Gold"], ["silver", "Silver"]].forEach(function (x) {
      var own = (lv[x[1]] || {}).pct || 0, sc = -dxy - 0.15 * y + 0.5 * own;
      out[x[0]] = { trend: sc > 0.25 ? "up" : sc < -0.25 ? "down" : "sideways",
        outlook_gu: "ડોલર ઇન્ડેક્સ " + pct(dxy) + ", US યીલ્ડ " + pct(y) + ", આજે " + pct(own) + " (" + t("liveRule") + ")",
        outlook_en: "Dollar index " + pct(dxy) + ", US yield " + pct(y) + ", today " + pct(own) + " (" + t("liveRule") + ")" };
    });
    return out;
  }
  function metalsCard(d) {
    var rows = [["Gold", t("gold"), "gold"], ["Silver", t("silver"), "silver"]];
    var etf = [["GOLDBEES", t("goldbees")], ["SILVERBEES", t("silverbees")]];
    var aim = (d.ai && d.ai.metals) || d.metals_rule || liveMetalsRule() || {};
    var aiMet = !!(d.ai && d.ai.metals);
    var inr = metalQ(d, "USD/INR");
    var any = false;
    var h = "<div class='card'><h3>" + t("metals") + "</h3>";
    rows.forEach(function (r) {
      var q = metalQ(d, r[0]); if (!q) return; any = true;
      var a = aim[r[2]] || null;
      var tr = a && a.trend ? a.trend : (q.pct > 0.3 ? "up" : q.pct < -0.3 ? "down" : "sideways");
      var c = tr === "up" ? "pos" : tr === "down" ? "neg" : "neu";
      h += "<div class='row'><div class='l'><b>" + r[1] + "</b><div class='small'><span class='badge " + c + "'>" + t("trend")[tr] + "</span> <span class='muted'>" + (a ? t("trendNext") + (aiMet ? "" : " (" + t("ruleTrend") + ")") : t("todayTrend")) + "</span></div>" +
        (a && tx(a, "outlook") ? "<div class='muted small'>" + (aiMet ? "🤖 " : "📐 ") + esc(tx(a, "outlook")) + "</div>" : "") +
        "</div><div class='r'><div>$" + num(q.price) + "</div><div class='" + cls(q.pct || 0) + "-t'><b>" + pct(q.pct) + "</b></div>" +
        (inr && inr.price ? "<div class='muted small'>≈ ₹" + num(Math.round(q.price * inr.price / 31.1035 * (r[0] === "Gold" ? 10 : 1000) * 1.06)) + (r[0] === "Gold" ? t("per10g") : t("perKg")) + "</div>" : "") +
        "</div></div>";
    });
    if (inr && inr.price) h += "<div class='muted small'>₹ = " + t("inrApprox") + " · USD/INR " + num(inr.price) + "</div>";
    etf.forEach(function (r) {
      var q = metalQ(d, r[0]); if (!q) return; any = true;
      h += "<div class='row'><div class='l small'>" + r[1] + "</div><div class='r'><span>₹" + num(q.price) + "</span> <b class='" + cls(q.pct || 0) + "-t'>" + pct(q.pct) + "</b></div></div>";
    });
    var mn = (d.news || []).filter(function (n) { return n.metal; });
    if (mn.length) h += "<h3 style='margin-top:10px'>" + t("metalNews") + "</h3>" + mn.slice(0, 3).map(function (n) { return newsCard(n); }).join("") + "<button class='chip' data-metal-news='1'>" + t("allMetalNews") + "</button>";
    return any || mn.length ? h + "</div>" : "";
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

  function statRow(label, o) {
    if (!o || !o.n) return "";
    var r = Math.round(o.hit / o.n * 100);
    return "<div class='row'><div class='l small'>" + label + "</div><div class='r'><b class='" + (r >= 55 ? "pos" : r < 50 ? "neg" : "neu") + "-t'>" + r + "%</b> <span class='muted small'>(" + o.hit + "/" + o.n + ")</span></div></div>";
  }
  function renderLedger(d) {
    var led = d.ledger || {}, st = d.ledger_stats || {};
    var h = "<div class='card'><h3>" + t("ledT") + "</h3><div class='muted small' style='margin-bottom:8px'>" + t("ledNote") + "</div>";
    ["last20", "all"].forEach(function (k) {
      var s = st[k]; if (!s || !s.n) return;
      h += "<div class='muted small' style='margin-top:6px'><b>" + t(k === "last20" ? "last20" : "allT") + "</b> (" + s.n + ")</div>" +
        statRow(t("statDir"), s.dir) + statRow(t("statDirCalled"), s.dir_called) + statRow(t("statGap"), s.gap) + statRow(t("statRange"), s.range) + statRow(t("statBase"), s.baseline_up);
    });
    var keys = Object.keys(led).sort().reverse().slice(0, 30);
    var labels = t("labels");
    if (!keys.some(function (k) { return led[k].actual; })) h += "<div class='muted' style='margin:8px 0'>" + t("noLedger") + "</div>";
    if (keys.length) {
      h += "<div class='tbl-wrap'><table class='chain led'><tr>" + t("ledCols").map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr>" + keys.map(function (k) {
        var f = led[k].forecast || {}, a = led[k].actual, hi = (a && a.hits) || {};
        function ok(v) { return v === true ? "✅" : v === false ? "❌" : "–"; }
        return "<tr><td>" + k.slice(8) + "/" + k.slice(5, 7) + "</td>" +
          "<td>" + (f.prob_up != null ? Math.round(f.prob_up * 100) + "%↑" : "–") + "<br><span class='muted'>" + esc((labels[f.label] || "").split(" ")[0]) + "</span></td>" +
          "<td>" + (f.gap_pred != null ? pct(f.gap_pred) : "–") + "<br>" + (a && a.open_gap != null ? pct(a.open_gap) : "") + "</td>" +
          "<td>" + (f.range_lo ? f.range_lo + "<br>" + f.range_hi : "–") + "</td>" +
          "<td>" + (a ? num(a.close) + "<br><span class='" + cls(a.close_pct) + "-t'>" + pct(a.close_pct) + "</span>" : t("pending")) + "</td>" +
          "<td>" + (a ? "D" + ok(hi.dir) + " G" + ok(hi.gap) + " R" + ok(hi.range) : "⏳") + "</td></tr>";
      }).join("") + "</table></div><div class='muted small' style='margin-top:6px'>D = દિશા/direction · G = ગેપ/gap · R = રેન્જ/range</div>";
    }
    h += "</div>" + foLogCard();
    return h;
  }
  function foLogCard() {
    var log = store("mm_fo_log") || [];
    var h = "<div class='card'><h3>" + t("foLog") + "</h3><div class='muted small' style='margin-bottom:6px'>" + t("foLogNote") + "</div>";
    if (!log.length) return h + "<div class='muted'>" + t("foLogEmpty") + "</div></div>";
    var done = log.filter(function (x) { return x.close != null; }), hit = done.filter(function (x) { return x.ok; }).length;
    if (done.length) h += statRow(t("statDir"), { hit: hit, n: done.length });
    h += log.slice().reverse().slice(0, 25).map(function (x) {
      return "<div class='row'><div class='l small'><b>" + esc(x.name) + " " + x.strike + " " + x.opt + "</b> · " + x.date.slice(8) + "/" + x.date.slice(5, 7) + " " + x.time +
        "<div class='muted'>" + t("spot") + " " + num(x.spot) + " · ₹" + x.premium + "</div></div><div class='r small'>" +
        (x.close != null ? (x.ok ? "✅" : "❌") + " " + num(x.close) : "⏳ " + t("pending")) + "</div></div>";
    }).join("");
    return h + "</div>";
  }

  function renderMore(d) {
    var seg = state.moreSeg || "news";
    return "<div class='seg'>" + [["news", t("segNews")], ["global", t("segGlobal")], ["sectors", t("segSectors")], ["ledger", t("segLedger")]].map(function (x) {
      return "<button data-seg='" + x[0] + "' class='" + (seg === x[0] ? "on" : "") + "'>" + x[1] + "</button>";
    }).join("") + "</div>" + (seg === "news" ? renderNews(d) : seg === "global" ? renderGlobal(d) : seg === "ledger" ? renderLedger(d) : renderSectors(d));
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
  var FO_KEYS = ["nifty", "banknifty", "finnifty", "midcpnifty", "sensex", "bankex"];
  var FO_NAMES = { nifty: "Nifty", banknifty: "Bank Nifty", finnifty: "Fin Nifty", midcpnifty: "Midcap Select", sensex: "Sensex", bankex: "BANKEX" };

  function loadOpt(key, expiry) {
    if (!LIVE.available) return;
    var L = state.live;
    L.optLoading[key] = true;
    if (state.tab === "fo") render();
    var hintName = { nifty: "Nifty 50", banknifty: "Bank Nifty", finnifty: "Fin Nifty", midcpnifty: "Midcap Select", sensex: "Sensex", bankex: "BANKEX" }[key];
    var hint = L.idx && L.idx[hintName] ? L.idx[hintName].price : null;
    LIVE.options(key, expiry || L.exp[key], hint).then(function (m) {
      L.opt[key] = m; L.optErr[key] = null; L.exp[key] = m.expiry;
      if (m.index && m.spot && !(L.idx && L.idx[m.index])) { L.idx = L.idx || {}; L.idx[m.index] = { price: m.spot, pct: null }; }
    }, function (e) {
      L.optErr[key] = e.message || String(e);
    }).then(function () {
      L.optLoading[key] = false;
      if (state.tab === "fo") render();
    });
  }

  function foCard(o, aiPart, ideaObj, meta) {
    var i = ideaObj || {}, b = i.bias || "neutral", n = o.name;
    var h = "<div class='card'><h3>" + esc(n) + " · " + t("expiry") + " " + esc(o.expiry || "—") + "</h3>";
    h += "<div class='ts'>🕒 " + t("dataTime") + ": <b>" + meta.time + "</b><br>" + meta.src + "</div>";
    h += planCard(n, i, o);
    if (o.expiries && o.expiries.length > 1) {
      h += "<label class='muted small'>" + t("expiryL") + ": <select id='expSel'>" + o.expiries.map(function (e) { return "<option" + (e === o.expiry ? " selected" : "") + ">" + esc(e) + "</option>"; }).join("") + "</select></label>";
    }
    // ATM premium
    h += "<div class='atm'><div class='atm-h'>" + t("atmCard") + "</div><div class='atm-row'>" +
      "<div><div class='muted small'>ATM</div><div class='big2'>" + (o.atm || "—") + "</div></div>" +
      "<div><div class='muted small'>CE ₹</div><div class='big2 pos-t'>" + (o.atm_ce == null ? "—" : o.atm_ce) + "</div></div>" +
      "<div><div class='muted small'>PE ₹</div><div class='big2 neg-t'>" + (o.atm_pe == null ? "—" : o.atm_pe) + "</div></div></div>";
    var st = o.straddle || ((o.atm_ce || 0) + (o.atm_pe || 0));
    if (st) h += "<div class='small'>" + t("straddle") + ": <b>₹" + Math.round(st * 10) / 10 + "</b> · " + t("expMove") + "<b>" + Math.round(st) + "</b> (" + (o.atm ? Math.round(o.atm - st) + " – " + Math.round(o.atm + st) : "") + ")</div>";
    h += "<div class='muted small'>" + t("iv") + " " + (o.iv == null ? "—" : o.iv + "%") + "</div></div>";
    h += "<div class='grid'>" +
      "<div class='tile'><div class='n'>" + t("spot") + "</div><div class='v'>" + num(o.spot) + "</div></div>" +
      "<div class='tile'><div class='n'>" + t("pcr") + "</div><div class='v'>" + (o.pcr == null ? "—" : o.pcr) + "</div><div class='p muted'>" + (o.pcr == null ? "" : esc(t("pcrMean")(o.pcr))) + "</div></div>" +
      "<div class='tile'><div class='n'>" + t("support") + "</div><div class='v pos-t'>" + (o.support || "—") + "</div></div>" +
      "<div class='tile'><div class='n'>" + t("resistance") + "</div><div class='v neg-t'>" + (o.resistance || "—") + "</div></div>" +
      "<div class='tile'><div class='n'>" + t("maxPain") + "</div><div class='v'>" + (o.max_pain || "—") + "</div></div>" +
      "<div class='tile'><div class='n'>OTM CE / PE ₹</div><div class='v small'>" + (o.otm_ce == null ? "—" : o.otm_ce) + " / " + (o.otm_pe == null ? "—" : o.otm_pe) + "</div></div></div>";
    // mini chain
    if (o.chain && o.chain.length) {
      var hd = t("chainH");
      h += "<h3 style='margin-top:12px'>" + t("chainT") + "</h3><div class='tbl-wrap'><table class='chain'><tr>" + hd.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr>" +
        o.chain.map(function (r) {
          var c = r.k === o.atm ? "atm-r" : r.k === o.resistance ? "res-r" : r.k === o.support ? "sup-r" : "";
          function k(v) { return v == null ? "—" : Math.abs(v) >= 100000 ? (v / 100000).toFixed(1) + "L" : Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + "K" : v; }
          return "<tr class='" + c + "'><td>" + k(r.ce_oi) + "</td><td class='" + cls(r.ce_chg) + "-t'>" + k(r.ce_chg) + "</td><td>" + (r.ce_ltp == null ? "—" : r.ce_ltp) + "</td><td class='stk'>" + r.k + "</td><td>" + (r.pe_ltp == null ? "—" : r.pe_ltp) + "</td><td class='" + cls(r.pe_chg) + "-t'>" + k(r.pe_chg) + "</td><td>" + k(r.pe_oi) + "</td></tr>";
        }).join("") + "</table></div>";
    }
    var note = tx(aiPart, "note");
    if (note) h += "<div class='muted' style='margin-top:8px'>" + t("aiView") + ": " + esc(note) + "</div>";
    return h + "</div>";
  }

  function logFoPlan(key, o, i, idxName) {
    if (!i || (i.action !== "BUY_CE" && i.action !== "BUY_PE") || !marketHours()) return;
    var log = store("mm_fo_log") || [], day = todayIST();
    if (log.some(function (x) { return x.date === day && x.key === key; })) return;
    var now = new Date(Date.now() + 5.5 * 3600000);
    log.push({ date: day, key: key, name: o.name, idx: idxName, time: ("0" + now.getUTCHours()).slice(-2) + ":" + ("0" + now.getUTCMinutes()).slice(-2),
      opt: i.opt, strike: i.strike, premium: i.premium, spot: o.spot, sl: i.sl_premium, t1: i.target_premium });
    store("mm_fo_log", log.slice(-200));
  }
  function evalFoLog() { // fill in the closing level for past signals
    var log = store("mm_fo_log") || [], lv = state.live.idx || {}, day = todayIST(), changed = false;
    var after = (function () { var d = new Date(Date.now() + 5.5 * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes() >= 15 * 60 + 35; })();
    log.forEach(function (x) {
      if (x.close != null) return;
      var q = lv[x.idx]; if (!q || q.price == null) return;
      var close = null;
      if (x.date === day && after) close = q.price;
      else if (x.date < day && q.prev && x.date === prevWeekday(day)) close = q.prev;
      if (close != null) { x.close = close; x.ok = x.opt === "CE" ? close > x.spot : close < x.spot; changed = true; }
    });
    if (changed) store("mm_fo_log", log);
  }
  function prevWeekday(day) {
    var d = new Date(day + "T00:00:00Z"); do { d = new Date(d.getTime() - 86400000); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    return d.toISOString().slice(0, 10);
  }

  function planCard(n, i, o) {
    var b = i.bias || "neutral", c = b === "bullish" ? "pos" : b === "bearish" ? "neg" : "neu";
    var head = i.action === "BUY_CE" ? t("buyCall") : i.action === "BUY_PE" ? t("buyPut") : t("noTrade");
    var h = "<div class='plan " + c + "'><div class='plan-t'>" + t("planT") + (i.expiryDay ? " <span class='badge neg'>" + t("expDayBadge") + "</span>" : "") + "</div>" +
      "<div class='plan-big " + c + "-t'>" + (i.action === "BUY_CE" ? "📈 " : i.action === "BUY_PE" ? "📉 " : "⏸ ") + head + "</div>" +
      "<span class='badge'>" + t("confT") + ": " + t("conf")[i.confidence || "low"] + "</span>";
    if (i.premium) {
      h += "<div class='plan-grid'>" +
        "<div><span>" + t("strikeL") + "</span><b>" + i.strike + " " + i.opt + "</b></div>" +
        "<div><span>" + t("premNow") + "</span><b>₹" + i.premium + "</b></div>" +
        "<div class='wide'><span>" + t("buyZone") + "</span><b>₹" + i.buy_low + " – ₹" + i.buy_high + "</b></div>" +
        "<div><span>" + t("slL") + " (−" + i.sl_pct + "%)</span><b class='neg-t'>₹" + i.sl_premium + "</b></div>" +
        "<div><span>" + t("t1L") + "</span><b class='pos-t'>₹" + i.target_premium + "</b></div>" +
        "<div><span>" + t("t2L") + "</span><b class='pos-t'>₹" + i.target2_premium + "</b></div>" +
        "<div><span>" + esc(n) + " " + (i.opt === "CE" ? "↑" : "↓") + "</span><b>" + (i.target_level || "—") + "</b></div></div>" +
        "<ul class='steps'><li>" + esc(t("spotInv")(n, i)) + "</li><li>" + (i.expiryDay ? t("exitBy") : esc(t("notExpiry")(i.dte == null ? "?" : i.dte))) + "</li><li>" + t("zoneNote") + "</li>" +
        (i.spread ? "<li>" + esc(t("ideaSpread")({ opt: i.opt, spread: i.spread })) + "</li>" : "") + "</ul>";
    } else if (i.action === "WAIT") {
      h += "<div style='margin-top:6px'>" + esc(t("waitNote")(n, i)) + "</div>";
    }
    if (i.signals) {
      var sn = t("sigN");
      h += "<div class='sigs'><div class='muted small'>" + t("sigT") + ":</div>" + Object.keys(sn).map(function (k) {
        var v = i.signals[k] || 0;
        return "<span class='sig " + cls(v) + "'>" + sn[k] + " " + (v > 0.05 ? "▲" : v < -0.05 ? "▼" : "●") + "</span>";
      }).join("") + "</div>";
    }
    return h + "</div>";
  }

  function renderFO(d) {
    var L = state.live, sel = L.sel, h = indexStrip(d) + "<div class='warn'>" + t("foWarn") + "</div>";
    var gh = d.options || {}, aiFo = (d.ai && d.ai.fo) || {};
    h += "<div class='chips'>" + FO_KEYS.map(function (k) { return "<button class='chip " + (k === sel ? "on" : "") + "' data-fo='" + k + "'>" + FO_NAMES[k] + "</button>"; }).join("") + "</div>";
    var lv = L.opt[sel], o = null, meta = null, ideaObj = null;
    if (lv) {
      o = lv;
      meta = { time: lv.time ? fmtDT(lv.time) + " (" + lv.source + ")" : fmtDT(lv.fetched_at), src: "🟢 " + t("srcLive") + lv.source + ")" };
      var idxName = { nifty: "Nifty 50", banknifty: "Bank Nifty", finnifty: "Fin Nifty", midcpnifty: "Midcap Select", sensex: "Sensex", bankex: "BANKEX" }[sel];
      var iq = (L.idx || {})[idxName];
      ideaObj = LIVE.idea(lv, finalLabel(d), (aiFo[sel] || {}).bias, { pct: iq ? iq.pct : null });
      logFoPlan(sel, lv, ideaObj, idxName);
    } else if (gh[sel]) {
      o = gh[sel];
      meta = { time: fmtDT(o.fetched_at || d.generated_at) + (o.stale ? " ⏳" : ""), src: "🕒 " + t("srcGh") };
      ideaObj = o.idea;
    }
    if (L.optLoading[sel]) h += "<div class='muted small' style='margin-bottom:8px'>⏳ " + t("loadingOpt") + "</div>";
    if (L.optErr[sel]) h += "<div class='err-inline'>⚠️ " + t("optErr") + ": " + esc(L.optErr[sel]) + (gh[sel] && !lv ? " — " + t("showingGh") : "") + "</div>";
    if (!LIVE.available && !o) h += "<div class='muted small'>" + t("noLive") + "</div>";
    if (sel === "sensex" || sel === "bankex") h += "<div class='muted small' style='margin-bottom:8px'>ℹ️ " + t("bseLiveNote") + "</div>";
    if (o) h += foCard(o, aiFo[sel], ideaObj, meta);
    else if (!L.optLoading[sel]) h += "<div class='empty'>" + t("foNoData") + "</div>";
    h += "<div class='muted small' style='margin:-4px 4px 12px'>" + t("autoNote") + " " + t("premNote") + "</div>";
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
    root.querySelectorAll("[data-fo]").forEach(function (el) {
      el.onclick = function () {
        var k = el.getAttribute("data-fo"); state.live.sel = k; PREF.foSel = k;
        store("mm_prefs", Object.assign({}, store("mm_prefs") || {}, { foSel: k }));
        render(); if (!state.live.opt[k]) loadOpt(k);
      };
    });
    var es = root.querySelector("#expSel");
    if (es) es.onchange = function () { loadOpt(state.live.sel, es.value); };
    root.querySelectorAll("[data-metal-news]").forEach(function (el) {
      el.onclick = function () { var mn = (state.data.news || []).filter(function (n) { return n.metal; }); openSheet(t("metalNews"), mn.slice(0, 60).map(function (n) { return newsCard(n); }).join("")); };
    });
    root.querySelectorAll("[data-fii]").forEach(function (el) { el.onclick = function () { state.fiiSel = el.getAttribute("data-fii"); render(); }; });
    root.querySelectorAll("[data-seg]").forEach(function (el) { el.onclick = function () { state.moreSeg = el.getAttribute("data-seg"); render(); }; });
    root.querySelectorAll("[data-jump]").forEach(function (el) { el.onclick = function () { var x = $(el.getAttribute("data-jump")); if (x) x.scrollIntoView({ behavior: "smooth", block: "start" }); }; });
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
    if (tb === "news") { state.moreSeg = "news"; tb = "more"; }
    if (tb === "global" || tb === "sectors") { state.moreSeg = tb; tb = "more"; }
    state.tab = tb;
    document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === tb); });
    window.scrollTo(0, 0);
    render();
    if (tb === "fo" && LIVE.available && !state.live.opt[state.live.sel] && !state.live.optLoading[state.live.sel]) loadOpt(state.live.sel);
  }

  document.querySelectorAll(".tabs button").forEach(function (b) { b.onclick = function () { setTab(b.getAttribute("data-tab")); }; });
  function refreshLive(withOpt) {
    if (!LIVE.available) return;
    LIVE.indices().then(function (r) {
      if (Object.keys(r.quotes).length) { state.live.idx = r.quotes; state.live.idxTime = r.time; evalFoLog(); }
      state.live.idxErr = r.errors;
      if (state.tab === "home" || state.tab === "fo") render();
    }, function () {});
    if (withOpt || state.tab === "fo") loadOpt(state.live.sel);
    LIVE.fii().then(function (rows) {
      if (!rows.length) return;
      state.live.fii = rows; state.live.fiiTime = new Date().toISOString();
      var h = store("mm_fii_hist") || {};
      rows.forEach(function (r) { if (r.date) { h[r.date] = h[r.date] || {}; h[r.date][r.category] = r; } });
      var keys = Object.keys(h).sort(function (a, b) { return parseNseDate(b) - parseNseDate(a); });
      keys.slice(30).forEach(function (k) { delete h[k]; });
      store("mm_fii_hist", h);
      if (state.tab === "home") render();
    }, function () {});
  }
  function marketHours() {
    var d = new Date(Date.now() + 5.5 * 3600000), m = d.getUTCHours() * 60 + d.getUTCMinutes();
    return d.getUTCDay() >= 1 && d.getUTCDay() <= 5 && m >= 9 * 60 && m <= 15 * 60 + 40;
  }
  var lastLive = 0;
  setInterval(function () {
    if (document.hidden) return;
    var gap = marketHours() ? 5 * 60000 : 30 * 60000;
    if (Date.now() - lastLive >= gap) { lastLive = Date.now(); refreshLive(false); }
  }, 30000);
  $("btnRefresh").onclick = function () { load(true); lastLive = Date.now(); refreshLive(true); };
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
    if (Date.now() - lastLive > 3 * 60000) { lastLive = Date.now(); refreshLive(false); }
    if (state.data) renderHeaderOnly();
  };
  window.mmOpen = function (target) { // from a notification tap: "stock:SYM" or "tab:fo"
    if (!target) return;
    var p = String(target).split(":");
    if (p[0] === "tab") setTab(p[1]);
    if (p[0] === "stock" && state.data) openStock(p[1]);
  };
  function renderHeaderOnly() {
    var d = state.data;
    var old = marketHours() && (Date.now() - new Date(d.generated_at).getTime()) > 40 * 60000;
    $("updated").textContent = (state.live.idxTime ? "🟢 " + t("liveAt") + " " + fmtDT(state.live.idxTime).split(", ")[1] + " · " + t("newsAi") + " " + ago(d.generated_at) : t("updated") + ": " + ago(d.generated_at)) + (old ? " ⚠️" : "");
  }
  setInterval(function () { if (state.data) renderHeaderOnly(); }, 60000);

  var cached = store("mm_cache");
  if (cached) state.data = cached;
  render();
  load(false);
  checkUpdate();
  syncNative();
  lastLive = Date.now();
  refreshLive(false);
})();
