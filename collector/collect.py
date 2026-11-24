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


EXPLAIN_RX = re.compile(
    r"(explainer|explained|what is|what are|how to|how does|why is|why are|guide to|faq|quiz|"
    r"live updates|live blog|stocks to watch|stocks to buy|क्या है|क्या होता|जानें|समझें|कैसे|एक्सप्लेनर|"
    r"लाइव अपडेट|देखें लिस्ट)", re.I)


METAL_RX = re.compile(r"(?<![a-z])(gold|silver|bullion|comex|सोना|सोने|चांदी|चाँदी|सर्राफा)(?![a-z])", re.I)


def tag_item(item, stocks, sector_kw):
    text = (item["title"] + " " + item.get("desc", "")).lower()
    item["metal"] = bool(METAL_RX.search(item["title"]))
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
    if EXPLAIN_RX.search(item["title"]):
        item["sent"] = 0.0  # explainers / how-to / live blogs carry no direction
        item["explainer"] = True
        return
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
            for k in ("ai_impact", "ai_gu", "ai_en", "ai_symbols", "published", "tr_gu", "tr_en"):
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
    "Fin Nifty": "NIFTY FINANCIAL SERVICES", "Midcap Select": "NIFTY MIDCAP SELECT",
    "Nifty Next 50": "NIFTY NEXT 50", "Nifty Midcap 100": "NIFTY MIDCAP 100", "Nifty Smallcap 100": "NIFTY SMALLCAP 100",
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


CNBC = {  # yahoo symbol -> CNBC quote symbol
    "^GSPC": ".SPX", "^IXIC": ".IXIC", "^DJI": ".DJI", "ES=F": "@SP.1", "NQ=F": "@ND.1", "YM=F": "@DJ.1",
    "^N225": ".N225", "^HSI": ".HSI", "^FTSE": ".FTSE", "^GDAXI": ".GDAXI", "BZ=F": "@LCO.1",
    "GC=F": "@GC.1", "INR=X": "INR=", "DX-Y.NYB": ".DXY", "^TNX": "US10Y", "^VIX": ".VIX",
    "^BSESN": [".BSESN", ".SENSEX", "SENSEX"], "BANKEX": [".BSEBANK", ".BANKEX", "BANKEX"],
    "SI=F": "@SI.1", "^NSEI": [".NSEI"], "^NSEBANK": [".NSEBANK"],
}


def _num(v):
    try:
        return float(str(v).replace(",", "").replace("%", "").replace("+", "").strip())
    except Exception:
        return None


def cnbc_batch(yahoo_syms):
    want = {}
    for ys in yahoo_syms:
        cands = CNBC.get(ys)
        for c in ([cands] if isinstance(cands, str) else (cands or [])):
            want[c] = ys
    if not want:
        return {}
    r = HTTP.get("https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol",
                 params={"symbols": "|".join(want), "requestMethod": "itv", "noform": "1",
                         "partnerId": "2", "fund": "1", "exthrs": "1", "output": "json", "events": "1"},
                 timeout=20)
    r.raise_for_status()
    rows = r.json().get("FormattedQuoteResult", {}).get("FormattedQuote", [])
    if isinstance(rows, dict):
        rows = [rows]
    out = {}
    for row in rows:
        ysym = want.get(row.get("symbol")) or want.get(row.get("altSymbol"))
        if ysym in out:
            continue
        last, prev = _num(row.get("last")), _num(row.get("previous_day_closing"))
        pct = _num(row.get("change_pct"))
        if ysym is None or last is None:
            continue
        if not prev and pct is not None and pct != -100:
            prev = last / (1 + pct / 100)
        q = _q(last, prev)
        if q:
            if pct is not None:
                q["pct"] = round(pct, 2)
            for k in ("open", "high", "low"):
                if _num(row.get(k)):
                    q[k] = _num(row.get(k))
            out[ysym] = q
    return out


GIFT_URLS = [
    "https://priceapi.moneycontrol.com/technicalCompanyData/globalMarket/getGlobalIndicesListingData?view=overview&deviceType=W",
    "https://priceapi.moneycontrol.com/technicalCompanyData/globalMarket/getGlobalIndicesListingData?view=ext&deviceType=W",
]


def _is_gift(txt):
    t = txt.upper()
    return ("GIFT" in t or "SGX" in t) and "NIFTY" in t


def _find_gift(js):
    """walk any JSON and return the GIFT Nifty quote as a dict.
    Handles both list-of-dicts feeds and 'header ids + rows as lists' feeds (Moneycontrol)."""
    header = None
    stack = [js]
    while stack:
        v = stack.pop()
        if isinstance(v, list) and v and all(isinstance(x, dict) and "id" in x for x in v):
            header = [str(x["id"]) for x in v]
        elif isinstance(v, dict):
            stack.extend(v.values())
        elif isinstance(v, list):
            stack.extend(v)
    stack = [js]
    while stack:
        v = stack.pop()
        if isinstance(v, dict):
            txt = " ".join(str(x) for x in v.values() if isinstance(x, str))
            if _is_gift(txt):
                return v
            stack.extend(v.values())
        elif isinstance(v, list):
            if v and all(not isinstance(x, (dict, list)) for x in v) and any(isinstance(x, str) and _is_gift(x) for x in v):
                if header and len(header) == len(v):
                    return dict(zip(header, v))
                return {f"c{i}": x for i, x in enumerate(v)}
            stack.extend(v)
    return None


def _names(js, limit=30):
    out, stack = [], [js]
    while stack and len(out) < limit:
        v = stack.pop()
        if isinstance(v, dict):
            for k, x in v.items():
                if isinstance(x, str) and k.lower() in ("name", "indexname", "index_name", "symbol", "shortname", "id", "sc_id"):
                    out.append(x[:20])
                elif isinstance(x, (dict, list)):
                    stack.append(x)
        elif isinstance(v, list):
            stack.extend(v)
    return out


def gift_nifty():
    errs = []
    for url in GIFT_URLS:
        try:
            r = HTTP.get(url, timeout=15)
            r.raise_for_status()
            js = r.json()
            row = _find_gift(js)
            if not row:
                errs.append("no GIFT row; sample: " + json.dumps(js)[:400])
                continue
            if "c2" in row and "c4" in row:   # Moneycontrol row: symbol,name,price,net_change,%change,high,low,open,prev_close,...
                row = {"price": row.get("c2"), "percent_change": row.get("c4"), "prev_close": row.get("c8")}
            price = _pick(row, ["lastprice", "ltp", "lastPrice", "price", "current", "last", "close", "lastValue"])
            pct = _pick(row, ["percent_change", "percentchange", "pchange", "chgper", "change_per", "perChange", "percChange", "changePercent", "chgPer"])
            prev = _pick(row, ["prev_close", "prevclose", "previousclose", "prevClose", "previousClose"])
            if price and not prev and pct is not None:
                prev = price / (1 + pct / 100)
            q = _q(price, prev)
            if q:
                return q
            errs.append("row: " + json.dumps(row)[:300])
        except Exception as e:
            errs.append(str(e)[:60])
    # fallback: Moneycontrol global-indices web page
    try:
        r = HTTP.get("https://www.moneycontrol.com/markets/global-indices/", timeout=20)
        r.raise_for_status()
        m = re.search(r"GIFT\s*NIFTY.{0,600}?([\d,]{5,}\.\d+).{0,400}?(-?[\d.]+)\s*%", r.text, re.S | re.I)
        if m:
            price, pct = _num(m.group(1)), _num(m.group(2))
            q = _q(price, price / (1 + pct / 100) if pct is not None else None)
            if q:
                return q
        errs.append(f"page: no match (len {len(r.text)})")
    except Exception as e:
        errs.append(f"page: {str(e)[:50]}")
    raise RuntimeError("; ".join(errs))


def _q(price, prev, ts=None, closes=None):
    if price is None or not prev:
        return None
    return {"price": round(float(price), 4), "prev": round(float(prev), 4),
            "pct": round((float(price) - float(prev)) / float(prev) * 100, 2),
            "time": ts or now_utc().isoformat(), "spark": [round(c, 2) for c in (closes or [])[-5:]]}


def nse_indices():
    s = nse_session()
    r = s.get("https://www.nseindia.com/api/allIndices", timeout=15)
    r.raise_for_status()
    out = {}
    for row in r.json().get("data", []):
        q = _q(row.get("last"), row.get("previousClose"))
        if q:
            for k in ("open", "high", "low"):
                if _num(row.get(k)):
                    q[k] = _num(row.get(k))
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


def _pick(d, keys):
    for k in keys:
        for kk, v in d.items():
            if kk.lower() == k.lower() and _num(v) is not None:
                return _num(v)
    return None


BSE_INDEX = {  # our symbol -> sources to try
    "^BSESN": {"bse": "SENSEX", "mc": ["in%3BSEN"], "google": "SENSEX:INDEXBOM"},
    "BANKEX": {"bse": "BANKEX", "mc": ["in%3BBKX", "in%3Bbkx", "in%3BBANKEX", "in%3Bbankex"], "google": "BANKEX:INDEXBOM"},
}


def bse_quote(sym):
    """BSE indices: BSE API -> Moneycontrol price feed -> Google Finance page."""
    cfg, errs = BSE_INDEX[sym], []
    try:
        s = requests.Session()
        s.headers.update({"User-Agent": UA, "Referer": "https://www.bseindia.com/",
                          "Origin": "https://www.bseindia.com", "Accept": "application/json, text/plain, */*"})
        try:
            s.get("https://www.bseindia.com/", timeout=10)
        except Exception:
            pass
        r = s.get("https://api.bseindia.com/BseIndiaAPI/api/GetSensexData/w", timeout=15)
        r.raise_for_status()
        js = r.json()
        rows = js if isinstance(js, list) else (js.get("Table") or js.get("data") or [js])
        row = next((x for x in rows if isinstance(x, dict) and cfg["bse"] in json.dumps(x).upper()), None)
        if row:
            price = _pick(row, ["ltp", "CurrValue", "Curvalue", "currentvalue", "last", "I_close", "Close"])
            prev = _pick(row, ["Prev_Close", "PrevClose", "prevclose", "previousclose", "Prev"])
            pct = _pick(row, ["perchg", "PerChange", "pchange", "chgper", "percentchange", "pChg"])
            if price and not prev and pct is not None:
                prev = price / (1 + pct / 100)
            q = _q(price, prev)
            if q:
                return q, "BSE"
        errs.append("bse: no row")
    except Exception as e:
        errs.append(f"bse: {str(e)[:40]}")
    for code in cfg["mc"]:
        try:
            r = HTTP.get(f"https://priceapi.moneycontrol.com/pricefeed/notapplicable/inidicesindia/{code}", timeout=15)
            r.raise_for_status()
            dd = (r.json() or {}).get("data") or {}
            price, prev = _num(dd.get("pricecurrent")), _num(dd.get("priceprevclose"))
            pct = _num(dd.get("pricepercentchange"))
            if price and not prev and pct is not None:
                prev = price / (1 + pct / 100)
            q = _q(price, prev)
            if q:
                return q, "Moneycontrol"
            errs.append("mc: empty")
        except Exception as e:
            errs.append(f"mc: {str(e)[:40]}")
    try:
        r = HTTP.get(f"https://www.google.com/finance/quote/{cfg['google']}?hl=en", timeout=15,
                     headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", "Cookie": "CONSENT=YES+"})
        r.raise_for_status()
        html = r.text
        m = re.search(r'data-last-price="([\d.,]+)"', html)
        mp = re.search(r"Previous close.{0,800}?>\s*([\d,]{4,}\.\d+)\s*<", html, re.S)
        if m and mp:
            q = _q(_num(m.group(1)), _num(mp.group(1)))
            if q:
                return q, "Google"
        errs.append(f"google: price={'y' if m else 'n'} prev={'y' if mp else 'n'} len={len(html)}")
    except Exception as e:
        errs.append(f"google: {str(e)[:40]}")
    raise RuntimeError("; ".join(errs))


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
    # 1b) GIFT Nifty (Moneycontrol feed) — best pre-open signal
    if any(m["sym"] == "GIFTNIFTY" for _, m in all_items):
        try:
            got["GIFTNIFTY"] = gift_nifty()
            status.append({"name": "GIFT Nifty (Moneycontrol)", "ok": True, "count": 1})
        except Exception as e:
            status.append({"name": "GIFT Nifty (Moneycontrol)", "ok": False, "error": str(e)[:600]})
    # 2) CNBC (works from cloud servers, no key)
    need = sorted({m["sym"] for _, m in all_items if m["sym"] not in got})
    if need:
        try:
            cq = cnbc_batch(need)
            got.update(cq)
            status.append({"name": "CNBC quotes", "ok": bool(cq), "count": len(cq)})
        except Exception as e:
            status.append({"name": "CNBC quotes", "ok": False, "error": str(e)[:100]})
            log("cnbc failed", e)
    # 3) Yahoo batch for the rest
    need = sorted({m["sym"] for _, m in all_items if m["sym"] not in got})
    if need:
        try:
            y = yahoo_batch(need)
            got.update({k: v for k, v in y.items() if k in need})
            status.append({"name": "Yahoo Finance", "ok": bool(y), "count": len(y)})
        except Exception as e:
            status.append({"name": "Yahoo Finance", "ok": False, "error": str(e)[:100]})
            log("yahoo failed", e)
    # 3b) BSE indices (Sensex, BANKEX) when CNBC/Yahoo did not give them
    for bsym in BSE_INDEX:
        if any(m["sym"] == bsym for _, m in all_items) and bsym not in got:
            try:
                got[bsym], src = bse_quote(bsym)
                status.append({"name": f"{bsym.strip('^')} ({src})", "ok": True, "count": 1})
            except Exception as e:
                status.append({"name": f"{bsym.strip('^')} (BSE/MC/Google)", "ok": False, "error": str(e)[:180]})
    # 4) Stooq for whatever is still missing
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
    # 5) keep last known value (marked stale) for anything still missing
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


def metals_rule(markets):
    """Simple multi-factor view for gold & silver when AI is not available."""
    def g(name):
        for grp in ("macro", "global"):
            for q in markets.get(grp, []):
                if q["name"] == name and q.get("pct") is not None and not q.get("stale"):
                    return q["pct"]
        return 0.0
    dxy, y10, vix, gold, silver, spx = g("Dollar Index"), g("US 10Y Yield"), g("US VIX"), g("Gold"), g("Silver"), g("S&P 500 Futures")
    out = {}
    for key, own, extra in (("gold", gold, 0.02 * vix), ("silver", silver, 0.15 * spx)):
        score = -1.0 * dxy - 0.15 * y10 + 0.5 * own + extra
        trend = "up" if score > 0.25 else "down" if score < -0.25 else "sideways"
        gu = (f"ડોલર ઇન્ડેક્સ {dxy:+.2f}%, US યીલ્ડ {y10:+.2f}%, આજે {own:+.2f}% — "
              f"{'ડોલર નબળો/યીલ્ડ નીચે હોવાથી ટેકો' if score > 0.25 else 'ડોલર મજબૂત/યીલ્ડ ઉપર હોવાથી દબાણ' if score < -0.25 else 'મિશ્ર સંકેત'}")
        en = (f"Dollar index {dxy:+.2f}%, US yield {y10:+.2f}%, today {own:+.2f}% — "
              f"{'support from a weaker dollar/lower yields' if score > 0.25 else 'pressure from a stronger dollar/higher yields' if score < -0.25 else 'mixed signals'}")
        out[key] = {"trend": trend, "score": round(score, 2), "outlook_gu": gu, "outlook_en": en}
    return out


def collect_metals_india():
    out = []
    for sym in ("GOLDBEES", "SILVERBEES"):
        try:
            r = nse_session().get("https://www.nseindia.com/api/quote-equity", params={"symbol": sym}, timeout=15)
            r.raise_for_status()
            p = r.json().get("priceInfo", {})
            q = _q(p.get("lastPrice"), p.get("previousClose"))
            if q:
                q.update({"name": sym, "sym": sym})
                out.append(q)
        except Exception as e:
            log("etf failed", sym, e)
    return out


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
HOLIDAYS = set()   # trading holidays as date objects (filled from NSE holiday-master, kept in latest.json)


def is_trading_day(d):
    return d.weekday() < 5 and d not in HOLIDAYS


def next_weekday(d):
    d = d + timedelta(days=1)
    while not is_trading_day(d):
        d += timedelta(days=1)
    return d


def target_session(now_ist):
    t = now_ist.hour * 60 + now_ist.minute
    today = now_ist.date()
    if is_trading_day(today) and t < 9 * 60 + 15:
        return today, "pre"
    if is_trading_day(today) and t < 15 * 60 + 30:
        return today, "live"
    return next_weekday(today), "closed"


def collect_holidays(prev):
    """NSE trading holidays; falls back to the list saved in the previous run."""
    out = set(prev.get("holidays") or [])
    try:
        r = nse_session().get("https://www.nseindia.com/api/holiday-master", params={"type": "trading"}, timeout=15)
        r.raise_for_status()
        js = r.json()
        for seg, rows in (js or {}).items():
            if isinstance(rows, list) and seg in ("CM", "FO"):
                for h in rows:
                    if h.get("tradingDate"):
                        out.add(h["tradingDate"])
    except Exception as e:
        log("holidays failed", e)
    days = set()
    for x in out:
        try:
            days.add(datetime.strptime(x, "%d-%b-%Y").date())
        except Exception:
            pass
    return sorted(out), days


def fmt_pct(p):
    return f"{p:+.2f}%"


def global_score(markets):
    num, den, reasons = 0.0, 0.0, []
    for grp in ("global", "macro", "india"):
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
                if q["name"] == name and q.get("pct") is not None and not q.get("stale"):
                    return q["pct"]
        return None

    def add(t, gu, en):
        reasons.append((t, gu, en))

    gift = get("GIFT Nifty")
    if gift is not None:
        add("pos" if gift > 0.1 else "neg" if gift < -0.1 else "neu",
            f"GIFT Nifty {fmt_pct(gift)} — ઓપનિંગનો સૌથી મહત્વનો સંકેત",
            f"GIFT Nifty {fmt_pct(gift)} — the key opening signal")

    fut = get("S&P 500 Futures")
    if fut is not None and abs(fut) >= 0.15:
        add("pos" if fut > 0 else "neg",
            f"અમેરિકન ફ્યુચર્સ (S&P) {fmt_pct(fut)} — {'પોઝિટિવ' if fut > 0 else 'નેગેટિવ'} સંકેત",
            f"US futures (S&P) {fmt_pct(fut)} — {'positive' if fut > 0 else 'negative'} cue")
    asia = [p for p in (get("Nikkei 225"), get("Hang Seng")) if p is not None]
    if asia:
        a = sum(asia) / len(asia)
        if abs(a) >= 0.3:
            add("pos" if a > 0 else "neg", f"એશિયન બજારો સરેરાશ {fmt_pct(a)} — {'સપોર્ટ' if a > 0 else 'દબાણ'}",
                f"Asian markets avg {fmt_pct(a)} — {'support' if a > 0 else 'pressure'}")
    crude = get("Brent Crude")
    if crude is not None and abs(crude) >= 1:
        add("neg" if crude > 0 else "pos",
            f"ક્રૂડ ઓઇલ {fmt_pct(crude)} — ભારત માટે {'નેગેટિવ (આયાત ખર્ચ વધે)' if crude > 0 else 'પોઝિટિવ'}",
            f"Brent crude {fmt_pct(crude)} — {'negative for India (higher import bill)' if crude > 0 else 'positive for India'}")
    inr = get("USD/INR")
    if inr is not None and abs(inr) >= 0.15:
        add("neg" if inr > 0 else "pos", f"રૂપિયો {'નબળો' if inr > 0 else 'મજબૂત'} (USD/INR {fmt_pct(inr)})",
            f"Rupee {'weaker' if inr > 0 else 'stronger'} (USD/INR {fmt_pct(inr)})")
    tnx = get("US 10Y Yield")
    if tnx is not None and abs(tnx) >= 1.5:
        add("neg" if tnx > 0 else "pos",
            f"US બોન્ડ યીલ્ડ {fmt_pct(tnx)} — {'FII વેચવાલીનો ડર' if tnx > 0 else 'FII માટે સારું'}",
            f"US 10Y yield {fmt_pct(tnx)} — {'risk of FII selling' if tnx > 0 else 'good for FII flows'}")
    vix = get("India VIX")
    if vix is not None and abs(vix) >= 5:
        add("neg" if vix > 0 else "pos", f"India VIX {fmt_pct(vix)} — {'અસ્થિરતા વધી' if vix > 0 else 'ડર ઘટ્યો'}",
            f"India VIX {fmt_pct(vix)} — {'volatility rising' if vix > 0 else 'fear easing'}")
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


def india_score(markets):
    """Actual move of the Indian market today (Nifty, Bank Nifty, Sensex) — the main thing we judge."""
    vals = []
    for q in markets.get("india", []):
        if q["name"] in ("Nifty 50", "Bank Nifty", "Sensex") and q.get("pct") is not None and not q.get("stale"):
            vals.append(q["pct"] * (1.5 if q["name"] == "Nifty 50" else 1.0))
    if not vals:
        return None
    return math.tanh((sum(vals) / (len(vals) + 0.5 * any(True for _ in vals))) / 0.6)


def rule_outlook(news, markets, phase="closed"):
    gs, reasons = global_score(markets)
    ns, pos, neg, n = news_score(news)
    g_norm = math.tanh(gs / 0.7)
    ind = india_score(markets)
    if ind is None:
        combined = 0.6 * g_norm + 0.4 * ns
    elif phase == "live":     # market open: judge mainly by what Indian market is actually doing
        combined = 0.65 * ind + 0.15 * g_norm + 0.2 * ns
    else:                     # forecasting the next session: global cues matter more, today's trend still counts
        combined = 0.3 * ind + 0.45 * g_norm + 0.25 * ns
    if ind is not None:
        nifty = next((q for q in markets.get("india", []) if q["name"] == "Nifty 50" and not q.get("stale")), None)
        if nifty and nifty.get("pct") is not None:
            p = nifty["pct"]
            reasons.insert(0, ("pos" if p > 0.1 else "neg" if p < -0.1 else "neu",
                               f"ભારતીય બજાર: Nifty આજે {fmt_pct(p)}", f"Indian market: Nifty today {fmt_pct(p)}"))
    if n:
        pct_pos = round(pos / n * 100)
        reasons.append(("pos" if ns > 0.05 else "neg" if ns < -0.05 else "neu",
                        f"છેલ્લા 18 કલાકના {n} સમાચારમાંથી {pct_pos}% પોઝિટિવ, {round(neg / n * 100)}% નેગેટિવ",
                        f"Of {n} news items in the last 18 h, {pct_pos}% positive, {round(neg / n * 100)}% negative"))
    agree = (g_norm > 0) == (ns > 0)
    data_ok = sum(1 for g in ("global", "macro") for q in markets.get(g, []) if q.get("pct") is not None)
    conf = "medium" if (agree and abs(combined) > 0.25 and data_ok >= 8 and n >= 20) else "low"
    return {
        "score": round(combined, 3),
        "label": label_for(combined),
        "confidence": conf,
        "global_score": round(g_norm, 3),
        "news_score": round(ns, 3),
        "india_score": round(ind, 3) if ind is not None else None,
        "reasons": [{"type": t, "text": gu, "gu": gu, "en": en} for t, gu, en in reasons],
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
AI_PROMPT = """You are an experienced Indian stock-market and F&O analyst.
DATE CONTEXT (very important):
- Now (IST): {now_long}.
- Indian market status right now: {status_text}
- The forecast is for the trading session of {session_long}.
- Headlines below carry their IST publish time. Anything published today describes TODAY ({today_long});
  call it "today/આજે", not "yesterday/ગઈકાલે". Only use "yesterday" for events of {yday_long}.

Market snapshot (daily % change):
{snapshot}

Index options data (NSE, nearest expiry):
{options}

Headlines (index | IST time | region | source | title):
{headlines}

IMPORTANT: "outlook.label" describes ONLY the Indian market (Nifty/Sensex). If the market is OPEN, base it mainly on
how Nifty/Sensex/Bank Nifty are actually moving today (see snapshot); global cues are secondary.
Return ONLY JSON with exactly this shape. Every *_gu field in simple Gujarati, every *_en field in simple English.
{{
  "summary_gu": "4-6 short sentences", "summary_en": "same in English",
  "outlook": {{"label": "strong_positive|positive|neutral|negative|strong_negative",
               "confidence": "low|medium|high",
               "reasons_gu": ["3-6 short reasons"], "reasons_en": ["same in English"]}},
  "global_gu": "2-3 sentences on global cues and likely effect on India", "global_en": "same in English",
  "sectors": [{{"sector": "IT|Banking|PSU Bank|Auto|Pharma|FMCG|Metal|Energy|Realty|Power|Defence|Railway|Telecom|Cement|Aviation|Financial Services|Infra|Consumer|Media",
                "view": "positive|neutral|negative", "reason_gu": "one line", "reason_en": "one line"}}],
  "items": [{{"i": 0, "impact": 0, "symbols": ["NSE symbols"], "gu": "one-line Gujarati meaning & impact", "en": "one-line English impact"}}],
  "watch": [{{"symbol": "NSE symbol", "view": "positive|negative", "reason_gu": "why in focus", "reason_en": "why in focus"}}],
  "metals": {{
    "gold": {{"trend": "up|down|sideways", "outlook_gu": "2 lines: trend for the coming days (global + India factors: dollar, yields, Fed, geopolitics, import duty, festive/wedding demand)", "outlook_en": "same"}},
    "silver": {{"trend": "up|down|sideways", "outlook_gu": "2 lines incl. industrial demand", "outlook_en": "same"}}
  }},
  "fo": {{
    "nifty": {{"bias": "bullish|bearish|neutral", "note_gu": "2 lines: view for the session with key levels", "note_en": "same"}},
    "banknifty": {{"bias": "bullish|bearish|neutral", "note_gu": "2 lines", "note_en": "same"}},
    "stocks": [{{"symbol": "F&O stock NSE symbol", "bias": "bullish|bearish", "reason_gu": "news-based reason", "reason_en": "same"}}]
  }}
}}
Rules: impact is -2..+2 for the Indian market / the named company; 0 for explainers, how-to, opinion,
live blogs or unrelated news. "fo.stocks": at most 4 liquid NSE F&O stocks with a clear fresh news trigger.
Be balanced and factual. This is an educational outlook, not investment advice."""


def ai_snapshot(markets):
    lines = []
    for grp in ("india", "global", "macro", "sectors"):
        for q in markets.get(grp, []):
            if q.get("pct") is not None and not q.get("stale"):
                lines.append(f"{grp}: {q['name']} {q['pct']:+.2f}% (last {q['price']})")
    return "\n".join(lines) or "(no market data)"


def call_gemini(prompt, key, models):
    last_err = None
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"}}
        try:
            r = requests.post(url, json=body, headers={"x-goog-api-key": key}, timeout=150)
            if r.status_code in (429, 500, 503):  # busy: wait once and retry the same model
                time.sleep(8)
                r = requests.post(url, json=body, headers={"x-goog-api-key": key}, timeout=150)
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


def _long_date(d):
    return d.strftime("%A %d %B %Y")


def options_text(options):
    out = []
    for key, o in (options or {}).items():
        if not o:
            continue
        out.append(f"{o['name']}: spot {o['spot']}, expiry {o['expiry']}, PCR {o['pcr']}, max pain {o['max_pain']}, "
                   f"support (max PE OI) {o['support']}, resistance (max CE OI) {o['resistance']}, "
                   f"ATM {o['atm']} CE {o.get('atm_ce')} / PE {o.get('atm_pe')}, ATM IV {o.get('iv')}")
    return "\n".join(out) or "(not available)"


def run_ai(news, markets, prev, session, phase, now_ist, options=None):
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    prev_ai = prev.get("ai")
    if not key:
        return None, "no_key"
    interval = int(os.environ.get("AI_MIN_INTERVAL_MIN", "120") or 120)
    force = os.environ.get("AI_FORCE", "") == "1"
    if prev_ai and prev_ai.get("generated_at") and not force and prev_ai.get("schema") == 3:
        try:
            age = (now_utc() - datetime.fromisoformat(prev_ai["generated_at"])).total_seconds() / 60
            same_session = prev_ai.get("session") == str(session)
            if age < interval and same_session:
                return prev_ai, "reused"
        except Exception:
            pass
    models = [m.strip() for m in (os.environ.get("GEMINI_MODELS") or
                                  "gemini-flash-latest,gemini-2.5-flash,gemini-flash-lite-latest").split(",") if m.strip()]
    pick = news[:70]
    heads = []
    for i, it in enumerate(pick):
        try:
            t = datetime.fromisoformat(it["published"]).astimezone(IST).strftime("%d %b %H:%M")
        except Exception:
            t = "?"
        heads.append(f"{i} | {t} | {it['region']} | {it['source']} | {it['title']}")
    status_text = {
        "live": "OPEN (live session in progress today).",
        "pre": "NOT YET OPEN today (opens 09:15 IST).",
        "closed": "CLOSED (today's session ended at 15:30 IST or it is a weekend).",
    }[phase]
    yday = (now_ist - timedelta(days=1)).date()
    prompt = AI_PROMPT.format(
        now_long=now_ist.strftime("%A %d %B %Y, %H:%M"), status_text=status_text,
        session_long=_long_date(session), today_long=_long_date(now_ist.date()), yday_long=_long_date(yday),
        snapshot=ai_snapshot(markets), options=options_text(options), headlines="\n".join(heads))
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
                if row.get("en"):
                    it["ai_en"] = str(row["en"])[:300]
                if row.get("symbols"):
                    it["ai_symbols"] = [str(s).upper() for s in row["symbols"]][:5]
        except Exception:
            continue
    res.pop("items", None)
    res["generated_at"] = now_utc().isoformat()
    res["session"] = str(session)
    res["model"] = model
    res["schema"] = 3
    return res, "ok"


# --------------------------------------------------------------------------
# Free translation (Google Translate web endpoint) — cached per news item
# --------------------------------------------------------------------------
def _gtx(text, tl):
    url = "https://translate.googleapis.com/translate_a/single"
    params = {"client": "gtx", "sl": "auto", "tl": tl, "dt": "t"}
    try:
        r = HTTP.post(url, params=params, data={"q": text}, timeout=25)
        r.raise_for_status()
    except Exception:
        r = HTTP.get(url, params=dict(params, q=text), timeout=25)
        r.raise_for_status()
    js = r.json()
    return "".join(seg[0] for seg in js[0] if seg and seg[0])


def translate_titles(news, max_new=160):
    """adds tr_gu to every non-Gujarati title and tr_en to Hindi titles"""
    stats = {"ok": 0, "fail": 0}
    for tl, field, cond in (("gu", "tr_gu", lambda it: True),
                            ("en", "tr_en", lambda it: it.get("lang") == "hi")):
        todo = [it for it in news if cond(it) and not it.get(field)][:max_new]
        i = 0
        while i < len(todo):
            chunk = todo[i:i + 12]
            i += 12
            text = "\n".join(it["title"].replace("\n", " ") for it in chunk)
            try:
                out = _gtx(text, tl).split("\n")
                if len(out) == len(chunk):
                    for it, t in zip(chunk, out):
                        it[field] = t.strip()
                    stats["ok"] += len(chunk)
                else:  # fallback one by one
                    for it in chunk:
                        it[field] = _gtx(it["title"], tl).strip()
                        stats["ok"] += 1
                        time.sleep(0.2)
            except Exception as e:
                stats["fail"] += len(chunk)
                stats["error"] = str(e)[:100]
                log("translate failed", e)
                break
            time.sleep(0.4)
    return stats


# --------------------------------------------------------------------------
# NSE option chain -> F&O levels and an educational trade idea
# --------------------------------------------------------------------------
_NSE = None


def nse_session():
    global _NSE
    if _NSE is None:
        s = requests.Session()
        s.headers.update({"User-Agent": UA, "Accept": "application/json, text/plain, */*",
                          "Accept-Language": "en-US,en;q=0.9",
                          "Referer": "https://www.nseindia.com/option-chain"})
        try:
            s.get("https://www.nseindia.com/", timeout=15)
            s.get("https://www.nseindia.com/option-chain", timeout=15)
        except Exception:
            pass
        _NSE = s
    return _NSE


def _chain_rows(symbol):
    s = nse_session()
    # newer API needs an expiry; older one returns everything
    try:
        info = s.get("https://www.nseindia.com/api/option-chain-contract-info", params={"symbol": symbol}, timeout=15)
        info.raise_for_status()
        exps = info.json().get("expiryDates") or []
        if exps:
            r = s.get("https://www.nseindia.com/api/option-chain-v3",
                      params={"type": "Indices", "symbol": symbol, "expiry": exps[0]}, timeout=20)
            r.raise_for_status()
            js = r.json()
            rec = js.get("records", {})
            rows = rec.get("data") or js.get("filtered", {}).get("data") or []
            if rows:
                return rows, rec.get("underlyingValue"), exps[0]
    except Exception as e:
        log("option-chain v3 failed", symbol, e)
    r = s.get("https://www.nseindia.com/api/option-chain-indices", params={"symbol": symbol}, timeout=20)
    r.raise_for_status()
    rec = r.json().get("records", {})
    exp = (rec.get("expiryDates") or [None])[0]
    rows = [x for x in rec.get("data", []) if not exp or x.get("expiryDate", x.get("expiryDates")) == exp]
    return rows, rec.get("underlyingValue"), exp


def option_metrics(symbol, name, step):
    rows, spot, exp = _chain_rows(symbol)
    if not rows or not spot:
        raise ValueError("empty chain")
    strikes = {}
    for x in rows:
        k = x.get("strikePrice")
        if k is None:
            continue
        ce, pe = x.get("CE") or {}, x.get("PE") or {}
        strikes[k] = {"ce_oi": ce.get("openInterest") or 0, "pe_oi": pe.get("openInterest") or 0,
                      "ce_chg": ce.get("changeinOpenInterest") or 0, "pe_chg": pe.get("changeinOpenInterest") or 0,
                      "ce_ltp": ce.get("lastPrice"), "pe_ltp": pe.get("lastPrice"),
                      "ce_iv": ce.get("impliedVolatility"), "pe_iv": pe.get("impliedVolatility")}
    ks = sorted(strikes)
    tot_ce = sum(v["ce_oi"] for v in strikes.values()) or 1
    tot_pe = sum(v["pe_oi"] for v in strikes.values())
    near = [k for k in ks if abs(k - spot) <= spot * 0.06] or ks
    resistance = max((k for k in near if k >= spot), key=lambda k: strikes[k]["ce_oi"], default=None)
    support = max((k for k in near if k <= spot), key=lambda k: strikes[k]["pe_oi"], default=None)

    def pain(p):
        return sum(v["ce_oi"] * max(0, p - k) + v["pe_oi"] * max(0, k - p) for k, v in strikes.items())
    max_pain = min(near, key=pain)
    atm = min(ks, key=lambda k: abs(k - spot))
    a = strikes[atm]
    ivs = [v for v in (a["ce_iv"], a["pe_iv"]) if v]
    return {"symbol": symbol, "name": name, "spot": round(spot, 2), "expiry": exp, "step": step,
            "fetched_at": now_utc().isoformat(),
            "pcr": round(tot_pe / tot_ce, 2), "max_pain": max_pain, "support": support, "resistance": resistance,
            "atm": atm, "atm_ce": a["ce_ltp"], "atm_pe": a["pe_ltp"],
            "iv": round(sum(ivs) / len(ivs), 1) if ivs else None,
            "otm_ce": strikes.get(atm + step, {}).get("ce_ltp"), "otm_pe": strikes.get(atm - step, {}).get("pe_ltp")}


LABEL_SCORE = {"strong_positive": 0.7, "positive": 0.4, "neutral": 0.0, "negative": -0.4, "strong_negative": -0.7}


def fo_idea(o, outlook_label, ai_bias=None):
    """Educational option idea from outlook + option-chain positioning (no guarantees)."""
    s = o["spot"]
    pcr_sig = max(-1, min(1, (o["pcr"] - 1.0) / 0.4))
    mp_sig = max(-1, min(1, (o["max_pain"] - s) / (s * 0.01))) if o.get("max_pain") else 0
    b = LABEL_SCORE.get(outlook_label, 0) * 0.6 + pcr_sig * 0.25 + mp_sig * 0.15
    if ai_bias == "bullish":
        b += 0.1
    elif ai_bias == "bearish":
        b -= 0.1
    idea = {"score": round(b, 2), "pcr_sig": round(pcr_sig, 2)}
    sup, res = o.get("support"), o.get("resistance")
    if b >= 0.2:
        prem = o.get("atm_ce")
        idea.update(bias="bullish", action="BUY_CE", strike=o["atm"], opt="CE", premium=prem,
                    spread={"buy": o["atm"], "sell": res if res and res > o["atm"] else o["atm"] + 2 * o["step"], "type": "CE"},
                    trigger=round(s), target_level=res, stop_level=sup)
    elif b <= -0.2:
        prem = o.get("atm_pe")
        idea.update(bias="bearish", action="BUY_PE", strike=o["atm"], opt="PE", premium=prem,
                    spread={"buy": o["atm"], "sell": sup if sup and sup < o["atm"] else o["atm"] - 2 * o["step"], "type": "PE"},
                    trigger=round(s), target_level=sup, stop_level=res)
    else:
        idea.update(bias="neutral", action="WAIT", trigger_up=res, trigger_down=sup)
        prem = None
    if prem:
        idea["sl_premium"] = round(prem * 0.7, 1)       # ~30% risk
        idea["target_premium"] = round(prem * 1.5, 1)   # ~1:1.7 reward
    idea["confidence"] = "medium" if abs(b) >= 0.45 else "low"
    return idea


def collect_options():
    out, status = {}, []
    for key, sym, name, step in (("nifty", "NIFTY", "Nifty", 50), ("banknifty", "BANKNIFTY", "Bank Nifty", 100),
                                 ("finnifty", "FINNIFTY", "Fin Nifty", 50), ("midcpnifty", "MIDCPNIFTY", "Midcap Select", 25)):
        try:
            out[key] = option_metrics(sym, name, step)
            time.sleep(1)
        except Exception as e:
            status.append({"name": f"NSE option chain {sym}", "ok": False, "error": str(e)[:100]})
            log("option chain failed", sym, e)
    if out:
        status.append({"name": "NSE option chain", "ok": True, "count": len(out)})
    return out, status


# --------------------------------------------------------------------------
# Track record: what we said vs what Nifty did
# --------------------------------------------------------------------------
# --------------------------------------------------------------------------
# Prediction ledger: every forecast is stored and later scored against what Nifty actually did
# --------------------------------------------------------------------------
def prob_up(score):
    return round(0.5 + 0.3 * math.tanh(1.5 * score), 3)


def _mq(markets, name, grp="india"):
    return next((q for q in markets.get(grp, []) if q["name"] == name and not q.get("stale")), None)


def dir_of(p_up=None, pct=None):
    if p_up is not None:
        return 1 if p_up >= 0.55 else -1 if p_up <= 0.45 else 0
    return 1 if pct > 0.25 else -1 if pct < -0.25 else 0


def update_ledger(prev, outlook, ai, markets, session, phase, now_ist):
    led = dict(prev.get("ledger") or {})
    ai_label = ((ai or {}).get("outlook") or {}).get("label")
    score = outlook["score"]
    if ai_label in LABEL_SCORE:
        score = 0.5 * score + 0.5 * LABEL_SCORE[ai_label]
    n = _mq(markets, "Nifty 50")
    vix = _mq(markets, "India VIX")
    gift = _mq(markets, "GIFT Nifty")
    if phase in ("pre", "closed"):
        key = str(session)
        e = led.get(key, {})
        ref = n["price"] if n else None
        # GIFT Nifty move since the Indian close = the expected opening gap
        if not e.get("gift_ref"):   # a holiday in between: keep the reference taken at the last real close
            for k in sorted(led, reverse=True):
                if k < key and led[k].get("gift_ref") and not led[k].get("actual"):
                    e["gift_ref"] = led[k]["gift_ref"]
                    break
                if k < key:
                    break
        if gift and gift.get("price") and not e.get("gift_ref"):
            e["gift_ref"] = gift["price"]
        gap = ((gift["price"] / e["gift_ref"] - 1) * 100) if (gift and gift.get("price") and e.get("gift_ref")) else None
        sigma = (vix["price"] / math.sqrt(252)) if vix and vix.get("price") else 0.8   # % 1-day move (≈68%)
        f = {"made_at": now_utc().isoformat(), "label": ai_label or outlook["label"], "score": round(score, 3),
             "prob_up": prob_up(score), "ref": ref, "gap_pred": round(gap, 2) if gap is not None else None,
             "sigma": round(sigma, 2)}
        if ref:
            center = ref * (1 + (gap or 0) / 100)
            f["range_lo"], f["range_hi"] = round(center * (1 - sigma / 100)), round(center * (1 + sigma / 100))
        e["forecast"] = f
        led[key] = e
    for k in list(led):
        try:
            if datetime.strptime(k, "%Y-%m-%d").date() in HOLIDAYS and not led[k].get("actual"):
                led[k]["holiday"] = True
        except Exception:
            pass
    # record what actually happened today (after the close)
    today = str(now_ist.date())
    t = now_ist.hour * 60 + now_ist.minute
    if n and today in led and "actual" not in led[today] and is_trading_day(now_ist.date()) and t >= 15 * 60 + 35:
        f = led[today].get("forecast") or {}
        a = {"close": n["price"], "close_pct": n["pct"], "high": n.get("high"), "low": n.get("low"), "open": n.get("open")}
        if n.get("open") and n.get("prev"):
            a["open_gap"] = round((n["open"] - n["prev"]) / n["prev"] * 100, 2)
        hits = {}
        if f.get("prob_up") is not None:
            hits["dir"] = dir_of(f["prob_up"]) == dir_of(pct=n["pct"])
            hits["pred_dir"] = dir_of(f["prob_up"])
        if f.get("gap_pred") is not None and a.get("open_gap") is not None:
            g, og = f["gap_pred"], a["open_gap"]
            hits["gap"] = (abs(g) < 0.15 and abs(og) < 0.3) or (g * og > 0 and abs(g) >= 0.15)
        if f.get("range_lo") and f.get("range_hi"):
            hits["range"] = f["range_lo"] <= n["price"] <= f["range_hi"]
        a["hits"] = hits
        led[today]["actual"] = a
    led = dict(sorted(led.items())[-150:])
    return led, ledger_stats(led)


def ledger_stats(led):
    done = [v for k, v in sorted(led.items()) if v.get("actual") and not v.get("holiday")]

    def summ(rows):
        out = {"n": len(rows)}
        for k in ("dir", "gap", "range"):
            xs = [r["actual"]["hits"][k] for r in rows if k in r["actual"].get("hits", {})]
            out[k] = {"hit": sum(1 for x in xs if x), "n": len(xs)}
        dirs = [r for r in rows if r["actual"].get("hits", {}).get("pred_dir") not in (None, 0)]
        out["dir_called"] = {"hit": sum(1 for r in dirs if r["actual"]["hits"]["dir"]), "n": len(dirs)}
        ups = [r for r in rows if r["actual"].get("close_pct") is not None]
        out["baseline_up"] = {"hit": sum(1 for r in ups if dir_of(pct=r["actual"]["close_pct"]) == 1), "n": len(ups)}
        return out
    return {"last20": summ(done[-20:]), "all": summ(done)}


def update_history(prev, outlook, ai, markets, session, phase, now_ist, options=None):
    hist = prev.get("history", {})
    key = str(session)
    final_label = (ai or {}).get("outlook", {}).get("label") if ai else None
    entry = hist.get(key, {})
    # freeze the forecast at market open (we only update while it is still a forecast)
    if phase in ("closed", "pre") or "rule" not in entry:
        entry["rule"] = outlook["label"]
        if final_label:
            entry["ai"] = final_label
        nifty = (options or {}).get("nifty") or {}
        if nifty.get("idea") and not nifty.get("stale"):
            entry["fo"] = nifty["idea"]["bias"]
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
    hol_list, hol_days = collect_holidays(prev)
    HOLIDAYS.update(hol_days)
    session, phase = target_session(now_ist)

    news, feed_status = collect_news(sources, prev, stocks, sector_kw)
    tr = translate_titles(news)
    feed_status.append({"name": "Translation (gu/en)", "ok": tr["fail"] == 0, "count": tr["ok"],
                        **({"error": tr.get("error", "")} if tr["fail"] else {})})
    markets, mkt_status = collect_markets(sources, prev.get("markets"))
    fii = collect_fii_dii() or prev.get("fii_dii")
    fii_hist = dict(prev.get("fii_hist") or {})
    for row in fii or []:
        if row.get("date"):
            fii_hist.setdefault(row["date"], {})[row.get("category") or "?"] = row
    fii_hist = dict(sorted(fii_hist.items(), key=lambda kv: datetime.strptime(kv[0], "%d-%b-%Y") if re.match(r"\d{2}-[A-Za-z]{3}-\d{4}$", kv[0]) else datetime.min)[-30:])
    options, opt_status = collect_options()
    metals_india = collect_metals_india() or prev.get("metals_india") or []
    if not options and prev.get("options"):
        options = prev["options"]
        for o in options.values():
            o["stale"] = True

    ai, ai_status = run_ai(news, markets, prev, session, phase, now_ist, options)
    outlook = rule_outlook(news, markets, phase)  # after AI so it can use ai_impact
    final_label = ((ai or {}).get("outlook") or {}).get("label") or outlook["label"]
    ai_fo = (ai or {}).get("fo") or {}
    for key, o in options.items():
        o["idea"] = fo_idea(o, final_label, (ai_fo.get(key) or {}).get("bias"))

    data = {
        "app": "M-Market",
        "schema": 2,
        "generated_at": now_utc().isoformat(),
        "session": {"date": str(session), "phase": phase, "today_holiday": now_ist.date() in HOLIDAYS},
        "holidays": hol_list,
        "outlook": outlook,
        "ai": ai,
        "ai_status": ai_status,
        "markets": markets,
        "fii_dii": fii,
        "fii_hist": fii_hist,
        "sectors": sector_view(news, markets),
        "stocks": stock_summary(news, stocks_cfg),
        "stock_list": [[s[0], s[1], s[2]] for s in stocks_cfg["stocks"]],
        "news": news,
        "options": options,
        "metals_india": metals_india,
        "metals_rule": metals_rule(markets),
        "sources": feed_status + mkt_status + opt_status,
    }
    data["history"] = update_history(prev, outlook, ai, markets, session, phase, now_ist, options)
    data["ledger"], data["ledger_stats"] = update_ledger(prev, outlook, ai, markets, session, phase, now_ist)
    f = data["ledger"].get(str(session), {}).get("forecast")
    if f:
        data["forecast"] = f

    tmp = out_file + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, out_file)
    ok = sum(1 for s in feed_status if s["ok"])
    log(f"done: {len(news)} news, {ok}/{len(feed_status)} feeds ok, ai={ai_status}, "
        f"outlook={outlook['label']} ({outlook['score']})")


if __name__ == "__main__":
    main()
