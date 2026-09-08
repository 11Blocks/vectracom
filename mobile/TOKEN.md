# VECTRACOM Mobile — Design tokens

Source of truth: `mobile/src/theme/colors.ts`  
Mirror of: `web-admin/src/app/globals.css` (Guide Frontend v1.0)

## Rule

**Screens (`src/screens/**`) must not use raw hex / rgba.**  
Import `colors`, `statusColors`, `radius`, `spacing`, `typography`, `motion` from `../theme` or `../theme/colors`.

Allowed raw colors live **only** in:
- `theme/colors.ts` (canonical)
- `theme/statusColors` (badge fills)

## Core map (web → mobile)

| Web CSS | Mobile |
|---------|--------|
| `--background` `#0a0f0d` | `colors.bg` |
| `--card` `#111916` | `colors.card` |
| `--primary` `#0f9d70` | `colors.primary` |
| `--accent` `#172019` | `colors.accent` |
| `--muted-foreground` | `colors.muted` |
| AI amber `#f5a623` | `colors.amber` / `aiSurface` / `aiBorder` |
| `--radius` `0.625rem` | `radius.md` (10) |

## Soft surfaces

Use named tokens: `primarySoft12`, `dangerSoft12`, `overlay`, `waSoft12`, etc.  
Do not invent new `rgba(15,157,112,…)` in screens.

## Motion

| Token | Value | Use |
|-------|-------|-----|
| `motion.toastMs` | 220 | Toast fade/slide |
| `motion.modalMs` | 180 | Modal scale-in |
| `motion.pressScale` | 0.98 | Button / Card press |

## Fonts

System stack only (same as web today — Inter not loaded).  
Do not add `expo-font` / Inter until web ships it.

## Check

```bash
# No raw hex in screens/components (theme excepted)
rg "#[0-9a-fA-F]{3,8}|rgba?\(" mobile/src/screens mobile/src/components
```
