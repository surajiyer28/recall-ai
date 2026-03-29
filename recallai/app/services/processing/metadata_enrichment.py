import logging

from geopy.geocoders import Nominatim

logger = logging.getLogger(__name__)

_geocoder = None


def _get_geocoder():
    global _geocoder
    if _geocoder is None:
        _geocoder = Nominatim(user_agent="recallai-memory-prosthetic")
    return _geocoder


def reverse_geocode(lat: float, lng: float) -> str | None:
    """Convert GPS coordinates to a readable place name."""
    try:
        geocoder = _get_geocoder()
        location = geocoder.reverse(f"{lat}, {lng}", language="en")
        if location:
            return location.address
    except Exception as e:
        logger.error("Reverse geocoding failed for (%s, %s): %s", lat, lng, e)
    return None


def enrich_metadata(
    gps_lat: float | None,
    gps_lng: float | None,
    place_name: str | None,
) -> dict:
    """
    Enrich capture metadata. If GPS is provided but place_name is missing,
    attempt reverse geocoding.
    """
    enriched = {"place_name": place_name}

    if gps_lat is not None and gps_lng is not None and not place_name:
        resolved_name = reverse_geocode(gps_lat, gps_lng)
        if resolved_name:
            enriched["place_name"] = resolved_name

    return enriched
