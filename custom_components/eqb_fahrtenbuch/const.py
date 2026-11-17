"""Konstanten für das EQB Fahrtenbuch."""

DOMAIN = "eqb_fahrtenbuch"
VERSION = "1.0.2"

SOURCE_DOMAIN = "mbapi2020"  # MercedesMe2020-Integration

CONF_VIN = "vin"
CONF_CAPACITY = "battery_capacity"
CONF_DEFAULT_PRICE = "default_price"

DEFAULT_CAPACITY = 66.5  # nutzbare Akkukapazität EQB 350 in kWh
DEFAULT_PRICE = 0.59  # €/kWh, solange noch keine Ladung mit Preis existiert

STORAGE_VERSION = 1

PANEL_URL = "fahrtenbuch"
PANEL_COMPONENT = "eqb-fahrtenbuch-panel"
STATIC_URL = "/eqb_fahrtenbuch_static"

# Zündung der MercedesMe2020-Integration (Rohwerte)
IGNITION_ON = {"4", "5"}  # Ein, Start
IGNITION_OFF = {"0", "1"}  # Verriegelt, Aus

# Wartezeit nach dem Abstellen, bis Position und Verbrauchswerte vom Auto da sind
FINALIZE_DELAY = 150  # Sekunden
MIN_TRIP_KM = 0.2

# Schlüssel = unique_id der MercedesMe2020-Entität ohne VIN-Präfix (kleingeschrieben)
KEY_ODOMETER = "odometer"
KEY_IGNITION = "ignitionstate"
KEY_SOC = "soc"
KEY_TRACKER = "tracker"
KEY_CHARGING = "chargingactive"
KEY_CHARGE_POWER = "chargingpowerkw"
KEY_CONS_START = "electricconsumptionstart"
KEY_DIST_START = "distancestart"
KEY_ECO_ACCEL = "ecoscoreaccel"
KEY_ECO_CONST = "ecoscoreconst"
KEY_ECO_FREE = "ecoscorefreewhl"
KEY_ECO_BONUS = "ecoscorebonusrange"
KEY_COUPLER_AC = "chargecoupleracstatus"
KEY_COUPLER_DC = "chargecouplerdcstatus"
KEY_RANGE = "rangeelectrickm"

REQUIRED_KEYS = [KEY_ODOMETER, KEY_IGNITION, KEY_SOC]

COUPLER_PLUGGED = {"0", "1"}  # beidseitig / nur fahrzeugseitig eingesteckt
