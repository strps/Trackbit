# Trackbit Native

React Native app for Trackbit, built with [Expo](https://expo.dev) ~56 and [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation. Targets Android and iOS; web output is supported but treated as a secondary target.

Docs: [Expo v56](https://docs.expo.dev/versions/v56.0.0/)

## Stack

| Concern | Technology |
|---------|-----------|
| Framework | Expo ~56 |
| Navigation | Expo Router ~56.2 (file-based) |
| UI runtime | React Native 0.85 / React 19 |
| Language | TypeScript ~6 (strict) |
| Animations | React Native Reanimated 4 |
| Gestures | React Native Gesture Handler ~2.31 |
| Tabs | `expo-router/unstable-native-tabs` (`NativeTabs`) |
| Images | `expo-image` |
| Glass effects | `expo-glass-effect` |

## Directory layout

```
apps/native/
├── assets/
│   └── images/           # App icons, splash, tab icons (PNG)
├── src/
│   ├── app/              # Expo Router routes (file = screen)
│   │   ├── _layout.tsx   # Root layout — ThemeProvider + splash overlay
│   │   ├── index.tsx     # Home tab screen
│   │   └── explore.tsx   # Explore tab screen
│   ├── components/       # Reusable UI components
│   │   ├── ui/           # Primitive building blocks
│   │   └── *.web.tsx     # Web platform overrides (same export shape)
│   ├── constants/
│   │   └── theme.ts      # Colors, Fonts, Spacing, layout constants
│   └── hooks/            # Custom React hooks
│       └── *.web.ts      # Web overrides for hooks
├── app.json              # Expo config (name, icons, plugins, experiments)
├── package.json
└── tsconfig.json
```

## Conventions

### Path aliases

`@/*` resolves to `src/*`. `@/assets/*` resolves to `assets/*`. Never use relative paths that cross directory boundaries — always use the alias.

```ts
import { Spacing } from '@/constants/theme';
import logo from '@/assets/images/icon.png';
```

### Routing

Routes live in `src/app/`. The file name is the route segment. `_layout.tsx` wraps children with providers. Index screens (`index.tsx`) are the default screen for a segment. Tab triggers are declared in the layout's `<AppTabs />` component, not scattered across individual screens.

### Platform overrides

When a component or hook needs a different implementation on web, create a sibling file with the `.web.tsx` (or `.web.ts`) suffix. The Metro bundler picks the platform-specific file automatically. Both files must export the exact same interface.

```
use-color-scheme.ts       # native implementation
use-color-scheme.web.ts   # web implementation (same export)
```

### Theming

Never hardcode colors. Always read from the theme via `useTheme()`:

```ts
const theme = useTheme(); // returns Colors['light'] | Colors['dark']
<View style={{ backgroundColor: theme.background }} />
```

Available color tokens: `text`, `background`, `backgroundElement`, `backgroundSelected`, `textSecondary`.

`ThemeColor` is the union type of valid token names (re-export from `@/constants/theme`).

### Spacing

Use the `Spacing` token map for all margin, padding, and gap values. Never use raw numbers.

```ts
import { Spacing } from '@/constants/theme';
// half=2, one=4, two=8, three=16, four=24, five=32, six=64
gap: Spacing.three
```

`BottomTabInset` and `MaxContentWidth` are also exported from `theme.ts` and used for consistent safe-area and content-width constraints.

### Typography

Use `<ThemedText>` for all text. Select a type variant via the `type` prop:

| type | use case |
|------|----------|
| `default` | Body copy (16/24, weight 500) |
| `small` | Secondary labels (14/20, weight 500) |
| `smallBold` | Emphasized labels (14/20, weight 700) |
| `subtitle` | Section headings (32/44, weight 600) |
| `title` | Hero headings (48/52, weight 600) |
| `code` | Monospace snippets |
| `link` / `linkPrimary` | Tappable links |

### StyleSheet

Define styles at the bottom of every file with `StyleSheet.create()`. Keep style objects co-located with the component that uses them — do not share a stylesheet between files.

### Component exports

- Route screens (`src/app/*.tsx`) use **default exports** (Expo Router requires it).
- All other components use **named exports**.
- File names: kebab-case (`themed-text.tsx`, `app-tabs.tsx`).

### Tabs

Tab configuration lives in `src/components/app-tabs.tsx` using `NativeTabs` from `expo-router/unstable-native-tabs`. Tab icons are PNG assets in `assets/images/tabIcons/` at 1×, 2×, and 3× resolutions. Use `renderingMode="template"` so the icon color follows the active/inactive state automatically.

## Running locally

```bash
# Install dependencies
npm install

# Start Expo dev server (interactive menu to open on device/emulator/web)
npm start

# Open directly on a specific target
npm run android   # Android emulator / connected device
npm run ios       # iOS simulator (macOS only)
npm run web       # Browser

# Lint
npm run lint
```

Requires [Expo Go](https://expo.dev/go) or a development build on device. For Android emulator, Android Studio + AVD must be configured. For iOS simulator, Xcode must be installed.
