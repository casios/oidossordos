# apps/etl/matching/test_band_matcher.py
"""
Salvaguarda de bandas tributo — RF-07c (`docs/Documentación de Proyecto.md`).

La regla que se prueba aquí no está escrita en ningún documento de diseño: el
plan de pruebas que la cubriría (secciones 2.3/2.4, citadas desde
`docs/Diseño de CI CD.md`) nunca se escribió, y `docs/Diseño del Módulo ETL.md`
sección 4 describe la cascada de matching pero no menciona los tributos. Hasta
que exista ese documento, este test es la especificación ejecutable de la regla:
una banda con marcador de tributo en el nombre nunca se homologa automáticamente
contra la banda original, por alto que sea el score de similitud.
"""
from matching.band_matcher import ExistingBand, IncomingBand, match_band


def test_tribute_band_never_auto_merges_with_original_even_at_high_score():
    incoming = IncomingBand(
        name="Tributo a Iron Maiden",
        country="MX",
        mbid=None,
        source="manual",
        external_id="n/a",
    )
    iron_maiden = ExistingBand(
        id="band-iron-maiden-uuid",
        name="Iron Maiden",
        country="GB",
        is_tribute=False,
    )

    result = match_band(
        incoming=incoming,
        existing_by_external_id=None,
        existing_by_mbid=None,
        candidates_by_name=[iron_maiden],
    )

    # Aunque el fuzzy score entre "Tributo a Iron Maiden" e "Iron Maiden"
    # sería altísimo (>95), el resultado NUNCA debe ser un match directo.
    assert result.band_id is None
    assert result.confidence == "new"
    assert result.is_tribute_candidate is True
    assert result.requires_manual_review is True
    # Sí debe sugerir la banda original, para que un Moderador la confirme
    assert result.suggested_tribute_of_band_id == "band-iron-maiden-uuid"


def test_non_tribute_band_can_auto_match_via_fuzzy():
    incoming = IncomingBand(
        name="Gojira Official",
        country="FR",
        mbid=None,
        source="metal_archives",
        external_id="12345",
    )
    gojira = ExistingBand(id="band-gojira-uuid", name="Gojira", country="FR", is_tribute=False)

    result = match_band(
        incoming=incoming,
        existing_by_external_id=None,
        existing_by_mbid=None,
        candidates_by_name=[gojira],
    )

    assert result.band_id == "band-gojira-uuid"
    assert result.confidence == "deterministic"
    assert result.requires_manual_review is False
