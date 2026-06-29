# Pitch IQ Context Log

This file records development and recovery context so the project can be restored from GitHub if the local machine is lost, formatted, or reset.

## 2026-06-29 - Restore After System Format

- Restored repository from GitHub: `akshitolihan/pitchiq`.
- Local project path: `C:\Users\kumak\Documents\Codex\2026-06-29\we\pitchiq`.
- Normal system `git`, `python`, and Node tooling were missing after the format, so Codex bundled runtimes were used.
- Created local environment files from examples:
  - `.env`
  - `.env.local`
  - `frontend/.env.local`
- Installed root Next.js dependencies using bundled `pnpm`.
- Created a Python virtual environment at `.venv`.
- Installed backend dependencies from `requirements.txt`.
- Seeded the local SQLite database with:
  - `380` historical matches
  - `10` upcoming fixtures
  - `20` fitted teams
  - `10` generated predictions
- Started FastAPI backend on `http://127.0.0.1:8000`.
- Started Next.js frontend on `http://127.0.0.1:3000`.
- Verified backend health endpoint returned `200 OK`.
- Verified frontend home page returned `200 OK`.
- Ran backend tests: `23 passed`.
- Ran Next.js production build successfully.

## Standing Process

For future work, every meaningful app update should be recorded in this file and pushed to GitHub so the latest project state is recoverable.

