# Encore Atlas — Product Roadmap

This roadmap outlines the evolution of Encore Atlas from a search-driven live music viewer into a personalized, immersive music discovery platform.

The roadmap is organized around increasing depth of user engagement over time.

---

## Vision

Encore Atlas should feel like returning to a show you loved and then falling into everything connected to it.

The product evolves from:
- finding a moment  
→ to staying in that moment  
→ to exploring an entire musical world  

---

## Phase 1 — Foundation (Current State)

**Goal:** Enable reliable discovery and playback of live music content

### Core Capabilities
- Artist search
- Video playback (live shows, interviews, music videos)
- Multi-surface browsing (Live Shows, Music Videos, Interviews, Merch)
- Basic UI structure and navigation

### Key Characteristics
- Fully frontend-driven
- Search-first experience
- No persistence or personalization

### Limitations
- No session continuity after playback
- No user memory or history
- Discovery depends entirely on user input

---

## Phase 2 — Session Extension (In Progress)

**Goal:** Keep users engaged beyond a single video

### Key Features
- Recommended Videos (“You Might Also Like”)
- Dedicated “For You” tab
- Improved browsing across content types

### Product Impact
- Transitions from single interaction → continuous session
- Introduces passive discovery
- Reduces drop-off after initial playback

### Constraints
- Limited recommendation set (4 videos)
- Early-stage relevance (low user data)
- API limitations

---

## Phase 3 — Data Foundation (Backend Introduction)

**Goal:** Introduce persistence and user-level data

### Key Features
- Supabase integration (Postgres + Auth)
- Anonymous user sessions
- Search logging (`artist_searches`)
- Watch history tracking (`watch_history`)

### Product Impact
- Enables user memory
- Unlocks analytics and behavioral insights
- Creates foundation for personalization

### Milestone
- Replace external analytics with internal data tracking
- Persist user activity across sessions

---

## Phase 4 — Intelligent Recommendations

**Goal:** Improve recommendation quality using structured data

### Key Features
- AI-powered artist tagging (Claude API)
- Genre / tag-based recommendation system
- Collaborative filtering:
  - “Users who searched for X also searched for Y”

### Product Impact
- Recommendations become more relevant and dynamic
- Discovery feels more intentional and less random

### Strategy
- Start with tag-based (high reliability)
- Gradually blend in collaborative filtering as data grows

---

## Phase 5 — Personalization

**Goal:** Tailor the experience to individual users

### Key Features
- Personalized “For You” feed
- Taste profiles (e.g., genre distribution)
- Recently watched content
- Returning user homepage

### Product Impact
- Transitions from generic discovery → personal experience
- Increases retention and repeat usage

---

## Phase 6 — Social & Identity Layer

**Goal:** Turn discovery into something shareable

### Key Features
- User accounts and profiles
- Shareable recommended collections
- Commentary on videos
- “What’s trending” feed

### Product Impact
- Introduces network effects
- Builds community around music moments
- Adds identity to user behavior

---

## Phase 7 — Platform Expansion

**Goal:** Expand Encore Atlas beyond viewing into a broader music ecosystem

### Potential Features
- Ticket discovery integrations
- Venue and show context
- Scene-based exploration (genres, regions, eras)
- Curated editorial pages

### Product Impact
- Positions Encore Atlas as a hub for live music culture
- Moves beyond aggregation into curation and storytelling

---

## Key Product Bets

- Discovery should feel emotional, not algorithmic
- Sessions matter more than individual clicks
- Context (era, scene, vibe) is as important as artist identity
- Users want to relive experiences, not just consume content

---

## Risks

- API dependency (YouTube availability, quotas)
- Early recommendation quality may feel weak
- Backend complexity increases over time
- Feature sprawl could dilute core experience

---

## Guiding Principle

Prioritize features that extend immersion and make it easier for users to stay in a musical moment.

Avoid building features that increase surface area without deepening the experience.
