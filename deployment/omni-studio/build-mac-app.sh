#!/bin/bash
set -euo pipefail

source_file=${1:?Pass the path to OmniStudioProbe.swift}
destination=${2:?Pass the path to the new OmniStudioProbe.app}
if [[ -e "$destination" ]]; then
  echo "Choose a new app path. Rebuilding can invalidate the existing Accessibility grant." >&2
  exit 1
fi
temp=$(mktemp -d "$(dirname "$destination")/.omni-probe.XXXXXXXX")
trap 'rm -rf "$temp"' EXIT
app="$temp/OmniStudioProbe.app"
mkdir -p "$app/Contents/MacOS" "$temp/cache"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.skilledcrafting.omnistudioprobe</string>
  <key>CFBundleName</key><string>OmniStudioProbe</string>
  <key>CFBundleExecutable</key><string>OmniStudioProbe</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSUIElement</key><true/>
  <key>NSDownloadsFolderUsageDescription</key>
  <string>Save the read-only Omni Studio pilot result in Downloads.</string>
</dict></plist>
PLIST
CLANG_MODULE_CACHE_PATH="$temp/cache" swiftc -module-cache-path "$temp/cache" "$source_file" -o "$app/Contents/MacOS/OmniStudioProbe"
codesign --force --sign - --identifier com.skilledcrafting.omnistudioprobe "$app"
codesign --verify --strict "$app"
mv "$app" "$destination"
printf 'Built %s\n' "$destination"
