# Decisions

This document captures key product and technical decisions made during the development of Encore Atlas, along with the reasoning behind them.

---

## 1. Shift from Search Tool → Discovery Experience

**Decision**
Introduce Recommended Videos to extend user sessions beyond a single search interaction.

**Why**
- Users had no clear next step after watching a video
- Sessions ended prematurely despite clear intent to continue exploring
- Live music consumption is associative and benefits from guided discovery

**Impact**
- Transforms the product from utility → experience
- Enables longer, more immersive sessions
- Creates foundation for future personalization

---

## 2. Two-Entry Recommendation Strategy

**Decision**
Surface recommendations in two places:
- Contextual: “You Might Also Like” below video results
- Dedicated: “For You” tab in navigation

**Why**
- Contextual recommendations support passive discovery
- Dedicated tab supports intentional exploration
- Prevents over-reliance on search as the only entry point

**Tradeoff**
- Increased UI complexity
- Landing experience still search-first, which may limit visibility of recommendations for new users

---

## 3. Limit Recommendations to 4 Videos

**Decision**
Display only 4 recommended videos per context

**Why**
- API limitations restrict how many videos can be fetched efficiently
- Smaller set improves clarity and reduces noise
- Easier to maintain perceived relevance

**Tradeoff**
- Less depth in early discovery
- May feel constrained if users want to browse more

---

## 4. Start with Heuristic + Tag-Based Recommendations

**Decision**
Use artist tags and similarity heuristics before relying on user behavior

**Why**
- No meaningful user data exists at early stage
- Need recommendations to work immediately
- Tag-based approach is simple, explainable, and reliable

**Tradeoff**
- Less personalized initially
- “Vibe” matching may be imperfect

---

## 5. Plan for Hybrid Recommendation System

**Decision**
Combine:
- genre/tag similarity
- collaborative filtering (“users who searched for X also searched for Y”)

**Why**
- Tag-based recommendations provide immediate coverage
- Collaborative filtering improves with scale
- Blended approach avoids cold start problem

**Impact**
- System improves naturally over time without needing ML infrastructure

---

## 6. Use Supabase as Backend Foundation

**Decision**
Adopt Supabase (Postgres + Auth + API) for backend

**Why**
- Provides database, auth, and API in one system
- Supports anonymous → authenticated user model
- Integrates cleanly with Vercel
- Free tier sufficient for early stage

**Tradeoff**
- Requires learning backend concepts
- Free tier has limitations (pausing, storage limits)

---

## 7. Use Claude API for Artist Tagging

**Decision**
Automatically generate artist tags using Claude API

**Why**
- Manual tagging is not scalable
- Tags enable recommendation system
- Lightweight AI integration adds meaningful capability

**Tradeoff**
- Tag quality may vary
- Requires validation and possible future overrides

---

## 8. Maintain Frontend Simplicity (for Now)

**Decision**
Keep most logic client-side initially

**Why**
- Faster iteration
- Lower complexity
- No need for full backend early on

**Tradeoff**
- Limited personalization
- Some logic duplicated or constrained by client environment
- Requires careful handling of environment variables

---

## 9. Use PR + Preview Workflow (After Early Issues)

**Decision**
Adopt branch → PR → Vercel preview → merge workflow

**Why**
- Direct pushes to main caused regressions
- Preview environments allow validation before going live
- Reduces risk of breaking production

**Impact**
- More stable development process
- Better visibility into changes

---

## 10. Separate Git Control from Claude

**Decision**
Restrict Claude from performing Git operations

**Why**
- AI-assisted Git commands introduced risk (merges, force pushes, branch confusion)
- Maintaining manual control ensures predictable repo state

**Impact**
- Cleaner workflow
- Reduced risk of unintended changes

---

## 11. Prioritize Immersive Experience Over Feature Breadth

**Decision**
Focus on features that deepen engagement (e.g., recommendations) rather than expanding surface area too quickly

**Why**
- Core value is emotional and experiential
- Too many features risks diluting the product
- Strong sessions matter more than feature count

---

## 12. Accept Early Imperfection in Recommendation Quality

**Decision**
Ship recommendations before they are “perfect”

**Why**
- Learning requires real usage
- Quality improves with data
- Waiting for perfection delays feedback

**Tradeoff**
- Some recommendations may feel irrelevant
- Requires iteration based on real usage

---

## Guiding Principle

Favor decisions that:
- extend user sessions
- deepen emotional engagement
- support discovery without friction

while staying realistic about:
- API limits
- early-stage data quality
- solo developer workflow constraints
