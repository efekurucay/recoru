#!/bin/bash
# scripts/build.sh
# Packages the current codebase into a production-ready ZIP file

echo "📦 Packaging Recoru..."

# Create dist directory
mkdir -p dist/recoru_ext

# Copy necessary files
cp manifest.json dist/recoru_ext/
cp icon*.png dist/recoru_ext/
cp -r src dist/recoru_ext/

# Create the zip
cd dist
zip -r ../recoru_release.zip recoru_ext -x "*.DS_Store"
cd ..

# Cleanup
rm -rf dist

echo "✅ Done! recoru_release.zip is ready for the Chrome Web Store."
