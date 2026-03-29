from sqlalchemy import Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.database import Base


class PrivacyZone(Base):
    __tablename__ = "privacy_zones"

    name: Mapped[str] = mapped_column(Text)
    gps_lat: Mapped[float] = mapped_column(Float)
    gps_lng: Mapped[float] = mapped_column(Float)
    radius_metres: Mapped[float] = mapped_column(Float, default=50.0)
