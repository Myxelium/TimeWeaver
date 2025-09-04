# Icon Setup Guide

Place your icon files in this directory with the following naming convention:

## Required Icon Files:

### For All Platforms (most important):
- `icon.png` - 512x512px (this will be used as fallback and for Linux)

### Platform-Specific (optional but recommended):
- `icon.ico` - Windows icon (multi-size: 16, 32, 48, 64, 128, 256px)
- `icon.icns` - macOS icon (multi-size: 16, 32, 64, 128, 256, 512, 1024px)

## File Structure:
```
build/
├── icon.png      # 512x512 PNG (Linux, fallback)
├── icon.ico      # Windows multi-size ICO
└── icon.icns     # macOS multi-size ICNS
```

## Tools for Icon Creation:
- **Online converters**: Convert PNG to ICO/ICNS
  - https://convertio.co/png-ico/
  - https://cloudconvert.com/png-to-icns

- **Desktop tools**:
  - GIMP (free)
  - Photoshop
  - Sketch (macOS)

## Notes:
- Start with a high-quality 1024x1024 PNG
- Use transparent background for best results
- Electron-builder will automatically pick the right format for each platform
- The icon path in package.json is "build/icon" (without extension)
