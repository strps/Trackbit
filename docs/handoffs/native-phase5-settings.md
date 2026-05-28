# Handoff: Native App — Phase 5 Settings & Profile (in progress)

**Branch:** `android`
**Date:** 2026-05-26
**Status:** Phase 5 partially complete — user menu and settings screen are shipped; locale/timezone pickers and version row remain.

---

## What was built this session

### User dropdown menu (`apps/native/src/components/app-tabs.tsx`)

A `UserMenu` component was added to the right side of the custom tab bar header (`CustomTabList`). It:

- Renders a 36×36 circle showing the user's initials (first letter of each word in `user.name`, max 2 chars)
- On press, measures its own screen position with `View.measure()` and opens a transparent `Modal` positioned just below the button (right-aligned, `right: 12`)
- The dropdown contains:
  1. User name + email header (separated by a divider from actions)
  2. **Settings** row — taps close the menu and call `router.push('/settings')`
  3. Divider
  4. **Sign out** row — calls `signOut()` from `useAuth()`
- Tapping outside the menu closes it (`Pressable` backdrop fills the modal)

### Settings screen (`apps/native/src/app/settings.tsx`)

A stack screen (not a tab — see design decision below). Contains:

- **Profile section** — Name and Email displayed read-only as `SettingsRow` items
- **Preferences section** — Locale and Timezone rows with `onPress={() => {}}` stubs (pickers not yet implemented)
- **Sign out** — red-tinted destructive row; calls `signOut()` then `router.replace('/auth/sign-in')`

The screen gets its title ("Settings") and back chevron from the native stack header (`headerShown: true` set on the `Stack.Screen` in `_layout.tsx`). No manual header or `SafeAreaView` needed in the screen itself.

### Root layout (`apps/native/src/app/_layout.tsx`)

Added:
```tsx
<Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
```
inside the authenticated `Stack.Protected` block.

---

## Design decision: Settings is not a tab

Original Phase 5 plan called for a Settings tab. Decision changed: Settings lives at `/settings` (stack screen) and is reached exclusively via the user avatar dropdown menu. This keeps the tab bar to three items (Habits, Analytics, Configuration) and groups account actions naturally with the user menu.

This is recorded in `docs/tasks/native-app.md` under Phase 5.

---

## Remaining Phase 5 tasks

### 1. Locale picker

- Row in Settings > Preferences is already rendered with a stub `onPress`
- Should open a modal or action sheet listing available locales
- On selection: call `PATCH /api/me/preferences` with `{ locale: selectedLocale }`
- API helper pattern: follow `apps/frontend/src/lib/api.ts` or the existing `apps/native/src/lib/api.ts`
- After a successful patch, the user object in `AuthContext` should reflect the new locale (either refetch session or update state locally)
- Available locales on the backend: check `apps/backend/src/lib/i18n.ts` or the `/api/me/preferences` handler

### 2. Timezone picker

- Same row stub exists in Settings > Preferences
- The IANA timezone list is large; a searchable `FlatList` modal is recommended
- Same `PATCH /api/me/preferences` endpoint, field `timezone`
- Consider using `Intl.supportedValuesOf('timeZone')` (available in Hermes / React Native 0.73+) for the list

### 3. App version / build info row

- Add a non-interactive row at the bottom of the Settings screen showing app version + build number
- Use `expo-application`: `Application.nativeApplicationVersion` and `Application.nativeBuildVersion`
- `expo-application` is likely already in the Expo SDK 56 install; verify with `npx expo install expo-application` if needed

---

## Key files to know

| File | Purpose |
|------|---------|
| `apps/native/src/app/settings.tsx` | Settings screen |
| `apps/native/src/components/app-tabs.tsx` | Tab bar + `UserMenu` dropdown |
| `apps/native/src/app/_layout.tsx` | Root stack — settings registered here |
| `apps/native/src/context/auth-context.tsx` | `useAuth()` — `user`, `signOut` |
| `apps/native/src/lib/api.ts` | Typed fetch wrapper (attaches Bearer token) |
| `apps/native/src/constants/theme.ts` | Color tokens (`backgroundElement`, `backgroundSelected`, `textSecondary`, etc.) |
| `docs/tasks/native-app.md` | Full phase-by-phase plan with task checkboxes |

---

## Patterns used in this codebase

- **Theming:** `useTheme()` returns a flat object of color strings keyed by `ThemeColor`. Use `theme.backgroundElement` for card backgrounds, `theme.textSecondary` for muted text.
- **Styled rows:** follow the `ConfigRow` / `SettingsRow` pattern — `TouchableOpacity` with `borderRadius: 12`, `paddingHorizontal/Vertical: Spacing.three`, flex-row with label left and value/chevron right.
- **Stack screens with back:** register in `_layout.tsx` with `options={{ headerShown: true, title: '...' }}`. The root Stack has `headerShown: false` globally, so you must opt in per screen.
- **API calls:** use `apiFetch` from `apps/native/src/lib/api.ts`. It attaches the Bearer token automatically.
- **Mutations:** follow React Query pattern in `apps/native/src/hooks/`. See `use-update-habit.ts` for a `PATCH` mutation example.

---

## Phase context

Phase 4 (Analytics) and remaining Phase 5 tasks (locale/timezone/version) are the next open items before Phase 6 (Habit Management) which is already largely complete. See `docs/tasks/native-app.md` for the full picture.
