"""Plugin management API — list all plugins, toggle enable/disable for extensions."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.utils.auth import get_current_user, require_role

from app.plugin_loader import get_all_plugins_full, toggle_plugin
from app.i18n import t

router = APIRouter(prefix="/api/plugins", tags=["plugins"])


class ToggleRequest(BaseModel):
    enabled: bool


class ToggleResponse(BaseModel):
    plugin_id: str
    enabled: bool
    message: str


@router.get("/all")
def list_all_plugins(current_user=Depends(get_current_user)):
    """Return all plugins with layer/category/enabled status (for plugin center)."""
    plugins = get_all_plugins_full()
    return {"plugins": plugins}


@router.put("/{plugin_id}/toggle")
def toggle_plugin_status(
    plugin_id: str,
    body: ToggleRequest,
    current_user=Depends(require_role("admin")),
):
    """Enable or disable an extension plugin (admin only)."""
    try:
        new_state = toggle_plugin(
            plugin_id,
            body.enabled,
            operator=current_user.username,
        )
        action = t("user.enable") if new_state else t("user.disable")
        return ToggleResponse(
            plugin_id=plugin_id,
            enabled=new_state,
            message=t("plugin.toggled", action=action),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
