# TASK-13: Light & Dark Mode

## Objective
Add persistent light/dark mode with a theme toggle UI accessible from the profile screen.

## Context
The app already has `lightTheme` and `darkTheme` defined in `utils/theme.ts` and a `ThemeProvider` with `toggle()`/`setMode()` in `hooks/useTheme.tsx`. The only missing piece is **persistence** — theme preference resets to default on app restart.

---

## Sub-Tasks

### 1. Theme Persistence
- [ ] Store theme preference (`'light'` | `'dark'` | `'system'`) in AsyncStorage
- [ ] Load persisted theme on app start before first render
- [ ] Save to AsyncStorage whenever theme changes

### 2. Theme Toggle UI
- [ ] Add theme toggle section in Profile screen
- [ ] Support three modes: Light / Dark / System (device default)
- [ ] Visual indicator of current mode

### 3. Verification
- [ ] Theme persists after app restart
- [ ] No TypeScript errors
- [ ] Both light and dark themes look correct on all screens