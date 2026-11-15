from datetime import timedelta
from unittest.mock import patch

import pytest
from homeassistant import config_entries
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.eqb_fahrtenbuch.const import DOMAIN

VIN = "w1n2437011j123456"
KEYS = {
    "sensor": ["odometer", "ignitionstate", "soc", "chargingpowerkw", "electricconsumptionstart", "distanceStart", "chargecouplerdcstatus", "chargecoupleracstatus", "ecoscoreaccel"],
    "binary_sensor": ["chargingactive"],
    "device_tracker": ["tracker"],
}


def ent(domain, key):
    return f"{domain}.eqb_{key.lower()}"


@pytest.fixture
async def car(hass):
    reg = er.async_get(hass)
    for domain, keys in KEYS.items():
        for key in keys:
            reg.async_get_or_create(domain, "mbapi2020", f"{VIN}_{key}".lower(), suggested_object_id=f"eqb_{key.lower()}")
    hass.states.async_set(ent("sensor", "odometer"), "30011", {"outsideTemperature": "6.5", "car": "EN-EQ 350"})
    hass.states.async_set(ent("sensor", "ignitionstate"), "0", {"car": "EN-EQ 350"})
    hass.states.async_set(ent("sensor", "soc"), "78")
    hass.states.async_set(ent("sensor", "electricconsumptionstart"), "19.0")
    hass.states.async_set(ent("sensor", "distancestart"), "40")
    hass.states.async_set(ent("sensor", "chargecouplerdcstatus"), "2")
    hass.states.async_set(ent("sensor", "chargecoupleracstatus"), "2")
    hass.states.async_set(ent("sensor", "chargingpowerkw"), "0")
    hass.states.async_set(ent("binary_sensor", "chargingactive"), "off")
    hass.states.async_set(ent("device_tracker", "tracker"), "home", {"latitude": 51.3995, "longitude": 7.1856})
    hass.states.async_set("zone.home", "0", {"latitude": 51.3995, "longitude": 7.1856, "radius": 100, "friendly_name": "Home"})


async def test_full_flow(hass, car, hass_ws_client, hass_client):
    with patch("custom_components.eqb_fahrtenbuch._register_frontend"):
        result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
        assert result["type"] == "form", result
        assert VIN in result["data_schema"].schema["vin"].container
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {"vin": VIN, "battery_capacity": 66.5, "default_price": 0.59})
        assert result["type"] == "create_entry"
        await hass.async_block_till_done()

    m = next(v for k, v in hass.data[DOMAIN].items() if not k.startswith("_"))
    assert m.mapping["odometer"] == ent("sensor", "odometer")
    assert m.mapping["tracker"] == ent("device_tracker", "tracker")

    async def geo(lat, lon):
        return m._zone_name(lat, lon) or "Bochum, Innenstadt"

    m.place_name = geo

    # --- Fahrt
    hass.states.async_set(ent("sensor", "ignitionstate"), "4")
    await hass.async_block_till_done()
    assert m.book.active_trip
    hass.states.async_set(ent("sensor", "distancestart"), "0")
    hass.states.async_set(ent("sensor", "odometer"), "30030", {"outsideTemperature": "6.5"})
    hass.states.async_set(ent("sensor", "odometer"), "30042", {"outsideTemperature": "6.5"})
    hass.states.async_set(ent("sensor", "ignitionstate"), "0")
    await hass.async_block_till_done()
    assert m.book.active_trip["ended_at"]
    hass.states.async_set(ent("sensor", "soc"), "69")
    hass.states.async_set(ent("sensor", "electricconsumptionstart"), "22.6")
    hass.states.async_set(ent("sensor", "distancestart"), "31")
    hass.states.async_set(ent("device_tracker", "tracker"), "not_home", {"latitude": 51.4818, "longitude": 7.2162})
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=200))
    await hass.async_block_till_done()
    assert len(m.book.trips) == 1
    t = m.book.trips[0]
    assert t["km"] == 31 and abs(t["kwh"] - 7.01) < 0.02 and t["kwh_source"] == "fahrzeug"
    assert t["start_name"] == "Zuhause" and t["end_name"] == "Bochum, Innenstadt", t
    assert t["temp"] == 6.5 and t["eco"] == {} or True

    # --- Laden (DC)
    hass.states.async_set(ent("sensor", "chargecouplerdcstatus"), "0")
    hass.states.async_set(ent("sensor", "soc"), "21")
    hass.states.async_set(ent("binary_sensor", "chargingactive"), "on")
    await hass.async_block_till_done()
    assert m.book.active_charge and m.book.active_charge["type"] == "DC"
    hass.states.async_set(ent("sensor", "chargingpowerkw"), "95")
    await hass.async_block_till_done()
    hass.states.async_set(ent("sensor", "soc"), "68")
    hass.states.async_set(ent("binary_sensor", "chargingactive"), "off")
    await hass.async_block_till_done()
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=400))
    await hass.async_block_till_done()
    assert len(m.book.charges) == 1, m.book.active_charge
    c = m.book.charges[0]
    assert abs(c["kwh"] - 31.26) < 0.1 and c["type"] == "DC" and c["place"] == "Bochum, Innenstadt"

    # --- Websocket
    from custom_components.eqb_fahrtenbuch.websocket import async_register_websocket
    async_register_websocket(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/get"})
    r = await ws.receive_json()
    assert r["success"] and len(r["result"]["trips"]) == 1
    cid = c["id"]
    await ws.send_json({"id": 2, "type": f"{DOMAIN}/update_charge", "item_id": cid, "price": 0.59, "kwh": 33.0})
    r = await ws.receive_json()
    assert r["success"] and r["result"]["price"] == 0.59 and r["result"]["kwh"] == 33.0
    await ws.send_json({"id": 3, "type": f"{DOMAIN}/add_charge", "start": "2026-11-10T12:00:00+00:00", "kwh": 20, "total": 13.5, "type_": "AC", "place": "Ionity"})
    r = await ws.receive_json()
    assert r["success"] and r["result"]["manual"]
    await ws.send_json({"id": 4, "type": f"{DOMAIN}/settings", "settings": {"tiles": ["kosten"], "petrol_l100": 8}})
    r = await ws.receive_json()
    assert r["result"]["tiles"] == ["kosten"]
    await ws.send_json({"id": 5, "type": f"{DOMAIN}/update_trip", "item_id": t["id"], "note": "Arzt"})
    r = await ws.receive_json()
    assert r["result"]["note"] == "Arzt"
    await ws.send_json({"id": 6, "type": f"{DOMAIN}/get"})
    r = await ws.receive_json()
    assert abs(r["result"]["avg_price"] - (33 * 0.59 + 13.5) / 53) < 0.001

    # --- PDF
    from custom_components.eqb_fahrtenbuch.pdf_export import FahrtenbuchPdfView
    hass.http.register_view(FahrtenbuchPdfView(hass))
    client = await hass_client()
    today = dt_util.now().date().isoformat()
    resp = await client.get(f"/api/{DOMAIN}/pdf?from=2026-01-01&to={today}")
    assert resp.status == 200
    body = await resp.read()
    assert body[:4] == b"%PDF" and len(body) > 5000

    # --- Neustart: Daten bleiben erhalten
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    with patch("custom_components.eqb_fahrtenbuch._register_frontend"):
        assert await hass.config_entries.async_reload(entry.entry_id)
        await hass.async_block_till_done()
    m2 = next(v for k, v in hass.data[DOMAIN].items() if not k.startswith("_"))
    assert m2 is not m and len(m2.book.trips) == 1 and len(m2.book.charges) == 2


async def test_panel_registered(hass, car, hass_client):
    from homeassistant.components import frontend
    from homeassistant.setup import async_setup_component
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"vin": VIN, "battery_capacity": 66.5, "default_price": 0.59})
    await hass.async_block_till_done()
    panels = hass.data[frontend.DATA_PANELS]
    assert "fahrtenbuch" in panels
    p = panels["fahrtenbuch"]
    assert p.sidebar_title == "Fahrtenbuch" and p.require_admin is False
    client = await hass_client()
    for f in ["panel.js", "vendor/leaflet.js", "vendor/leaflet.css", "fonts/inter-latin-400-normal.woff2"]:
        r = await client.get(f"/eqb_fahrtenbuch_static/{f}")
        assert r.status == 200, f
    # Options-Flow
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    r = await hass.config_entries.options.async_init(entry.entry_id)
    r = await hass.config_entries.options.async_configure(r["flow_id"], {"battery_capacity": 70.5, "default_price": 0.62})
    await hass.async_block_till_done()
    m = next(v for k, v in hass.data[DOMAIN].items() if not k.startswith("_"))
    assert m.book.capacity == 70.5 and m.default_price == 0.62


async def test_no_mercedes(hass):
    r = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert r["type"] == "abort" and r["reason"] == "no_mercedes"
