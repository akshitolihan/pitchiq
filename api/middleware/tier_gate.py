"""
Server-side tier gating and geofence middleware.

Tier resolution order:
  1. X-User-Tier request header (for testing / future JWT claim)
  2. STUB_USER_TIER env var (M1 default — no real auth yet)

Geofencing:
  Reads CF-IPCountry header (Cloudflare) or X-Country header.
  Returns 451 Unavailable For Legal Reasons if the country is blocked.
  Off by default (GEOFENCE_BLOCKED_COUNTRIES is empty).
"""
from __future__ import annotations

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from api.config import settings

VALID_TIERS = {"free", "paid", "pro"}
FREE_FIXTURE_LIMIT = 3   # Free tier sees this many upcoming matches


class TierGateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # --- Geofence check ---
        blocked = settings.blocked_countries
        if blocked:
            country = (
                request.headers.get("CF-IPCountry")
                or request.headers.get("X-Country")
                or ""
            ).upper()
            if country and country in blocked:
                raise HTTPException(
                    status_code=451,
                    detail=f"Service unavailable in your region ({country}).",
                )

        # --- Resolve tier ---
        tier = (
            request.headers.get("X-User-Tier", "").lower()
            or settings.stub_user_tier.lower()
        )
        if tier not in VALID_TIERS:
            tier = "free"
        request.state.tier = tier

        return await call_next(request)


def require_tier(minimum: str):
    """
    Dependency: raises 403 if the request tier is below `minimum`.
    Usage:  Depends(require_tier("paid"))
    """
    order = {"free": 0, "paid": 1, "pro": 2}

    def _check(request: Request):
        current = getattr(request.state, "tier", "free")
        if order.get(current, 0) < order.get(minimum, 99):
            raise HTTPException(
                status_code=403,
                detail=f"This feature requires a {minimum} subscription. "
                       "Upgrade to unlock full access.",
            )

    return _check
