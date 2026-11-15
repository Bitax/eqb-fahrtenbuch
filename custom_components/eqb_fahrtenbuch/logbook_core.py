"""Reine Fahrtenbuch-Logik ohne Home-Assistant-Abhängigkeiten (gut testbar).

Alle Zeiten sind ISO-Strings in UTC. Werte, die das Auto nicht liefert, sind None.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any


def fnum(value: Any) -> float | None:
    """Wert robust in float umwandeln ('22,6', '30042', 'unknown' ...)."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", ".")
    if text.lower() in ("", "unknown", "unavailable", "none", "error", "not_received"):
        return None
    # Einheiten am Ende abschneiden ("8.0 °C")
    num = ""
    for ch in text:
        if ch.isdigit() or ch in ".-":
            num += ch
        elif num:
            break
    try:
        return float(num)
    except ValueError:
        return None


def _r(value: float | None, digits: int = 1) -> float | None:
    return None if value is None else round(value, digits)


@dataclass
class Snapshot:
    """Momentaufnahme der Fahrzeugwerte."""

    time: str
    odo: float | None = None
    soc: float | None = None
    lat: float | None = None
    lon: float | None = None
    cons_start: float | None = None  # kWh/100 km seit Start
    dist_start: float | None = None  # km seit Start
    temp: float | None = None
    eco: dict[str, float | None] = field(default_factory=dict)


def _minutes(start: str, end: str) -> float:
    from datetime import datetime

    a = datetime.fromisoformat(start)
    b = datetime.fromisoformat(end)
    return max((b - a).total_seconds() / 60.0, 0.0)


class Logbook:
    """Hält Fahrten und Ladungen und entscheidet, wann etwas beginnt oder endet."""

    def __init__(self, data: dict | None = None, capacity: float = 66.5) -> None:
        data = data or {}
        self.capacity = capacity
        self.trips: list[dict] = data.get("trips", [])
        self.charges: list[dict] = data.get("charges", [])
        self.active_trip: dict | None = data.get("active_trip")
        self.active_charge: dict | None = data.get("active_charge")
        self.last_park: dict | None = data.get("last_park")
        self.settings: dict = data.get("settings", {})

    def to_dict(self) -> dict:
        return {
            "trips": self.trips,
            "charges": self.charges,
            "active_trip": self.active_trip,
            "active_charge": self.active_charge,
            "last_park": self.last_park,
            "settings": self.settings,
        }

    # ------------------------------------------------------------------ Fahrten
    def start_trip(self, snap: Snapshot, from_park: bool = False) -> None:
        """Neue Fahrt beginnen. from_park: Startdaten aus dem letzten Parken nehmen."""
        start = {
            "start": snap.time,
            "start_odo": snap.odo,
            "start_soc": snap.soc,
            "start_lat": snap.lat,
            "start_lon": snap.lon,
            "ds0": snap.dist_start,
            "e0": self._energy_start(snap),
            "temp": snap.temp,
            "ended_at": None,
        }
        if from_park and self.last_park:
            p = self.last_park
            start.update(
                start=p.get("time") or snap.time,
                start_odo=p.get("odo", snap.odo),
                start_soc=p.get("soc", snap.soc),
                start_lat=p.get("lat", snap.lat),
                start_lon=p.get("lon", snap.lon),
                ds0=None,
                e0=None,
            )
        self.active_trip = start

    def mark_trip_end(self, time: str) -> None:
        if self.active_trip and not self.active_trip.get("ended_at"):
            self.active_trip["ended_at"] = time

    def finalize_trip(self, snap: Snapshot) -> dict | None:
        """Fahrt mit den aktuellen Werten abschließen. Gibt die Fahrt zurück oder None."""
        t = self.active_trip
        self.active_trip = None
        if not t:
            return None
        end_time = t.get("ended_at") or snap.time
        self.last_park = {
            "time": end_time,
            "odo": snap.odo,
            "soc": snap.soc,
            "lat": snap.lat,
            "lon": snap.lon,
        }

        km_odo = None
        if snap.odo is not None and t.get("start_odo") is not None:
            km_odo = snap.odo - t["start_odo"]
        ds0, ds1 = t.get("ds0"), snap.dist_start
        km_ds = None
        if ds1 is not None:
            if ds0 is not None and ds1 >= ds0:
                km_ds = ds1 - ds0
            # Wurde "seit Start" beim Losfahren zurückgesetzt, ist ds1 die ganze Fahrt
            if km_odo is not None and abs(ds1 - km_odo) <= 1.5 and (km_ds is None or abs(km_ds - km_odo) > 1.5):
                km_ds = ds1
        km = km_odo
        if km is None or (km < 1 and km_ds):  # Kilometerstand nur in ganzen km
            km = km_ds if km_ds is not None else km
        if km is None or km < 0:
            return None
        if km < 0.2:
            return None  # nur Zündung an, nicht gefahren

        kwh, source = self._trip_energy(t, snap, km)
        minutes = _minutes(t["start"], end_time)
        trip = {
            "id": uuid.uuid4().hex[:12],
            "start": t["start"],
            "end": end_time,
            "km": _r(km),
            "start_odo": t.get("start_odo"),
            "end_odo": snap.odo,
            "start_soc": t.get("start_soc"),
            "end_soc": snap.soc,
            "kwh": _r(kwh, 2),
            "kwh_source": source,
            "cons_100": _r(kwh / km * 100) if kwh is not None and km > 0 else None,
            "minutes": _r(minutes, 0),
            "avg_speed": _r(km / (minutes / 60.0), 0) if minutes >= 1 else None,
            "start_lat": t.get("start_lat"),
            "start_lon": t.get("start_lon"),
            "end_lat": snap.lat,
            "end_lon": snap.lon,
            "start_name": None,
            "end_name": None,
            "eco": {k: v for k, v in snap.eco.items() if v is not None},
            "temp": t.get("temp") if t.get("temp") is not None else snap.temp,
            "note": "",
        }
        self.trips.append(trip)
        return trip

    def _energy_start(self, snap: Snapshot) -> float | None:
        if snap.cons_start is None or snap.dist_start is None:
            return None
        return snap.cons_start * snap.dist_start / 100.0

    def _trip_energy(self, t: dict, snap: Snapshot, km: float) -> tuple[float | None, str]:
        tol = max(1.5, 0.15 * km)
        e1 = self._energy_start(snap)
        ds0, ds1, e0 = t.get("ds0"), snap.dist_start, t.get("e0")
        kwh = None
        if e1 is not None and ds1 is not None:
            if ds0 is not None and e0 is not None and ds1 >= ds0 and abs((ds1 - ds0) - km) <= tol and e1 >= e0:
                kwh = e1 - e0
            elif abs(ds1 - km) <= tol:
                kwh = e1
        if kwh is not None and km >= 1 and not (5 <= kwh / km * 100 <= 60):
            kwh = None  # unplausibel
        if kwh is not None:
            return kwh, "fahrzeug"
        s0, s1 = t.get("start_soc"), snap.soc
        if s0 is not None and s1 is not None and s0 > s1:
            return (s0 - s1) / 100.0 * self.capacity, "akku"
        return None, "fehlt"

    # ------------------------------------------------------------------ Laden
    def start_charge(self, snap: Snapshot, kind: str | None) -> None:
        self.active_charge = {
            "start": snap.time,
            "soc_start": snap.soc,
            "energy": 0.0,
            "last_p": None,
            "last_t": snap.time,
            "max_kw": 0.0,
            "type": kind,
            "lat": snap.lat,
            "lon": snap.lon,
        }

    def charge_power(self, time: str, kw: float | None, kind: str | None = None) -> None:
        c = self.active_charge
        if not c:
            return
        if c.get("last_p") is not None and c.get("last_t"):
            c["energy"] += c["last_p"] * _minutes(c["last_t"], time) / 60.0
        c["last_p"] = kw if kw is not None and kw >= 0 else None
        c["last_t"] = time
        if kw is not None:
            c["max_kw"] = max(c.get("max_kw") or 0.0, kw)
        if kind and not c.get("type"):
            c["type"] = kind

    def finalize_charge(self, snap: Snapshot, kind: str | None = None) -> dict | None:
        c = self.active_charge
        if not c:
            return None
        self.charge_power(snap.time, None)
        self.active_charge = None
        kwh_soc = None
        if c.get("soc_start") is not None and snap.soc is not None and snap.soc > c["soc_start"]:
            kwh_soc = (snap.soc - c["soc_start"]) / 100.0 * self.capacity
        measured = c.get("energy") or 0.0
        if kwh_soc and 0.85 * kwh_soc <= measured <= 1.25 * kwh_soc:
            kwh = measured
        else:
            kwh = kwh_soc if kwh_soc else (measured if measured > 0 else None)
        if kwh is None or kwh < 0.3:
            return None
        if snap.lat is not None and c.get("lat") is None:
            c["lat"], c["lon"] = snap.lat, snap.lon
        charge = {
            "id": uuid.uuid4().hex[:12],
            "start": c["start"],
            "end": snap.time,
            "soc_start": c.get("soc_start"),
            "soc_end": snap.soc,
            "kwh": _r(kwh, 2),
            "kwh_auto": _r(kwh, 2),
            "type": c.get("type") or kind,
            "max_kw": _r(c.get("max_kw") or None, 0),
            "lat": c.get("lat"),
            "lon": c.get("lon"),
            "place": None,
            "price": None,  # €/kWh, trägt man selbst ein
            "total": None,  # Gesamtbetrag in €, alternativ zum Preis
            "note": "",
            "manual": False,
        }
        self.charges.append(charge)
        return charge

    # ------------------------------------------------------------------ Kosten
    def avg_price(self, default: float) -> float:
        return average_price(self.charges, default)


def charge_cost(charge: dict) -> float | None:
    """Kosten einer Ladung, falls Preis oder Betrag eingetragen ist."""
    if charge.get("total") is not None:
        return float(charge["total"])
    if charge.get("price") is not None and charge.get("kwh") is not None:
        return float(charge["price"]) * float(charge["kwh"])
    return None


def average_price(charges: list[dict], default: float) -> float:
    """Gewichteter Ø-Preis aller Ladungen mit Preis; sonst der Standardpreis."""
    kwh = cost = 0.0
    for c in charges:
        cc = charge_cost(c)
        if cc is not None and c.get("kwh"):
            kwh += float(c["kwh"])
            cost += cc
    return cost / kwh if kwh > 0 else default
