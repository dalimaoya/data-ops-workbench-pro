from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.services.unified_auth import check_plugin_license
from app.i18n import t

router = APIRouter(prefix="/api/license", tags=["统一认证授权"])
bearer = HTTPBearer(auto_error=False)


@router.get("/check")
async def license_check(
    plugin: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
):
    if not credentials:
        raise HTTPException(status_code=401, detail=t("license.missing_token"))
    return await check_plugin_license(credentials.credentials, plugin)
