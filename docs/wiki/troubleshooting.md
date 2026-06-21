# Troubleshooting

Operational caveats and debugging findings. Append as they surface; prefer
evidence over guesses.

No code exists yet (docs-only scaffold). Intended starting points once the API
lands:

- **API should boot without a live DB** — plan to use a lazy `pgxpool.New` so the
  server starts even if Postgres is briefly down; `/health` reports DB
  reachability via a ping. A failing ping is the signal, not a crash.
- **sqlc / goose are dev tools, not runtime deps** — the server should compile and
  run without them; only schema/codegen work needs them (see `database.md`).

> Placeholder — extend with concrete findings as they occur.
