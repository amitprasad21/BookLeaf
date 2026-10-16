# Design

This file is a pointer. **The single visual source of truth is [.front/DESIGN_SYSTEM.md](.front/DESIGN_SYSTEM.md).** Do not define colours, type, spacing or component styling anywhere else.

## Status: provisional

The blueprint names a supplied **monochrome UI design specification** as canonical, but that specification was **not included** in the material received (see [SOURCE_REGISTER.md](SOURCE_REGISTER.md), item S-07). Until it is provided, `.front/DESIGN_SYSTEM.md` defines a provisional monochrome token set built from the rules the blueprint quotes:

- Opaque dark surfaces, white and grayscale text, no brand colours, gradients, glows, glassmorphism or decorative imagery.
- Clear control boundaries, visible focus, sufficient contrast.
- Status meaning never depends on colour alone.
- No fake metrics; missing data is never shown as zero.

When the real specification arrives, replace the token values in `.front/DESIGN_SYSTEM.md`, record the change in [.agent/DECISIONS.md](.agent/DECISIONS.md) (D-014), and re-run the checks in [.front/ACCESSIBILITY_RESPONSIVENESS.md](.front/ACCESSIBILITY_RESPONSIVENESS.md).

## Related

| Topic | Document |
|---|---|
| Tokens, typography, spacing, iconography | [.front/DESIGN_SYSTEM.md](.front/DESIGN_SYSTEM.md) |
| Reusable components and their states | [.front/COMPONENTS.md](.front/COMPONENTS.md) |
| Accessibility and viewport checks | [.front/ACCESSIBILITY_RESPONSIVENESS.md](.front/ACCESSIBILITY_RESPONSIVENESS.md) |
| Admin screens | [.front/admin/SCREENS.md](.front/admin/SCREENS.md) |
| Author screens | [.front/author/SCREENS.md](.front/author/SCREENS.md) |
