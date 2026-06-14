# Encore Atlas Development Workflow

## Session workflow

1. **Start a new Claude Code chat** — each session gets its own git worktree automatically
2. **Work with Claude Code** — implement changes, iterate, commit
3. **Open a PR** — Claude Code opens the PR on GitHub
4. **Codex review** — share the PR with Codex for review; feed back any bugs or requested changes to Claude Code
5. **Claude Code fixes** — address Codex feedback in the same session
6. **Merge the PR** — merge via GitHub UI
7. **Delete the remote branch** — via GitHub UI after merge
8. **Start fresh** — open a new Claude Code chat for the next piece of work

## Why the PR/preview workflow

Changes are primarily reviewed via Vercel's automatic preview deployments (triggered on every PR) rather than local testing. This avoids needing to copy `.env` files into individual worktrees, since API keys and other secrets are configured once in Vercel and available automatically in every preview URL. Local testing is still possible for changes that don't depend on environment variables.

## Worktree hygiene

Claude Code and Codex each create local worktrees that aren't automatically cleaned up after merging. Periodically run:

```sh
git worktree list
git worktree prune
git worktree remove <path>   # for any merged/stale worktrees
```
