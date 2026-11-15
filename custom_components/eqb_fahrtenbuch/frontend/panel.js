/* EQB Fahrtenbuch – Oberfläche für Home Assistant (ohne Build-Schritt) */

const DOMAIN = "eqb_fahrtenbuch";
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const TABS = [
  ["overview", "Übersicht", "mdi:view-dashboard-outline"],
  ["trips", "Fahrten", "mdi:steering"],
  ["months", "Monate", "mdi:calendar-month-outline"],
  ["charges", "Laden", "mdi:ev-station"],
  ["stats", "Statistik", "mdi:chart-box-outline"],
];

const TILES = {
  kosten: "Kosten",
  ersparnis: "Ersparnis",
  verbrauch_monat: "Verbrauch je Monat",
  km_monat: "Kilometer je Monat",
  temperatur: "Temperatur",
  kurzstrecken: "Kurzstrecken",
  topziele: "Top-Ziele",
  wochentage: "Wochentage",
  laden: "Laden",
  eco: "Eco-Score",
  co2: "CO₂",
  rekorde: "Rekorde",
};
const DEFAULT_TILES = ["kosten", "ersparnis", "verbrauch_monat", "kurzstrecken", "topziele", "laden", "rekorde"];

const nf = (d) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (v, d = 1) => (v === null || v === undefined || isNaN(v) ? "–" : nf(d).format(v));
const eur = (v) => (v === null || v === undefined || isNaN(v) ? "–" : nf(2).format(v) + " €");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dm = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dur = (min) => {
  if (min === null || min === undefined) return "–";
  min = Math.round(min);
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
};
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

const CSS = `
:host{display:block;min-height:100vh;background:#000;color:#fff;font-family:"EQB Inter",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;--blue:#00adef;--silver:#a4aaae;--muted:#7d8287;--card:#141414;--line:#242424;--line2:#1f1f1f;--warn:#f5b335;--ok:#6fcf7a;--bad:#ff5f56}
*{box-sizing:border-box}
button{font:inherit;color:inherit}
.top{position:sticky;top:0;z-index:20;background:#000;border-bottom:1px solid var(--line2);padding:0 24px;padding-top:env(safe-area-inset-top)}
.toprow{display:flex;align-items:center;gap:16px;min-height:64px}
.menu{display:none;background:none;border:0;padding:8px;margin-left:-8px;cursor:pointer;color:#fff}
.title small{display:block;font-size:11px;color:var(--silver);letter-spacing:1.6px;text-transform:uppercase;margin-bottom:2px}
.title h1{margin:0;font-family:"EQB Serif",Georgia,serif;font-weight:400;font-size:24px;letter-spacing:.2px}
.tabs{display:flex;gap:26px;margin-left:auto;align-self:stretch}
.tab{background:none;border:0;border-bottom:2px solid transparent;color:var(--silver);font-size:15px;cursor:pointer;padding:0 2px;display:flex;align-items:center;gap:6px}
.tab ha-icon{--mdc-icon-size:18px;display:none}
.tab.on{color:#fff;border-color:var(--blue)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #3a3a3a;background:#0b0b0b;padding:0 16px;height:42px;border-radius:4px;font-size:14px;cursor:pointer;white-space:nowrap}
.btn:hover{border-color:#5a5a5a}
.btn.pri{background:var(--blue);border-color:var(--blue);color:#000;font-weight:500}
.btn.danger{border-color:#5a2a2a;color:#ff8a80}
.btn ha-icon{--mdc-icon-size:18px}
.ibtn{width:44px;height:44px;padding:0}
.content{padding:22px 24px 40px;max-width:1400px;margin:0 auto}
.lbl{font-size:11px;color:var(--silver);letter-spacing:1.3px;text-transform:uppercase}
.serif{font-family:"EQB Serif",Georgia,serif;font-weight:400}
.muted{color:var(--silver)}
.blue{color:var(--blue)}
.warn{color:var(--warn)}
.card{background:var(--card);border:1px solid var(--line);border-radius:6px}
.pad{padding:16px 18px}
.grid{display:grid;gap:14px}
.sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden}
.sum>div{background:var(--card);padding:16px 18px}
.sum b{display:block;font-family:"EQB Serif",Georgia,serif;font-weight:400;font-size:28px;margin-top:6px;white-space:nowrap}
.bar{display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap}
.nav{display:flex;align-items:center;gap:6px}
.nav .cur{min-width:170px;text-align:center;font-size:15px}
.day{font-size:12px;color:var(--muted);letter-spacing:1.3px;text-transform:uppercase;margin:18px 0 6px}
.trip{display:flex;align-items:center;gap:16px;padding:12px 14px;border-bottom:1px solid var(--line2);border:1px solid transparent;border-bottom-color:var(--line2);cursor:pointer;border-radius:4px}
.trip:hover{background:#0b0b0b}
.trip .t{width:56px;color:var(--silver);font-size:13px;line-height:1.45}
.trip .r{flex:1;min-width:0}
.trip .r b{font-weight:500;font-size:15.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trip .r span{font-size:13px;color:var(--silver)}
.trip .km{width:80px;text-align:right;font-size:17px}
.trip .kwh{width:84px;text-align:right;font-size:14px;color:var(--silver)}
.det{width:44px;height:44px;border-radius:4px;border:1px solid #3a3a3a;background:#0b0b0b;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.det ha-icon{--mdc-icon-size:20px}
.trip.sel{background:#0d1a20;border-color:var(--blue)}
.trip.sel .det{background:var(--blue);border-color:var(--blue);color:#000}
.split{display:flex;gap:20px;align-items:flex-start}
.split>.main{flex:1;min-width:0}
.side{width:400px;flex:none;position:sticky;top:84px}
.sheet{position:fixed;inset:0;z-index:50;background:#000;overflow:auto;padding:16px 18px calc(30px + env(safe-area-inset-bottom));padding-top:calc(16px + env(safe-area-inset-top))}
.map{height:200px;border-radius:6px;overflow:hidden;border:1px solid var(--line);background:#1a1d20;margin-top:14px}
.kv{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden;margin-top:14px}
.kv>div{background:var(--card);padding:12px 14px}
.kv span{display:block;font-size:11px;color:var(--silver);letter-spacing:1px;text-transform:uppercase}
.kv b{display:block;font-weight:500;font-size:18px;margin-top:4px}
.prog{height:6px;background:#262626;border-radius:3px;overflow:hidden;margin-top:6px}
.prog i{display:block;height:100%;background:var(--blue);border-radius:3px}
.row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line2);font-size:14px}
.row:last-child{border:0}
.row b{font-weight:500;text-align:right}
table{width:100%;border-collapse:collapse;font-size:15px}
th{font-size:11px;color:var(--silver);letter-spacing:1.2px;text-transform:uppercase;font-weight:400;text-align:right;padding:12px 16px;border-bottom:1px solid #2a2a2a}
td{padding:13px 16px;border-bottom:1px solid var(--line2);text-align:right}
th:first-child,td:first-child{text-align:left}
tr.click{cursor:pointer}
tr.click:hover td{background:#0b0b0b}
tr.cur td{background:#0d1a20}
.mbar{display:inline-block;height:6px;background:var(--blue);border-radius:3px;vertical-align:middle;margin-right:10px}
.ch{display:flex;align-items:center;gap:16px;padding:13px 16px;border-bottom:1px solid var(--line2)}
.ch:last-child{border-bottom:0}
.ch.miss{background:#1a1508}
.ico{width:42px;height:42px;border-radius:4px;background:#0d1a20;color:var(--blue);display:flex;align-items:center;justify-content:center;flex:none}
.ch.miss .ico{background:#2a2008;color:var(--warn)}
.ch .d{width:118px;font-size:14px}
.ch .d div,.ch .p div{color:var(--silver);font-size:12px;margin-top:3px}
.ch .p{flex:1;min-width:0;font-size:15px}
.ch .p b{font-weight:400;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch .k{width:96px;text-align:right;font-size:17px}
.price{min-width:150px;height:42px;border:1px solid #3a3a3a;border-radius:4px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;font-size:14px;cursor:pointer;background:#0b0b0b}
.price.miss{border-color:var(--warn);color:var(--warn)}
.ch .c{width:84px;text-align:right;font-size:15px}
.mhead{display:flex;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #2a2a2a;font-size:12px;color:var(--silver);letter-spacing:1.2px;text-transform:uppercase}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:18px;border:1px solid #3a3a3a;background:#0b0b0b;font-size:13px;cursor:pointer}
.chip.on{background:#0d1a20;border-color:var(--blue);color:var(--blue)}
.chip ha-icon{--mdc-icon-size:16px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:4px;font-size:13px;background:#1c1c1c;border:1px solid #2c2c2c}
.pill ha-icon{--mdc-icon-size:16px}
.pill.ok{color:var(--ok)}.pill.warnp{color:var(--warn);border-color:#4a3a10}.pill.blue{color:var(--blue);border-color:#0b3a4d}
.ov{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:14px}
.hero{grid-row:span 2;background:linear-gradient(160deg,#1c1f23 0%,#0e0f11 60%,#000 100%);position:relative;overflow:hidden}
.hero .soc{font-family:"EQB Serif",Georgia,serif;font-size:72px;line-height:1;letter-spacing:-1px}
.mini{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden;margin-top:16px}
.mini>div{background:#111;padding:10px 12px}
.mini .lbl{font-size:10px;letter-spacing:1px}
.mini b{display:block;font-weight:500;font-size:17px;margin-top:3px;white-space:nowrap}
.tire{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-top:10px}
.tire b{font-weight:500;font-size:18px}
.chart{display:flex;align-items:flex-end;gap:6px;height:120px;margin-top:12px}
.chart>div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px;min-width:0}
.chart i{display:block;width:100%;background:var(--blue);border-radius:3px 3px 0 0;min-height:2px}
.chart span{font-size:11px;color:var(--muted)}
.chart em{font-style:normal;font-size:11px;color:var(--silver)}
.st{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:14px}
.big{font-family:"EQB Serif",Georgia,serif;font-size:34px;margin-top:6px}
.modalbg{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px}
.modal{background:#111;border:1px solid #2c2c2c;border-radius:8px;width:100%;max-width:460px;padding:22px;max-height:90vh;overflow:auto}
.modal h2{margin:0 0 4px;font-family:"EQB Serif",Georgia,serif;font-weight:400;font-size:22px}
.field{display:block;margin-top:14px}
.field span{display:block;font-size:12px;color:var(--silver);margin-bottom:6px}
.field input,.field textarea,.field select{width:100%;height:44px;background:#000;border:1px solid #3a3a3a;border-radius:4px;color:#fff;padding:0 12px;font:inherit;font-size:16px}
.field textarea{height:80px;padding:10px 12px;resize:vertical}
.field input:focus,.field textarea:focus{outline:none;border-color:var(--blue)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap}
.hint{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.5}
.empty{padding:40px 20px;text-align:center;color:var(--silver)}
.empty b{display:block;color:#fff;font-family:"EQB Serif",Georgia,serif;font-weight:400;font-size:22px;margin-bottom:6px}
.live{display:flex;align-items:center;gap:10px;padding:12px 16px;border:1px solid #0b3a4d;background:#06141a;border-radius:6px;margin-bottom:14px;font-size:14px}
.dot{width:9px;height:9px;border-radius:50%;background:var(--blue);box-shadow:0 0 0 4px rgba(0,173,239,.18)}
.leaflet-container{background:#1a1d20;font-family:inherit}
.leaflet-control-attribution{background:rgba(0,0,0,.6)!important;color:#888!important;font-size:10px}
.leaflet-control-attribution a{color:#aaa!important}
.pin{width:20px;height:20px;border-radius:50%;border:5px solid #fff;background:#000;box-shadow:0 0 0 2px rgba(0,0,0,.4)}
.pin.end{border-color:var(--blue)}
.pin.car{border-color:var(--blue);background:#fff;width:18px;height:18px}
@media (max-width:1100px){.ov{grid-template-columns:1fr 1fr}.hero{grid-column:span 2;grid-row:auto}.side{width:340px}}
@media (max-width:820px){
 .top{padding:0 14px}.menu{display:block}.title h1{font-size:21px}
 .toprow{min-height:56px;gap:10px}
 .tabs{position:fixed;left:0;right:0;bottom:0;z-index:30;background:#0b0b0b;border-top:1px solid var(--line);margin:0;gap:0;justify-content:space-around;padding-bottom:env(safe-area-inset-bottom);height:auto}
 .tab{flex:1;flex-direction:column;gap:3px;padding:8px 0 7px;font-size:10.5px;border-bottom:0;border-top:2px solid transparent}
 .tab ha-icon{display:block;--mdc-icon-size:22px}
 .tab.on{border-top-color:var(--blue)}
 .content{padding:14px 14px calc(96px + env(safe-area-inset-bottom))}
 .pdfl{display:none}
 .ov{grid-template-columns:1fr}.hero{grid-column:auto}
 .hero .soc{font-size:60px}
 .trip{gap:10px;padding:12px 6px}.trip .kwh{display:none}.trip .km{width:auto}
 .ch{flex-wrap:wrap;gap:10px 12px;padding:13px 12px}.ch .d{width:auto;flex:1}.ch .p{order:3;flex-basis:100%;padding-left:54px}.ch .k{width:auto}
 .ch .pr{order:4;margin-left:54px;flex:1}.price{width:100%}.ch .c{order:5}
 .sum b{font-size:24px}
 .st{grid-template-columns:1fr}
 .nav .cur{min-width:130px}
}
`;

const FONT_FACES = (base) => `
@font-face{font-family:"EQB Inter";font-weight:400;font-display:swap;src:url(${base}/fonts/inter-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:"EQB Inter";font-weight:500;font-display:swap;src:url(${base}/fonts/inter-latin-500-normal.woff2) format("woff2")}
@font-face{font-family:"EQB Inter";font-weight:600;font-display:swap;src:url(${base}/fonts/inter-latin-600-normal.woff2) format("woff2")}
@font-face{font-family:"EQB Serif";font-weight:400;font-display:swap;src:url(${base}/fonts/source-serif-4-latin-400-normal.woff2) format("woff2")}
`;

class EqbFahrtenbuchPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    const now = new Date();
    this.s = {
      tab: "overview",
      ym: { y: now.getFullYear(), m: now.getMonth() },
      year: now.getFullYear(),
      sel: null,
      modal: null,
      statPeriod: "year",
      statYm: { y: now.getFullYear(), m: now.getMonth() },
      tilePicker: false,
    };
    this.data = null;
    this.error = null;
    this._maps = {};
    this._lastStates = "";
  }

  set panel(p) {
    this._panel = p;
    this.base = p?.config?.static || "/eqb_fahrtenbuch_static";
  }

  set narrow(n) {
    this._narrow = n;
  }

  set hass(h) {
    const first = !this._hass;
    this._hass = h;
    if (first) {
      this._init();
      return;
    }
    if (this.s.tab === "overview" && !this.s.modal && this.data) {
      const sig = this._stateSig();
      if (sig !== this._lastStates) {
        this._lastStates = sig;
        clearTimeout(this._ovT);
        this._ovT = setTimeout(() => this.render(), 600);
      }
    }
  }

  get hass() {
    return this._hass;
  }

  async _init() {
    this.base = this.base || "/eqb_fahrtenbuch_static";
    if (!document.getElementById("eqb-fonts")) {
      const st = document.createElement("style");
      st.id = "eqb-fonts";
      st.textContent = FONT_FACES(this.base);
      document.head.appendChild(st);
    }
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="${this.base}/vendor/leaflet.css"><style>${CSS}</style><div id="root"></div>`;
    this.root = this.shadowRoot.getElementById("root");
    this.root.addEventListener("click", (e) => this._click(e));
    this.root.addEventListener("change", (e) => this._change(e));
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.s.modal) this._closeModal();
    });
    this._loadLeaflet();
    await this._load();
    try {
      this._unsub = await this.hass.connection.subscribeMessage(() => this._load(), { type: `${DOMAIN}/subscribe` });
    } catch (e) {
      /* älteres HA: dann eben ohne Live-Aktualisierung */
    }
  }

  disconnectedCallback() {
    this._wasDisconnected = true;
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
  }

  connectedCallback() {
    if (this._wasDisconnected && this._hass && this.root && !this._unsub) {
      this._wasDisconnected = false;
      this._load();
      this.hass.connection.subscribeMessage(() => this._load(), { type: `${DOMAIN}/subscribe` }).then((u) => (this._unsub = u)).catch(() => {});
    }
  }

  _loadLeaflet() {
    if (window.L || document.getElementById("eqb-leaflet")) return;
    const sc = document.createElement("script");
    sc.id = "eqb-leaflet";
    sc.src = `${this.base}/vendor/leaflet.js`;
    sc.onload = () => this._mountMaps();
    document.head.appendChild(sc);
  }

  async _load() {
    try {
      this.data = await this.hass.callWS({ type: `${DOMAIN}/get` });
      this.error = null;
    } catch (e) {
      this.error = e.message || String(e);
    }
    if (this.s.modal) {
      this._dirty = true;
      return;
    }
    this.render();
  }

  _ws(msg) {
    return this.hass.callWS({ ...msg, type: `${DOMAIN}/${msg.type}` });
  }

  // ------------------------------------------------------------- Werte
  _st(key) {
    const id = this.data?.entities?.[key];
    return id ? this.hass.states[id] : undefined;
  }
  _num(key) {
    const st = this._st(key);
    if (!st) return null;
    const v = parseFloat(String(st.state).replace(",", "."));
    return isNaN(v) ? null : v;
  }
  _fmtState(key) {
    const st = this._st(key);
    if (!st) return null;
    if (["unavailable", "unknown"].includes(st.state)) return "–";
    try {
      if (this.hass.formatEntityState) return this.hass.formatEntityState(st);
    } catch (e) {}
    return st.state;
  }
  _stateSig() {
    const ents = this.data?.entities || {};
    return Object.values(ents)
      .map((id) => {
        const st = this.hass.states[id];
        return st ? st.last_updated : "";
      })
      .join("|");
  }
  get price() {
    return this.data?.avg_price ?? 0.59;
  }
  get trips() {
    return this.data?.trips || [];
  }
  get charges() {
    return this.data?.charges || [];
  }
  get settings() {
    return this.data?.settings || {};
  }
  tripCost(t) {
    return t.kwh === null || t.kwh === undefined ? null : t.kwh * this.price;
  }
  chargeCost(c) {
    if (c.total !== null && c.total !== undefined) return Number(c.total);
    if (c.price !== null && c.price !== undefined && c.kwh) return Number(c.price) * Number(c.kwh);
    return null;
  }
  route(t) {
    return `${esc(t.start_name || "Unbekannter Ort")} <span class="muted">→</span> ${esc(t.end_name || "Unbekannter Ort")}`;
  }
  inMonth(item, y, m) {
    const d = new Date(item.start);
    return d.getFullYear() === y && d.getMonth() === m;
  }

  // ------------------------------------------------------------- Rendern
  render() {
    if (!this.root) return;
    this._dirty = false;
    const scroll = window.scrollY;
    const tabTitle = TABS.find((t) => t[0] === this.s.tab)[1];
    const title = this.s.tab === "months" ? "Monatsübersicht" : tabTitle;
    let body;
    if (this.error) body = `<div class="empty"><b>Fahrtenbuch nicht erreichbar</b>${esc(this.error)}</div>`;
    else if (!this.data) body = `<div class="empty"><b>Lädt …</b></div>`;
    else body = this["_" + this.s.tab]();

    this.root.innerHTML = `
      <div class="top"><div class="toprow">
        <button class="menu" data-a="menu" aria-label="Menü"><ha-icon icon="mdi:menu"></ha-icon></button>
        <div class="title"><small>EQB 350 · Fahrtenbuch</small><h1>${title}</h1></div>
        <nav class="tabs">${TABS.map(([id, name, icon]) => `<button class="tab ${this.s.tab === id ? "on" : ""}" data-a="tab" data-v="${id}"><ha-icon icon="${icon}"></ha-icon>${name}</button>`).join("")}</nav>
        <button class="btn" data-a="pdf" style="margin-left:${this._isNarrow() ? "auto" : "26px"}"><ha-icon icon="mdi:file-download-outline"></ha-icon><span class="pdfl">PDF</span></button>
      </div></div>
      <div class="content">${body}</div>
      ${this._modalHtml()}`;
    this._mountMaps();
    if (!this._keepScroll) window.scrollTo(0, scroll);
    this._keepScroll = false;
    const first = this.root.querySelector(".modal input, .modal textarea");
    if (first && this.s.modal && !this.s.modal.focused) {
      this.s.modal.focused = true;
      setTimeout(() => first.focus(), 30);
    }
  }

  _isNarrow() {
    return window.innerWidth <= 820;
  }

  // ------------------------------------------------------------- Übersicht
  _overview() {
    const soc = this._num("soc");
    const range = this._num("rangeelectrickm");
    const maxSoc = this._num("max_soc") ?? 100;
    const odo = this._num("odometer");
    const charging = this._st("chargingactive")?.state === "on";
    const lockTxt = this._fmtState("lock");
    const last = this.trips[this.trips.length - 1];
    const now = new Date();
    const mTrips = this.trips.filter((t) => this.inMonth(t, now.getFullYear(), now.getMonth()));
    const mKm = sum(mTrips, (t) => t.km);
    const mKwh = sum(mTrips, (t) => t.kwh);
    const at = this.data.active_trip;
    const ac = this.data.active_charge;
    const ring = soc === null ? 0 : Math.max(0, Math.min(100, soc));
    const C = 2 * Math.PI * 52;

    const status = [
      ["Verriegelung", "lock"],
      ["Fenster", "windowstatusoverall"],
      ["Heckklappe", "decklidstatus"],
      ["Schiebedach", "sunroofstatus"],
      ["Parkbremse", "parkbrakestatus"],
      ["Vorklimatisierung", "preclimatestatus"],
    ].filter(([, k]) => this._st(k));

    const warnKeys = [
      ["Motorkontrolle", "warningenginelight"],
      ["Bremsflüssigkeit", "warningbrakefluid"],
      ["Kühlmittel", "warningcoolantlevellow"],
      ["Wischwasser", "warningwashwater"],
      ["Reifen", "tirewarninglamp"],
    ].filter(([, k]) => this._st(k));

    const tp = (k) => {
      const v = this._num(k);
      return v === null ? "–" : `${fmt(v, 1)} bar`;
    };

    return `
      ${at && !at.ended_at ? `<div class="live"><span class="dot"></span>Fahrt läuft seit ${hm(new Date(at.start))} Uhr</div>` : ""}
      ${ac ? `<div class="live"><span class="dot"></span>Ladevorgang läuft seit ${hm(new Date(ac.start))} Uhr${ac.type ? " · " + ac.type : ""}${this._num("chargingpowerkw") ? " · " + fmt(this._num("chargingpowerkw"), 1) + " kW" : ""}</div>` : ""}
      <div class="ov">
        <div class="card pad hero">
          <div style="display:flex;justify-content:space-between;gap:12px">
            <div>
              <div class="lbl">Batterie</div>
              <div class="soc" style="margin-top:8px">${soc === null ? "–" : fmt(soc, 0)}<span style="font-size:.5em"> %</span></div>
              <div style="font-size:18px;margin-top:8px">${range === null ? "–" : fmt(range, 0)} km <span class="muted">Reichweite</span></div>
            </div>
            <svg width="124" height="124" viewBox="0 0 124 124" aria-hidden="true">
              <circle cx="62" cy="62" r="52" fill="none" stroke="#262626" stroke-width="9"/>
              <circle cx="62" cy="62" r="52" fill="none" stroke="#00adef" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(C * ring) / 100} ${C}" transform="rotate(-90 62 62)"/>
              <line x1="62" y1="6" x2="62" y2="18" stroke="#fff" stroke-width="2" transform="rotate(${(maxSoc / 100) * 360} 62 62)"/>
              <text x="62" y="58" text-anchor="middle" fill="#a4aaae" font-size="11" letter-spacing="1">LADEZIEL</text>
              <text x="62" y="78" text-anchor="middle" fill="#fff" font-size="20">${fmt(maxSoc, 0)} %</text>
            </svg>
          </div>
          ${CAR_SVG}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${lockTxt ? `<span class="pill ${/verriegelt/i.test(lockTxt) && !/ent/i.test(lockTxt) ? "ok" : "warnp"}"><ha-icon icon="mdi:lock-outline"></ha-icon>${esc(lockTxt)}</span>` : ""}
            <span class="pill ${charging ? "blue" : ""}"><ha-icon icon="${charging ? "mdi:battery-charging" : "mdi:power-plug-off-outline"}"></ha-icon>${charging ? "Lädt" : "Lädt nicht"}</span>
            ${this._st("chargingstatus") ? `<span class="pill">${esc(this._fmtState("chargingstatus"))}</span>` : ""}
          </div>
          <div class="mini">
            <div><span class="lbl">Kilometer</span><b>${odo === null ? "–" : fmt(odo, 0) + " km"}</b></div>
            <div><span class="lbl">Ø seit Reset</span><b>${this._num("electricconsumptionreset") === null ? "–" : fmt(this._num("electricconsumptionreset"), 1) + " kWh"}</b></div>
            <div><span class="lbl">12-V-Batterie</span><b>${esc(this._fmtState("starterbatterystate") ?? "–")}</b></div>
          </div>
        </div>

        <div class="card pad" style="border-color:#0b3a4d;background:#06141a">
          <div class="lbl">Letzte Fahrt</div>
          ${
            last
              ? `<div style="margin-top:8px;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.route(last)}</div>
                 <div style="display:flex;align-items:baseline;gap:10px;margin-top:6px"><span class="big" style="margin:0">${fmt(last.km, 1)} km</span><span class="muted">${fmt(last.kwh, 1)} kWh</span></div>
                 <div class="row" style="margin-top:6px"><span class="muted">${WD_SHORT[new Date(last.start).getDay()]} ${dm(new Date(last.start))} · ${hm(new Date(last.start))}</span><b>${fmt(last.cons_100, 1)} kWh/100 km</b></div>
                 <div class="row"><span class="muted">Kosten</span><b class="blue">${eur(this.tripCost(last))}</b></div>
                 <button class="btn" data-a="opentrip" data-v="${last.id}" style="margin-top:10px">Details <ha-icon icon="mdi:chevron-right"></ha-icon></button>`
              : `<div class="hint" style="font-size:14px">Noch keine Fahrt. Sobald das Auto das nächste Mal fährt, erscheint sie hier.</div>`
          }
        </div>

        <div class="card pad">
          <div class="lbl">${MONTHS[now.getMonth()]}</div>
          <div class="big">${fmt(mKm, 0)} km</div>
          <div class="row" style="margin-top:6px"><span class="muted">Fahrten</span><b>${mTrips.length}</b></div>
          <div class="row"><span class="muted">Verbrauch</span><b>${fmt(mKwh, 1)} kWh</b></div>
          <div class="row"><span class="muted">Ø pro 100 km</span><b>${mKm ? fmt((mKwh / mKm) * 100, 1) : "–"} kWh</b></div>
          <div class="row"><span class="muted">Kosten</span><b class="blue">${eur(mKwh * this.price)}</b></div>
        </div>

        <div class="card pad">
          <div class="lbl">Fahrzeugstatus</div>
          <div style="margin-top:6px">${status.map(([n, k]) => `<div class="row"><span class="muted">${n}</span><b>${esc(this._fmtState(k))}</b></div>`).join("") || `<div class="hint">Keine Statuswerte gefunden.</div>`}</div>
        </div>

        <div class="card pad">
          <div class="lbl">Standort</div>
          <div class="map" style="height:150px;margin-top:10px" data-map="car"></div>
          <div class="row" style="margin-top:6px"><span class="muted">Zuletzt geparkt</span><b>${esc(last?.end_name || "–")}</b></div>
        </div>

        <div class="card pad">
          <div class="lbl">Reifendruck</div>
          <div class="tire">
            <div><b>${tp("tirepressurefrontleft")}</b><div class="hint" style="margin:2px 0 18px">vorne links</div><b>${tp("tirepressurerearleft")}</b><div class="hint" style="margin-top:2px">hinten links</div></div>
            <svg width="54" height="100" viewBox="0 0 54 100" aria-hidden="true"><rect x="9" y="3" width="36" height="94" rx="14" fill="none" stroke="#5a5f64" stroke-width="2"/><rect x="14" y="26" width="26" height="16" rx="3" fill="#2a2d31"/><rect x="2" y="14" width="7" height="20" rx="2" fill="#00adef"/><rect x="45" y="14" width="7" height="20" rx="2" fill="#00adef"/><rect x="2" y="66" width="7" height="20" rx="2" fill="#00adef"/><rect x="45" y="66" width="7" height="20" rx="2" fill="#00adef"/></svg>
            <div style="text-align:right"><b>${tp("tirepressurefrontright")}</b><div class="hint" style="margin:2px 0 18px">vorne rechts</div><b>${tp("tirepressurerearright")}</b><div class="hint" style="margin-top:2px">hinten rechts</div></div>
          </div>
          ${this._st("tirewarningsrdk") ? `<div class="row" style="margin-top:8px"><span class="muted">Reifenkontrolle</span><b>${esc(this._fmtState("tirewarningsrdk"))}</b></div>` : ""}
        </div>

        <div class="card pad">
          <div class="lbl">Laden</div>
          <div style="font-size:19px;margin-top:8px">${charging ? "Wird geladen" : "Wird nicht geladen"}</div>
          ${[
            ["Ladeleistung", this._num("chargingpowerkw") === null ? null : fmt(this._num("chargingpowerkw"), 1) + " kW"],
            ["Ladeziel", fmt(maxSoc, 0) + " %"],
            ["AC-Stecker", this._fmtState("chargecoupleracstatus")],
            ["DC-Stecker", this._fmtState("chargecouplerdcstatus")],
            ["Ø Ladepreis", nf(2).format(this.price) + " €/kWh"],
          ]
            .filter(([, v]) => v)
            .map(([n, v]) => `<div class="row"><span class="muted">${n}</span><b>${esc(v)}</b></div>`)
            .join("")}
        </div>

        <div class="card pad">
          <div class="lbl">Warnungen</div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
          ${
            warnKeys
              .map(([n, k]) => {
                const bad = this._st(k)?.state === "on";
                return `<span class="pill ${bad ? "warnp" : "ok"}" style="justify-content:space-between"><span>${n}</span><span>${bad ? "Prüfen" : "OK"}</span></span>`;
              })
              .join("") || `<div class="hint">Keine Warnsensoren gefunden.</div>`
          }
          </div>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------- Fahrten
  _trips() {
    const { y, m } = this.s.ym;
    const list = this.trips.filter((t) => this.inMonth(t, y, m)).sort((a, b) => (a.start < b.start ? 1 : -1));
    const km = sum(list, (t) => t.km);
    const kwh = sum(list, (t) => t.kwh);
    let html = `<div class="bar">
      <div class="nav"><button class="btn ibtn" data-a="month" data-v="-1" aria-label="Vorheriger Monat"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
      <span class="cur">${MONTHS[m]} ${y}</span>
      <button class="btn ibtn" data-a="month" data-v="1" aria-label="Nächster Monat"><ha-icon icon="mdi:chevron-right"></ha-icon></button></div>
      <span class="muted" style="font-size:14px">${list.length} Fahrten · ${fmt(km, 0)} km · ${fmt(kwh, 1)} kWh · ${eur(kwh * this.price)}</span></div>`;
    if (!list.length) {
      html += `<div class="card empty"><b>Keine Fahrten im ${MONTHS[m]}</b>Neue Fahrten werden automatisch eingetragen, sobald das Auto fährt.</div>`;
      return html;
    }
    let lastDay = "";
    const today = isoDate(new Date());
    let rows = "";
    for (const t of list) {
      const s = new Date(t.start);
      const e = new Date(t.end);
      const day = isoDate(s);
      if (day !== lastDay) {
        lastDay = day;
        rows += `<div class="day">${day === today ? "Heute · " : ""}${WEEKDAYS[s.getDay()]}, ${dm(s)}</div>`;
      }
      rows += `<div class="trip ${this.s.sel === t.id ? "sel" : ""}" data-a="opentrip" data-v="${t.id}">
        <div class="t">${hm(s)}<br>${hm(e)}</div>
        <div class="r"><b>${this.route(t)}</b><span>${dur(t.minutes)}${t.avg_speed ? " · Ø " + fmt(t.avg_speed, 0) + " km/h" : ""}</span></div>
        <div class="km">${fmt(t.km, 1)} km</div><div class="kwh">${fmt(t.kwh, 1)} kWh</div>
        <button class="det" data-a="opentrip" data-v="${t.id}" aria-label="Statistik dieser Fahrt"><ha-icon icon="mdi:chart-bar"></ha-icon></button></div>`;
    }
    const sel = this.s.sel && this.trips.find((t) => t.id === this.s.sel);
    if (sel && !this._isNarrow()) {
      return html + `<div class="split"><div class="main">${rows}</div><div class="side">${this._tripDetail(sel)}</div></div>`;
    }
    return html + rows + (sel ? `<div class="sheet">${this._tripDetail(sel, true)}</div>` : "");
  }

  _tripDetail(t, sheet = false) {
    const s = new Date(t.start);
    const eco = t.eco || {};
    const ecoVals = ["accel", "const", "free"].map((k) => eco[k]).filter((v) => v !== undefined && v !== null);
    const ecoAvg = ecoVals.length ? ecoVals.reduce((a, b) => a + b, 0) / ecoVals.length : null;
    const src = { fahrzeug: "vom Fahrzeug gemessen", akku: "aus dem Akkustand berechnet", fehlt: "nicht verfügbar" }[t.kwh_source] || "";
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div><div class="lbl">Fahrt · ${WD_SHORT[s.getDay()]} ${dm(s)}${s.getFullYear()} · ${hm(s)}–${hm(new Date(t.end))}</div>
        <div class="serif" style="font-size:23px;margin-top:6px;line-height:1.25">${this.route(t)}</div></div>
        <button class="btn ibtn" data-a="closetrip" aria-label="Schließen"><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      <div class="map" data-map="trip" data-id="${t.id}" style="height:${sheet ? 240 : 200}px"></div>
      <div class="kv">
        <div><span>Strecke</span><b>${fmt(t.km, 1)} km</b></div><div><span>Dauer</span><b>${dur(t.minutes)}</b></div>
        <div><span>Verbrauch</span><b>${fmt(t.kwh, 2)} kWh</b></div><div><span>Pro 100 km</span><b>${fmt(t.cons_100, 1)} kWh</b></div>
        <div><span>Kosten</span><b class="blue">${eur(this.tripCost(t))}</b></div><div><span>Ø Tempo</span><b>${t.avg_speed ? fmt(t.avg_speed, 0) + " km/h" : "–"}</b></div>
        <div><span>Akku</span><b>${fmt(t.start_soc, 0)} → ${fmt(t.end_soc, 0)} %</b></div><div><span>Außentemp.</span><b>${t.temp === null || t.temp === undefined ? "–" : fmt(t.temp, 0) + " °C"}</b></div>
      </div>
      ${
        ecoVals.length
          ? `<div class="card pad" style="margin-top:14px"><div class="lbl">Eco-Score${ecoAvg !== null ? " · Ø " + fmt(ecoAvg, 0) + " %" : ""}</div>
            ${[["Beschleunigen", eco.accel], ["Gleichmäßig", eco.const], ["Rollen", eco.free]]
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([n, v]) => `<div style="margin-top:10px;font-size:13px;display:flex;justify-content:space-between"><span>${n}</span><span>${fmt(v, 0)} %</span></div><div class="prog"><i style="width:${Math.min(100, v)}%"></i></div>`)
              .join("")}
            ${eco.bonus ? `<div class="hint">Bonus-Reichweite: +${fmt(eco.bonus, 0)} km</div>` : ""}</div>`
          : ""
      }
      <div class="hint">Verbrauch ${src}. Kosten mit Ø ${nf(2).format(this.price)} €/kWh. Kilometerstand ${fmt(t.start_odo, 0)} → ${fmt(t.end_odo, 0)} km.</div>
      <label class="field"><span>Notiz</span><textarea data-f="note" placeholder="Zum Beispiel: Einkauf, Arzt, Ausflug">${esc(t.note || "")}</textarea></label>
      <div class="actions"><button class="btn danger" data-a="deltrip" data-v="${t.id}">Fahrt löschen</button><button class="btn pri" data-a="savenote" data-v="${t.id}">Notiz speichern</button></div>`;
  }

  // ------------------------------------------------------------- Monate
  _months() {
    const y = this.s.year;
    const list = this.trips.filter((t) => new Date(t.start).getFullYear() === y);
    const months = {};
    for (const t of list) {
      const m = new Date(t.start).getMonth();
      months[m] = months[m] || { n: 0, km: 0, kwh: 0 };
      months[m].n++;
      months[m].km += t.km || 0;
      months[m].kwh += t.kwh || 0;
    }
    const keys = Object.keys(months).map(Number).sort((a, b) => b - a);
    const maxKm = Math.max(1, ...keys.map((k) => months[k].km));
    const km = sum(list, (t) => t.km);
    const kwh = sum(list, (t) => t.kwh);
    const now = new Date();
    const narrow = this._isNarrow();
    let html = `<div class="bar">
      <div class="nav"><button class="btn ibtn" data-a="year" data-v="-1" aria-label="Vorheriges Jahr"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
      <span class="cur">${y}</span>
      <button class="btn ibtn" data-a="year" data-v="1" aria-label="Nächstes Jahr"><ha-icon icon="mdi:chevron-right"></ha-icon></button></div>
      <span class="muted" style="font-size:13px">Monat antippen zeigt alle Fahrten darin</span></div>
      <div class="sum">
        <div><span class="lbl">Jahr gesamt</span><b>${fmt(km, 0)} km</b></div>
        <div><span class="lbl">Fahrten</span><b>${list.length}</b></div>
        <div><span class="lbl">Verbrauch</span><b>${fmt(kwh, 0)} kWh</b></div>
        <div><span class="lbl">Ø pro 100 km</span><b>${km ? fmt((kwh / km) * 100, 1) : "–"} kWh</b></div>
        <div><span class="lbl">Kosten</span><b class="blue">${eur(kwh * this.price)}</b></div>
      </div>`;
    if (!keys.length) return html + `<div class="card empty" style="margin-top:14px"><b>Keine Fahrten in ${y}</b>Wähle oben ein anderes Jahr.</div>`;
    if (narrow) {
      html += `<div class="grid" style="margin-top:14px">${keys
        .map((k) => {
          const v = months[k];
          const cur = y === now.getFullYear() && k === now.getMonth();
          return `<div class="card pad" data-a="gomonth" data-v="${k}" style="cursor:pointer;${cur ? "border-color:#0b3a4d;background:#06141a" : ""}">
            <div style="display:flex;justify-content:space-between;align-items:center"><span class="serif" style="font-size:20px">${MONTHS[k]}${cur ? ' <span class="muted" style="font-size:12px;font-family:inherit">läuft</span>' : ""}</span><ha-icon icon="mdi:chevron-right"></ha-icon></div>
            <div class="prog" style="margin:10px 0 8px"><i style="width:${(v.km / maxKm) * 100}%"></i></div>
            <div class="two" style="font-size:14px"><span>${fmt(v.km, 0)} km · ${v.n} Fahrten</span><span style="text-align:right">${fmt(v.kwh, 0)} kWh · <span class="blue">${eur(v.kwh * this.price)}</span></span></div>
            <div class="hint" style="margin-top:4px">${v.km ? fmt((v.kwh / v.km) * 100, 1) : "–"} kWh/100 km</div></div>`;
        })
        .join("")}</div>`;
      return html;
    }
    html += `<div class="card" style="margin-top:14px;padding:4px 0"><table>
      <tr><th>Monat</th><th>Fahrten</th><th style="text-align:left">Kilometer</th><th>Verbrauch</th><th>kWh/100 km</th><th>Kosten</th><th></th></tr>
      ${keys
        .map((k) => {
          const v = months[k];
          const cur = y === now.getFullYear() && k === now.getMonth();
          return `<tr class="click ${cur ? "cur" : ""}" data-a="gomonth" data-v="${k}"><td>${MONTHS[k]}${cur ? ' <span class="muted" style="font-size:12px">läuft</span>' : ""}</td><td>${v.n}</td>
          <td style="text-align:left"><span class="mbar" style="width:${Math.round((v.km / maxKm) * 160)}px"></span>${fmt(v.km, 0)} km</td>
          <td>${fmt(v.kwh, 0)} kWh</td><td>${v.km ? fmt((v.kwh / v.km) * 100, 1) : "–"}</td><td class="${cur ? "blue" : ""}">${eur(v.kwh * this.price)}</td>
          <td style="width:60px"><span class="det" style="width:36px;height:36px"><ha-icon icon="mdi:chevron-right"></ha-icon></span></td></tr>`;
        })
        .join("")}</table></div>`;
    return html;
  }

  // ------------------------------------------------------------- Laden
  _charges() {
    const list = [...this.charges].sort((a, b) => (a.start < b.start ? 1 : -1));
    const now = new Date();
    const cur = list.filter((c) => this.inMonth(c, now.getFullYear(), now.getMonth()));
    const curKwh = sum(cur, (c) => c.kwh);
    let curCost = 0;
    for (const c of cur) curCost += this.chargeCost(c) ?? (c.kwh || 0) * this.price;
    const missing = list.filter((c) => this.chargeCost(c) === null).length;
    let html = `<div class="bar"><span class="muted" style="font-size:14px">${list.length} Ladungen insgesamt${missing ? ` · <span class="warn">${missing} ohne Preis</span>` : ""}</span>
      <button class="btn" data-a="addcharge"><ha-icon icon="mdi:plus"></ha-icon>Ladung nachtragen</button></div>
      <div class="sum">
        <div><span class="lbl">Geladen · ${MONTHS[now.getMonth()]}</span><b>${fmt(curKwh, 0)} kWh</b></div>
        <div><span class="lbl">Kosten</span><b class="blue">${eur(curCost)}</b></div>
        <div><span class="lbl">Ø Preis</span><b>${nf(2).format(this.price)} €/kWh</b></div>
        <div><span class="lbl">Ladungen</span><b>${cur.length}</b></div>
      </div>`;
    if (!list.length) return html + `<div class="card empty" style="margin-top:14px"><b>Noch keine Ladung</b>Ladevorgänge werden automatisch erkannt. Du kannst auch eine Ladung nachtragen.</div>`;
    const groups = [];
    for (const c of list) {
      const d = new Date(c.start);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) groups.push((g = { key, y: d.getFullYear(), m: d.getMonth(), items: [] }));
      g.items.push(c);
    }
    for (const g of groups) {
      const kwh = sum(g.items, (c) => c.kwh);
      let cost = 0;
      for (const c of g.items) cost += this.chargeCost(c) ?? (c.kwh || 0) * this.price;
      html += `<div class="card" style="margin-top:14px"><div class="mhead"><span>${MONTHS[g.m]} ${g.y}</span><span>${fmt(kwh, 1)} kWh · ${eur(cost)}</span></div>
        ${g.items
          .map((c) => {
            const d = new Date(c.start);
            const cc = this.chargeCost(c);
            const miss = cc === null;
            const priceTxt = c.price !== null && c.price !== undefined ? `${nf(2).format(c.price)} €/kWh` : c.total !== null && c.total !== undefined ? `${eur(c.total)} gesamt` : "Preis eintragen";
            return `<div class="ch ${miss ? "miss" : ""}">
              <div class="ico"><ha-icon icon="${c.type === "AC" ? "mdi:ev-plug-type2" : "mdi:lightning-bolt"}"></ha-icon></div>
              <div class="d">${WD_SHORT[d.getDay()]}, ${dm(d)}<div>${hm(d)}${c.end && c.end !== c.start ? "–" + hm(new Date(c.end)) : ""}</div></div>
              <div class="p"><b>${esc(c.place || (c.manual ? "Nachgetragen" : "Unbekannter Ort"))}</b><div>${c.type || ""}${c.max_kw ? " · max. " + fmt(c.max_kw, 0) + " kW" : ""}${c.soc_start !== null && c.soc_start !== undefined && c.soc_end !== null && c.soc_end !== undefined ? ` · Akku ${fmt(c.soc_start, 0)} → ${fmt(c.soc_end, 0)} %` : ""}</div></div>
              <div class="k">${fmt(c.kwh, 1)} kWh</div>
              <div class="pr"><div class="price ${miss ? "miss" : ""}" data-a="editcharge" data-v="${c.id}"><span>${priceTxt}</span><ha-icon icon="mdi:pencil-outline" style="--mdc-icon-size:16px"></ha-icon></div></div>
              <div class="c ${miss ? "warn" : ""}">${miss ? "offen" : eur(cc)}</div></div>`;
          })
          .join("")}</div>`;
    }
    html += `<div class="hint" style="margin-top:12px">Ohne eingetragenen Preis rechnet die Statistik mit dem Ø-Preis deiner Ladungen (${nf(2).format(this.price)} €/kWh). Die kWh werden aus dem Akkustand berechnet. Steht auf der Ladesäulen-Abrechnung ein anderer Wert, kannst du ihn ändern.</div>`;
    return html;
  }

  // ------------------------------------------------------------- Statistik
  _periodTrips() {
    const p = this.s.statPeriod;
    const { y, m } = this.s.statYm;
    if (p === "all") return { trips: this.trips, charges: this.charges, label: "Gesamt" };
    if (p === "year") {
      const f = (x) => new Date(x.start).getFullYear() === y;
      return { trips: this.trips.filter(f), charges: this.charges.filter(f), label: String(y) };
    }
    const f = (x) => this.inMonth(x, y, m);
    return { trips: this.trips.filter(f), charges: this.charges.filter(f), label: `${MONTHS[m]} ${y}` };
  }

  _stats() {
    const tiles = this.settings.tiles || DEFAULT_TILES;
    const { trips, charges, label } = this._periodTrips();
    const p = this.s.statPeriod;
    let html = `<div class="bar">
      <div class="chips">${[["month", "Monat"], ["year", "Jahr"], ["all", "Gesamt"]].map(([k, n]) => `<button class="chip ${p === k ? "on" : ""}" data-a="period" data-v="${k}">${n}</button>`).join("")}</div>
      ${p !== "all" ? `<div class="nav"><button class="btn ibtn" data-a="statnav" data-v="-1" aria-label="Zurück"><ha-icon icon="mdi:chevron-left"></ha-icon></button><span class="cur">${label}</span><button class="btn ibtn" data-a="statnav" data-v="1" aria-label="Weiter"><ha-icon icon="mdi:chevron-right"></ha-icon></button></div>` : ""}
      <div style="display:flex;gap:8px"><button class="btn" data-a="tilepicker"><ha-icon icon="mdi:view-grid-plus-outline"></ha-icon>Kacheln</button><button class="btn ibtn" data-a="compare" aria-label="Vergleichswerte"><ha-icon icon="mdi:tune-variant"></ha-icon></button></div>
    </div>`;
    if (this.s.tilePicker) {
      html += `<div class="card pad" style="margin-bottom:14px"><div class="lbl" style="margin-bottom:10px">Kacheln auswählen</div><div class="chips">${Object.entries(TILES)
        .map(([k, n]) => `<button class="chip ${tiles.includes(k) ? "on" : ""}" data-a="toggletile" data-v="${k}">${tiles.includes(k) ? '<ha-icon icon="mdi:check"></ha-icon>' : ""}${n}</button>`)
        .join("")}</div></div>`;
    }
    const km = sum(trips, (t) => t.km);
    const kwh = sum(trips, (t) => t.kwh);
    const cost = kwh * this.price;
    html += `<div class="sum">
      <div><span class="lbl">Strecke</span><b>${fmt(km, 0)} km</b></div>
      <div><span class="lbl">Fahrten</span><b>${trips.length}</b></div>
      <div><span class="lbl">Verbrauch</span><b>${fmt(kwh, 0)} kWh</b></div>
      <div><span class="lbl">Ø pro 100 km</span><b>${km ? fmt((kwh / km) * 100, 1) : "–"} kWh</b></div>
      <div><span class="lbl">Kosten</span><b class="blue">${eur(cost)}</b></div></div>`;
    if (!trips.length) return html + `<div class="card empty" style="margin-top:14px"><b>Keine Fahrten in diesem Zeitraum</b>Wähle einen anderen Zeitraum.</div>`;
    html += `<div class="st">${tiles.map((k) => (this["_tile_" + k] ? this["_tile_" + k](trips, charges, { km, kwh, cost }) : "")).join("")}</div>`;
    return html;
  }

  _tileCard(title, inner) {
    return `<div class="card pad"><div class="lbl">${title}</div>${inner}</div>`;
  }

  _tile_kosten(t, c, a) {
    return this._tileCard(
      "Kosten pro 100 km",
      `<div class="big">${a.km ? eur((a.cost / a.km) * 100) : "–"}</div>
      <div class="row" style="margin-top:6px"><span class="muted">Fahrtkosten gesamt</span><b>${eur(a.cost)}</b></div>
      <div class="row"><span class="muted">Pro Fahrt im Schnitt</span><b>${eur(a.cost / t.length)}</b></div>
      <div class="row"><span class="muted">Pro Kilometer</span><b>${a.km ? nf(3).format(a.cost / a.km) + " €" : "–"}</b></div>`
    );
  }

  _petrol() {
    return { l: Number(this.settings.petrol_l100 ?? 7.5), p: Number(this.settings.petrol_price ?? 1.75) };
  }

  _tile_ersparnis(t, c, a) {
    const pe = this._petrol();
    const petrol = (a.km / 100) * pe.l * pe.p;
    const diff = petrol - a.cost;
    return this._tileCard(
      "Ersparnis gegenüber Benziner",
      `<div class="big ${diff >= 0 ? "blue" : "warn"}">${eur(diff)}</div>
      <div class="row" style="margin-top:6px"><span class="muted">Benziner hätte gekostet</span><b>${eur(petrol)}</b></div>
      <div class="row"><span class="muted">Strom hat gekostet</span><b>${eur(a.cost)}</b></div>
      <div class="hint">Vergleich mit ${fmt(pe.l, 1)} l/100 km zu ${nf(2).format(pe.p)} €/l. Ändern über <ha-icon icon="mdi:tune-variant" style="--mdc-icon-size:14px"></ha-icon>.</div>`
    );
  }

  _monthAgg(trips) {
    const map = new Map();
    for (const t of trips) {
      const d = new Date(t.start);
      const k = d.getFullYear() * 12 + d.getMonth();
      const v = map.get(k) || { km: 0, kwh: 0, n: 0 };
      v.km += t.km || 0;
      v.kwh += t.kwh || 0;
      v.n++;
      map.set(k, v);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).slice(-12);
  }

  _chart(items, floor = 0) {
    const max = Math.max(...items.map((i) => i.v), floor + 0.0001);
    const h = (v) => Math.max(2, ((v - floor) / (max - floor)) * 82);
    return `<div class="chart">${items.map((i) => `<div><em>${i.t}</em><i style="height:${i.v ? h(i.v) : 2}%"></i><span>${i.l}</span></div>`).join("")}</div>`;
  }

  _tile_verbrauch_monat(trips) {
    const agg = this._monthAgg(this.s.statPeriod === "month" ? this.trips : trips);
    const items = agg.map(([k, v]) => ({ v: v.km ? (v.kwh / v.km) * 100 : 0, t: v.km ? fmt((v.kwh / v.km) * 100, 1) : "", l: MONTHS_SHORT[k % 12] }));
    const vals = items.map((i) => i.v).filter(Boolean);
    let hint = "";
    if (vals.length >= 2) {
      const mi = Math.min(...vals);
      const ma = Math.max(...vals);
      hint = `<div class="hint">Höchster Monatswert ${fmt(((ma - mi) / mi) * 100, 0)} % über dem niedrigsten.</div>`;
    }
    const floor = vals.length ? Math.min(...vals) * 0.75 : 0;
    return this._tileCard("Verbrauch je Monat · kWh/100 km", this._chart(items, floor) + hint);
  }

  _tile_km_monat(trips) {
    const agg = this._monthAgg(this.s.statPeriod === "month" ? this.trips : trips);
    return this._tileCard("Kilometer je Monat", this._chart(agg.map(([k, v]) => ({ v: v.km, t: fmt(v.km, 0), l: MONTHS_SHORT[k % 12] }))));
  }

  _tile_temperatur(trips) {
    const buckets = [
      ["unter 0 °C", -99, 0],
      ["0–10 °C", 0, 10],
      ["10–20 °C", 10, 20],
      ["über 20 °C", 20, 99],
    ];
    const rows = buckets
      .map(([n, lo, hi]) => {
        const ts = trips.filter((t) => t.temp !== null && t.temp !== undefined && t.temp >= lo && t.temp < hi && t.km >= 3 && t.kwh);
        const km = sum(ts, (t) => t.km);
        const kwh = sum(ts, (t) => t.kwh);
        return { n, v: km ? (kwh / km) * 100 : null, c: ts.length };
      })
      .filter((r) => r.c);
    if (!rows.length) return this._tileCard("Verbrauch nach Außentemperatur", `<div class="hint">Noch keine Temperaturwerte vorhanden.</div>`);
    const max = Math.max(...rows.map((r) => r.v));
    return this._tileCard(
      "Verbrauch nach Außentemperatur",
      rows.map((r) => `<div style="margin-top:12px;font-size:13px;display:flex;justify-content:space-between"><span>${r.n} <span class="muted">· ${r.c} Fahrten</span></span><span>${fmt(r.v, 1)} kWh</span></div><div class="prog"><i style="width:${(r.v / max) * 100}%"></i></div>`).join("")
    );
  }

  _tile_kurzstrecken(trips, c, a) {
    const short = trips.filter((t) => (t.km || 0) < 5);
    const sKm = sum(short, (t) => t.km);
    const sKwh = sum(short, (t) => t.kwh);
    const long = trips.filter((t) => (t.km || 0) >= 5);
    const lKm = sum(long, (t) => t.km);
    const lKwh = sum(long, (t) => t.kwh);
    return this._tileCard(
      "Kurzstrecken unter 5 km",
      `<div class="big">${fmt((short.length / trips.length) * 100, 0)} %</div>
      <div class="hint" style="margin-top:0">der Fahrten (${short.length} von ${trips.length})</div>
      <div class="row" style="margin-top:6px"><span class="muted">Verbrauch Kurzstrecke</span><b>${sKm ? fmt((sKwh / sKm) * 100, 1) + " kWh/100 km" : "–"}</b></div>
      <div class="row"><span class="muted">Verbrauch ab 5 km</span><b>${lKm ? fmt((lKwh / lKm) * 100, 1) + " kWh/100 km" : "–"}</b></div>`
    );
  }

  _tile_topziele(trips) {
    const map = {};
    for (const t of trips) {
      const n = t.end_name;
      if (!n || n === "Zuhause") continue;
      map[n] = map[n] || { n: 0, km: 0 };
      map[n].n++;
      map[n].km += t.km || 0;
    }
    const top = Object.entries(map)
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 5);
    if (!top.length) return this._tileCard("Top-Ziele", `<div class="hint">Noch keine Ziele mit Ortsnamen.</div>`);
    return this._tileCard("Top-Ziele", `<div style="margin-top:6px">${top.map(([n, v], i) => `<div class="row"><span><span class="muted">${i + 1}.</span> ${esc(n)}</span><b>${v.n}× <span class="muted" style="font-weight:400">· ${fmt(v.km, 0)} km</span></b></div>`).join("")}</div>`);
  }

  _tile_wochentage(trips) {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const cnt = order.map((d) => trips.filter((t) => new Date(t.start).getDay() === d));
    return this._tileCard("Fahrten nach Wochentag", this._chart(cnt.map((ts, i) => ({ v: ts.length, t: ts.length || "", l: WD_SHORT[order[i]] }))));
  }

  _tile_laden(t, charges) {
    if (!charges.length) return this._tileCard("Laden", `<div class="hint">Keine Ladungen in diesem Zeitraum.</div>`);
    const kwh = sum(charges, (c) => c.kwh);
    const dc = sum(
      charges.filter((c) => c.type === "DC"),
      (c) => c.kwh
    );
    const priced = charges.filter((c) => this.chargeCost(c) !== null && c.kwh).map((c) => this.chargeCost(c) / c.kwh);
    let cost = 0;
    for (const c of charges) cost += this.chargeCost(c) ?? (c.kwh || 0) * this.price;
    return this._tileCard(
      "Laden",
      `<div class="big">${fmt(kwh, 0)} kWh</div>
      <div class="row" style="margin-top:6px"><span class="muted">Ladekosten</span><b>${eur(cost)}</b></div>
      <div class="row"><span class="muted">Ladungen</span><b>${charges.length}</b></div>
      <div class="row"><span class="muted">Schnellladen (DC)</span><b>${fmt((dc / kwh) * 100, 0)} %</b></div>
      ${priced.length ? `<div class="row"><span class="muted">Günstigster / teuerster Preis</span><b>${nf(2).format(Math.min(...priced))} / ${nf(2).format(Math.max(...priced))} €</b></div>` : ""}`
    );
  }

  _tile_eco(trips) {
    const vals = { accel: [], const: [], free: [] };
    for (const t of trips) for (const k in vals) if (t.eco && t.eco[k] !== undefined && t.eco[k] !== null) vals[k].push(t.eco[k]);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const rows = [
      ["Beschleunigen", avg(vals.accel)],
      ["Gleichmäßig fahren", avg(vals.const)],
      ["Rollen lassen", avg(vals.free)],
    ].filter(([, v]) => v !== null);
    if (!rows.length) return this._tileCard("Eco-Score", `<div class="hint">Noch keine Eco-Werte vorhanden.</div>`);
    return this._tileCard("Eco-Score · Durchschnitt", rows.map(([n, v]) => `<div style="margin-top:12px;font-size:13px;display:flex;justify-content:space-between"><span>${n}</span><span>${fmt(v, 0)} %</span></div><div class="prog"><i style="width:${v}%"></i></div>`).join(""));
  }

  _tile_co2(t, c, a) {
    const pe = this._petrol();
    const petrol = (a.km / 100) * pe.l * 2.37;
    const ev = a.kwh * 0.38;
    return this._tileCard(
      "CO₂-Bilanz (ca.)",
      `<div class="big">${fmt(Math.max(0, petrol - ev), 0)} kg</div><div class="hint" style="margin-top:0">weniger als mit einem Benziner</div>
      <div class="row" style="margin-top:6px"><span class="muted">Benziner</span><b>${fmt(petrol, 0)} kg</b></div>
      <div class="row"><span class="muted">Strom (Strommix)</span><b>${fmt(ev, 0)} kg</b></div>
      <div class="hint">Annahme: 2,37 kg CO₂ pro Liter Benzin, 0,38 kg pro kWh Strom.</div>`
    );
  }

  _tile_rekorde(trips, charges) {
    const longest = trips.reduce((a, b) => ((b.km || 0) > (a?.km || 0) ? b : a), null);
    const eff = trips.filter((t) => t.cons_100 && t.km >= 5);
    const best = eff.reduce((a, b) => (!a || b.cons_100 < a.cons_100 ? b : a), null);
    const worst = eff.reduce((a, b) => (!a || b.cons_100 > a.cons_100 ? b : a), null);
    const fastest = charges.reduce((a, b) => ((b.max_kw || 0) > (a?.max_kw || 0) ? b : a), null);
    const day = (t) => dm(new Date(t.start));
    const rows = [
      longest && ["Längste Fahrt", `${fmt(longest.km, 0)} km · ${day(longest)}`, longest.id],
      best && ["Sparsamste Fahrt", `${fmt(best.cons_100, 1)} kWh · ${day(best)}`, best.id],
      worst && ["Durstigste Fahrt", `${fmt(worst.cons_100, 1)} kWh · ${day(worst)}`, worst.id],
      fastest && fastest.max_kw && ["Schnellste Ladung", `${fmt(fastest.max_kw, 0)} kW · ${day(fastest)}`, null],
    ].filter(Boolean);
    return this._tileCard("Rekorde", `<div style="margin-top:6px">${rows.map(([n, v, id]) => `<div class="row" ${id ? `data-a="opentrip" data-v="${id}" style="cursor:pointer"` : ""}><span class="muted">${n}</span><b>${v}</b></div>`).join("")}</div>`);
  }

  // ------------------------------------------------------------- Dialoge
  _modalHtml() {
    const md = this.s.modal;
    if (!md) return "";
    let inner = "";
    if (md.type === "charge") {
      const c = this.charges.find((x) => x.id === md.id) || {};
      const d = c.start ? new Date(c.start) : new Date();
      inner = `<h2>Ladung bearbeiten</h2><div class="muted" style="font-size:14px">${WD_SHORT[d.getDay()]}, ${dm(d)}${d.getFullYear()} · ${hm(d)} · ${esc(c.place || "")}</div>
        <div class="two"><label class="field"><span>Geladen (kWh)</span><input data-f="kwh" inputmode="decimal" value="${c.kwh === null || c.kwh === undefined ? "" : String(c.kwh).replace(".", ",")}"></label>
        <label class="field"><span>Preis €/kWh</span><input data-f="price" inputmode="decimal" placeholder="0,59" value="${c.price === null || c.price === undefined ? "" : String(c.price).replace(".", ",")}"></label></div>
        <label class="field"><span>Oder Gesamtbetrag laut Abrechnung (€)</span><input data-f="total" inputmode="decimal" placeholder="z. B. 18,40" value="${c.total === null || c.total === undefined ? "" : String(c.total).replace(".", ",")}"></label>
        <label class="field"><span>Ort</span><input data-f="place" value="${esc(c.place || "")}"></label>
        <label class="field"><span>Notiz</span><input data-f="note" value="${esc(c.note || "")}" placeholder="z. B. EnBW-Tarif"></label>
        <div class="hint">Trag entweder den Preis pro kWh oder den Gesamtbetrag ein. Mit Gesamtbetrag wird der Preis daraus berechnet.${c.kwh_auto ? ` Automatisch erkannt: ${fmt(c.kwh_auto, 1)} kWh.` : ""}</div>
        <div class="actions"><button class="btn danger" data-a="delcharge" data-v="${c.id}">Löschen</button><span style="flex:1"></span><button class="btn" data-a="close">Abbrechen</button><button class="btn pri" data-a="savecharge" data-v="${c.id}">Speichern</button></div>`;
    } else if (md.type === "addcharge") {
      const n = new Date();
      inner = `<h2>Ladung nachtragen</h2>
        <div class="two"><label class="field"><span>Datum</span><input data-f="date" type="date" value="${isoDate(n)}"></label><label class="field"><span>Uhrzeit</span><input data-f="time" type="time" value="${hm(n)}"></label></div>
        <div class="two"><label class="field"><span>Geladen (kWh)</span><input data-f="kwh" inputmode="decimal" placeholder="30,0"></label><label class="field"><span>Preis €/kWh</span><input data-f="price" inputmode="decimal" placeholder="0,59"></label></div>
        <label class="field"><span>Oder Gesamtbetrag (€)</span><input data-f="total" inputmode="decimal"></label>
        <div class="two"><label class="field"><span>Ort</span><input data-f="place" placeholder="z. B. Ionity Hagen"></label><label class="field"><span>Art</span><select data-f="type"><option>DC</option><option>AC</option></select></label></div>
        <div class="actions"><button class="btn" data-a="close">Abbrechen</button><button class="btn pri" data-a="saveadd">Ladung speichern</button></div>`;
    } else if (md.type === "pdf") {
      const n = new Date();
      inner = `<h2>PDF herunterladen</h2><div class="muted" style="font-size:14px">Wähle den Zeitraum und was ins PDF soll.</div>
        <div class="chips" style="margin-top:14px">${[["month", "Dieser Monat"], ["lastmonth", "Letzter Monat"], ["year", "Dieses Jahr"], ["all", "Alles"], ["custom", "Eigener Zeitraum"]].map(([k, l]) => `<button class="chip ${md.range === k ? "on" : ""}" data-a="pdfrange" data-v="${k}">${l}</button>`).join("")}</div>
        ${md.range === "custom" ? `<div class="two"><label class="field"><span>Von</span><input data-f="from" type="date" value="${md.from || isoDate(new Date(n.getFullYear(), n.getMonth(), 1))}"></label><label class="field"><span>Bis</span><input data-f="to" type="date" value="${md.to || isoDate(n)}"></label></div>` : ""}
        <div class="lbl" style="margin-top:18px">Inhalt</div>
        <div class="chips" style="margin-top:10px">${[["summary", "Zusammenfassung"], ["stats", "Statistik"], ["months", "Monate"], ["trips", "Fahrten"], ["charges", "Ladungen"]].map(([k, l]) => `<button class="chip ${md.sections.includes(k) ? "on" : ""}" data-a="pdfsec" data-v="${k}">${md.sections.includes(k) ? '<ha-icon icon="mdi:check"></ha-icon>' : ""}${l}</button>`).join("")}</div>
        ${md.error ? `<div class="hint warn">${esc(md.error)}</div>` : ""}
        <div class="actions"><button class="btn" data-a="close">Abbrechen</button><button class="btn pri" data-a="makepdf"><ha-icon icon="mdi:file-download-outline"></ha-icon>PDF erstellen</button></div>`;
    } else if (md.type === "compare") {
      const pe = this._petrol();
      inner = `<h2>Vergleichswerte</h2><div class="muted" style="font-size:14px">Für die Ersparnis und die CO₂-Bilanz wird mit einem Benziner verglichen.</div>
        <div class="two"><label class="field"><span>Verbrauch l/100 km</span><input data-f="petrol_l100" inputmode="decimal" value="${nf(1).format(pe.l)}"></label><label class="field"><span>Benzinpreis €/l</span><input data-f="petrol_price" inputmode="decimal" value="${nf(2).format(pe.p)}"></label></div>
        <div class="actions"><button class="btn" data-a="close">Abbrechen</button><button class="btn pri" data-a="savecompare">Speichern</button></div>`;
    } else if (md.type === "confirm") {
      inner = `<h2>${esc(md.title)}</h2><div class="muted" style="font-size:15px;margin-top:8px">${esc(md.text)}</div>
        <div class="actions"><button class="btn" data-a="close">Abbrechen</button><button class="btn pri" style="background:#ff5f56;border-color:#ff5f56" data-a="confirmok">${esc(md.ok)}</button></div>`;
    }
    return `<div class="modalbg" data-a="bg"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
  }

  _closeModal() {
    this.s.modal = null;
    this.render();
  }

  _val(field) {
    const el = this.root.querySelector(`[data-f="${field}"]`);
    return el ? el.value.trim() : "";
  }
  _numVal(field) {
    const v = this._val(field).replace(/\s|€/g, "").replace(",", ".");
    if (v === "") return null;
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }

  // ------------------------------------------------------------- Aktionen
  async _click(e) {
    const el = e.target.closest("[data-a]");
    if (!el) return;
    const a = el.dataset.a;
    const v = el.dataset.v;
    if (a === "bg") {
      if (e.target === el) this._closeModal();
      return;
    }
    e.stopPropagation();
    const go = () => this.render();
    switch (a) {
      case "menu":
        this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
        break;
      case "tab":
        this.s.tab = v;
        this.s.sel = null;
        this.s.tilePicker = false;
        window.scrollTo(0, 0);
        this._keepScroll = true;
        go();
        break;
      case "month": {
        const d = new Date(this.s.ym.y, this.s.ym.m + Number(v), 1);
        this.s.ym = { y: d.getFullYear(), m: d.getMonth() };
        this.s.sel = null;
        go();
        break;
      }
      case "year":
        this.s.year += Number(v);
        go();
        break;
      case "gomonth":
        this.s.ym = { y: this.s.year, m: Number(v) };
        this.s.tab = "trips";
        this.s.sel = null;
        window.scrollTo(0, 0);
        this._keepScroll = true;
        go();
        break;
      case "opentrip": {
        const t = this.trips.find((x) => x.id === v);
        if (!t) break;
        const d = new Date(t.start);
        this.s.ym = { y: d.getFullYear(), m: d.getMonth() };
        if (this.s.tab !== "trips") {
          this.s.tab = "trips";
          window.scrollTo(0, 0);
          this._keepScroll = true;
        }
        this.s.sel = this.s.sel === v && el.classList.contains("trip") ? null : v;
        go();
        break;
      }
      case "closetrip":
        this.s.sel = null;
        go();
        break;
      case "savenote":
        await this._ws({ type: "update_trip", item_id: v, note: this._val("note") });
        this._toast(el, "Gespeichert");
        break;
      case "deltrip":
        this.s.modal = { type: "confirm", title: "Fahrt löschen?", text: "Die Fahrt wird endgültig aus dem Fahrtenbuch entfernt.", ok: "Löschen", action: { type: "delete_trip", item_id: v } };
        go();
        break;
      case "editcharge":
        this.s.modal = { type: "charge", id: v };
        go();
        break;
      case "addcharge":
        this.s.modal = { type: "addcharge" };
        go();
        break;
      case "savecharge": {
        const kwh = this._numVal("kwh");
        const price = this._numVal("price");
        const total = this._numVal("total");
        if ([kwh, price, total].includes(undefined)) return this._err("Bitte nur Zahlen eintragen, zum Beispiel 0,59.");
        await this._ws({ type: "update_charge", item_id: v, kwh, price: total !== null ? null : price, total, place: this._val("place") || null, note: this._val("note") });
        this._closeModal();
        break;
      }
      case "delcharge":
        this.s.modal = { type: "confirm", title: "Ladung löschen?", text: "Die Ladung wird endgültig entfernt.", ok: "Löschen", action: { type: "delete_charge", item_id: v } };
        go();
        break;
      case "saveadd": {
        const kwh = this._numVal("kwh");
        const price = this._numVal("price");
        const total = this._numVal("total");
        if (!kwh || [price, total].includes(undefined)) return this._err("Bitte die geladenen kWh als Zahl eintragen.");
        const start = new Date(`${this._val("date")}T${this._val("time") || "12:00"}`);
        if (isNaN(start)) return this._err("Bitte ein gültiges Datum eintragen.");
        await this._ws({ type: "add_charge", start: start.toISOString(), kwh, price: total !== null ? null : price, total, place: this._val("place") || null, type_: this._val("type") });
        this._closeModal();
        break;
      }
      case "confirmok":
        await this._ws(this.s.modal.action);
        if (this.s.modal.action.type === "delete_trip") this.s.sel = null;
        this._closeModal();
        break;
      case "close":
        this._closeModal();
        break;
      case "pdf":
        this.s.modal = { type: "pdf", range: "month", sections: ["summary", "stats", "months", "trips", "charges"] };
        go();
        break;
      case "pdfrange":
        this._keepModalInputs();
        this.s.modal.range = v;
        go();
        break;
      case "pdfsec": {
        this._keepModalInputs();
        const s = this.s.modal.sections;
        this.s.modal.sections = s.includes(v) ? s.filter((x) => x !== v) : [...s, v];
        go();
        break;
      }
      case "makepdf":
        await this._makePdf();
        break;
      case "period":
        this.s.statPeriod = v;
        go();
        break;
      case "statnav": {
        const { y, m } = this.s.statYm;
        if (this.s.statPeriod === "year") this.s.statYm = { y: y + Number(v), m };
        else {
          const d = new Date(y, m + Number(v), 1);
          this.s.statYm = { y: d.getFullYear(), m: d.getMonth() };
        }
        go();
        break;
      }
      case "tilepicker":
        this.s.tilePicker = !this.s.tilePicker;
        go();
        break;
      case "toggletile": {
        const cur = this.settings.tiles || DEFAULT_TILES;
        const tiles = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
        this.data.settings = { ...this.settings, tiles };
        go();
        await this._ws({ type: "settings", settings: { tiles } });
        break;
      }
      case "compare":
        this.s.modal = { type: "compare" };
        go();
        break;
      case "savecompare": {
        const l = this._numVal("petrol_l100");
        const p = this._numVal("petrol_price");
        if (!l || !p) return this._err("Bitte beide Werte als Zahl eintragen.");
        await this._ws({ type: "settings", settings: { petrol_l100: l, petrol_price: p } });
        this._closeModal();
        break;
      }
    }
  }

  _change() {}

  _keepModalInputs() {
    if (this.s.modal?.type === "pdf") {
      if (this._val("from")) this.s.modal.from = this._val("from");
      if (this._val("to")) this.s.modal.to = this._val("to");
    }
  }

  _err(text) {
    let hint = this.root.querySelector(".modal .errline");
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "hint warn errline";
      this.root.querySelector(".modal .actions")?.before(hint);
    }
    hint.textContent = text;
  }

  _toast(el, text) {
    const old = el.textContent;
    el.textContent = text;
    setTimeout(() => (el.textContent = old), 1400);
  }

  async _makePdf() {
    this._keepModalInputs();
    const md = this.s.modal;
    const n = new Date();
    let from;
    let to = n;
    if (md.range === "month") from = new Date(n.getFullYear(), n.getMonth(), 1);
    else if (md.range === "lastmonth") {
      from = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      to = new Date(n.getFullYear(), n.getMonth(), 0);
    } else if (md.range === "year") from = new Date(n.getFullYear(), 0, 1);
    else if (md.range === "all") {
      const first = [...this.trips, ...this.charges].map((x) => x.start).sort()[0];
      from = first ? new Date(first) : new Date(n.getFullYear(), 0, 1);
    } else {
      from = new Date(md.from || this._val("from"));
      to = new Date(md.to || this._val("to"));
    }
    if (isNaN(from) || isNaN(to) || from > to) return this._err("Bitte einen gültigen Zeitraum wählen.");
    if (!md.sections.length) return this._err("Bitte mindestens einen Inhalt auswählen.");
    // Fenster sofort öffnen (sonst blockiert Safari das Popup)
    const win = window.open("", "_blank");
    try {
      const path = `/api/${DOMAIN}/pdf?from=${isoDate(from)}&to=${isoDate(to)}&sections=${md.sections.join(",")}`;
      const res = await this.hass.callWS({ type: "auth/sign_path", path, expires: 300 });
      if (win) win.location.href = res.path;
      else window.location.href = res.path;
      this._closeModal();
    } catch (err) {
      if (win) win.close();
      this._err("PDF konnte nicht erstellt werden: " + (err.message || err));
    }
  }

  // ------------------------------------------------------------- Karten
  _mountMaps() {
    if (!this.root) return;
    const L = window.L;
    const holders = this.root.querySelectorAll("[data-map]");
    if (!L) return;
    const keep = {};
    holders.forEach((h) => {
      const kind = h.dataset.map;
      let key;
      let pts = [];
      if (kind === "trip") {
        const t = this.trips.find((x) => x.id === h.dataset.id);
        if (!t) return;
        key = "trip:" + t.id + (this._isNarrow() ? ":n" : "");
        if (t.start_lat != null) pts.push(["start", t.start_lat, t.start_lon]);
        if (t.end_lat != null) pts.push(["end", t.end_lat, t.end_lon]);
      } else {
        const st = this._st("tracker");
        const lat = st?.attributes?.latitude;
        const lon = st?.attributes?.longitude;
        key = "car";
        if (lat != null) pts.push(["car", lat, lon]);
      }
      const sig = JSON.stringify(pts);
      const cached = this._maps[key];
      if (cached && cached.sig === sig) {
        h.replaceWith(cached.el);
        cached.el.style.height = h.style.height;
        keep[key] = cached;
        setTimeout(() => cached.map.invalidateSize(), 0);
        return;
      }
      if (cached) cached.map.remove();
      if (!pts.length) {
        h.innerHTML = `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#7d8287;font-size:13px">Keine Position vorhanden</div>`;
        return;
      }
      const map = L.map(h, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> © <a href="https://carto.com/" target="_blank">CARTO</a>',
      }).addTo(map);
      const ll = pts.map((p) => [p[1], p[2]]);
      for (const p of pts) L.marker([p[1], p[2]], { icon: L.divIcon({ className: "", html: `<div class="pin ${p[0]}"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(map);
      if (ll.length === 2) {
        L.polyline(ll, { color: "#00adef", weight: 2, dashArray: "6 6" }).addTo(map);
        map.fitBounds(ll, { padding: [36, 36], maxZoom: 15 });
      } else map.setView(ll[0], 14);
      keep[key] = { el: h, map, sig };
      setTimeout(() => map.invalidateSize(), 50);
    });
    for (const k in this._maps) if (!keep[k]) this._maps[k].map.remove();
    this._maps = keep;
  }
}

const CAR_SVG = `<svg viewBox="0 0 440 150" width="100%" style="margin:16px 0 12px;max-height:170px" aria-hidden="true">
  <defs><linearGradient id="eqbBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9ecef"/><stop offset=".55" stop-color="#b9c0c7"/><stop offset="1" stop-color="#7d858d"/></linearGradient></defs>
  <ellipse cx="220" cy="136" rx="190" ry="8" fill="#000" opacity=".6"/>
  <path d="M34 112 L36 82 Q38 70 52 66 L104 58 L146 28 Q154 22 170 22 L318 22 Q336 22 346 32 L376 62 L396 68 Q408 72 408 86 L408 112 Z" fill="url(#eqbBody)"/>
  <path d="M156 32 L232 32 L232 60 L124 60 Z M240 32 L316 32 Q328 32 334 40 L352 60 L240 60 Z" fill="#14171a"/>
  <path d="M36 92 L408 92" stroke="#5d656c" stroke-width="1.5"/>
  <rect x="392" y="74" width="16" height="6" rx="3" fill="#fff"/><rect x="34" y="76" width="12" height="6" rx="2" fill="#e0262b"/>
  <circle cx="110" cy="114" r="26" fill="#0b0c0e"/><circle cx="110" cy="114" r="15" fill="#4a5056"/><circle cx="110" cy="114" r="5" fill="#0b0c0e"/>
  <circle cx="332" cy="114" r="26" fill="#0b0c0e"/><circle cx="332" cy="114" r="15" fill="#4a5056"/><circle cx="332" cy="114" r="5" fill="#0b0c0e"/>
</svg>`;

customElements.define("eqb-fahrtenbuch-panel", EqbFahrtenbuchPanel);
