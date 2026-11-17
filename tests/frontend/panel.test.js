// Rendert das Panel so, wie Home Assistant es einbindet (panel, hass, narrow, route),
// und zeichnet alle Seiten mit und ohne Fahrten. Ausführen:
//   npm install --no-save jsdom && node tests/frontend/panel.test.js
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../../custom_components/eqb_fahrtenbuch/frontend/panel.js"), "utf8");

const now = Date.now();
const trip = (id, minAgo, km) => ({
  id, start: new Date(now - minAgo * 60e3).toISOString().replace("Z", "123+00:00"), end: new Date(now - (minAgo - 15) * 60e3).toISOString(),
  km, kwh: km * 0.26, cons_100: km >= 1 ? 26 : null, kwh_source: "fahrzeug", minutes: 15, avg_speed: km * 4,
  start_odo: 30000, end_odo: 30000 + km, start_soc: 80, end_soc: 78, start_lat: 51.39, start_lon: 7.18, end_lat: 51.4, end_lon: 7.19,
  start_name: "Hattingen, Holthausen", end_name: "Hattingen, Holthausen", eco: { accel: 80 }, temp: 6, note: "",
});
const full = { entities: {}, trips: [trip("a", 120, 12), trip("b", 30, 1)], charges: [], active_trip: null, active_charge: null, settings: {}, capacity: 66.5, default_price: 0.59, avg_price: 0.59 };
const empty = { ...full, trips: [] };

async function check(name, data) {
  const w = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", pretendToBeVisual: true }).window;
  w.scrollTo = () => {};
  w.eval(src);
  const el = w.document.createElement("eqb-fahrtenbuch-panel");
  w.document.body.appendChild(el);
  // Reihenfolge wie ha-panel-custom
  el.panel = { config: { static: "/eqb_fahrtenbuch_static" } };
  el.hass = { states: {}, callWS: async () => JSON.parse(JSON.stringify(data)), connection: { subscribeMessage: async () => () => {}, addEventListener() {}, removeEventListener() {} } };
  el.narrow = false;
  el.route = { prefix: "/fahrtenbuch", path: "" };
  await new Promise((r) => setTimeout(r, 30));
  let failed = 0;
  for (const tab of ["overview", "trips", "months", "charges", "stats"]) {
    el.s.tab = tab;
    el.s.sel = tab === "trips" && data.trips.length ? data.trips[0].id : null;
    try {
      el.render();
      if (/Lädt …/.test(el.shadowRoot.textContent)) throw new Error("bleibt bei „Lädt …“ stehen");
    } catch (e) {
      failed++;
      console.log(`FEHLER ${name} / ${tab}: ${e.message}`);
    }
  }
  console.log(`${name}: ${failed ? failed + " Seite(n) fehlerhaft" : "alle Seiten ok"}`);
  return failed;
}

(async () => {
  const bad = (await check("mit Fahrten", full)) + (await check("ohne Fahrten", empty));
  process.exit(bad ? 1 : 0);
})();
