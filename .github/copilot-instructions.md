- [x] Workspace instructions verified.
- [x] Requirements clarified: Italian interface, client-side batch conversion, proportional resize, exact-size presets, WebP export.
- [x] Standalone HTML/CSS/JS app created because Node.js and npm are unavailable.
- [x] Conversion workflow implemented.
- [x] No extensions required.
- [x] Verified in browser with a 4309 x 2390 px test image: output at 1000 px is 1000 x 555 px; changing the maximum to 900 px produces 900 x 499 px.
- [x] README added at the repository root. The app is in `Piccola pressa/`; no VS Code task or build step is needed.
- [x] Open `Piccola pressa/index.html` in a modern browser to use the app.
- [x] GitHub Pages workflow added for automatic deployment from the public `main` branch.
- [x] Publish the files to the public GitHub repository and enable GitHub Actions in Pages settings.
- [x] Redundant "Immagini del lotto" box removed: files and folders are added from the preview panel, which is also a drop target.
- [x] The page title follows the resize mode: "Controlla l’inquadratura." in exact-size mode, "Ridimensiona le tue immagini." in maximum-side mode.
- [x] The exact-size crop window can be dragged in the preview (pointer drag and arrow keys) and is clamped inside the image, so no empty areas are produced.
- [x] Each image keeps its own crop position, centered by default; "Ricentra l’inquadratura" resets the active image and only the edited image is marked as stale after a drag.
- [x] Verified in a headless Chrome run (26 checks): title switching, drag clamping on landscape and portrait sources, per-image crop persistence, 1486 × 992 WebP output whose pixels match the dragged crop, per-image stale state, keyboard nudging and recentering.
- [x] The "Dimensioni esatte" box shows a live thumbnail of the selected portion: it redraws on every drag step, follows the active image and the chosen preset (caption "Anteprima · T&I 1486 × 992 px"), and hides with no image or in maximum-side mode.
- [x] Re-verified with a second headless Chrome run (24 checks) covering the live thumbnail, clamping, per-image crop, keyboard, recentering, conversion and per-image stale state.

Keep image processing client-side. In maximum-side mode, preserve aspect ratio and only downscale when the source's longest side exceeds the configured limit. Exact-size mode uses a per-image crop that starts centered and can be dragged in the preview; moving it marks only that image's result as stale. Keep the exact-size crop preview in sync with the active image and the output format. Keep interface text in Italian.
