# apps/etl/matching/band_matcher.py
"""
Motor de homologación de bandas — ver `docs/Diseño del Módulo ETL.md` sección 4.

Cascada, de más a menos estricta:
  0. MusicBrainz ID (MBID) como clave maestra, cuando está disponible.
  1. Coincidencia exacta por (source, external_id).
  2. Coincidencia determinística: nombre normalizado + país.
  3. Fuzzy matching con rapidfuzz, con la salvaguarda de bandas tributo
     aplicada ANTES del fuzzy — este es el orden que importa: si se
     corriera el fuzzy primero y la salvaguarda después, un score muy
     alto podría auto-aprobarse antes de que la salvaguarda alcance a
     interceptarlo, dependiendo de cómo se implemente el pipeline.
"""

import re
import unicodedata
from dataclasses import dataclass
from rapidfuzz import fuzz

# Marcadores multi-idioma. La salvaguarda de tributos NO está en
# `docs/Diseño del Módulo ETL.md` (su sección 4 describe la cascada de
# matching sin mencionar tributos); el único respaldo escrito es RF-07c en
# `docs/Documentación de Proyecto.md`. La especificación viva de la regla es
# `test_band_matcher.py` — si agregas un marcador, agrega también su caso ahí.
TRIBUTE_MARKERS = [
    "tributo", "tribute", "cover band", "cover", "homenaje",
]

FUZZY_AUTO_MATCH_THRESHOLD = 92
FUZZY_MANUAL_REVIEW_THRESHOLD = 75


@dataclass
class IncomingBand:
    name: str
    country: str | None
    mbid: str | None
    source: str
    external_id: str


@dataclass
class ExistingBand:
    id: str
    name: str
    country: str | None
    is_tribute: bool


@dataclass
class MatchResult:
    band_id: str | None  # None si se debe crear una banda nueva
    confidence: str  # "exact_id" | "mbid" | "deterministic" | "fuzzy_auto" | "fuzzy_review" | "new"
    requires_manual_review: bool
    is_tribute_candidate: bool
    suggested_tribute_of_band_id: str | None = None


def normalize_name(name: str) -> str:
    """Minúsculas, sin acentos, sin sufijos comunes tipo 'official'."""
    n = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    n = n.lower().strip()
    n = re.sub(r"\b(official|oficial)\b", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def is_tribute_name(name: str) -> bool:
    normalized = normalize_name(name)
    return any(marker in normalized for marker in TRIBUTE_MARKERS)


def match_band(
    incoming: IncomingBand,
    existing_by_external_id: ExistingBand | None,
    existing_by_mbid: ExistingBand | None,
    candidates_by_name: list[ExistingBand],
) -> MatchResult:
    # Paso 1: ID externo exacto ya vinculado — no hay nada más que decidir.
    if existing_by_external_id:
        return MatchResult(
            band_id=existing_by_external_id.id,
            confidence="exact_id",
            requires_manual_review=False,
            is_tribute_candidate=False,
        )

    # Paso 0: MBID como clave maestra — ver `docs/Diseño del Módulo ETL.md`
    # sección 4 punto 0.
    if incoming.mbid and existing_by_mbid:
        return MatchResult(
            band_id=existing_by_mbid.id,
            confidence="mbid",
            requires_manual_review=False,
            is_tribute_candidate=False,
        )

    incoming_is_tribute = is_tribute_name(incoming.name)

    # Salvaguarda de tributos: se evalúa ANTES del fuzzy matching, sin
    # importar qué tan alto sería el score contra la banda original.
    if incoming_is_tribute:
        # Intentar sugerir (no asignar) la banda original mencionada en el
        # nombre, quitando los marcadores de tributo para buscarla.
        stripped = normalize_name(incoming.name)
        for marker in TRIBUTE_MARKERS:
            stripped = stripped.replace(marker, "").strip()
        stripped = re.sub(r"^(a|to|de)\s+", "", stripped).strip()

        suggested = next(
            (c for c in candidates_by_name if normalize_name(c.name) == stripped and not c.is_tribute),
            None,
        )

        return MatchResult(
            band_id=None,  # siempre banda nueva, nunca se fusiona con la original
            confidence="new",
            requires_manual_review=True,
            is_tribute_candidate=True,
            suggested_tribute_of_band_id=suggested.id if suggested else None,
        )

    # Paso 2: coincidencia determinística (nombre normalizado + país)
    normalized_incoming = normalize_name(incoming.name)
    for candidate in candidates_by_name:
        if (
            normalize_name(candidate.name) == normalized_incoming
            and candidate.country == incoming.country
            and not candidate.is_tribute
        ):
            return MatchResult(
                band_id=candidate.id,
                confidence="deterministic",
                requires_manual_review=False,
                is_tribute_candidate=False,
            )

    # Paso 3: fuzzy matching
    best_score = 0
    best_candidate: ExistingBand | None = None
    for candidate in candidates_by_name:
        if candidate.is_tribute:
            continue  # nunca fusionar contra una tributo tampoco
        score = fuzz.token_sort_ratio(normalized_incoming, normalize_name(candidate.name))
        if score > best_score:
            best_score = score
            best_candidate = candidate

    if best_candidate and best_score >= FUZZY_AUTO_MATCH_THRESHOLD:
        return MatchResult(
            band_id=best_candidate.id,
            confidence="fuzzy_auto",
            requires_manual_review=False,
            is_tribute_candidate=False,
        )

    if best_candidate and best_score >= FUZZY_MANUAL_REVIEW_THRESHOLD:
        return MatchResult(
            band_id=best_candidate.id,
            confidence="fuzzy_review",
            requires_manual_review=True,
            is_tribute_candidate=False,
        )

    return MatchResult(
        band_id=None,
        confidence="new",
        requires_manual_review=False,
        is_tribute_candidate=False,
    )
