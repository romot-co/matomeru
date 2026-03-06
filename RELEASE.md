# Release Checklist

## Prerequisites

- A clean working tree on `main`
- A VS Marketplace Personal Access Token in `VSCE_PAT`
- Node dependencies installed with `npm ci`

## Release Steps

1. Update `CHANGELOG.md` for the release contents.
2. Bump the extension version and create the tag:
   ```bash
   npm version patch
   ```
   Use `minor` or `major` instead of `patch` when needed.
3. Reinstall dependencies from the lockfile:
   ```bash
   npm ci
   ```
4. Run the full local verification flow, including real integration tests and VSIX packaging:
   ```bash
   npm run release:check
   ```
5. Smoke-test the generated VSIX locally if needed:
   ```bash
   npm run install-extension
   ```
6. Publish to the Marketplace:
   ```bash
   npm run publish:extension
   ```
7. Push the release commit and tag:
   ```bash
   git push origin main --follow-tags
   ```

## Notes

- The extension ID is `romot.matomeru`.
- `npm run package` and `npm run publish:extension` use `@vscode/vsce`.
