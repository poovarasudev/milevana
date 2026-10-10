# Release run — vX.Y.Z

Copy this file to `docs/release-runs/vX.Y.Z.md` **before tagging**. The
release workflow refuses to build or deploy a tag whose run record does not
exist with both results below marked `pass` (`scripts/check-release-gate.mjs`,
AC-R2).

- Tag: `vX.Y.Z`
- Date: YYYY-MM-DD
- Release candidate: EAS build `___` / versionCode `___`

## Results

- maestro: pending <!-- change to `pass` or `fail` -->
- manual checklist: pending <!-- change to `pass` or `fail` -->

## Maestro

Run `maestro test .maestro/` on a release or preview Android build. Record
each flow's outcome; link a bug for any failure.

| Flow | Result | Notes |
|------|--------|-------|
| `.maestro/foundation-first-launch.yaml` | ☐ | |
| `.maestro/foundation-offline-lifecycle.yaml` | ☐ | |
| _(every other `.maestro/*.yaml` flow)_ | ☐ | |

## Manual checklist

Work through `docs/release-verification.md` end to end on the release
candidate and record the overall result above. Paste or link the completed
checklist here (or reference the dated copy).

## Notes / failures

<!--
  Anything that failed, was deferred by the owner in writing (AC-R3), or
  needs a follow-up tag.
-->
