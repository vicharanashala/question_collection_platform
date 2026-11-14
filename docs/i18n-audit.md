# i18n audit: web and mobile

Audit date: 2026-11-04. Scope: every screen and component in `web/src` and `mobile/src`, and all 23 locale bundles (English plus 22 Indian languages).

## Findings

- **Keys shown as raw text.** Several `t()` keys had no English value anywhere, so users saw the key name. Examples: `audio.translateHint` (its `??` fallback never runs because i18next never returns null), `kvkLoadingMessage`, `speech.stt.uploading`, `common.failedToLoad` (called through the `$t` wrapper), and `nav.agriEntities`.
- **Inline English defaults.** Some `t('key', 'English default')` calls carried their English text in code, so non-English users always saw English for them. Those defaults were moved into the English bundle; a grep of current source finds one such call left.
- **Placeholder mismatch.** `anveshan.candidateWelcome` used `{{ANVESHAN_TAGLINE}}` but the component passes `app`, so the tagline did not render.
- **Web bundle source.** The web bundle is not generated from mobile, so it is maintained directly. Its old "auto-copied" header was wrong and has been replaced.
- **Hardcoded strings.** JSX text, user-facing attributes (placeholder, title, aria-label, label, and similar), toast and alert messages, and conditional labels were moved to keys. Counts: web 1,118 candidates, now 141 remaining; mobile 520 candidates, now 42 remaining.
- **Translation gap.** Most non-English strings in the web bundle are identical to English (table below). Mobile is considerably more complete.

## What changed

- New English keys: mobile 266, web 1,013. Each is present in all 23 locales, using the English text as a placeholder where no translation exists.
- Existing keys were reused when the English text matched exactly.
- Inline `t()` defaults were promoted into the English bundle and removed from the call sites.
- Mobile locale JSON is the source of truth. `mobile/src/i18n/resources.ts` was regenerated with `node scripts/generate-i18n-resources.js`.
- Web `src/i18n/resources.ts` is edited directly.
- No existing key was removed or changed in any locale: checked programmatically across all 23 languages on both platforms.

## Verification

- Every literal `t()`, `$t()`, and `i18n.t()` key resolves in English. The few that do not are plural base keys that resolve through `_one`/`_other`, checked at runtime.
- Placeholder and option names match for every call that passes interpolation options.
- TypeScript: web has 0 errors (baseline 0). Mobile has 48 errors, the same set as before the change (pre-existing, unrelated).
- Jest: the same 36 tests fail before and after (pre-existing: `AuthProvider` requires `AccountLockedProvider` in the test harness, and OTP tests rely on unmounted inputs).
- Web ESLint: 38 pre-existing style findings (`no-empty-function`, `array-type`, `no-unused-expressions`). None are hooks violations, and the counts of the patterns these rules flag are unchanged.

## Coverage by language

Count of keys used in code whose text is identical to English. For new keys this means "not yet translated". Each figure is `identical / keys used`.

| Language | Mobile | Web |
|---|---|---|
| Assamese (`as`) | 271 / 833 | 1095 / 1476 |
| Bengali (`bn`) | 271 / 833 | 1095 / 1476 |
| Bodo (`brx`) | 273 / 833 | 1097 / 1476 |
| Dogri (`doi`) | 274 / 833 | 1098 / 1476 |
| Gujarati (`gu`) | 272 / 833 | 1096 / 1476 |
| Hindi (`hi`) | 272 / 833 | 1051 / 1476 |
| Kannada (`kn`) | 273 / 833 | 1097 / 1476 |
| Kashmiri (`ks`) | 274 / 833 | 1097 / 1476 |
| Konkani (`kok`) | 273 / 833 | 1097 / 1476 |
| Maithili (`mai`) | 269 / 833 | 1092 / 1476 |
| Malayalam (`ml`) | 270 / 833 | 1094 / 1476 |
| Manipuri (`mni`) | 274 / 833 | 1098 / 1476 |
| Marathi (`mr`) | 272 / 833 | 1096 / 1476 |
| Nepali (`ne`) | 275 / 833 | 1098 / 1476 |
| Odia (`or`) | 273 / 833 | 1097 / 1476 |
| Punjabi (`pa`) | 273 / 833 | 1097 / 1476 |
| Sanskrit (`sa`) | 269 / 833 | 1092 / 1476 |
| Santali (`sat`) | 275 / 833 | 1098 / 1476 |
| Sindhi (`sd`) | 274 / 833 | 1097 / 1476 |
| Tamil (`ta`) | 274 / 833 | 1098 / 1476 |
| Telugu (`te`) | 272 / 833 | 1096 / 1476 |
| Urdu (`ur`) | 271 / 833 | 1095 / 1476 |

Translation of the new English keys (about 1,300 mobile and web entries per language) is still needed. The existing MyMemory pipeline (`mobile/scripts/translate_one.ts`) was blocked from this environment by the proxy (HTTP 403). It needs to run where network access is allowed.

## Remaining manual work

These were not auto-converted because they need a decision or a rewrite rather than a mechanical swap:

- **Sentence fragments mixed with markup or expressions** (for example `Showing {n} of {m}` split around links, or text next to a nested `<b>`). These need a single sentence with interpolation, or `<Trans>`.
- **Short labels of three characters or fewer** (for example `OK`, `Age`, `New`, `Qs`). They were left alone to avoid translating data.
- **Components that take `t` as a prop** (for example `SectionLabel` in the leaderboard) and module-level helpers that return text. These need `t` passed in or converted to hook-based components.

Remaining hardcoded strings (after filtering toast type arguments and tokens), by file:

Web (33 files):

| File | Count |
|---|---|
| `components/profile/CompleteProfileWizard.tsx` | 21 |
| `pages/users/UserDetailPage.tsx` | 13 |
| `components/profile/EditPublicProfileDialog.tsx` | 10 |
| `pages/reviews/ReviewsPage.tsx` | 10 |
| `pages/public/AnveshanPhaseGate.tsx` | 8 |
| `pages/auth/LoginPage.tsx` | 6 |
| `pages/dashboard/AdminDashboardPage.tsx` | 6 |
| `components/WalletDetailModal.tsx` | 5 |
| `components/DataTable.tsx` | 4 |
| `pages/dashboard/FinanceDashboardPage.tsx` | 4 |
| `pages/public/LocationCapture.tsx` | 4 |
| `pages/public/PublicHomePage.tsx` | 4 |
| `pages/users/UsersPage.tsx` | 4 |
| `components/LockedAccountModal.tsx` | 3 |
| `components/ReasonDialog.tsx` | 3 |
| `components/WalletAdjustModal.tsx` | 3 |
| `components/WithdrawalDetailModal.tsx` | 3 |
| `pages/distributions/AssignStatesDialog.tsx` | 3 |
| `pages/faqs/FaqsPage.tsx` | 3 |
| `pages/feedbacks/FeedbacksPage.tsx` | 3 |
| `pages/settings/SettingsPage.tsx` | 3 |
| `pages/withdrawals/WithdrawalsPage.tsx` | 3 |
| `pages/agri-entities/AgriEntitiesPage.tsx` | 2 |
| `pages/distributions/Pagination.tsx` | 2 |
| `pages/public/PublicWalletPage.tsx` | 2 |
| `pages/wallets/WalletsPage.tsx` | 2 |
| `components/anveshan-user/AnveshanQuestionsTab.tsx` | 1 |
| `components/ui/crop-picker-modal.tsx` | 1 |
| `components/ui/new-badge.tsx` | 1 |
| `components/ui/searchable-select.tsx` | 1 |
| `pages/public/PublicAskPage.tsx` | 1 |
| `pages/public/PublicProfilePage.tsx` | 1 |
| `pages/reports/ReportDetailPage.tsx` | 1 |

Mobile (18 files):

| File | Count |
|---|---|
| `navigation/AppNavigator.tsx` | 5 |
| `screens/Admin/AdminAuditLogsScreen.tsx` | 4 |
| `screens/Admin/AdminDashboardScreen.tsx` | 4 |
| `components/SuspendBanModal.tsx` | 3 |
| `components/WalletAdjustModal.tsx` | 3 |
| `screens/Admin/AdminSuperAdminScreen.tsx` | 3 |
| `screens/Admin/AdminUserDetailScreen.tsx` | 3 |
| `components/WalletDetailModal.tsx` | 2 |
| `screens/Admin/FinanceDashboardScreen.tsx` | 2 |
| `screens/Auth/TermsScreen.tsx` | 2 |
| `screens/Profile/ProfileScreen.tsx` | 2 |
| `screens/Wallet/PaymentDetailsScreen.tsx` | 2 |
| `screens/Wallet/WalletScreen.tsx` | 2 |
| `components/WithdrawalDetailModal.tsx` | 1 |
| `screens/Admin/AdminQuestionsScreen.tsx` | 1 |
| `screens/Leaderboard/LeaderboardScreen.tsx` | 1 |
| `screens/Question/QuestionPreviewScreen.tsx` | 1 |
| `screens/Submissions/SubmissionsScreen.tsx` | 1 |

## Known issues outside this change

- `agriEntity.viewImage` has two different English defaults in `AgriEntitySubmitForm.tsx`. The first one is now the English text for both call sites.
- Sanskrit and Telugu contain flat dotted keys (for example `auth.accountBanned`) that no code uses. They are harmless and were left in place.
- `onDeviceAI.*` keys exist in mobile and are used there. The web bundle has copies, but the web UI never renders them.
- `block.verification_methods` in `PaymentDetailsScreen.tsx` is a payment-gateway config key, not UI text, and was left alone.
- Dynamic keys built from variables (for example `home.${tier.key}`, `report.categories.${category}`) cannot be verified statically. Their prefixes match existing English keys, but each key should be spot-checked in the UI.
