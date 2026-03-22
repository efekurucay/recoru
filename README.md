<div align="center">
  <img src="assets/logo.png" alt="Recoru Logo" width="128" />
  
  # Recoru
  
  **A Local Audio Recorder for Chord Websites**
  
  [![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-blue?logo=googlechrome)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

---

**Recoru** is an open-source Chrome extension that allows musicians and guitarists to instantly record, organize, and playback their audio directly within supported chord websites (like hakoru.net and repertuarim.com).

It features a strict privacy-first architecture: no servers involved, no cloud telemetry. All audio tracks are securely stored completely offline in your browser's IndexedDB.

## Features

- **Automated Metadata Extraction:** Automatically detects the song name and artist from the supported chord website.
- **Inline Recording Dashboard:** Injects a clean, non-intrusive widget on the bottom right of the page instead of relying on popups, keeping chords perfectly readable while recording.
- **Robust Audio Capture:** Leverages Manifest V3's `chrome.offscreen` API for highly reliable background audio capture that bypasses strict Content-Security-Policy (CSP) headers without disrupting the active page.
- **Offline Storage:** Recordings are compressed and securely saved in IndexedDB as Opus WebM files.
- **Audio Organization:** Easily rename recordings, monitor durations, and download tracks as `.webm` files immediately.
- **Modern User Interface:** Sleek, lightweight, dashboard-style design utilizing standard scalable vector graphics (SVGs).

## Supported Platforms

| Platform | URL Format |
|----------|-------------|
| [Hakoru](https://www.hakoru.net) | `/akor/{song-slug}` |
| [Repertuarım](https://www.repertuarim.com) | `/akor/{song-slug}-akor-{id}.html` |

*More websites are constantly being evaluated. Feel free to open an issue to request support for your favorite chord platform.*

## Installation (Developer Mode)

To install Recoru from the source instead of the Chrome Web Store:

1. Clone this repository: `git clone https://github.com/YOUR_USERNAME/recoru.git`
2. Open Chrome and navigate to: `chrome://extensions/`
3. Toggle the **Developer Mode** switch in the top right corner.
4. Click the **Load unpacked** button.
5. Select the cloned `recoru` repository folder.

## Development

Recoru is built entirely with Vanilla JavaScript, HTML, and CSS. To maintain simplicity and peak performance, it relies on zero external dependencies or bundlers. 

### Architecture

```
recoru/
├── manifest.json       # V3 Configuration
├── src/
│   ├── background/     # Service worker routing and offscreen manager
│   ├── content/        # UI injection and message proxy
│   ├── recorder/       # Offscreen audio capture and permission fallback
│   └── storage/        # IndexedDB state management
├── assets/             # Extension icons and promotional banners
└── scripts/            # Bash utilities for automated Zip packaging
```

### Building for Production

To package the extension into a zip file for the Chrome Web Store:
```bash
bash scripts/build.sh
```
This script will construct a trimmed down `recoru_release.zip` file excluding all unnecessary internal development files.

## Privacy Policy

Recoru operates 100% offline. The microphone is accessed exclusively when manually initiated via the start recording button. All data generated is written directly to the host browser's local sandbox environment (IndexedDB). No audio files, metadata, telemetry, or analytics are collected, transmitted, or stored externally.

## License

This project is licensed under the [MIT](LICENSE) License.
