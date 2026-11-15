"""Einrichtung über die Oberfläche."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback

from .const import CONF_CAPACITY, CONF_DEFAULT_PRICE, CONF_VIN, DEFAULT_CAPACITY, DEFAULT_PRICE, DOMAIN
from .mapping import find_vehicles


class FahrtenbuchConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        vehicles = find_vehicles(self.hass)
        if not vehicles:
            return self.async_abort(reason="no_mercedes")

        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_VIN])
            self._abort_if_unique_id_configured()
            return self.async_create_entry(title="EQB Fahrtenbuch", data=user_input)

        schema = vol.Schema(
            {
                vol.Required(CONF_VIN, default=next(iter(vehicles))): vol.In(vehicles),
                vol.Required(CONF_CAPACITY, default=DEFAULT_CAPACITY): vol.All(vol.Coerce(float), vol.Range(min=10, max=150)),
                vol.Required(CONF_DEFAULT_PRICE, default=DEFAULT_PRICE): vol.All(vol.Coerce(float), vol.Range(min=0, max=3)),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return FahrtenbuchOptionsFlow()


class FahrtenbuchOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        current = {**self.config_entry.data, **self.config_entry.options}
        schema = vol.Schema(
            {
                vol.Required(CONF_CAPACITY, default=current.get(CONF_CAPACITY, DEFAULT_CAPACITY)): vol.All(
                    vol.Coerce(float), vol.Range(min=10, max=150)
                ),
                vol.Required(CONF_DEFAULT_PRICE, default=current.get(CONF_DEFAULT_PRICE, DEFAULT_PRICE)): vol.All(
                    vol.Coerce(float), vol.Range(min=0, max=3)
                ),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
