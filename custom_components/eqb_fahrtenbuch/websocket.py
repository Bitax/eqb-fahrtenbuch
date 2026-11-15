"""Websocket-Befehle für die Oberfläche."""

from __future__ import annotations

import uuid
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .logbook_core import average_price


def _manager(hass: HomeAssistant):
    for key, value in hass.data.get(DOMAIN, {}).items():
        if not key.startswith("_"):
            return value
    return None


def _payload(m) -> dict[str, Any]:
    return {
        "entities": m.mapping,
        "trips": m.book.trips,
        "charges": m.book.charges,
        "active_trip": m.book.active_trip,
        "active_charge": m.book.active_charge,
        "settings": m.book.settings,
        "capacity": m.book.capacity,
        "default_price": m.default_price,
        "avg_price": average_price(m.book.charges, m.default_price),
    }


@callback
def async_register_websocket(hass: HomeAssistant) -> None:
    for cmd in (ws_get, ws_subscribe, ws_update_trip, ws_delete_trip, ws_update_charge, ws_add_charge, ws_delete_charge, ws_settings):
        websocket_api.async_register_command(hass, cmd)


def _not_ready(connection, msg) -> None:
    connection.send_error(msg["id"], "not_ready", "Fahrtenbuch ist noch nicht eingerichtet.")


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get"})
@callback
def ws_get(hass, connection, msg):
    m = _manager(hass)
    if not m:
        return _not_ready(connection, msg)
    connection.send_result(msg["id"], _payload(m))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(hass, connection, msg):
    m = _manager(hass)
    if not m:
        return _not_ready(connection, msg)

    @callback
    def _send() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {"changed": True}))

    connection.subscriptions[msg["id"]] = m.add_listener(_send)
    connection.send_result(msg["id"])


def _find(items: list[dict], item_id: str) -> dict | None:
    return next((i for i in items if i.get("id") == item_id), None)


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/update_trip", vol.Required("item_id"): str, vol.Optional("note"): str}
)
@callback
def ws_update_trip(hass, connection, msg):
    m = _manager(hass)
    trip = _find(m.book.trips, msg["item_id"]) if m else None
    if not trip:
        return connection.send_error(msg["id"], "not_found", "Fahrt nicht gefunden.")
    if "note" in msg:
        trip["note"] = msg["note"][:500]
    m.changed()
    connection.send_result(msg["id"], trip)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/delete_trip", vol.Required("item_id"): str})
@callback
def ws_delete_trip(hass, connection, msg):
    m = _manager(hass)
    if not m:
        return _not_ready(connection, msg)
    m.book.trips = [t for t in m.book.trips if t.get("id") != msg["item_id"]]
    m.changed()
    connection.send_result(msg["id"])


_NUM = vol.Any(None, vol.Coerce(float))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_charge",
        vol.Required("item_id"): str,
        vol.Optional("kwh"): _NUM,
        vol.Optional("price"): _NUM,
        vol.Optional("total"): _NUM,
        vol.Optional("place"): vol.Any(None, str),
        vol.Optional("note"): str,
    }
)
@callback
def ws_update_charge(hass, connection, msg):
    m = _manager(hass)
    charge = _find(m.book.charges, msg["item_id"]) if m else None
    if not charge:
        return connection.send_error(msg["id"], "not_found", "Ladung nicht gefunden.")
    for key in ("kwh", "price", "total", "place", "note"):
        if key in msg:
            charge[key] = msg[key]
    if charge.get("kwh") is None:
        charge["kwh"] = charge.get("kwh_auto")
    m.changed()
    connection.send_result(msg["id"], charge)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/add_charge",
        vol.Required("start"): str,
        vol.Required("kwh"): vol.Coerce(float),
        vol.Optional("price"): _NUM,
        vol.Optional("total"): _NUM,
        vol.Optional("type_"): vol.Any(None, str),
        vol.Optional("place"): vol.Any(None, str),
        vol.Optional("note"): str,
    }
)
@callback
def ws_add_charge(hass, connection, msg):
    m = _manager(hass)
    if not m:
        return _not_ready(connection, msg)
    charge = {
        "id": uuid.uuid4().hex[:12],
        "start": msg["start"],
        "end": msg["start"],
        "soc_start": None,
        "soc_end": None,
        "kwh": msg["kwh"],
        "kwh_auto": None,
        "type": msg.get("type_"),
        "max_kw": None,
        "lat": None,
        "lon": None,
        "place": msg.get("place"),
        "price": msg.get("price"),
        "total": msg.get("total"),
        "note": msg.get("note", ""),
        "manual": True,
    }
    m.book.charges.append(charge)
    m.book.charges.sort(key=lambda c: c["start"])
    m.changed()
    connection.send_result(msg["id"], charge)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/delete_charge", vol.Required("item_id"): str})
@callback
def ws_delete_charge(hass, connection, msg):
    m = _manager(hass)
    if not m:
        return _not_ready(connection, msg)
    m.book.charges = [c for c in m.book.charges if c.get("id") != msg["item_id"]]
    m.changed()
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/settings", vol.Required("settings"): dict}
)
@callback
def ws_settings(hass, connection, msg):
    m = _manager(hass)
    if not m:
        return _not_ready(connection, msg)
    m.book.settings.update(msg["settings"])
    m.changed()
    connection.send_result(msg["id"], m.book.settings)
