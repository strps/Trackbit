# How to Write a Handoff

A **handoff** is the document one run leaves behind so the next run can continue a task without re-reading the codebase to rediscover what was already decided. It exists to split a large task into several bounded runs — each starting with a small, precise context instead of a large, vague one.

A plan (`docs/tasks/*.md`) says *what we intend to build*. A handoff says *where we actually are, and what the next run must do first*. The plan is written once and edited rarely; the handoff is rewritten at the end of every run.

## The one rule

> **Write for an agent that has read nothing.**

The next run has no memory of this one. It has not opened a single file. Every claim it needs must either be in the handoff or be reachable from a link the handoff gives it. If a sentence only makes sense to someone who just spent an hour in the code, it is not a handoff — it is a note to yourself.

The corollary is what makes this save tokens: because the handoff carries the conclusions, the next run does **not** re-read the plan end-to-end, re-grep for the schema file, or re-derive why a column is nullable. It reads ~150 lines and starts working.

## When to write one

Write or update a handoff when any of these are true:

- The task spans more than one phase of a plan doc and you are stopping between phases.
- Context is filling up and the remaining work is well-defined enough to hand over.
- You made a decision that is not obvious from the code and not yet written in the plan doc.
- You are about to be blocked (waiting on a migration, a product answer, a deploy).

Do **not** write one for a task that finishes in the same run. A handoff for completed work is just noise in `docs/handoffs/`; fold anything durable into the plan doc or `AGENTS.md` and delete the handoff.

## File convention

```
docs/handoffs/<task-slug>.md
```

One file per task, matching the plan doc's slug (`docs/tasks/exercise-programs.md` → `docs/handoffs/exercise-programs.md`). **Overwrite it each run** — do not create `-phase2`, `-v2`, or dated variants. A handoff describes the present, not history; a folder of stale handoffs costs the next run more than it saves. Keep history in the `Run log` section, one line per run.

Delete the file when the task ships.

## Template

Copy this verbatim and fill it in.

```markdown
# Handoff: <Task name>

- **Plan:** [<task-slug>.md](../tasks/<task-slug>.md)
- **Status:** Phase N of M — <one line: what phase N is>
- **Branch:** <branch> · **Last run:** <YYYY-MM-DD>

## Where we are

<2–5 sentences. What works end-to-end right now, and what does not. Written so
someone can decide whether to trust the current state without running anything.>

## Done

- <Shipped thing> — [file.ts](../../path/to/file.ts)
- <Shipped thing> — [file.ts:88](../../path/to/file.ts#L88)

## Next: <the single next objective>

1. <First concrete step — a file to create or edit, not a goal to pursue.>
2. <Second step.>
3. <Third step.>

Start with [file.ts:120](../../path/to/file.ts#L120) — <why that exact line>.

## Invariants — do not break these

- <Rule established in an earlier run that the code does not make obvious.>
- <Rule.>

## Decisions made this run

| Question | Decision | Why |
|---|---|---|
| <what was ambiguous> | <what we chose> | <the reason, in one clause> |

## Landmines

- <Thing that will waste the next run's time if unwarned: a failing-by-design test,
  a generated file that must not be edited, a command that must run first.>

## Verify

```bash
<exact commands, in order, that prove the current state is good>
```

## Open questions

- <Blocking question + who answers it, or "assume X and flag it".>

## Run log

- 2026-08-02 — Phase 1: schema + migration. Next: API routes.
```

## What each section is for

**Status line.** Phase number against the plan doc. This is how the next run knows which part of the plan to read — and, more importantly, which parts to skip.

**Where we are.** The honest state. If something is half-finished, say it is half-finished and name the file. If a test fails, say so. A handoff that overstates progress makes the next run debug the gap before it can start, which is strictly worse than saying nothing.

**Done.** Facts with links, not a narrative. Each line should let the next run verify the claim in one click. Use `file:line` links (`[exercises.ts:119](../../apps/backend/src/db/schema/app/exercises.ts#L119)`) — paths are relative to `docs/handoffs/`, so app code is `../../apps/…`.

**Next.** *One* objective, broken into numbered steps that name files. "Continue phase 2" is not an objective. "Add `PUT /api/exercise-lists/:id/items` with replace-all semantics" is. Then point at the exact starting line — the difference between the next run opening one file and grepping ten.

**Invariants.** The highest-value section, and the one most often skipped. These are constraints an earlier run established that the code cannot state on its own: *"the unique index is `DEFERRABLE INITIALLY DEFERRED` — a plain unique breaks every reorder"*, *"prescriptions must never write `exercise_performances` rows"*. Without them the next run re-litigates a settled decision, or silently undoes it. Fix at the source and record why here rather than letting the next run patch around it.

**Decisions.** Anything where a reasonable agent would have chosen differently. The *Why* column is what stops it being reopened. Promote decisions to the plan doc's `Resolved decisions` table when they outlive the task.

**Landmines.** Everything that costs time but teaches nothing: `pnpm --filter backend db:generate` must run before the migration exists; `tsconfig.tsbuildinfo` shows up dirty and should not be committed; that one test fails on `main` too.

**Verify.** Copy-pasteable commands, in order. The next run's first action should be running these — it confirms the handoff is still accurate before any code is written. Prefer the scripts in `AGENTS.md` (`pnpm lint:all`, `pnpm --filter backend db:migrate`, `pnpm build`).

**Open questions.** Each one gets an owner or a default. "Should lists be shareable?" is useless; "Shareable lists — assumed **no** for v1; if product says yes, `authorId` already covers it" lets work continue.

**Run log.** One line per run, appended. It is the only history the file keeps, and it exists so the next run can spot thrash (three runs touching the same file = something is wrong with the plan, not the code).

## Anti-patterns

| Anti-pattern | Why it fails | Instead |
|---|---|---|
| "See the plan doc for details" | Forces a full re-read — the exact cost the handoff exists to avoid | Quote the 3 lines that matter, link the rest |
| Pasting large diffs or whole files | The code is already in git; this burns the budget you were trying to save | Link `file:line` |
| "Mostly done, just needs polish" | Unmeasurable. The next run cannot tell what is left | List what is left, item by item |
| Restating repo conventions | `AGENTS.md` already covers them and is loaded anyway | Only note where you *deviate*, and why |
| Keeping every past handoff | Stale files get read and believed | Overwrite; keep the run log |
| Writing it after context ran out | The details you needed are gone | Write it while you still remember why |

## Sizing

Target **100–200 lines**. Under ~60 it is usually missing invariants or landmines. Over ~250 it has become a second plan doc — move the durable parts into `docs/tasks/<slug>.md` and link to them.

## Starting a run from a handoff

The receiving run should, in order:

1. Read the handoff. Read `AGENTS.md` (always loaded).
2. Run the **Verify** commands. If they fail, the handoff is stale — fix that first and say so.
3. Read only the plan-doc section named in **Status**, plus the files linked under **Next**.
4. Work the **Next** steps.
5. Rewrite the handoff before stopping, appending to the run log.

Step 3 is where the savings are. Everything else in the plan doc stays unread.
