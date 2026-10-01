# ASTRA VISUAL ENTITY GUARD

Reusable pre-release guard for visual entities such as flags, crests, avatars, logos and badges.

## Contract

1. **One visual owner per entity.** A row/page may compose the owner component, but must not redraw the same flag/logo in metadata or another cell.
2. **Fallbacks stay in the same visual family.** A national team falls back to a flag, not to an unrelated club/provider logo.
3. **Remote providers have one owner.** CDN URLs live only inside the canonical component; pages consume the component.
4. **No raw regional-flag emoji in render files.** Rendering is normalized through the canonical component.
5. **Release blocking.** A contract violation exits non-zero and blocks prebuild/preflight.

## Porting to another site

Copy:
- `scripts/astra-visual-entity-guard.mjs`
- `config/astra-visual-entity-guard.json`

Then adapt only the JSON ownership contracts to the new site's canonical components and pages. Add:

```json
"test:visual-entities": "node scripts/astra-visual-entity-guard.mjs"
```

to package scripts and execute it in prebuild/release preflight.

The guard is framework-light: it scans React/JSX, Vue, Svelte and HTML render files by default.
