# Sector Nine Workflow

## Required workflow

For each substantial Sector Nine development task:

1. Query relevant knowledge in `graphify-out/graph.json` before broad source exploration.
2. Read only the relevant section of `D:\ARCON MEMORY\ARCON PS\Sector Nine\Project Memory.md`.
3. Inspect only the source files needed for the task. Source code and the live database take precedence over stale notes.
4. Routinely consider the `local_ollama` MCP tool with `qwen2.5-coder:3b` for focused, low-risk work: small component analysis, focused error explanations, simple refactoring suggestions, small test-case generation, or summaries of relevant source code. Never send the repository, secrets, environment files, or private data. Do not delegate security-sensitive decisions, production database changes, complex architecture decisions, or final correctness verification.
5. Use Ruflo routing or coordination only for genuinely independent work where it saves effort. Keep the swarm at no more than 3 agents and do not recursively delegate.
6. Implement with Codex, run targeted tests, and validate every local-model result before using it.
7. Incrementally refresh Graphify only after meaningful architecture or dependency changes.
8. Update only the relevant Obsidian memory section after a durable decision or implementation milestone.
9. Return a concise summary.

## Token efficiency and fallback

- Prefer existing memory and graph context over repository-wide scans; keep tool output and delegated context concise.
- Do not delegate trivial work, send entire repositories to local models, or run multiple agents for work one agent can complete.
- Local Ollama is fixed to `http://127.0.0.1:11434` and `qwen2.5-coder:3b`; prefer the `local_ollama` MCP bridge over ad-hoc API calls.
- If local inference fails, times out, or returns an unusable result, continue with Codex automatically and mention the fallback only when relevant.
- Ruflo 3.10.0 can reach a local Ollama endpoint, but its current `agent_execute` path maps registered agent models to Claude model IDs and cannot execute the installed `qwen2.5-coder:3b` cleanly. Prefer the direct `local_ollama` bridge for focused delegation, use Ruflo only for beneficial coordination, and never claim a Ruflo agent used Ollama without an actual model response in its execution output.
- If Ruflo, Graphify, Obsidian, or Ollama is unavailable, continue with available tools, report the missing integration briefly, and never claim it was invoked.
- Never put credentials, tokens, private user data, environment files, or database dumps in Ruflo memory, Graphify, or Obsidian.
- Do not repeat completed analysis or create audits, plans, or reports unless explicitly requested.
- Do not commit, push, deploy, or run production migrations without explicit approval.

## Automatic background resource workflow

- Before launching local builds, test suites, Host Agent packaging, PostgreSQL E2E, Docker, or Ollama, read the current mode with `powershell -NoProfile -File scripts/background-dev/BackgroundDev.ps1 STATUS`.
- Queue allowlisted heavy work with `BackgroundDev.ps1 QUEUE <task-id>` so it runs hidden in IDLE mode. In GAMING or PAUSED mode, perform only lightweight analysis/edits and defer heavy local work.
- Discover jobs with `npm run bg:list`, queue one with `npm run bg:queue -- <task-id>`, inspect it with `npm run bg:job -- <queue-id>`, and wait for its real exit status with `npm run bg:wait -- <queue-id> [timeout-seconds]`.
- Heavy jobs run sequentially. Build and test task IDs call the existing npm scripts; PostgreSQL E2E remains isolated, and Windows packaging retains its backup/checksum wrapper.
- Do not invoke `local_ollama` while the reported mode is GAMING or PAUSED. In ACTIVE mode, keep it focused and low-risk; in IDLE it may run when resource headroom remains available.
- Never bypass this controller for Docker, PostgreSQL E2E, parallel builds, or Host Agent packaging. Critical database, Git, migration, or deployment operations are not auto-queued and must finish transactionally once explicitly started.
- The controller may reprioritize only PIDs recorded in its owned-worker registry. Never manage unrelated processes, games, user applications, Windows services, or unrelated Node/PostgreSQL instances.
