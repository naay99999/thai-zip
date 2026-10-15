# Security Policy

## Supported versions

Only the latest published version of `thaizip` receives security fixes.

## Reporting a vulnerability

Please **do not** open a public issue. Report it privately through
[GitHub private vulnerability reporting](https://github.com/naay99999/thai-zip/security/advisories/new).

Include the affected version, a minimal reproduction, and the impact you
expect. You should get an initial response within 7 days.

## Release integrity

Releases are published from `.github/workflows/release-please.yml` using npm
trusted publishing with provenance. Verify a release with
`npm audit signatures`, and check that its provenance points at this
repository.
