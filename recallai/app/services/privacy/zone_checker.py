import math
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.privacy_zone import PrivacyZone

logger = logging.getLogger(__name__)


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two GPS points in metres."""
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


async def is_in_privacy_zone(
    db: AsyncSession, lat: float, lng: float
) -> tuple[bool, str | None]:
    """
    Check if coordinates fall inside any privacy zone.
    Returns (is_inside, zone_name).
    """
    result = await db.execute(select(PrivacyZone))
    zones = result.scalars().all()

    for zone in zones:
        distance = haversine_distance(lat, lng, zone.gps_lat, zone.gps_lng)
        if distance <= zone.radius_metres:
            logger.info(
                "Location (%.4f, %.4f) is inside privacy zone '%s' (%.0fm away, radius %.0fm)",
                lat, lng, zone.name, distance, zone.radius_metres,
            )
            return True, zone.name

    return False, None
