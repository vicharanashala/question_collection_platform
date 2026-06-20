# Task: User Leaderboard

## Context

Users earn money when their questions are approved. They also accumulate total questions asked over time. We need a user-facing leaderboard that ranks all users by their earnings and question count, shows each user's position, and displays gold/silver/bronze medals for the top 3.

---

## Scope

### Backend — `backend/src/`

#### 1. New Entity: `LeaderboardEntry` (optional, or query on-the-fly)

> **Decision:** Compute leaderboard entries on-the-fly via a dedicated service method — no new table needed for now. If performance becomes an issue, introduce a cached `daily_leaderboard` table and refresh it on a schedule.

#### 2. `user.service.ts` — add method

```ts
// Returns top N users + the requesting user's rank + position
async getLeaderboard(
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{
  entries: LeaderboardEntry[];
  userRank: number | null;
  total: number;
}>
```

`LeaderboardEntry` shape:
```ts
{
  rank: number;           // 1-based
  userId: string;
  name: string;
  totalEarned: number;    // sum of CREDIT transactions with source=REWARD and status=COMPLETED
  totalQuestions: number; // count of questions with status=APPROVED (or all statuses — confirm)
  medal: 'gold' | 'silver' | 'bronze' | null;
  isCurrentUser: boolean;
}
```

**Sorting:** Primary sort — `totalEarned DESC`. Secondary sort — `totalQuestions DESC` (tiebreaker).

**Ranking:** Dense rank (users with the same score share the same rank).

#### 3. `user.controller.ts` — add endpoint

```
GET /users/me/leaderboard?limit=20&offset=0
Authorization: Bearer <jwt>
```

Response:
```json
{
  "entries": [
    { "rank": 1, "userId": "...", "name": "Ramesh", "totalEarned": 1250, "totalQuestions": 45, "medal": "gold", "isCurrentUser": false },
    { "rank": 2, "userId": "...", "name": "Sunita", "totalEarned": 1100, "totalQuestions": 38, "medal": "silver", "isCurrentUser": false },
    { "rank": 3, "userId": "...", "name": "Lakshmi", "totalEarned": 900, "totalQuestions": 30, "medal": "bronze", "isCurrentUser": false },
    ...
  ],
  "userRank": 12,
  "total": 148
}
```

#### 4. `user.module.ts` — inject QuestionRepository if needed for approved question counts

---

### Mobile — `mobile/src/`

#### 5. API client — `mobile/src/api/client.ts`

Add `leaderboardApi` object:
```ts
leaderboardApi: {
  getLeaderboard(params?: { limit?: number; offset?: number }): Promise<ApiResponse<LeaderboardResponse>>;
}
```

#### 6. Types — `mobile/src/types/index.ts`

Add:
```ts
interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalEarned: number;
  totalQuestions: number;
  medal: 'gold' | 'silver' | 'bronze' | null;
  isCurrentUser: boolean;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  userRank: number | null;
  total: number;
}
```

#### 7. New Screen — `mobile/src/screens/Leaderboard/LeaderboardScreen.tsx`

**Layout:**
- SafeAreaView with `backgroundColor: c.background`
- Header: "Leaderboard" title (left-aligned, large bold), subtitle showing current user rank pill on the right
- Tabs: "By Earnings" | "By Questions" (toggle between the two rankings)
- ScrollView with pull-to-refresh

**Podium / Top 3 Section** (above the flat list):
- Horizontal row of 3 cards for ranks 1, 2, 3
- Gold card: largest, centered, elevated shadow
- Silver card: slightly smaller, left of gold
- Bronze card: slightly smaller, right of gold
- Each card shows: medal icon, name, earned amount or question count (depending on active tab), rank number
- Medal icons: `trophy` (gold, color `#FFD700`), `trophy-outline` (silver, color `#C0C0C0`), `medal` (bronze, color `#CD7F32`)

**Flat List (rank 4+):**
- ListItem: rank number (greyed if no medal), name, totalEarned, totalQuestions
- Current user row highlighted with `backgroundColor: c.primary + '14'` and a left border accent
- Empty state if user has no rank yet

**Pull-to-refresh** and **loading skeleton** on first load.

#### 8. Navigation — `mobile/src/navigation/types.ts`

Add to `RootStackParamList`:
```ts
Leaderboard: undefined;
```

Add to `AppNavigator.tsx`: Button/menu item on ProfileScreen or HomeScreen that navigates to `Leaderboard`.

Also add "Leaderboard" entry to the ProfileScreen's Actions section as a navigation link.

#### 9. Translations — `mobile/dist/locales/en/common.json`

Add keys:
```json
{
  "leaderboard": {
    "title": "Leaderboard",
    "byEarnings": "By Earnings",
    "byQuestions": "By Questions",
    "yourRank": "Your Rank",
    "totalEarned": "Total Earned",
    "questionsAsked": "Questions Asked",
    "rank": "Rank",
    "notRanked": "Not Ranked",
    "gold": "Gold",
    "silver": "Silver",
    "bronze": "Bronze"
  }
}
```

---

## Out of Scope

- Admin-only leaderboard views
- Historical / daily / weekly leaderboard snapshots
- Caching layer (Redis/materialized view) — add later if query is slow
- Leaderboard across filtered subsets (by state, district) — future enhancement

---

## Dependencies

- Existing `Question` entity with `userId` and `status` fields
- Existing `Transaction` entity with `walletId`, `type=CREDIT`, `source=REWARD`, `status=COMPLETED`
- Existing `Wallet` → `User` relationship

---

## Acceptance Criteria

1. `GET /users/me/leaderboard` returns top 20 users (default) sorted by total earned (COMPLETED reward transactions)
2. Response includes `userRank` so the current user always knows their position
3. `medal` field is `'gold'` for rank 1, `'silver'` for rank 2, `'bronze'` for rank 3, `null` otherwise
4. Mobile screen shows top 3 in a podium row with gold/silver/bronze medals
5. Mobile screen shows current user's row highlighted even if outside the top 20
6. Tab toggle switches between "By Earnings" and "By Questions" rankings
7. All copy is translated

---

## File Changes Summary

| File | Action |
|------|--------|
| `backend/src/user/user.service.ts` | Add `getLeaderboard()` method |
| `backend/src/user/user.controller.ts` | Add `GET /users/me/leaderboard` endpoint |
| `backend/src/user/user.module.ts` | Import Question repository if not already imported |
| `mobile/src/api/client.ts` | Add `leaderboardApi` |
| `mobile/src/types/index.ts` | Add `LeaderboardEntry` and `LeaderboardResponse` types |
| `mobile/src/screens/Leaderboard/LeaderboardScreen.tsx` | **Create** new screen |
| `mobile/src/navigation/types.ts` | Add `Leaderboard` to `RootStackParamList` |
| `mobile/src/navigation/AppNavigator.tsx` | Add navigation to Leaderboard from ProfileScreen actions |
| `mobile/dist/locales/en/common.json` | Add leaderboard translation keys |