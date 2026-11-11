# Astronomical Time — Hologram Test

A small, isolated Three.js test harness for the `hologram.js` module.

## Files

- `index.html` — page and test controls
- `main.js` — Three.js scene, procedural demonstration textures, and view toggles
- `hologram.js` — holographic overlay module

## Run it in GitHub Codespaces

1. Upload or commit all three files to your private GitHub repository.
2. Open the repository in GitHub Codespaces.
3. In the terminal, run:

   ```bash
   python3 -m http.server 8000
   ```

4. Open the **Ports** tab and open port `8000` in the browser.

The page imports Three.js r180 from jsDelivr, so the browser needs internet access.

## Run with GitHub Pages

You can also enable GitHub Pages for the repository and publish from the branch/folder containing `index.html`. No build step is required.

## Notes

- The Earth and Sun textures are procedural placeholders generated in `main.js`; they are not NASA imagery and are not intended for scientific rendering.
- Replace the procedural texture maps with your own image textures when you want to compare against the actual Mode 4 appearance.
- Holograms are enabled only in Orbit View. Earth Focus and Sun Focus hide the overlays, matching the requested initial integration behavior.
- This is a standalone visual test. It does not modify or import your production `Mode4.js`.
