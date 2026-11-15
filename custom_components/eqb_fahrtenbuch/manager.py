"""Verbindet die Fahrtenbuch-Logik mit Home Assistant."""

from __future__ import annotations

import asyncio
import logging
import math
from collections.abc import Callable
from typing import Any

from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    COUPLER_PLUGGED,
    DOMAIN,
    FINALIZE_DELAY,
    IGNITION_OFF,
    IGNITION_ON,
    KEY_CHARGE_POWER,
    KEY_CHARGING,
    KEY_CONS_START,
    KEY_COUPLER_AC,
    KEY_COUPLER_DC,
    KEY_DIST_START,
    KEY_ECO_ACCEL,
    KEY_ECO_BONUS,
    KEY_ECO_CONST,
    KEY_ECO_FREE,
    KEY_IGNITION,
    KEY_ODOMETER,
    KEY_SOC,
    KEY_TRACKER,
    STORAGE_VERSION,
)
from .logbook_core import Logbook, Snapshot, fnum

_LOGGER = logging.getLogger(__name__)

NOMINATIM = "https://nominatim.openstreetmap.org/reverse"


class FahrtenbuchManager:
    """Beobachtet die Mercedes-Entitäten und pflegt Fahrten und Ladungen."""

    def __init__(self, hass: HomeAssistant, entry_id: str, mapping: dict[str, str], capacity: float, default_price: float) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self.mapping = mapping
        self.default_price = default_price
        self.store: Store = Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry_id}")
        self.book = Logbook(capacity=capacity)
        self._unsubs: list[CALLBACK_TYPE] = []
        self._finalize_trip_cancel: CALLBACK_TYPE | None = None
        self._finalize_charge_cancel: CALLBACK_TYPE | None = None
        self._listeners: set[Callable[[], None]] = set()
        self._geo_lock = asyncio.Lock()
        self._geo_cache: dict[str, str | None] = {}

    # ------------------------------------------------------------ Start/Stopp
    async def async_start(self) -> None:
        data = await self.store.async_load()
        capacity = self.book.capacity
        self.book = Logbook(data, capacity=capacity)

        watch = [self.mapping.get(k) for k in (KEY_IGNITION, KEY_ODOMETER, KEY_CHARGING, KEY_CHARGE_POWER)]
        watch = [w for w in watch if w]
        self._unsubs.append(async_track_state_change_event(self.hass, watch, self._on_change))

        # Nach einem Neustart: angefangene Fahrt/Ladung sauber weiterführen
        if self.book.active_trip and self.book.active_trip.get("ended_at"):
            self._schedule_trip_finalize(30)
        elif self.book.active_trip and self._raw(KEY_IGNITION) in IGNITION_OFF:
            self.book.mark_trip_end(self._now())
            self._schedule_trip_finalize(30)
        if self.book.active_charge and self._raw(KEY_CHARGING) == "off":
            self._schedule_charge_finalize(30)

        # Fehlende Ortsnamen nachtragen
        self.hass.async_create_task(self._fill_missing_places())

    async def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        for cancel in (self._finalize_trip_cancel, self._finalize_charge_cancel):
            if cancel:
                cancel()
        await self.store.async_save(self.book.to_dict())

    # ------------------------------------------------------------ Hilfen
    def _now(self) -> str:
        return dt_util.utcnow().isoformat()

    def _raw(self, key: str) -> str | None:
        entity_id = self.mapping.get(key)
        if not entity_id:
            return None
        state = self.hass.states.get(entity_id)
        return state.state if state else None

    def _num(self, key: str) -> float | None:
        return fnum(self._raw(key))

    def _charge_kind(self) -> str | None:
        if self._raw(KEY_COUPLER_DC) in COUPLER_PLUGGED:
            return "DC"
        if self._raw(KEY_COUPLER_AC) in COUPLER_PLUGGED:
            return "AC"
        return None

    def snapshot(self) -> Snapshot:
        lat = lon = None
        tracker = self.mapping.get(KEY_TRACKER)
        if tracker and (st := self.hass.states.get(tracker)):
            lat = fnum(st.attributes.get("latitude"))
            lon = fnum(st.attributes.get("longitude"))
            if lat == 0 and lon == 0:
                lat = lon = None
        temp = None
        odo_id = self.mapping.get(KEY_ODOMETER)
        if odo_id and (st := self.hass.states.get(odo_id)):
            temp = fnum(st.attributes.get("outsideTemperature"))
        return Snapshot(
            time=self._now(),
            odo=self._num(KEY_ODOMETER),
            soc=self._num(KEY_SOC),
            lat=lat,
            lon=lon,
            cons_start=self._num(KEY_CONS_START),
            dist_start=self._num(KEY_DIST_START),
            temp=temp,
            eco={
                "accel": self._num(KEY_ECO_ACCEL),
                "const": self._num(KEY_ECO_CONST),
                "free": self._num(KEY_ECO_FREE),
                "bonus": self._num(KEY_ECO_BONUS),
            },
        )

    # ------------------------------------------------------------ Ereignisse
    @callback
    def _on_change(self, event: Event) -> None:
        entity_id = event.data["entity_id"]
        new = event.data.get("new_state")
        old = event.data.get("old_state")
        if new is None:
            return
        n, o = new.state, (old.state if old else None)

        if entity_id == self.mapping.get(KEY_IGNITION):
            if n in IGNITION_ON and o not in IGNITION_ON:
                self._trip_started()
            elif n in IGNITION_OFF and self.book.active_trip:
                self.book.mark_trip_end(self._now())
                self._schedule_trip_finalize(FINALIZE_DELAY)
                self._save()

        elif entity_id == self.mapping.get(KEY_ODOMETER):
            # Rückfallebene: Fahrt läuft, aber der Zündungswechsel kam nicht an
            if (
                not self.book.active_trip
                and self._raw(KEY_IGNITION) in IGNITION_ON
                and fnum(n) is not None
                and fnum(o) is not None
                and fnum(n) > fnum(o)
            ):
                self.book.start_trip(self.snapshot(), from_park=bool(self.book.last_park))
                self._save()

        elif entity_id == self.mapping.get(KEY_CHARGING):
            if n == "on" and o != "on":
                if self._finalize_charge_cancel:  # kurz unterbrochen -> gleiche Ladung
                    self._finalize_charge_cancel()
                    self._finalize_charge_cancel = None
                elif not self.book.active_charge:
                    self.book.start_charge(self.snapshot(), self._charge_kind())
                    self.book.charge_power(self._now(), self._num(KEY_CHARGE_POWER))
                    self._save()
            elif n == "off" and o == "on" and self.book.active_charge:
                self.book.charge_power(self._now(), 0.0)
                self._schedule_charge_finalize(90)

        elif entity_id == self.mapping.get(KEY_CHARGE_POWER):
            if self.book.active_charge:
                self.book.charge_power(self._now(), fnum(n), self._charge_kind())

    def _trip_started(self) -> None:
        if self.book.active_trip:
            if self.book.active_trip.get("ended_at"):
                # Kurzer Halt: vorherige Fahrt jetzt abschließen
                if self._finalize_trip_cancel:
                    self._finalize_trip_cancel()
                    self._finalize_trip_cancel = None
                self._finalize_trip_now()
            else:
                return  # läuft schon
        self.book.start_trip(self.snapshot())
        self._save()

    def _schedule_trip_finalize(self, delay: float) -> None:
        if self._finalize_trip_cancel:
            self._finalize_trip_cancel()

        @callback
        def _run(_now: Any) -> None:
            self._finalize_trip_cancel = None
            self._finalize_trip_now()

        self._finalize_trip_cancel = async_call_later(self.hass, delay, _run)

    def _finalize_trip_now(self) -> None:
        trip = self.book.finalize_trip(self.snapshot())
        self._save()
        if trip:
            _LOGGER.info("Fahrt gespeichert: %s km", trip["km"])
            self.hass.async_create_task(self._name_trip(trip))

    def _schedule_charge_finalize(self, delay: float) -> None:
        if self._finalize_charge_cancel:
            self._finalize_charge_cancel()

        @callback
        def _run(_now: Any) -> None:
            self._finalize_charge_cancel = None
            charge = self.book.finalize_charge(self.snapshot(), self._charge_kind())
            self._save()
            if charge:
                self.hass.async_create_task(self._name_charge(charge))

        self._finalize_charge_cancel = async_call_later(self.hass, delay, _run)

    # ------------------------------------------------------------ Speichern / Benachrichtigen
    @callback
    def _save(self) -> None:
        self.store.async_delay_save(self.book.to_dict, 2)
        for listener in list(self._listeners):
            listener()

    @callback
    def add_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        self._listeners.add(listener)
        return lambda: self._listeners.discard(listener)

    @callback
    def changed(self) -> None:
        self._save()

    # ------------------------------------------------------------ Ortsnamen
    async def _name_trip(self, trip: dict) -> None:
        trip["start_name"] = await self.place_name(trip.get("start_lat"), trip.get("start_lon"))
        trip["end_name"] = await self.place_name(trip.get("end_lat"), trip.get("end_lon"))
        self._save()

    async def _name_charge(self, charge: dict) -> None:
        charge["place"] = await self.place_name(charge.get("lat"), charge.get("lon"))
        self._save()

    async def _fill_missing_places(self) -> None:
        changed = False
        for trip in self.book.trips[-60:]:
            if trip.get("start_name") is None and trip.get("start_lat") is not None:
                trip["start_name"] = await self.place_name(trip["start_lat"], trip["start_lon"])
                changed = True
            if trip.get("end_name") is None and trip.get("end_lat") is not None:
                trip["end_name"] = await self.place_name(trip["end_lat"], trip["end_lon"])
                changed = True
        for charge in self.book.charges[-30:]:
            if charge.get("place") is None and charge.get("lat") is not None:
                charge["place"] = await self.place_name(charge["lat"], charge["lon"])
                changed = True
        if changed:
            self._save()

    def _zone_name(self, lat: float, lon: float) -> str | None:
        best = None
        for state in self.hass.states.async_all("zone"):
            zlat = state.attributes.get("latitude")
            zlon = state.attributes.get("longitude")
            radius = state.attributes.get("radius", 100)
            if zlat is None or zlon is None or state.attributes.get("passive"):
                continue
            dist = _distance_m(lat, lon, zlat, zlon)
            if dist <= max(radius, 150) and (best is None or dist < best[0]):
                name = "Zuhause" if state.entity_id == "zone.home" else state.name
                best = (dist, name)
        return best[1] if best else None

    async def place_name(self, lat: float | None, lon: float | None) -> str | None:
        if lat is None or lon is None:
            return None
        if zone := self._zone_name(lat, lon):
            return zone
        key = f"{lat:.4f},{lon:.4f}"
        if key in self._geo_cache:
            return self._geo_cache[key]
        async with self._geo_lock:
            name = None
            try:
                session = async_get_clientsession(self.hass)
                async with session.get(
                    NOMINATIM,
                    params={"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 16, "accept-language": "de"},
                    headers={"User-Agent": "HomeAssistant-EQB-Fahrtenbuch/1.0"},
                    timeout=10,
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        addr = data.get("address", {})
                        city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality")
                        part = addr.get("suburb") or addr.get("road") or addr.get("neighbourhood")
                        name = ", ".join(p for p in (city, part) if p) or data.get("name")
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Ortsname nicht gefunden: %s", err)
                return None
            await asyncio.sleep(1.1)  # Nominatim erlaubt 1 Anfrage pro Sekunde
            self._geo_cache[key] = name
            return name


def _distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
