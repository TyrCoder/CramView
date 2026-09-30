# Project: Reviewer Maker (PWA)

## About this project
- A Progressive Web App built with plain HTML, CSS, and vanilla JavaScript (no frameworks, no build tools).
- Files: index.html, style.css, app.js, manifest.json, service-worker.js, icons.
- Used on my Windows PC and iPhone (added to home screen via Safari). Hosted on GitHub Pages.
- Features: reviewers, reviewer overview, questions, quiz mode, exam mode, 3-life system, flashcards, progress history, export/import (JSON), offline support.

## Git rules (IMPORTANT — always follow)
- After finishing a task or a meaningful change, COMMIT the changes yourself.
- NEVER run `git push`, `git push --force`, or any command that pushes to a remote. I will push manually.
- NEVER add a "Co-Authored-By" line to commit messages.
- NEVER add "Generated with Claude Code" or any Claude/AI attribution, signature, or link to commit messages.
- Commit messages should look like I wrote them myself.

## Commit message style
- Use short, clear messages in this format: `type: short description`
- Types: feat (new feature), fix (bug fix), style (design/CSS), refactor, docs, chore
- Examples:
  - `feat: add 3-life system to quiz mode`
  - `fix: flashcard flip not working on iPhone`
  - `style: improve dark mode colors`
- Keep the first line under 72 characters. Add a short body only if the change needs explaining.
- Make separate commits for separate features instead of one giant commit.

## Before committing
- Check that the app still works and nothing existing is broken.
- If you changed cached files, update the cache version in service-worker.js so the iPhone gets the new version.
- Show me a short summary of what you changed and the commit message you used.
