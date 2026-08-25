# -*- coding: utf-8 -*-
"""Show how to open the Adaptive Streaming web UI (web interfaces are not started inside Kodi)."""
import json
import os
import socket

import xbmc
import xbmcaddon
import xbmcgui

ADDON = xbmcaddon.Addon()
ADDON_ID = "webinterface.adaptivestreaming"


def load_server_config():
    config_path = os.path.join(ADDON.getAddonInfo("path"), "http", "config.json")
    try:
        with open(config_path, encoding="utf-8") as handle:
            return json.load(handle)
    except Exception as err:
        return {"serverIp": "10.0.0.15", "serverPort": "5012", "error": str(err)}


def jsonrpc_setting(setting_id, default=None):
    try:
        payload = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "Settings.GetSettingValue",
                "params": {"setting": setting_id},
                "id": 1,
            }
        )
        raw = xbmc.executeJSONRPC(payload)
        value = json.loads(raw).get("result", {}).get("value", default)
        return value
    except Exception:
        return default


def detect_kodi_ip(server_ip):
    """Resolve LAN IP — System.FIPAddress is not a valid Kodi infolabel."""
    candidates = []

    try:
        ip = xbmc.getIPAddress()
        if ip:
            candidates.append(("xbmc.getIPAddress", ip))
    except Exception as err:
        candidates.append(("xbmc.getIPAddress", "error:{0}".format(err)))

    cfg = load_server_config()
    configured = (cfg.get("kodiBoxIp") or "").strip()
    if configured:
        candidates.append(("config.kodiBoxIp", configured))

    try:
        probe_host = server_ip or "8.8.8.8"
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(1.0)
        sock.connect((probe_host, 80))
        ip = sock.getsockname()[0]
        sock.close()
        candidates.append(("socket.route", ip))
    except Exception as err:
        candidates.append(("socket.route", "error:{0}".format(err)))

    for _source, ip in candidates:
        if not ip or str(ip).startswith("error:"):
            continue
        if ip in ("127.0.0.1", "0.0.0.0"):
            continue
        return ip

    return configured or "10.0.0.0"


def get_webserver_port():
    value = jsonrpc_setting("services.webserverport", 8080)
    try:
        return int(value)
    except (TypeError, ValueError):
        return 8080


def is_webserver_enabled():
    value = jsonrpc_setting("services.webserver", False)
    return str(value).lower() in ("true", "1")


def build_web_url(kodi_ip, port):
    return "http://{0}:{1}/addons/{2}/".format(kodi_ip, port, ADDON_ID)


def main():
    cfg = load_server_config()
    server_ip = cfg.get("serverIp", "10.0.0.15")
    server_port = cfg.get("serverPort", "5012")
    kodi_ip = detect_kodi_ip(server_ip)
    http_port = get_webserver_port()
    web_enabled = is_webserver_enabled()

    web_url = build_web_url(kodi_ip, http_port)
    direct_url = (
        "http://{0}:{1}/videoSelection?platform=kodi&kodiHost={2}".format(
            server_ip, server_port, kodi_ip
        )
    )

    warning = ""
    if not web_enabled:
        warning = (
            "\n\nWARNING: Kodi web server is OFF.\n"
            "Enable Settings → Services → Control → Allow remote control via HTTP."
        )

    xbmcgui.Dialog().ok(
        ADDON.getAddonInfo("name"),
        "Copy these URLs exactly (use the IP shown, not 'system.fipaddress'):\n\n"
        "Option A — via Kodi web server:\n{0}\n"
        "(addon path must be: /addons/{1}/)\n\n"
        "Option B — library on your PC (recommended):\n{2}{3}".format(
            web_url, ADDON_ID, direct_url, warning
        ),
    )


if __name__ == "__main__":
    main()
