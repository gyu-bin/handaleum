# Journal UI — Plan A (Dawn Survey align)

Approved 2026-08-05. Map canvas (Naver / land·water·pins·TimeSlider map chrome) is **out of scope**.

## Goal

Drop the cream+terracotta+Georgia-everywhere “AI journal template” look. Align journal chrome with `docs/design-philosophy.md`: cream paper + single slate ink; sand rare; notify-only warm red.

## Rules

| Layer | Rule |
|-------|------|
| Color | **단일 남색 `ink`**. `terracotta`/`sand`/`notify`는 ink alias. Map `land`/`water`만 지도용. |
| Type | **System sans everywhere** (`serif` token aliases System — no Georgia). |
| Radius | Chips/buttons = `radius.md` (or sm). `pill` only for floating dock + OTA toast. |
| CTA | `Button` primary = ink. `accent` variant = same as primary (no warm fill). Ghost = ink text. |
| Scope | Home chrome, month picker, stamps UI, settings, onboarding, permission, playback, cards **chrome**. Not MapCanvas pins, not Feed/Story pixel templates. |

## Non-goals

- New fonts files (MaruBuri/Pretendard) — keep Georgia/System until assets land.
- Map style retint.
- Insights orphan screen polish.
