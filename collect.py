#!/usr/bin/env python3
"""
M-Market data collector.
Runs on GitHub Actions. Collects finance news (English / Hindi / Global),
global & Indian market numbers, analyses impact (rule-based + optional Gemini AI)
and writes  <out>/latest.json  that the Android app reads.

Usage:  python collector/collect.py --out out
Env:    GEMINI_API_KEY (optional), GEMINI_MODELS (optional, comma list),
        AI_MIN_INTERVAL_MIN (optional, default 120)
"""
import argparse
import hashlib
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import requests

try:
    import feedparser
except ImportError:  # pragma: no cover
    feedparser = None

HERE = os.path.dirname(os.path.abspath(__file__))
IST = timezone(timedelta(hours=5, minutes=30))
UA = ("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")
HTTP = requests.Session()
HTTP.headers.update({"User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8"})

KEEP_HOURS = 48
MAX_NEWS = 300

# --------------------------------------------------------------------------
# Sentiment lexicon (English + Hindi). weight: + positive, - negative
# --------------------------------------------------------------------------
LEX = {
    # strong positive
    "surge": 2, "surges": 2, "soar": 2, "soars": 2, "rally": 2, "rallies": 2, "skyrocket": 2,
    "record high": 2, "all-time high": 2, "jumps": 2, "zooms": 2, "upgrade": 2, "upgraded": 2,
    "beats estimates": 2, "beat estimates": 2, "bumper": 2, "multibagger": 1, "blockbuster": 2,
    "rate cut": 1.5, "order win": 2, "bags order": 2, "wins order": 2, "secures order": 2,
    # mild positive
    "gain": 1, "gains": 1, "rise": 1, "rises": 1, "up ": 0.5, "higher": 1, "climbs": 1, "advance": 1,
    "profit rises": 2, "profit jumps": 2, "net profit up": 2, "growth": 1, "strong": 1, "robust": 1,
    "buy": 1, "outperform": 1.5, "bullish": 1.5, "positive": 1, "recovery": 1, "rebound": 1.5,
    "rebounds": 1.5, "approval": 1, "approves": 1, "dividend": 1, "bonus": 1, "buyback": 1.5,
    "expansion": 1, "inflows": 1, "fii buying": 1.5, "optimism": 1, "green": 0.5, "boost": 1,
    "jump": 1.5, "hits record": 2, "upbeat": 1, "cheer": 1, "soft landing": 1,
    "steady": 0.3, "stable": 0.3, "cools": 0.5, "eases": 0.5, "easing": 0.5, "deal": 0.5,
    # strong negative
    "crash": -2, "crashes": -2, "plunge": -2, "plunges": -2, "tank": -2, "tanks": -2, "slump": -2,
    "slumps": -2, "tumble": -2, "tumbles": -2, "bloodbath": -2.5, "sell-off": -2, "selloff": -2,
    "downgrade": -2, "downgraded": -2, "misses estimates": -2, "fraud": -2.5, "raid": -2,
    "probe": -1.5, "default": -2, "bankruptcy": -2.5, "insolvency": -2, "lower circuit": -2,
    "loss widens": -2, "profit falls": -2, "profit drops": -2, "net loss": -1.5, "ban": -1.5,
    "penalty": -1.5, "war": -1.5, "recession": -2, "tariff": -1, "tariffs": -1, "sanctions": -1.5,
    # mild negative
    "fall": -1, "falls": -1, "drop": -1, "drops": -1, "decline": -1, "declines": -1, "lower": -0.5,
    "slips": -1, "dips": -1, "down ": -0.5, "weak": -1, "weakness": -1, "sell": -0.8, "bearish": -1.5,
    "negative": -1, "concern": -1, "concerns": -1, "worries": -1, "fear": -1, "fears": -1,
    "volatile": -0.5, "volatility": -0.5, "outflows": -1, "fii selling": -1.5, "pressure": -0.8,
    "inflation": -0.5, "rate hike": -1.5, "red": -0.5, "slowdown": -1.5, "cut target": -1.5,
    "tension": -1, "tensions": -1, "conflict": -1.2, "attack": -1.2, "disappoints": -1.2,
    "underperform": -1.5, "resigns": -1, "layoffs": -1, "strike": -0.8, "uncertainty": -1,
    # Hindi
    "तेजी": 1.5, "उछाल": 2, "रिकॉर्ड": 1, "बढ़त": 1, "मजबूत": 1, "मुनाफा बढ़ा": 2, "खरीदारी": 1,
    "खरीदें": 1, "लाभ": 1, "ग्रीन": 0.5, "रैली": 1.5, "ऑर्डर मिला": 2, "डिविडेंड": 1, "बोनस": 1,
    "गिरावट": -1.5, "गिरा": -1, "गिरे": -1, "टूटा": -1.5, "टूटे": -1.5, "धड़ाम": -2, "कमजोर": -1,
    "बिकवाली": -1.5, "घाटा": -1.5, "नुकसान": -1.5, "मुनाफा घटा": -2, "दबाव": -1, "लाल निशान": -1,
    "हरे निशान": 1, "मंदी": -1.5, "चिंता": -1, "डर": -1, "छापा": -2, "जुर्माना": -1.5, "क्रैश": -2,
}
NEGATORS = ["not ", "no ", "despite ", "नहीं"]


def now_utc():
    return datetime.now(timezone.utc)


def log(*a):
    print("[collect]", *a, file=sys.stderr, flush=True)


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


# --------------------------------------------------------------------------
# News
# --------------------------------------------------------------------------
def clean_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"&nbsp;|&#160;", " ", s)
    s = re.sub(r"&amp;", "&", s)
    s = re.sub(r"&quot;|&#39;|&rsquo;|&lsquo;", "'", s)
    return re.sub(r"\s+", " ", s).strip()


def parse_date(entry):
    for key in ("published_parsed", "updated_parsed"):
        t = entry.get(key)
        if t:
            try:
                return datetime(*t[:6], tzinfo=timezone.utc)
            except Exception:
                pass
    for key in ("published", "updated"):
        v = entry.get(key)
        if v:
            try:
                d = parsedate_to_datetime(v)
                return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
            except Exception:
                pass
    return None


def norm_title(t):
    t = re.sub(r"\s+-\s+[^-]{2,40}$", "", t)  # Google News "Title - Source"
    return re.sub(r"[^\wऀ-ॿ]+", " ", t.lower()).strip()


FIN_RX = re.compile(
    r"(share|stock|market|sensex|nifty|ipo|profit|revenue|earning|quarter|q[1-4]|fii|dii|sebi|rbi|"
    r"rupee|crude|gold|bond|yield|inflation|gdp|fed|tariff|dividend|bank|fund|invest|trade|economy|"
    r"शेयर|बाजार|बाज़ार|सेंसेक्स|निफ्टी|स्टॉक|आईपीओ|मुनाफा|मुनाफ़ा|कंपनी|निवेश|रुपया|रुपये|सोना|चांदी|क्रूड|"
    r"बैंक|फंड|डिविडेंड|तिमाही|नतीजे|कारोबार|अर्थव्यवस्था|महंगाई|आरबीआई|सेबी|टैरिफ)", re.I)


def fetch_feed(feed):
    for attempt in range(3):
        r = HTTP.get(feed["url"], timeout=25)
        if r.status_code in (429, 502, 503) and attempt < 2:
            time.sleep(6 * (attempt + 1))
            continue
        break
    r.raise_for_status()
    parsed = feedparser.parse(r.content)
    out = []
    for e in parsed.entries[:60]:
        title = clean_html(e.get("title", ""))
        if not title:
            continue
        src = feed["name"]
        if "news.google.com" in feed["url"]:
            m = re.search(r"\s+-\s+([^-]{2,40})$", title)
            if m:
                src = m.group(1).strip()
                title = title[: m.start()].strip()
        if feed.get("filter") and not FIN_RX.search(title):
            continue
        out.append({
            "title": title,
            "desc": clean_html(e.get("summary", ""))[:400],
            "link": e.get("link", ""),
            "source": src,
            "feed": feed["name"],
            "lang": feed.get("lang", "en"),
            "region": feed.get("region", "india"),
            "published": (parse_date(e) or now_utc()).isoformat(),
        })
    return out


_LEX_RX = []
for _w, _v in LEX.items():
    if re.search(r"[\u0900-\u097F]", _w):
        _LEX_RX.append((re.compile(re.escape(_w)), _v))
    else:
        _LEX_RX.append((re.compile(r"(?<![a-z0-9])" + re.escape(_w.strip()) + r"(?![a-z0-9])"), _v))


_INVERSE_RX = re.compile(r"(?<![a-z])(crude|oil price|oil prices|brent|bond yield|treasury yield|dollar index|"
                         r"us yields|inflation|कच्चा तेल|क्रूड)(?![a-z])")
_INDIA_RX = re.compile(r"(?<![a-z])(sensex|nifty|shares of|stock of|सेंसेक्स|निफ्टी)(?![a-z])")


def sentiment(text):
    t = " " + text.lower() + " "
    score = 0.0
    hits = 0
    for rx, w in _LEX_RX:
        m = rx.search(t)
        if m:
            pre = t[max(0, m.start() - 12): m.start()]
            if any(n in pre for n in NEGATORS):
                w = -w * 0.5
            score += w
            hits += 1
    if hits == 0:
        return 0.0
    # rising crude / dollar / yields is bad for India even if the words sound "positive"
    if _INVERSE_RX.search(t) and not _INDIA_RX.search(t):
        score = -score
    return max(-1.0, min(1.0, score / 3.0))


def build_matchers(stocks_cfg):
    stocks = []
    for sym, name, sector, aliases in stocks_cfg["stocks"]:
        pats = []
        for a in aliases:
            a = a.lower()
            if re.search(r"[ऀ-ॿ]", a):
                pats.append(re.compile(re.escape(a.strip())))
            else:
                pats.append(re.compile(r"(?<![a-z0-9])" + re.escape(a.strip()) + r"(?![a-z0-9])"))
        stocks.append({"sym": sym, "name": name, "sector": sector, "pats": pats})
    sectors = {s: [k.lower() for k in kws] for s, kws in stocks_cfg.get("sector_keywords", {}).items()}
    return stocks, sectors


def tag_item(item, stocks, sector_kw):
    text = (item["title"] + " " + item.get("desc", "")).lower()
    title = item["title"].lower()
    syms, secs = [], set()
    for s in stocks:
        if any(p.search(title) for p in s["pats"]) or (
                len(syms) < 3 and any(p.search(text) for p in s["pats"])):
            if s["sym"] not in syms:
                syms.append(s["sym"])
                secs.add(s["sector"])
    for sec, kws in sector_kw.items():
        if any(k in text for k in kws):
            secs.add(sec)
    item["symbols"] = syms[:5]
    item["sectors"] = sorted(secs)
    # title counts double
    item["sent"] = round(max(-1, min(1, sentiment(item["title"]) * 0.75 + sentiment(text) * 0.25)), 3)


def item_id(title):
    return hashlib.md5(norm_title(title).encode("utf-8")).hexdigest()[:12]


def collect_news(sources, prev, stocks, sector_kw):
    status = []
    fresh = []
    for feed in sources["feeds"]:
        t0 = time.time()
        try:
            items = fetch_feed(feed)
            fresh.extend(items)
            status.append({"name": feed["name"], "ok": True, "count": len(items),
                           "ms": int((time.time() - t0) * 1000)})
            if "news.google.com" in feed["url"]:
                time.sleep(2)  # Google News rate-limits fast repeated calls
        except Exception as e:  # keep going
            status.append({"name": feed["name"], "ok": False, "error": str(e)[:120]})
            log("feed failed", feed["name"], e)

    by_id = {}
    # previous items first (keeps AI analysis), then fresh ones override basic fields
    for it in prev.get("news", []):
        by_id[it["id"]] = it
    for it in fresh:
        iid = item_id(it["title"])
        old = by_id.get(iid)
        it["id"] = iid
        if old:
            for k in ("ai_impact", "ai_gu", "ai_symbols", "published"):
                if k in old:
                    it[k] = old[k]
        by_id[iid] = it

    cutoff = now_utc() - timedelta(hours=KEEP_HOURS)
    news = []
    for it in by_id.values():
        try:
            pub = datetime.fromisoformat(it["published"])
        except Exception:
            pub = now_utc()
        if pub > now_utc() + timedelta(hours=1):
            pub = now_utc()
            it["published"] = pub.isoformat()
        if pub < cutoff:
            continue
        tag_item(it, stocks, sector_kw)
        news.append(it)
    news.sort(key=lambda x: x["published"], reverse=True)
    return news[:MAX_NEWS], status


# --------------------------------------------------------------------------
# Markets: NSE (India + sectors) -> Yahoo (batch, with cookie/crumb) -> Stooq
# Yahoo often rate-limits GitHub servers, so several sources are tried.
# --------------------------------------------------------------------------
NSE_NAMES = {  # our name -> NSE allIndices "index"
    "Nifty 50": "NIFTY 50", "Bank Nifty": "NIFTY BANK", "India VIX": "INDIA VIX",
    "IT": "NIFTY IT", "Banking": "NIFTY BANK", "Auto": "NIFTY AUTO", "Pharma": "NIFTY PHARMA",
    "FMCG": "NIFTY FMCG", "Metal": "NIFTY METAL", "Realty": "NIFTY REALTY", "Energy": "NIFTY ENERGY",
    "PSU Bank": "NIFTY PSU BANK", "Media": "NIFTY MEDIA", "Financial Services": "NIFTY FINANCIAL SERVICES",
}
STOOQ = {  # yahoo symbol -> stooq symbol
    "^GSPC": "^spx", "^IXIC": "^ndq", "^DJI": "^dji", "^N225": "^nkx", "^HSI": "^hsi",
    "^FTSE": "^ukx", "^GDAXI": "^dax", "ES=F": "es.f", "NQ=F": "nq.f", "YM=F": "ym.f",
    "BZ=F": "cb.f", "GC=F": "gc.f", "INR=X": "usdinr", "DX-Y.NYB": "dx.f", "^TNX": "10usy.b",
    "^BSESN": "^sensex",
}


def _q(price, prev, ts=None, closes=None):
    if price is None or not prev:
        return None
    return {"price": round(float(price), 4), "prev": round(float(prev), 4),
            "pct": round((float(price) - float(prev)) / float(prev) * 100, 2),
            "time": ts or now_utc().isoformat(), "spark": [round(c, 2) for c in (closes or [])[-5:]]}


def nse_indices():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept": "application/json",
                      "Referer": "https://www.nseindia.com/market-data/live-market-indices"})
    s.get("https://www.nseindia.com/", timeout=15)
    r = s.get("https://www.nseindia.com/api/allIndices", timeout=15)
    r.raise_for_status()
    out = {}
    for row in r.json().get("data", []):
        q = _q(row.get("last"), row.get("previousClose"))
        if q:
            out[row.get("index", "").upper()] = q
    return out


def yahoo_batch(symbols):
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    crumb = ""
    try:
        s.get("https://fc.yahoo.com", timeout=10)
        c = s.get("https://query2.finance.yahoo.com/v1/test/getcrumb", timeout=10)
        if c.status_code == 200 and len(c.text) < 40:
            crumb = c.text.strip()
    except Exception:
        pass
    out = {}
    for i in range(0, len(symbols), 20):
        chunk = symbols[i:i + 20]
        params = {"symbols": ",".join(chunk), "range": "5d", "interval": "1d"}
        if crumb:
            params["crumb"] = crumb
        r = s.get("https://query2.finance.yahoo.com/v7/finance/spark", params=params, timeout=20)
        r.raise_for_status()
        js = r.json()
        rows = js.get("spark", {}).get("result") if isinstance(js.get("spark"), dict) else None
        if rows:  # old shape
            for row in rows:
                resp = (row.get("response") or [{}])[0]
                meta = resp.get("meta", {})
                closes = [c for c in (resp.get("indicators", {}).get("quote", [{}])[0].get("close") or []) if c]
                price = meta.get("regularMarketPrice") or (closes[-1] if closes else None)
                prev = closes[-2] if len(closes) >= 2 else meta.get("chartPreviousClose")
                ts = meta.get("regularMarketTime")
                q = _q(price, prev, datetime.fromtimestamp(ts, timezone.utc).isoformat() if ts else None, closes)
                if q:
                    out[row.get("symbol")] = q
        else:  # new shape: {"SYM": {"close": [...], "timestamp": [...], "chartPreviousClose": x}}
            for sym, row in js.items():
                if not isinstance(row, dict):
                    continue
                closes = [c for c in (row.get("close") or []) if c]
                ts = (row.get("timestamp") or [None])[-1]
                q = _q(closes[-1] if closes else None, closes[-2] if len(closes) >= 2 else row.get("chartPreviousClose"),
                       datetime.fromtimestamp(ts, timezone.utc).isoformat() if ts else None, closes)
                if q:
                    out[sym] = q
        time.sleep(1)
    return out


def stooq_quote(sym):
    r = HTTP.get("https://stooq.com/q/d/l/", params={"s": sym, "i": "d"}, timeout=15)
    r.raise_for_status()
    lines = [l for l in r.text.strip().splitlines() if l and l[0].isdigit()]
    if len(lines) < 2:
        raise ValueError("no data")
    last, prev = lines[-1].split(","), lines[-2].split(",")
    closes = [float(l.split(",")[4]) for l in lines[-5:]]
    return _q(float(last[4]), float(prev[4]), last[0] + "T16:00:00+00:00", closes)


def collect_markets(sources, prev_markets=None):
    out, status = {}, []
    got = {}  # yahoo symbol -> quote
    # 1) NSE for Indian indices & sectors
    nse = {}
    try:
        nse = nse_indices()
        status.append({"name": "NSE indices", "ok": True, "count": len(nse)})
    except Exception as e:
        status.append({"name": "NSE indices", "ok": False, "error": str(e)[:100]})
        log("nse failed", e)
    all_items = [(g, m) for g, lst in sources["markets"].items() for m in lst]
    for g, m in all_items:
        key = NSE_NAMES.get(m["name"])
        if key and key in nse:
            got[m["sym"]] = nse[key]
    # 2) Yahoo batch for the rest
    need = sorted({m["sym"] for _, m in all_items if m["sym"] not in got})
    if need:
        try:
            y = yahoo_batch(need)
            got.update({k: v for k, v in y.items() if k in need})
            status.append({"name": "Yahoo Finance", "ok": bool(y), "count": len(y)})
        except Exception as e:
            status.append({"name": "Yahoo Finance", "ok": False, "error": str(e)[:100]})
            log("yahoo failed", e)
    # 3) Stooq for whatever is still missing
    need = [s for s in need if s not in got and s in STOOQ]
    if need:
        n_ok, err = 0, ""
        for sym in need:
            try:
                q = stooq_quote(STOOQ[sym])
                if q:
                    got[sym] = q
                    n_ok += 1
            except Exception as e:
                err = str(e)[:100]
            time.sleep(0.3)
        status.append({"name": "Stooq", "ok": n_ok > 0, "count": n_ok, **({"error": err} if not n_ok else {})})
    # 4) keep last known value (marked stale) for anything still missing
    prev_by_sym = {q["sym"]: q for lst in (prev_markets or {}).values() for q in lst}
    missing = []
    for g, lst in sources["markets"].items():
        out[g] = []
        for m in lst:
            q = got.get(m["sym"])
            if q:
                q = dict(q)
            elif m["sym"] in prev_by_sym:
                q = dict(prev_by_sym[m["sym"]])
                q["stale"] = True
            else:
                missing.append(m["name"])
                continue
            q.update({"sym": m["sym"], "name": m["name"], "w": m.get("w", 0)})
            out[g].append(q)
    if missing:
        status.append({"name": "ભાવ ન મળ્યા", "ok": False, "error": ", ".join(missing)[:150]})
    return out, status


def collect_fii_dii():
    """NSE often blocks cloud IPs; this is best-effort."""
    try:
        s = requests.Session()
        s.headers.update({"User-Agent": UA, "Accept": "application/json",
                          "Referer": "https://www.nseindia.com/reports/fii-dii"})
        s.get("https://www.nseindia.com/", timeout=15)
        r = s.get("https://www.nseindia.com/api/fiidiiTradeReact", timeout=15)
        r.raise_for_status()
        data = r.json()
        out = []
        for row in data:
            out.append({"category": row.get("category"), "date": row.get("date"),
                        "buy": row.get("buyValue"), "sell": row.get("sellValue"),
                        "net": row.get("netValue")})
        return out
    except Exception as e:
        log("fii/dii failed", e)
        return None


# --------------------------------------------------------------------------
# Rule based outlook
# --------------------------------------------------------------------------
def next_weekday(d):
    d = d + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def target_session(now_ist):
    t = now_ist.hour * 60 + now_ist.minute
    if now_ist.weekday() < 5 and t < 9 * 60 + 15:
        return now_ist.date(), "pre"
    if now_ist.weekday() < 5 and t < 15 * 60 + 30:
        return now_ist.date(), "live"
    return next_weekday(now_ist.date()), "closed"


def fmt_pct(p):
    return f"{p:+.2f}%"


def global_score(markets):
    num, den, reasons = 0.0, 0.0, []
    for grp in ("global", "macro"):
        for q in markets.get(grp, []):
            w, p = q.get("w", 0), q.get("pct")
            if not w or p is None or q.get("stale"):
                continue
            num += w * max(-3, min(3, p))
            den += abs(w)
    score = num / den if den else 0.0

    def get(name):
        for grp in ("global", "macro", "india"):
            for q in markets.get(grp, []):
                if q["name"] == name and q.get("pct") is not None:
                    return q["pct"]
        return None

    fut = get("S&P 500 Futures")
    if fut is not None and abs(fut) >= 0.15:
        reasons.append(("pos" if fut > 0 else "neg",
                        f"અમેરિકન ફ્યુચર્સ (S&P) {fmt_pct(fut)} — {'પોઝિટિવ' if fut > 0 else 'નેગેટિવ'} સંકેત"))
    asia = [p for p in (get("Nikkei 225"), get("Hang Seng")) if p is not None]
    if asia:
        a = sum(asia) / len(asia)
        if abs(a) >= 0.3:
            reasons.append(("pos" if a > 0 else "neg",
                            f"એશિયન બજારો સરેરાશ {fmt_pct(a)} — {'સપોર્ટ' if a > 0 else 'દબાણ'}"))
    crude = get("Brent Crude")
    if crude is not None and abs(crude) >= 1:
        reasons.append(("neg" if crude > 0 else "pos",
                        f"ક્રૂડ ઓઇલ {fmt_pct(crude)} — ભારત માટે {'નેગેટિવ (આયાત ખર્ચ વધે)' if crude > 0 else 'પોઝિટિવ'}"))
    inr = get("USD/INR")
    if inr is not None and abs(inr) >= 0.15:
        reasons.append(("neg" if inr > 0 else "pos",
                        f"રૂપિયો {'નબળો' if inr > 0 else 'મજબૂત'} (USD/INR {fmt_pct(inr)})"))
    tnx = get("US 10Y Yield")
    if tnx is not None and abs(tnx) >= 1.5:
        reasons.append(("neg" if tnx > 0 else "pos",
                        f"US બોન્ડ યીલ્ડ {fmt_pct(tnx)} — {'FII વેચવાલીનો ડર' if tnx > 0 else 'FII માટે સારું'}"))
    vix = get("India VIX")
    if vix is not None and abs(vix) >= 5:
        reasons.append(("neg" if vix > 0 else "pos",
                        f"India VIX {fmt_pct(vix)} — {'અસ્થિરતા વધી' if vix > 0 else 'ડર ઘટ્યો'}"))
    return score, reasons


def news_score(news, hours=18):
    cutoff = now_utc() - timedelta(hours=hours)
    vals = []
    for it in news:
        try:
            pub = datetime.fromisoformat(it["published"])
        except Exception:
            continue
        if pub < cutoff:
            continue
        s = it.get("ai_impact")
        s = (s / 2.0) if isinstance(s, (int, float)) else it.get("sent", 0)
        if s == 0:
            continue
        w = 1.0 + (0.5 if it["region"] == "india" else 0) + (0.3 if it.get("symbols") else 0)
        vals.append((s, w))
    if not vals:
        return 0.0, 0, 0, 0
    tot = sum(w for _, w in vals)
    avg = sum(s * w for s, w in vals) / tot
    pos = sum(1 for s, _ in vals if s > 0)
    neg = sum(1 for s, _ in vals if s < 0)
    return avg, pos, neg, len(vals)


def label_for(score):
    if score >= 0.45:
        return "strong_positive"
    if score >= 0.12:
        return "positive"
    if score <= -0.45:
        return "strong_negative"
    if score <= -0.12:
        return "negative"
    return "neutral"


def rule_outlook(news, markets):
    gs, reasons = global_score(markets)
    ns, pos, neg, n = news_score(news)
    g_norm = math.tanh(gs / 0.7)
    combined = 0.6 * g_norm + 0.4 * ns
    if n:
        pct_pos = round(pos / n * 100)
        reasons.append(("pos" if ns > 0.05 else "neg" if ns < -0.05 else "neu",
                        f"છેલ્લા 18 કલાકના {n} સમાચારમાંથી {pct_pos}% પોઝિટિવ, {round(neg / n * 100)}% નેગેટિવ"))
    agree = (g_norm > 0) == (ns > 0)
    data_ok = sum(1 for g in ("global", "macro") for q in markets.get(g, []) if q.get("pct") is not None)
    conf = "medium" if (agree and abs(combined) > 0.25 and data_ok >= 8 and n >= 20) else "low"
    return {
        "score": round(combined, 3),
        "label": label_for(combined),
        "confidence": conf,
        "global_score": round(g_norm, 3),
        "news_score": round(ns, 3),
        "reasons": [{"type": t, "text": x} for t, x in reasons],
    }


def sector_view(news, markets):
    idx = {q["name"]: q for q in markets.get("sectors", [])}
    agg = {}
    for it in news:
        s = it.get("ai_impact")
        s = (s / 2.0) if isinstance(s, (int, float)) else it.get("sent", 0)
        for sec in it.get("sectors", []):
            a = agg.setdefault(sec, {"sum": 0.0, "n": 0})
            a["sum"] += s
            a["n"] += 1
    names = set(agg) | set(idx)
    out = []
    for name in names:
        a = agg.get(name, {"sum": 0, "n": 0})
        q = idx.get(name, {})
        out.append({
            "sector": name,
            "pct": q.get("pct"),
            "news_count": a["n"],
            "news_sent": round(a["sum"] / a["n"], 3) if a["n"] else 0,
        })
    out.sort(key=lambda x: (-(x["news_count"]), x["sector"]))
    return out


def stock_summary(news, stocks_cfg):
    meta = {s[0]: {"name": s[1], "sector": s[2]} for s in stocks_cfg["stocks"]}
    agg = {}
    for i, it in enumerate(news):
        s = it.get("ai_impact")
        s = (s / 2.0) if isinstance(s, (int, float)) else it.get("sent", 0)
        for sym in it.get("symbols", []):
            a = agg.setdefault(sym, {"sum": 0.0, "n": 0})
            a["sum"] += s
            a["n"] += 1
    out = []
    for sym, a in agg.items():
        m = meta.get(sym, {"name": sym, "sector": ""})
        out.append({"sym": sym, "name": m["name"], "sector": m["sector"],
                    "news_count": a["n"], "sent": round(a["sum"] / a["n"], 3)})
    out.sort(key=lambda x: -x["news_count"])
    return out


# --------------------------------------------------------------------------
# Gemini AI (optional)
# --------------------------------------------------------------------------
AI_PROMPT = """You are an experienced Indian stock-market analyst. Below are the latest
financial headlines (Indian English, Hindi and global) and a market data snapshot.
Current time (IST): {now}. The session being forecast: {session} ({phase}).

Market snapshot (daily % change):
{snapshot}

Headlines (index | region | source | title):
{headlines}

Return ONLY JSON with this exact shape. All *_gu fields must be in simple Gujarati.
{{
  "summary_gu": "4-6 short sentences: what happened, what global cues say, what to expect",
  "outlook": {{"label": "strong_positive|positive|neutral|negative|strong_negative",
               "confidence": "low|medium|high",
               "reasons_gu": ["3-6 short reasons"]}},
  "global_gu": "2-3 sentences on global markets and their likely effect on India",
  "sectors": [{{"sector": "IT|Banking|PSU Bank|Auto|Pharma|FMCG|Metal|Energy|Realty|Power|Defence|Railway|Telecom|Cement|Aviation|Financial Services|Infra|Consumer|Media",
                "view": "positive|neutral|negative", "reason_gu": "one line"}}],
  "items": [{{"i": 0, "impact": -2, "symbols": ["NSE symbols"], "gu": "one-line Gujarati meaning & impact"}}],
  "watch": [{{"symbol": "NSE symbol", "view": "positive|negative", "reason_gu": "why it is in focus"}}]
}}
Rules: impact is -2..+2 for Indian stock market / the named company (0 = no market impact).
Include "items" for every headline that matters (skip pure noise). Be balanced and factual;
never give buy/sell advice; this is an informational outlook only."""


def ai_snapshot(markets):
    lines = []
    for grp in ("india", "global", "macro", "sectors"):
        for q in markets.get(grp, []):
            if q.get("pct") is not None:
                lines.append(f"{grp}: {q['name']} {q['pct']:+.2f}% (last {q['price']})")
    return "\n".join(lines) or "(no market data)"


def call_gemini(prompt, key, models):
    last_err = None
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"}}
        try:
            r = requests.post(url, json=body, headers={"x-goog-api-key": key}, timeout=120)
            if r.status_code != 200:
                last_err = f"{model}: HTTP {r.status_code} {r.text[:200]}"
                log("gemini", last_err)
                continue
            data = r.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            text = text.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(text), model
        except Exception as e:
            last_err = f"{model}: {e}"
            log("gemini error", last_err)
    raise RuntimeError(last_err or "gemini failed")


def run_ai(news, markets, prev, session, phase, now_ist):
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    prev_ai = prev.get("ai")
    if not key:
        return None, "no_key"
    interval = int(os.environ.get("AI_MIN_INTERVAL_MIN", "120") or 120)
    force = os.environ.get("AI_FORCE", "") == "1"
    if prev_ai and prev_ai.get("generated_at") and not force:
        try:
            age = (now_utc() - datetime.fromisoformat(prev_ai["generated_at"])).total_seconds() / 60
            same_session = prev_ai.get("session") == str(session)
            if age < interval and same_session:
                return prev_ai, "reused"
        except Exception:
            pass
    models = [m.strip() for m in (os.environ.get("GEMINI_MODELS") or
                                       "gemini-flash-latest,gemini-2.5-flash,gemini-flash-lite-latest").split(",") if m.strip()]
    pick = news[:90]
    heads = "\n".join(f"{i} | {it['region']} | {it['source']} | {it['title']}" for i, it in enumerate(pick))
    prompt = AI_PROMPT.format(now=now_ist.strftime("%d %b %Y %H:%M"), session=session,
                              phase=phase, snapshot=ai_snapshot(markets), headlines=heads)
    try:
        res, model = call_gemini(prompt, key, models)
    except Exception as e:
        return prev_ai, f"error: {str(e)[:150]}"
    for row in res.get("items", []) or []:
        try:
            i = int(row.get("i"))
            if 0 <= i < len(pick):
                it = pick[i]
                it["ai_impact"] = max(-2, min(2, int(row.get("impact", 0))))
                if row.get("gu"):
                    it["ai_gu"] = str(row["gu"])[:300]
                if row.get("symbols"):
                    it["ai_symbols"] = [str(s).upper() for s in row["symbols"]][:5]
        except Exception:
            continue
    res.pop("items", None)
    res["generated_at"] = now_utc().isoformat()
    res["session"] = str(session)
    res["model"] = model
    return res, "ok"


# --------------------------------------------------------------------------
# Track record: what we said vs what Nifty did
# --------------------------------------------------------------------------
def update_history(prev, outlook, ai, markets, session, phase, now_ist):
    hist = prev.get("history", {})
    key = str(session)
    final_label = (ai or {}).get("outlook", {}).get("label") if ai else None
    entry = hist.get(key, {})
    # freeze the forecast at market open (we only update while it is still a forecast)
    if phase in ("closed", "pre") or "rule" not in entry:
        entry["rule"] = outlook["label"]
        if final_label:
            entry["ai"] = final_label
    # record actual Nifty move once the session is running/closed
    today = now_ist.date()
    for q in markets.get("india", []):
        if q["name"] == "Nifty 50" and q.get("pct") is not None and q.get("time"):
            qdate = datetime.fromisoformat(q["time"]).astimezone(IST).date()
            if str(qdate) in hist or str(qdate) == key:
                e = hist.setdefault(str(qdate), {})
                if qdate <= today:
                    e["actual"] = q["pct"]
    hist[key] = entry
    # keep last 40 sessions
    for k in sorted(hist)[:-40]:
        hist.pop(k, None)
    return hist


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    out_file = os.path.join(args.out, "latest.json")

    if feedparser is None:
        log("feedparser missing: pip install feedparser")
        sys.exit(1)

    sources = load_json(os.path.join(HERE, "sources.json"), {})
    stocks_cfg = load_json(os.path.join(HERE, "stocks.json"), {"stocks": []})
    prev = load_json(out_file, {})
    stocks, sector_kw = build_matchers(stocks_cfg)

    now_ist = now_utc().astimezone(IST)
    session, phase = target_session(now_ist)

    news, feed_status = collect_news(sources, prev, stocks, sector_kw)
    markets, mkt_status = collect_markets(sources, prev.get("markets"))
    fii = collect_fii_dii() or prev.get("fii_dii")

    ai, ai_status = run_ai(news, markets, prev, session, phase, now_ist)
    outlook = rule_outlook(news, markets)  # after AI so it can use ai_impact

    data = {
        "app": "M-Market",
        "schema": 1,
        "generated_at": now_utc().isoformat(),
        "session": {"date": str(session), "phase": phase},
        "outlook": outlook,
        "ai": ai,
        "ai_status": ai_status,
        "markets": markets,
        "fii_dii": fii,
        "sectors": sector_view(news, markets),
        "stocks": stock_summary(news, stocks_cfg),
        "stock_list": [[s[0], s[1], s[2]] for s in stocks_cfg["stocks"]],
        "news": news,
        "sources": feed_status + mkt_status,
    }
    data["history"] = update_history(prev, outlook, ai, markets, session, phase, now_ist)

    tmp = out_file + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, out_file)
    ok = sum(1 for s in feed_status if s["ok"])
    log(f"done: {len(news)} news, {ok}/{len(feed_status)} feeds ok, ai={ai_status}, "
        f"outlook={outlook['label']} ({outlook['score']})")


if __name__ == "__main__":
    main()
