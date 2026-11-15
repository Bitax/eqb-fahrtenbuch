"""PDF-Export der Fahrten, Ladungen und Statistiken."""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .logbook_core import average_price, charge_cost

FONT_DIR = Path(__file__).parent / "fonts"
MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]
WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]


def de(value: float | None, digits: int = 1) -> str:
    if value is None:
        return "–"
    text = f"{value:,.{digits}f}"
    return text.replace(",", "X").replace(".", ",").replace("X", ".")


def _local(iso: str) -> datetime:
    return dt_util.as_local(datetime.fromisoformat(iso))


class FahrtenbuchPdfView(HomeAssistantView):
    url = f"/api/{DOMAIN}/pdf"
    name = f"api:{DOMAIN}:pdf"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request) -> web.Response:
        manager = next((v for k, v in self.hass.data.get(DOMAIN, {}).items() if not k.startswith("_")), None)
        if manager is None:
            return web.Response(status=503, text="Fahrtenbuch nicht eingerichtet")
        today = dt_util.now().date()
        try:
            start = date.fromisoformat(request.query.get("from", today.replace(day=1).isoformat()))
            end = date.fromisoformat(request.query.get("to", today.isoformat()))
        except ValueError:
            return web.Response(status=400, text="Ungültiges Datum")
        sections = request.query.get("sections", "summary,stats,months,trips,charges").split(",")

        data = {
            "trips": [dict(t) for t in manager.book.trips],
            "charges": [dict(c) for c in manager.book.charges],
            "settings": dict(manager.book.settings),
            "default_price": manager.default_price,
        }
        pdf_bytes = await self.hass.async_add_executor_job(build_pdf, data, start, end, sections)
        filename = f"Fahrtenbuch_{start.isoformat()}_{end.isoformat()}.pdf"
        return web.Response(
            body=pdf_bytes,
            content_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )


def build_pdf(data: dict, start: date, end: date, sections: list[str]) -> bytes:
    from fpdf import FPDF  # erst hier laden, damit der Start schnell bleibt

    def in_range(item: dict) -> bool:
        d = _local(item["start"]).date()
        return start <= d <= end

    trips = sorted([t for t in data["trips"] if in_range(t)], key=lambda t: t["start"])
    charges = sorted([c for c in data["charges"] if in_range(c)], key=lambda c: c["start"])
    price = average_price(data["charges"], data["default_price"])
    settings = data.get("settings", {})

    km = sum(t.get("km") or 0 for t in trips)
    kwh = sum(t.get("kwh") or 0 for t in trips)
    trip_cost = kwh * price
    ch_kwh = sum(c.get("kwh") or 0 for c in charges)
    ch_cost = 0.0
    ch_estimated = False
    for c in charges:
        cc = charge_cost(c)
        if cc is None:
            cc = (c.get("kwh") or 0) * price
            ch_estimated = True
        ch_cost += cc

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.add_font("Sans", "", str(FONT_DIR / "DejaVuSans.ttf"))
    pdf.add_font("Sans", "B", str(FONT_DIR / "DejaVuSans-Bold.ttf"))
    pdf.set_auto_page_break(True, 15)
    pdf.set_margins(15, 15, 15)
    pdf.add_page()

    ink = (20, 20, 20)
    grey = (110, 116, 120)
    blue = (0, 120, 170)
    line = (215, 218, 222)

    # Kopf
    pdf.set_fill_color(0, 0, 0)
    pdf.rect(0, 0, 210, 34, "F")
    pdf.set_xy(15, 9)
    pdf.set_text_color(164, 170, 174)
    pdf.set_font("Sans", "", 8)
    pdf.cell(0, 4, "MERCEDES-BENZ EQB 350 · FAHRTENBUCH", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Sans", "B", 18)
    pdf.cell(0, 10, f"{start.strftime('%d.%m.%Y')} – {end.strftime('%d.%m.%Y')}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(164, 170, 174)
    pdf.set_font("Sans", "", 8)
    pdf.cell(0, 4, f"Erstellt am {dt_util.now().strftime('%d.%m.%Y %H:%M')} · Kosten mit Ø {de(price, 2)} €/kWh", new_x="LMARGIN", new_y="NEXT")
    pdf.set_y(42)
    pdf.set_text_color(*ink)

    def heading(text: str) -> None:
        if pdf.get_y() > 255:
            pdf.add_page()
        pdf.ln(3)
        pdf.set_font("Sans", "B", 12)
        pdf.set_text_color(*ink)
        pdf.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(0, 173, 239)
        pdf.set_line_width(0.6)
        pdf.line(15, pdf.get_y(), 30, pdf.get_y())
        pdf.ln(3)

    def tiles(items: list[tuple[str, str]]) -> None:
        per_row = 4
        w = (180 - (per_row - 1) * 3) / per_row
        for i, (label, value) in enumerate(items):
            col = i % per_row
            if col == 0 and i:
                pdf.ln(21)
            x = 15 + col * (w + 3)
            y = pdf.get_y()
            pdf.set_fill_color(244, 245, 247)
            pdf.rect(x, y, w, 18, "F")
            pdf.set_xy(x + 3, y + 2.5)
            pdf.set_font("Sans", "", 7)
            pdf.set_text_color(*grey)
            pdf.cell(w - 6, 4, label.upper())
            pdf.set_xy(x + 3, y + 8)
            pdf.set_font("Sans", "B", 13)
            pdf.set_text_color(*ink)
            pdf.cell(w - 6, 7, value)
            pdf.set_xy(15, y)
        pdf.ln(23)

    def table(headers: list[str], widths: list[float], rows: list[list[str]], aligns: str) -> None:
        def head() -> None:
            pdf.set_font("Sans", "B", 7.5)
            pdf.set_text_color(*grey)
            for h, w, a in zip(headers, widths, aligns):
                pdf.cell(w, 6, h.upper(), align=a)
            pdf.ln(6)
            pdf.set_draw_color(*line)
            pdf.set_line_width(0.2)
            pdf.line(15, pdf.get_y(), 195, pdf.get_y())

        head()
        pdf.set_font("Sans", "", 8.5)
        for row in rows:
            if pdf.get_y() > 275:
                pdf.add_page()
                head()
                pdf.set_font("Sans", "", 8.5)
            pdf.set_text_color(*ink)
            for value, w, a in zip(row, widths, aligns):
                text = value
                while pdf.get_string_width(text) > w - 1.5 and len(text) > 3:
                    text = text[:-2] + "…"
                pdf.cell(w, 6.5, text, align=a)
            pdf.ln(6.5)
            pdf.set_draw_color(235, 237, 240)
            pdf.line(15, pdf.get_y(), 195, pdf.get_y())

    if "summary" in sections:
        heading("Zusammenfassung")
        tiles(
            [
                ("Fahrten", str(len(trips))),
                ("Strecke", f"{de(km, 0)} km"),
                ("Verbrauch", f"{de(kwh, 1)} kWh"),
                ("Ø pro 100 km", f"{de(kwh / km * 100, 1)} kWh" if km else "–"),
                ("Fahrtkosten", f"{de(trip_cost, 2)} €"),
                ("Ladungen", str(len(charges))),
                ("Geladen", f"{de(ch_kwh, 1)} kWh"),
                ("Ladekosten", f"{de(ch_cost, 2)} €{' *' if ch_estimated else ''}"),
            ]
        )
        if ch_estimated:
            pdf.set_font("Sans", "", 7)
            pdf.set_text_color(*grey)
            pdf.cell(0, 4, "* enthält Ladungen ohne eingetragenen Preis, dafür wurde der Ø-Preis verwendet.", new_x="LMARGIN", new_y="NEXT")

    if "stats" in sections and trips:
        heading("Statistik")
        petrol_l = float(settings.get("petrol_l100", 7.5))
        petrol_eur = float(settings.get("petrol_price", 1.75))
        petrol_cost = km / 100 * petrol_l * petrol_eur
        short = [t for t in trips if (t.get("km") or 0) < 5]
        longest = max(trips, key=lambda t: t.get("km") or 0)
        eff = [t for t in trips if t.get("cons_100") and (t.get("km") or 0) >= 5]
        best = min(eff, key=lambda t: t["cons_100"]) if eff else None
        co2 = km / 100 * petrol_l * 2.37 - kwh * 0.38
        tiles(
            [
                ("Kosten / 100 km", f"{de(trip_cost / km * 100, 2)} €" if km else "–"),
                ("Ersparnis vs. Benziner", f"{de(petrol_cost - trip_cost, 0)} €"),
                ("Kurzstrecken < 5 km", f"{de(len(short) / len(trips) * 100, 0)} %"),
                ("CO₂ gespart (ca.)", f"{de(max(co2, 0), 0)} kg"),
                ("Längste Fahrt", f"{de(longest.get('km'), 0)} km"),
                ("Sparsamste Fahrt", f"{de(best['cons_100'], 1)} kWh" if best else "–"),
                ("Ø Fahrtlänge", f"{de(km / len(trips), 1)} km"),
                ("Ø Ladepreis", f"{de(price, 2)} €/kWh"),
            ]
        )
        pdf.set_font("Sans", "", 7)
        pdf.set_text_color(*grey)
        pdf.cell(
            0,
            4,
            f"Vergleich: Benziner mit {de(petrol_l, 1)} l/100 km zu {de(petrol_eur, 2)} €/l. CO₂: 2,37 kg/l Benzin, 0,38 kg/kWh Strommix.",
            new_x="LMARGIN",
            new_y="NEXT",
        )

    if "months" in sections and trips:
        heading("Monatsübersicht")
        months: dict[tuple[int, int], dict] = {}
        for t in trips:
            d = _local(t["start"])
            m = months.setdefault((d.year, d.month), {"n": 0, "km": 0.0, "kwh": 0.0})
            m["n"] += 1
            m["km"] += t.get("km") or 0
            m["kwh"] += t.get("kwh") or 0
        rows = [
            [
                f"{MONTHS[mo - 1]} {y}",
                str(v["n"]),
                f"{de(v['km'], 0)} km",
                f"{de(v['kwh'], 1)} kWh",
                de(v["kwh"] / v["km"] * 100, 1) if v["km"] else "–",
                f"{de(v['kwh'] * price, 2)} €",
            ]
            for (y, mo), v in sorted(months.items(), reverse=True)
        ]
        table(["Monat", "Fahrten", "Kilometer", "Verbrauch", "kWh/100 km", "Kosten"], [44, 22, 30, 30, 26, 28], rows, "LRRRRR")

    if "trips" in sections:
        heading(f"Fahrten ({len(trips)})")
        rows = []
        for t in trips:
            s = _local(t["start"])
            e = _local(t["end"])
            route = f"{t.get('start_name') or 'Unbekannt'} → {t.get('end_name') or 'Unbekannt'}"
            rows.append(
                [
                    f"{WEEKDAYS[s.weekday()]} {s.strftime('%d.%m.')}",
                    f"{s.strftime('%H:%M')}–{e.strftime('%H:%M')}",
                    route,
                    de(t.get("km"), 1),
                    de(t.get("kwh"), 1),
                    de(t.get("cons_100"), 1),
                    de((t.get("kwh") or 0) * price, 2) if t.get("kwh") is not None else "–",
                ]
            )
        if rows:
            table(["Datum", "Zeit", "Strecke", "km", "kWh", "kWh/100", "€"], [20, 22, 70, 15, 15, 18, 20], rows, "LLLRRRR")
        else:
            pdf.set_font("Sans", "", 9)
            pdf.cell(0, 6, "Keine Fahrten in diesem Zeitraum.", new_x="LMARGIN", new_y="NEXT")

    if "charges" in sections:
        heading(f"Ladungen ({len(charges)})")
        rows = []
        for c in charges:
            s = _local(c["start"])
            cc = charge_cost(c)
            rows.append(
                [
                    f"{WEEKDAYS[s.weekday()]} {s.strftime('%d.%m. %H:%M')}",
                    c.get("place") or "–",
                    c.get("type") or "–",
                    de(c.get("kwh"), 1),
                    de(c.get("price"), 2) if c.get("price") is not None else ("–" if cc is None else de(cc / c["kwh"], 2) if c.get("kwh") else "–"),
                    de(cc, 2) if cc is not None else "offen",
                ]
            )
        if rows:
            table(["Datum", "Ort", "Typ", "kWh", "€/kWh", "Betrag €"], [32, 72, 14, 20, 20, 22], rows, "LLLRRR")
        else:
            pdf.set_font("Sans", "", 9)
            pdf.cell(0, 6, "Keine Ladungen in diesem Zeitraum.", new_x="LMARGIN", new_y="NEXT")

    # Seitenzahlen
    pdf.set_auto_page_break(False)
    total = pdf.page_no()
    for page in range(1, total + 1):
        pdf.page = page
        pdf.set_xy(15, 287)
        pdf.set_font("Sans", "", 7)
        pdf.set_text_color(*grey)
        pdf.cell(180, 4, f"Seite {page} von {total}", align="R")

    return bytes(pdf.output())
