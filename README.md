# 🚀 RallyHub — Pickleball Match Tracking App

RallyHub is a cross-platform mobile application (iOS + Android) built with **Expo + React Native** and a **Supabase** backend.  
It enables pickleball players to seamlessly:

- Create and manage profiles  
- Sign in via OAuth or Magic Link  
- Exchange identity via QR codes  
- Record matches and scores  
- Verify results with opponents  
- Maintain a clean match history  
- View leaderboards across venues  

Initial version is developed end-to-end in **10 days** by a solo engineer using **Generative AI** as a force multiplier.

---

## 📱 Features

### ✔ Profile System
- Real profiles and placeholder guest profiles  
- Guest → account claiming workflow  
- Device-local ID mapping for offline creation  
- Syncs known players across devices

### ✔ Authentication
- Google, Apple, and Email Magic Link  
- Secure session persistence using AsyncStorage  
- Typed Supabase client

### ✔ QR-Based Player Identification
- Show personal QR code  
- Scan partners/opponents instantly  
- Eliminates manual search and typos  

### ✔ Match Recording
- Select teammates and opponents  
- Enter final scores  
- Prevent duplicate player assignments  
- Optimistic locking to avoid race conditions

### ✔ Verification Workflow
- Each team independently verifies the match  
- Match becomes verified only when both sides approve  
- Supports spectator recording  
- Fully backed by RLS policies

### ✔ Leaderboards
- Powered by a materialized view  
- Ranks players by verified matches and wins  
- Supports venue-specific leaderboards  

### ✔ Venue System
- Full venue table with PostGIS `geography(Point, 4326)`  
- Insert via RPC with canonical name normalization  
- Distance-based venue search  
- Metadata (lighting, indoor/outdoor, courts)

---

## 🏗 Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Expo, React Native, Expo Router, Zustand |
| **Backend** | Supabase Postgres, RLS, PostGIS, Materialized Views |
| **Auth** | Supabase Auth (Google, Magic Link) |
| **State** | Custom hooks, optimistic updates |
| **Builds** | EAS for iOS + Android |
| **AI** | ChatGPT + GitHub Copilot + Antigravity |

---

## 📐 Architecture Overview

```text
┌──────────────────────────────┐
│ Mobile App (Expo)            │
│ - Auth (Google/Apple/Magic)  │
│ - QR Scan / Show QR          │
│ - Profile & Match Screens    │
│ - Zustand local state        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Supabase API                 │
│ - Auth Sessions              │
│ - RPC Functions              │
│ - Realtime (optional)        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Postgres + RLS               │
│ - profiles                   │
│ - matches                    │
│ - match_verifications        │
│ - venues (PostGIS)           │
│ - leaderboard_stats (MV)     │
│ - Triggers + RLS Policies    │
└──────────────────────────────┘
```

---

## 🔑 Supabase Client

- Strongly typed  
- Persistent sessions using AsyncStorage  
- Auto-refresh tokens  
- Conditional URL detection for Expo Web  

---

## 🗄 Database Schema

Schema includes:

- `profiles`
- `local_profile_links`
- `known_users`
- `matches`
- `match_verifications`
- `user_activity`
- `venues` (PostGIS)
- RPCs for venue insert, score update, verification
- Triggers for duplicate prevention, optimistic locking
- Materialized leaderboard view
- Full RLS policy set

---

## 🏅 Leaderboards

- Computed via a materialized view (`leaderboard_stats`)  
- Aggregates verified matches and wins  
- Efficient for real-time display  

---

## 🔒 Security (RLS Overview)

- Users may update only their own profiles  
- Match updates allowed only by creator or participants  
- Match verifications restricted to participants  
- Known users list is private per user  
- Venue modification allowed only for creators  

---

## 🧪 Core Workflows

### Match Creation
1. Select players using QR or known users  
2. Enter score  
3. Submit → stored as unverified  
4. Opponents verify  
5. Added to leaderboard

### Guest Claiming
1. Guest profile created offline  
2. Real user signs up later  
3. Scan QR to claim  
4. History is migrated securely  

---

## 🚀 Development

### Install

npm install

### Run

npx expo start

### Build (Android)

eas build -p android --profile preview

### Build (Android, Local)

npx expo prebuild --clean && pushd android && ./gradlew assembleRelease && popd

### Install (Android, Local)

adb install android/app/build/outputs/apk/release/app-release.apk

### Build (iOS)

eas build -p ios --profile preview

### Environment variables required:

EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

---

## 🌟 Highlights

- Fully working cross-platform mobile app  
- Built in **10 days** by a single developer  
- AI-assisted architecture, schema design, and coding  
- Robust SQL schema with production-grade RLS  
- Foundation for club-level rating systems and communities  

---

## 🤝 Contributing

Contributions will be welcomed once API stabilizes.

---

## 📄 License

MIT

---

## 🔒 Intellectual Property

Certain core workflows and mechanisms used in RallyHub, including identity exchange and match verification flows, are covered under **U.S. Provisional Patent Application — Patent Pending**.
