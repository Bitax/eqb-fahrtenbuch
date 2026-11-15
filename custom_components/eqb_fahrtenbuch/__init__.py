"""EQB Fahrtenbuch – automatisches Fahrtenbuch für die MercedesMe2020-Integration."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady

from .const import (
    CONF_CAPACITY,
    CONF_DEFAULT_PRICE,
    CONF_VIN,
    DEFAULT_CAPACITY,
    DEFAULT_PRICE,
    DOMAIN,
    PANEL_COMPONENT,
    PANEL_URL,
    REQUIRED_KEYS,
    STATIC_URL,
    VERSION,
)
from .manager import FahrtenbuchManager
from .mapping import build_mapping
from .pdf_export import FahrtenbuchPdfView
from .websocket import async_register_websocket

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data.setdefault(DOMAIN, {})

    mapping = build_mapping(hass, entry.data[CONF_VIN])
    missing = [k for k in REQUIRED_KEYS if k not in mapping]
    if missing:
        raise ConfigEntryNotReady(f"MercedesMe2020-Werte fehlen noch: {', '.join(missing)}")

    opts = {**entry.data, **entry.options}
    manager = FahrtenbuchManager(
        hass,
        entry.entry_id,
        mapping,
        float(opts.get(CONF_CAPACITY, DEFAULT_CAPACITY)),
        float(opts.get(CONF_DEFAULT_PRICE, DEFAULT_PRICE)),
    )
    await manager.async_start()
    data[entry.entry_id] = manager

    if not data.get("_registered"):
        await _register_frontend(hass)
        async_register_websocket(hass)
        hass.http.register_view(FahrtenbuchPdfView(hass))
        data["_registered"] = True

    entry.async_on_unload(entry.add_update_listener(_reload))
    return True


async def _reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    manager: FahrtenbuchManager | None = hass.data[DOMAIN].pop(entry.entry_id, None)
    if manager:
        await manager.async_stop()
    return True


async def _register_frontend(hass: HomeAssistant) -> None:
    folder = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths([StaticPathConfig(STATIC_URL, str(folder), False)])
    if PANEL_URL in hass.data.get(frontend.DATA_PANELS, {}):
        return
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_COMPONENT,
        frontend_url_path=PANEL_URL,
        module_url=f"{STATIC_URL}/panel.js?v={VERSION}",
        sidebar_title="Fahrtenbuch",
        sidebar_icon="mdi:car-electric",
        require_admin=False,
        config={"static": STATIC_URL, "version": VERSION},
    )
