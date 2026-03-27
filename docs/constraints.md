# Constraints

This document captures the current product, technical, and workflow constraints for Encore Atlas so feature decisions stay grounded in what is realistically possible right now.

---

## Product Constraints

**Search-first experience**
- The current product experience is heavily oriented around searching for an artist first.
- This makes discovery features harder to surface naturally for first-time users.
- Some features, like recommendations, may feel secondary unless the landing experience evolves for returning users.

**Audience specificity**
- Encore Atlas is aimed more at music lovers and live music fans than passive or casual listeners.
- Live performances are imperfect by nature, so the product may have less universal appeal than polished on-demand music products.

**Content dependency**
- The value of the app depends heavily on the quality and availability of third-party video content.
- If strong live footage or interviews are not available for an artist, the experience weakens.

**Recommendation quality at low scale**
- Recommendations based on collaborative behavior will be weak until there are enough users and enough search/watch history.
- Early recommendation quality will depend more on artist tags, genre similarity, and heuristics than true behavioral intelligence.

---

## Technical Constraints

**Frontend-first architecture**
- The app began as a frontend-only product.
- This limits persistence, personalization, analytics depth, and user-specific experiences until backend services are added.

**API dependency**
- The app depends on external APIs for core content retrieval.
- If APIs fail, change quotas, restrict access, or return poor results, key product experiences degrade.

**YouTube API restrictions**
- Referrer restrictions, quota limits, and environment-specific configuration can break search and playback.
- Preview deployments, custom domains, localhost, and production domains all need to be accounted for correctly.
- Failures may appear as empty results or 403 errors rather than graceful degradation.

**Limited recommendation payload**
- Current API limitations mean the app cannot surface too many recommended videos at once.
- Recommended Videos is intentionally constrained to a small set of results for now.

**Noisy relevance**
- Search and recommendation relevance can degrade if query logic becomes too broad or too clever.
- Small changes to search construction can materially worsen results.

**Browser inconsistency risk**
- Domain redirects, cached redirects, service workers, and browser-specific behavior can cause the app to behave differently across Chrome and Safari.
- Demo reliability can be affected by domain or cache state, even when the app is technically deployed correctly.

**Environment variable handling**
- The app relies on environment variables for API keys and service configuration.
- Worktrees do not automatically inherit `.env` files.
- Misconfigured or missing environment variables can silently break features.

**Client-side security limitations**
- Public frontend variables are exposed to the browser.
- Only publishable / anon keys should be used in client-side code.
- Secret keys must remain server-side only.

---

## Backend Constraints

**Early-stage backend maturity**
- Supabase is the likely backend path, but it is not yet fully integrated into the product.
- Until this is in place, user tracking, persistent histories, and personalized recommendation logic remain limited.

**Anonymous-first data model**
- Early backend plans assume anonymous users may later become identified users.
- This is useful, but it adds some schema and logic complexity up front.

**Supabase free-tier limitations**
- Free-tier projects may pause after inactivity.
- Storage, MAUs, and database size are limited.
- This is fine for early development, but not ideal for long-term reliability if the app gains traction.  [oai_citation:0‡music-app-implementation-plan.docx](sediment://file_000000003b0471fd97d80ac70d238b9b)

**AI tagging quality**
- Artist tagging via Claude can accelerate recommendations, but tag quality may vary.
- Incorrect or overly broad tags can reduce recommendation relevance.
- Manual override or review may eventually be needed.  [oai_citation:1‡music-app-implementation-plan.docx](sediment://file_000000003b0471fd97d80ac70d238b9b)

---

## UX Constraints

**Route fragility**
- Removing or renaming routes can create dead-end experiences for bookmarked or indexed paths.
- Redirects or fallback routes are needed when features are reverted or reorganized.

**Session continuity is fragile**
- If users do not see a clear next step after playing a video, they may leave the site.
- Features need to support momentum and emotional continuity, not just retrieval.

**Immersive use case**
- The app is often used in an evening, nostalgic, or headphone-based context.
- UI choices that feel too utilitarian or cluttered could undermine the emotional tone of the product.

**Returning-user experience is underdeveloped**
- The current design appears stronger for first-time search behavior than for habitual return visits.
- Personalized surfaces like a "For You" tab may help, but the overall entry experience may still need to adapt.

---

## Workflow Constraints

**Solo / AI-assisted development**
- Development is happening in a lightweight, experimental workflow using Claude, GitHub, and Vercel.
- This increases speed, but also increases the chance of branch confusion, accidental merges, and overpowered AI-assisted Git actions.

**Git hygiene matters**
- Local `main` can easily drift behind remote `main` if PRs are merged on GitHub without pulling locally afterward.
- Claude worktrees can become stale if created from outdated branches.
- Direct pushes to `main` are possible but riskier than branch + PR + preview workflows.

**Preview dependence**
- Vercel previews are important for validating changes before merge.
- However, preview reliability can be affected by environment configuration and API referrer restrictions, which can make debugging harder.

**Documentation still maturing**
- Product documentation is being created alongside development rather than as part of an established system.
- Structure, naming conventions, and doc organization are still evolving.

---

## Strategic Constraints

**Differentiation is curation, not ownership**
- Encore Atlas does not own the underlying content platforms.
- Its value comes from curation, emotional framing, discovery, and session design rather than exclusive content.

**Discovery quality must feel human**
- The product’s appeal depends on surfacing content that feels culturally and emotionally right, not just technically related.
- Generic recommendation quality would weaken the brand.

**Feature scope must stay controlled**
- There are many tempting future directions: recommendations, profiles, commentary, social features, playlists, concert history, merch, tickets.
- Without careful prioritization, the app could sprawl before its core experience is truly strong.

---

## Current Guiding Principle

Encore Atlas should prioritize features that deepen immersion and extend the emotional arc of a listening session, while staying realistic about API limits, early-stage data quality, and the need for a stable solo-developer workflow.
