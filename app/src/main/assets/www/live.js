/* M-Market — live data read directly from the phone (NSE / BSE / CNBC) through the native bridge.
   Exposes window.MMLive. Works only inside the Android app (window.MMNative.http). */
(function () {
  "use strict";
  var NATIVE = window.MMNative || null;
  var cbs = {}, seq = 0;

  window.mmHttpCb = function (id, code, body) {
    var cb = cbs[id];
    delete cbs[id];
    if (cb) cb(code, body);
  };

  function nget(url) {
    return new Promise(function (resolve, reject) {
      if (!NATIVE || !NATIVE.http) { reject(new Error("no-native")); return; }
      var id = "r" + (++seq);
      var to = setTimeout(function () { delete cbs[id]; reject(new Error("timeout")); }, 45000);
      cbs[id] = function (code, body) {
        clearTimeout(to);
        if (code >= 200 && code < 300) resolve(body);
        else reject(new Error("HTTP " + code + (code < 0 ? " " + String(body).slice(0, 80) : "")));
      };
      NATIVE.http(id, url);
    });
  }
  function njson(url) {
    return nget(url).then(function (t) {
      try { return JSON.parse(t); } catch (e) { throw new Error("bad JSON (" + String(t).slice(0, 40) + ")"); }
    });
  }
  function num(v) {
    if (v == null || v === "" || v === "-") return null;
    var n = parseFloat(String(v).replace(/,/g, "").replace("%", "").replace("+", ""));
    return isNaN(n) ? null : n;
  }
  function pick(o, keys) {
    var ks = Object.keys(o || {});
    for (var i = 0; i < keys.length; i++) {
      for (var j = 0; j < ks.length; j++) {
        if (ks[j].toLowerCase() === keys[i].toLowerCase() && num(o[ks[j]]) != null) return num(o[ks[j]]);
      }
    }
    return null;
  }
  function q(price, prev, pct) {
    if (price == null) return null;
    if (prev == null && pct != null) prev = price / (1 + pct / 100);
    if (!prev) return null;
    return { price: price, prev: prev, pct: pct != null ? Math.round(pct * 100) / 100 : Math.round((price - prev) / prev * 10000) / 100 };
  }

  // ---------------- indices ----------------
  var NSE_IDX = {
    "Nifty 50": "NIFTY 50", "Bank Nifty": "NIFTY BANK", "Fin Nifty": "NIFTY FINANCIAL SERVICES",
    "Midcap Select": "NIFTY MIDCAP SELECT", "Nifty Next 50": "NIFTY NEXT 50", "Nifty Midcap 100": "NIFTY MIDCAP 100",
    "Nifty Smallcap 100": "NIFTY SMALLCAP 100", "India VIX": "INDIA VIX"
  };
  var CNBC_SYM = { "Sensex": [".BSESN", ".SENSEX"], "BANKEX": [".BSEBANK", ".BANKEX"], "Gold": ["@GC.1"], "Silver": ["@SI.1"],
    "Nifty 50": [".NSEI"], "Bank Nifty": [".NSEBANK"] };

  function nseIndices() {
    return njson("https://www.nseindia.com/api/allIndices").then(function (js) {
      var by = {};
      (js.data || []).forEach(function (r) { by[String(r.index).toUpperCase()] = r; });
      var out = {};
      Object.keys(NSE_IDX).forEach(function (name) {
        var r = by[NSE_IDX[name]];
        if (r) { var x = q(num(r.last), num(r.previousClose), num(r.percentChange)); if (x) out[name] = x; }
      });
      return out;
    });
  }
  function bseIndices() {
    return njson("https://api.bseindia.com/BseIndiaAPI/api/GetSensexData/w").then(function (js) {
      var rows = Array.isArray(js) ? js : (js.Table || js.data || [js]);
      var out = {};
      rows.forEach(function (r) {
        if (!r || typeof r !== "object") return;
        var name = JSON.stringify(r).toUpperCase();
        var x = q(pick(r, ["ltp", "CurrValue", "Curvalue", "currentvalue", "last", "I_close"]),
          pick(r, ["Prev_Close", "PrevClose", "prevclose", "previousclose"]),
          pick(r, ["perchg", "PerChange", "pchange", "chgper", "percentchange"]));
        if (!x) return;
        if (name.indexOf("BANKEX") >= 0) out.BANKEX = x;
        else if (name.indexOf("SENSEX") >= 0 && !out.Sensex) out.Sensex = x;
      });
      return out;
    });
  }
  function cnbcQuotes(names) {
    var want = {};
    names.forEach(function (n) { (CNBC_SYM[n] || []).forEach(function (s) { want[s] = n; }); });
    var syms = Object.keys(want);
    if (!syms.length) return Promise.resolve({});
    var url = "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=" +
      encodeURIComponent(syms.join("|")) + "&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1";
    return njson(url).then(function (js) {
      var rows = ((js.FormattedQuoteResult || {}).FormattedQuote) || [];
      if (!Array.isArray(rows)) rows = [rows];
      var out = {};
      rows.forEach(function (r) {
        var n = want[r.symbol] || want[r.altSymbol];
        if (!n || out[n]) return;
        var x = q(num(r.last), num(r.previous_day_closing), num(r.change_pct));
        if (x) out[n] = x;
      });
      return out;
    });
  }
  function nseQuote(sym) {
    return njson("https://www.nseindia.com/api/quote-equity?symbol=" + encodeURIComponent(sym)).then(function (js) {
      var p = js.priceInfo || {};
      return q(num(p.lastPrice), num(p.previousClose), num(p.pChange));
    });
  }

  /** returns {quotes: {name: {price, prev, pct}}, time, errors: []} */
  function indices() {
    var out = {}, errors = [];
    function safe(p, label) { return p.then(function (r) { Object.keys(r || {}).forEach(function (k) { if (!out[k]) out[k] = r[k]; }); }, function (e) { errors.push(label + ": " + e.message); }); }
    return Promise.all([
      safe(nseIndices(), "NSE"),
      safe(bseIndices(), "BSE")
    ]).then(function () {
      var miss = ["Sensex", "BANKEX", "Gold", "Silver", "Nifty 50", "Bank Nifty"].filter(function (n) { return !out[n]; });
      return safe(cnbcQuotes(miss), "CNBC");
    }).then(function () {
      return Promise.all([
        safe(nseQuote("GOLDBEES").then(function (x) { return x ? { GOLDBEES: x } : {}; }), "GOLDBEES"),
        safe(nseQuote("SILVERBEES").then(function (x) { return x ? { SILVERBEES: x } : {}; }), "SILVERBEES")
      ]);
    }).then(function () { return { quotes: out, time: new Date().toISOString(), errors: errors }; });
  }

  // ---------------- option chains ----------------
  var OPT = {
    nifty: { name: "Nifty", ex: "NSE", sym: "NIFTY", step: 50 },
    banknifty: { name: "Bank Nifty", ex: "NSE", sym: "BANKNIFTY", step: 100 },
    finnifty: { name: "Fin Nifty", ex: "NSE", sym: "FINNIFTY", step: 50 },
    midcpnifty: { name: "Midcap Select", ex: "NSE", sym: "MIDCPNIFTY", step: 25 },
    sensex: { name: "Sensex", ex: "BSE", scrip: 1, step: 100, idx: "Sensex" },
    bankex: { name: "BANKEX", ex: "BSE", scrip: 12, step: 100, idx: "BANKEX" }
  };

  function nseExpiries(sym) {
    return njson("https://www.nseindia.com/api/option-chain-contract-info?symbol=" + sym).then(function (js) {
      return js.expiryDates || [];
    });
  }
  function nseChain(sym, expiry) {
    var url = "https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=" + sym + "&expiry=" + encodeURIComponent(expiry);
    return njson(url).then(function (js) {
      var rec = js.records || {};
      var rows = rec.data || (js.filtered || {}).data || [];
      return {
        spot: num(rec.underlyingValue), time: rec.timestamp || null, expiry: expiry,
        rows: rows.map(function (x) {
          var ce = x.CE || {}, pe = x.PE || {};
          return { k: num(x.strikePrice), ce_oi: num(ce.openInterest) || 0, pe_oi: num(pe.openInterest) || 0,
            ce_chg: num(ce.changeinOpenInterest) || 0, pe_chg: num(pe.changeinOpenInterest) || 0,
            ce_ltp: num(ce.lastPrice), pe_ltp: num(pe.lastPrice), ce_iv: num(ce.impliedVolatility), pe_iv: num(pe.impliedVolatility) };
        }).filter(function (r) { return r.k != null; })
      };
    });
  }

  function arrays(js) { // all arrays of objects inside a BSE response
    var out = [];
    (function walk(v) {
      if (Array.isArray(v)) { if (v.length && typeof v[0] === "object") out.push(v); v.forEach(walk); }
      else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { walk(v[k]); });
    })(js);
    return out;
  }
  function bseExpiries(scrip) {
    var url = "https://api.bseindia.com/BseIndiaAPI/api/ddlExpiry_IV/w?ProductType=IO&scrip_cd=" + scrip;
    return njson(url).then(function (js) {
      var exps = [];
      arrays(js).forEach(function (arr) {
        arr.forEach(function (o) {
          Object.keys(o).forEach(function (k) {
            var v = String(o[k]);
            if (/^\d{1,2}[ -][A-Za-z]{3}[ -]\d{4}$/.test(v.trim()) && exps.indexOf(v.trim()) < 0) exps.push(v.trim());
          });
        });
      });
      if (!exps.length && Array.isArray(js)) js.forEach(function (v) { if (typeof v === "string") exps.push(v); });
      return exps;
    });
  }
  function findKey(row, re, notRe) {
    var ks = Object.keys(row);
    for (var i = 0; i < ks.length; i++) if (re.test(ks[i]) && !(notRe && notRe.test(ks[i]))) return ks[i];
    return null;
  }
  function bseChain(scrip, expiry) {
    var url = "https://api.bseindia.com/BseIndiaAPI/api/DerivOptionChain_IV/w?Expiry=" + encodeURIComponent(expiry) + "&scrip_cd=" + scrip + "&strprice=0";
    return njson(url).then(function (js) {
      var arr = arrays(js).sort(function (a, b) { return b.length - a.length; })[0] || [];
      if (!arr.length) throw new Error("BSE: empty chain");
      var r0 = arr[0];
      var kStrike = findKey(r0, /strike/i);
      var kCeOi = findKey(r0, /^c_.*open.?int/i), kPeOi = findKey(r0, /open.?int/i, /^c_/i);
      var kCeLtp = findKey(r0, /^c_.*(ltp|last.?tr|last.?price)/i), kPeLtp = findKey(r0, /(ltp|last.?tr|last.?price)/i, /^c_/i);
      var kCeChg = findKey(r0, /^c_.*(chg|change).*oi|^c_.*oi.*(chg|change)/i), kPeChg = findKey(r0, /(chg|change).*oi|oi.*(chg|change)/i, /^c_/i);
      var kCeIv = findKey(r0, /^c_.*iv$/i), kPeIv = findKey(r0, /(^|_)iv$/i, /^c_/i);
      if (!kStrike || !kCeOi || !kPeOi) throw new Error("BSE fields: " + Object.keys(r0).slice(0, 14).join(","));
      var spotKey = null, spot = null;
      (function walk(v) {
        if (spot != null || !v || typeof v !== "object") return;
        Object.keys(v).forEach(function (k) {
          if (spot == null && /(ula|underly|ul_?value|index_?value|spot)/i.test(k) && num(v[k]) > 1000) { spotKey = k; spot = num(v[k]); }
          else if (typeof v[k] === "object") walk(v[k]);
        });
      })(js);
      return {
        spot: spot, time: null, expiry: expiry,
        rows: arr.map(function (x) {
          return { k: num(x[kStrike]), ce_oi: num(x[kCeOi]) || 0, pe_oi: num(x[kPeOi]) || 0,
            ce_chg: kCeChg ? num(x[kCeChg]) || 0 : 0, pe_chg: kPeChg ? num(x[kPeChg]) || 0 : 0,
            ce_ltp: kCeLtp ? num(x[kCeLtp]) : null, pe_ltp: kPeLtp ? num(x[kPeLtp]) : null,
            ce_iv: kCeIv ? num(x[kCeIv]) : null, pe_iv: kPeIv ? num(x[kPeIv]) : null };
        }).filter(function (r) { return r.k != null; })
      };
    });
  }

  function metrics(cfg, chain, spotHint) {
    var spot = chain.spot || spotHint;
    var rows = chain.rows.slice().sort(function (a, b) { return a.k - b.k; });
    if (!rows.length || !spot) throw new Error("empty chain");
    var totCe = 0, totPe = 0;
    rows.forEach(function (r) { totCe += r.ce_oi; totPe += r.pe_oi; });
    var near = rows.filter(function (r) { return Math.abs(r.k - spot) <= spot * 0.06; });
    if (!near.length) near = rows;
    var res = null, sup = null;
    near.forEach(function (r) {
      if (r.k >= spot && (!res || r.ce_oi > res.ce_oi)) res = r;
      if (r.k <= spot && (!sup || r.pe_oi > sup.pe_oi)) sup = r;
    });
    var mp = null, best = Infinity;
    near.forEach(function (c) {
      var pain = 0;
      rows.forEach(function (r) { pain += r.ce_oi * Math.max(0, c.k - r.k) + r.pe_oi * Math.max(0, r.k - c.k); });
      if (pain < best) { best = pain; mp = c.k; }
    });
    var atm = rows.reduce(function (a, b) { return Math.abs(b.k - spot) < Math.abs(a.k - spot) ? b : a; });
    var ivs = [atm.ce_iv, atm.pe_iv].filter(function (v) { return v; });
    var i = rows.indexOf(atm);
    var step = (rows[i + 1] && rows[i + 1].k - atm.k) || cfg.step;
    var straddle = (atm.ce_ltp || 0) + (atm.pe_ltp || 0);
    return {
      name: cfg.name, spot: Math.round(spot * 100) / 100, expiry: chain.expiry, step: step,
      pcr: totCe ? Math.round(totPe / totCe * 100) / 100 : null, max_pain: mp,
      support: sup ? sup.k : null, resistance: res ? res.k : null,
      atm: atm.k, atm_ce: atm.ce_ltp, atm_pe: atm.pe_ltp,
      iv: ivs.length ? Math.round(ivs.reduce(function (a, b) { return a + b; }, 0) / ivs.length * 10) / 10 : null,
      straddle: straddle ? Math.round(straddle * 10) / 10 : null,
      chain: rows.slice(Math.max(0, i - 6), i + 7),
      otm_ce: rows[i + 1] ? rows[i + 1].ce_ltp : null, otm_pe: rows[i - 1] ? rows[i - 1].pe_ltp : null
    };
  }

  var LABEL_SCORE = { strong_positive: 0.7, positive: 0.4, neutral: 0, negative: -0.4, strong_negative: -0.7 };
  /** same logic as collector/collect.py fo_idea() */
  function idea(o, label, aiBias) {
    var s = o.spot;
    var pcrSig = o.pcr == null ? 0 : Math.max(-1, Math.min(1, (o.pcr - 1.0) / 0.4));
    var mpSig = o.max_pain ? Math.max(-1, Math.min(1, (o.max_pain - s) / (s * 0.01))) : 0;
    var b = (LABEL_SCORE[label] || 0) * 0.6 + pcrSig * 0.25 + mpSig * 0.15;
    if (aiBias === "bullish") b += 0.1; else if (aiBias === "bearish") b -= 0.1;
    var r = { score: Math.round(b * 100) / 100 }, prem = null;
    if (b >= 0.2) {
      prem = o.atm_ce;
      r.bias = "bullish"; r.action = "BUY_CE"; r.strike = o.atm; r.opt = "CE"; r.premium = prem;
      r.spread = { buy: o.atm, sell: o.resistance && o.resistance > o.atm ? o.resistance : o.atm + 2 * o.step };
      r.trigger = Math.round(s); r.target_level = o.resistance; r.stop_level = o.support;
    } else if (b <= -0.2) {
      prem = o.atm_pe;
      r.bias = "bearish"; r.action = "BUY_PE"; r.strike = o.atm; r.opt = "PE"; r.premium = prem;
      r.spread = { buy: o.atm, sell: o.support && o.support < o.atm ? o.support : o.atm - 2 * o.step };
      r.trigger = Math.round(s); r.target_level = o.support; r.stop_level = o.resistance;
    } else {
      r.bias = "neutral"; r.action = "WAIT"; r.trigger_up = o.resistance; r.trigger_down = o.support;
    }
    if (prem) { r.sl_premium = Math.round(prem * 0.7 * 10) / 10; r.target_premium = Math.round(prem * 1.5 * 10) / 10; }
    r.confidence = Math.abs(b) >= 0.45 ? "medium" : "low";
    return r;
  }

  /** loads expiries (cached) + chain for one index. returns metrics with .time/.source/.expiries */
  var expCache = {};
  function options(key, expiry, spotHint) {
    var cfg = OPT[key];
    if (!cfg) return Promise.reject(new Error("unknown index"));
    var expP = expCache[key] ? Promise.resolve(expCache[key]) :
      (cfg.ex === "NSE" ? nseExpiries(cfg.sym) : bseExpiries(cfg.scrip)).then(function (e) { if (e.length) expCache[key] = e; return e; });
    return expP.then(function (exps) {
      var exp = expiry && exps.indexOf(expiry) >= 0 ? expiry : exps[0];
      if (!exp) throw new Error("no expiry list");
      var chainP = cfg.ex === "NSE" ? nseChain(cfg.sym, exp) : bseChain(cfg.scrip, exp);
      return chainP.then(function (ch) {
        var m = metrics(cfg, ch, spotHint);
        m.expiries = exps.slice(0, 8);
        m.time = ch.time;               // exchange timestamp (NSE) if given
        m.fetched_at = new Date().toISOString();
        m.source = cfg.ex;
        return m;
      });
    });
  }

  window.MMLive = {
    available: !!(NATIVE && NATIVE.http),
    indices: indices,
    options: options,
    idea: idea,
    OPT: OPT,
    _test: { metrics: metrics, bseChain: bseChain, arrays: arrays }
  };
})();
