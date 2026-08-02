# Default Template migrations

This project inherits source from `@nocobase/portal-template-default`. Updating
`nocobase.defaultTemplateVersion` records a completed source upgrade; changing
that value alone does not apply template changes.

## Upgrade checklist

1. Commit or back up application-owned changes.
2. Review each skipped Default Template release and its Portal SDK migration.
3. Merge host and installed Registry source without overwriting business code.
4. Update `nocobase.defaultTemplateVersion` only after source migration.
5. Run `pnpm install`, `pnpm sdk:check`, and `pnpm build`.

## Default Template 3.0

Template 3 uses Portal SDK 2 route definitions. Application and installed
Registry page routes use `lazy` loaders while keeping resource, menu, and access
metadata synchronous. The shared route fallback is intentionally empty so a
lazy drawer or dialog does not render a page-level Loading indicator beneath
its parent; any meaningful loading state belongs inside the owning surface.

See the upstream [Default Template migration guide](https://github.com/nocobase/portal-template-default/blob/main/MIGRATION.md)
and [Portal SDK migration guide](https://github.com/nocobase/portal-template-default/blob/main/sdk/MIGRATION.md)
for the complete release contract.
