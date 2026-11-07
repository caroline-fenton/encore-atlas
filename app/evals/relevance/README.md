# Jev / OpenAI Decisions pilot

This offline runner compares artist-identity relevance using identical evidence and question wording. It never writes to Supabase or changes the live app.

## Review before running

`review-set.json` contains 40 unique artist/video pairs from a read-only production snapshot: eight each for Catch 22, Destroyer, Radiohead, Witch, and X. Selection is deterministic by YouTube ID, not random or balanced. Existing stored candidates are selection-biased; this pilot cannot measure retrieval recall or establish a production winner.

All labels start null; all artist identities start unreviewed. Review the intended artist, genres and context first. **X currently has a Wikipedia extract about the alphabet letter.** Witch may also require explicit disambiguation. Correct evaluation context without changing production, and record the source/reason in `review_note`. Then set `identity_reviewed: true` for each reviewed case. Label each video `relevant`, `irrelevant`, or `uncertain`; do not infer labels from which tab stores it or from either model's output. YouTube links use `https://www.youtube.com/watch?v=<youtube_id>`.

Relevance here means about the intended artist. Covers and discussion count as relevant to identity; whether they belong in the app/category is a separate future judgment. Keep this policy fixed for both providers. Human-uncertain cases are excluded from binary error/Brier metrics, but their outputs remain available for review.

Before choosing a provider, add reviewed positive controls and hard negatives, split development and held-out cases by artist, and freeze the dataset/prompt/thresholds. Do not tune and report final results on the same pilot. The provisional 0.1/0.9 review band is not calibrated and is never applied to production.

## Local setup and execution

Requires Node 24 (already used by project tests). Set `TYPESAFE_API_KEY` and `OPENAI_API_KEY` in your local shell or ignored `.env.relevance.local`. Never use VITE-prefixed credentials, commit them, or paste them into chat.

```sh
node scripts/relevance/run.mjs evals/relevance/review-set.json dry-run
node --env-file=.env.relevance.local scripts/relevance/run.mjs evals/relevance/review-set.json live
```

Dry-run performs no network calls and rejects incomplete review. Live mode caps the pilot at 100 cases/200 paid requests, sends one case per provider request, alternates provider order, uses a 30-second timeout, and makes no retries. Authentication/rate-limit failures stop the run and retain partial results. Other errors remain explicit failures, never confident rejections. Rerunning starts a new paid run; there is no resume mechanism.

Results go to ignored `evals/relevance/results/<timestamp>/`. They include dataset SHA-256, requested/returned model, raw token usage, latency, probabilities, and errors. Summary includes review counts, mistaken rejections/acceptances, Brier score and latency percentiles. Inspect the denominators; review and failure are not correct predictions. Costs are not estimated automatically: use recorded usage and current account pricing. `jev-latest` can move between runs, so retain returned model identity and pin a version supported by your account before a formal benchmark.

## Sources verified November 7, 2026

- TypeSafe: https://docs.typesafe.ai/api/system-one — POST https://api.typesafe.ai/v1/systemone, named `noul` questions, `answers.<name>.noul`.
- OpenAI: https://developers.openai.com/api/docs/guides/decisions — POST https://api.openai.com/v1/decisions, model `gpt-6-luna`, named predicate answers with `probability`.

Tests validate matching provider evidence, exclusion of reference labels, review gates, typed response parsing, and error-aware metrics. Live provider compatibility and billing remain unverified until credentials and reviewed data are available.
