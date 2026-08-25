# -*- coding: utf-8 -*-
"""Launch Adaptive Streaming in cefbrowser (on TV) or show URL for remote browsers (Chorus 2 style)."""
import urllib.parse

import xbmc
import xbmcaddon
import xbmcgui

ADDON = xbmcaddon.Addon()
NOTICE_KEY = "jsonrpc_notice_shown"


def maybe_show_jsonrpc_notice():
    if ADDON.getSetting(NOTICE_KEY) == "true":
        return
    xbmcgui.Dialog().ok(
        ADDON.getAddonInfo("name"),
        "Enable Kodi remote control for playback:\n\n"
        "Settings → Services → Control\n"
        "• Allow remote control via HTTP\n"
        "• Allow remote control from applications on this system\n"
        "• Allow remote control from applications on other systems "
        "(required if you browse from phone/PC like Chorus 2)\n\n"
        "The Angular UI uses JSON-RPC on port 9090 to start Kodi's player.",
    )
    ADDON.setSetting(NOTICE_KEY, "true")


def ui_url():
    server_ip = ADDON.getSetting("server_ip") or "10.0.0.15"
    server_port = ADDON.getSetting("server_port") or "5012"
    kodi_host = (ADDON.getSetting("kodi_box_ip") or "127.0.0.1").strip()
    return (
        "http://{0}:{1}/videoSelection?platform=kodi&kodiHost={2}".format(
            server_ip, server_port, urllib.parse.quote(kodi_host, safe="")
        )
    )


def open_browser(url):
    browser_addon = (ADDON.getSetting("browser_addon") or "plugin.program.cefbrowser").strip()
    encoded = urllib.parse.quote(url, safe="")
    xbmc.log(
        "Adaptive Streaming: opening {0} via {1}".format(url, browser_addon),
        xbmc.LOGINFO,
    )
    xbmc.executebuiltin("RunAddon({0},?url={1})".format(browser_addon, encoded))


def show_remote_url(url):
    xbmcgui.Dialog().ok(
        ADDON.getAddonInfo("name"),
        "Open this URL on your phone or PC (same as Chorus 2):\n\n{0}\n\n"
        "In Kodi → Settings → Services → Control, also enable:\n"
        "'Allow remote control from applications on other systems'.".format(url),
    )


def main():
    maybe_show_jsonrpc_notice()
    url = ui_url()
    use_remote = ADDON.getSetting("use_remote_browser") == "true"

    if use_remote:
        show_remote_url(url)
        return

    browser_addon = (ADDON.getSetting("browser_addon") or "").strip()
    if not browser_addon:
        xbmcgui.Dialog().ok(
            ADDON.getAddonInfo("name"),
            "Install cefbrowser, or enable 'Use remote browser (Chorus 2)' in settings "
            "to browse from your phone/PC instead.",
        )
        ADDON.openSettings()
        return

    try:
        open_browser(url)
    except Exception as err:
        xbmc.log("Adaptive Streaming launch failed: {0}".format(err), xbmc.LOGERROR)
        xbmcgui.Dialog().ok(
            ADDON.getAddonInfo("name"),
            "Could not open the browser.\n\nTry 'Use remote browser' in settings, "
            "or install cefbrowser.\n\n{0}".format(err),
        )


if __name__ == "__main__":
    main()
