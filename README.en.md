# Shotırs

Fast, lightweight Windows desktop screenshot & screen-recording app.
Built with Electron + React + TypeScript.

> 🇹🇷 Türkçe sürüm: [README.md](README.md)

---

## Features

### 📸 Screenshot
- **Region selection** — magnifier loupe for pixel-perfect framing
- **Annotation** — pen, arrow, rectangle, line, text, highlighter,
  blur/cover, eraser, drag, eyedropper
- **OCR** — extract text from a selected area to clipboard (TR + EN)
- **Copy / save / share**

### 🎥 Screen recording
- **Full screen or region capture**
- **System audio + microphone** (system audio Windows-only)
- **Webcam picture-in-picture** — draggable, resizable
- **Live annotation** — draw on screen mid-recording
- **Click ripple, cursor spotlight, fluorescent cursor** — Loom/Cap-style
- **Click-to-zoom** — smooth zoom to where you click during recording
- **Trim editor** — cut clips after recording
- **Crash recovery** — interrupted recordings can be restored

### 🛠 Other
- **Turkish + English** UI
- **Global hotkeys** — PrintScreen, Ctrl+Alt+R, Ctrl+Shift+D, Ctrl+Shift+O
- **History** — last 100 captures, bulk delete, GIF export, share links
- **Tray menu** — keeps running in the background after window close
- **Auto-update** — via GitHub Releases

---

## Install

### Download a release
Grab the latest `Shotirs-Setup-x.y.z.exe` (installer) or
`Shotirs-x.y.z-portable.exe` (portable) from the
[GitHub Releases](https://github.com/saholand/shotirs/releases) page.

> ⚠️ The build is not code-signed yet, so Windows SmartScreen may show
> "Unknown publisher". Click **More info → Run anyway** to continue.

### Build from source
```bash
git clone https://github.com/saholand/shotirs.git
cd shotirs
npm install
npm run dev      # development
npm run dist     # build Windows installer + portable
```

---

## Hotkeys (default)

| Shortcut | Action |
|---|---|
| `PrintScreen` | Take a screenshot |
| `Ctrl+Alt+R` | Start / stop screen recording |
| `Ctrl+Shift+D` | Toggle live drawing during recording |
| `Ctrl+Shift+O` | OCR — copy text from selected area |

Hotkeys are configurable under Settings → Shortcuts.

---

## Architecture

```
src/
  main/         Electron main process (windows, IPC, services)
    windows/    Window lifecycle (overlay, annotation, webcam, ...)
    ipc/        IPC handlers (recording, screenshot, settings, OCR)
    services/   Tray, hotkey, settings, logger, auto-updater
    recording/  MediaRecorder pipeline, temp file, trim, mouse hook
    screenshot/ Capture + export
  preload/      contextBridge API (renderer ↔ main)
  renderer/     React UI
    overlay/    Selection + editing canvas
    recording/  Live annotation toolbar/canvas, recording panel
    settings/   Settings panel
    history/    History + bulk delete
    annotation/ Shared annotation primitives
  shared/       Constants, i18n, types (shared by main + renderer)
share-server/   Optional custom upload backend (Express + S3)
```

### Security
- `contextIsolation: true`, `nodeIntegration: false`
- `local-media://` protocol is sandboxed via an allowlist + extension filter
- Custom upload server URLs are required to use HTTPS
- CSP enforced in every renderer window

### i18n
- TR + EN. Key-based dictionary in `src/shared/i18n/{tr,en}.ts`
- Each renderer window is its own process, so entry points sync the
  language from settings on startup before first render
- Main process has its own mini-i18n in `src/main/services/i18n-main.ts`
  for dialog titles, IPC error strings, and OCR notifications

---

## Releasing

```bash
# 1. Bump the version
npm version patch    # or minor / major

# 2. Push the tag
git push --follow-tags
```

The [`release.yml`](.github/workflows/release.yml) GitHub Actions
workflow builds the Windows installer + portable and publishes them to
GitHub Releases. Installed clients will pick up the new version on next
launch via the auto-updater.

---

## Legal

- **Privacy policy:** [PRIVACY.md](PRIVACY.md)
- **License:** TBD (the owner hasn't picked one yet)

## Contributing

Issues and PRs welcome. For larger changes, please open an issue first
to discuss the approach.

---

Made with ❤ — Shotırs
