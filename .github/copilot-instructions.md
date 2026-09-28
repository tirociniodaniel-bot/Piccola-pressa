- [x] Workspace instructions verified.
- [x] Requirements clarified: Italian interface, client-side conversion, proportional resize, WebP export.
- [x] Standalone HTML/CSS/JS app created because Node.js and npm are unavailable.
- [x] Conversion workflow implemented.
- [x] No extensions required.
- [x] Verified in browser with a 4309 x 2390 px test image: output at 1000 px is 1000 x 555 px; changing the maximum to 900 px produces 900 x 499 px.
- [x] README added. No VS Code task or build step is needed for a standalone HTML app.
- [x] Open `index.html` in a modern browser to use the app.
- [x] GitHub Pages workflow added for automatic deployment from the public `main` branch.
- [ ] Publish the files to a public GitHub repository and enable GitHub Actions in Pages settings.

Keep image processing client-side. Preserve aspect ratio and only downscale when the source exceeds the configured maximum width. Keep interface text in Italian.
