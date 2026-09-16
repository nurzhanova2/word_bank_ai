# Release checks

Run `npm run release:check` for type checking, tests, builds, version synchronization and placeholder-secret checks. `npm run sbom` writes a CycloneDX SBOM to `release/sbom.cdx.json`.

LanguageTool and JRE download pinning remain pending: the current preparation script still uses mutable upstream endpoints and must not be treated as supply-chain complete. Installer signing is unsigned unless verified CI signing credentials are supplied.
