# apps/etl/matching/test_band_matcher.py
"""
Ver plan-de-pruebas.md sección 2.3 — "el caso central del matching".
"""
from matching.band_matcher import IncomingBand, ExistingBand, match_band


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
