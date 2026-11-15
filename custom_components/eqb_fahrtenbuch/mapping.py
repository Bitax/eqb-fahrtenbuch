"""Findet die Entitäten der MercedesMe2020-Integration zu einem Fahrzeug."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import slugify

from .const import KEY_IGNITION, SOURCE_DOMAIN


def find_vehicles(hass: HomeAssistant) -> dict[str, str]:
    """Alle Fahrzeuge (VIN-Slug -> Anzeigename), die MercedesMe2020 angelegt hat."""
    reg = er.async_get(hass)
    vehicles: dict[str, str] = {}
    suffix = "_" + KEY_IGNITION
    for entry in reg.entities.values():
        if entry.platform != SOURCE_DOMAIN or not entry.unique_id:
            continue
        uid = str(entry.unique_id).lower()
        if uid.endswith(suffix):
            vin = uid[: -len(suffix)]
            state = hass.states.get(entry.entity_id)
            name = None
            if state is not None:
                name = state.attributes.get("car")
            vehicles[vin] = f"{name or 'Mercedes'} ({vin.upper()})"
    return vehicles


def build_mapping(hass: HomeAssistant, vin: str) -> dict[str, str]:
    """Schlüssel (z. B. 'odometer') -> entity_id für das gewählte Fahrzeug."""
    reg = er.async_get(hass)
    prefix = slugify(vin).lower() + "_"
    mapping: dict[str, str] = {}
    for entry in reg.entities.values():
        if entry.platform != SOURCE_DOMAIN or not entry.unique_id:
            continue
        uid = str(entry.unique_id).lower()
        if not uid.startswith(prefix):
            continue
        key = uid[len(prefix):]
        # Bei Doppelungen gewinnt die Sensor-Entität, Tracker bleibt Tracker
        if key in mapping and not entry.entity_id.startswith("sensor."):
            mapping[f"{entry.domain}.{key}"] = entry.entity_id
            continue
        mapping[key] = entry.entity_id
    # Tracker sicher über die Domain finden
    for entry in reg.entities.values():
        if (
            entry.platform == SOURCE_DOMAIN
            and entry.domain == "device_tracker"
            and str(entry.unique_id).lower().startswith(prefix)
        ):
            mapping["tracker"] = entry.entity_id
    return mapping
