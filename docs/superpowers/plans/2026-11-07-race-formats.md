# Race Formats Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Work continuously within the user's delegated implementation scope; preserve unrelated work.

**Goal:** Add four playable formats with matching selection, HUD, finish conditions and saved results.

**Architecture:** A shared registry supplies rules to the existing simulation and React views. Simulation owns timing and results; React renders and persists them.

**Tech Stack:** TypeScript, React, Three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-race-formats-design.md`

## Global Constraints

- Classic stays the default; old calls and stored classic records remain valid.
- Time attack is 120 seconds/solo/no random pickups; endurance 180 seconds; elimination every 30 seconds.
- Preserve checkpoint validation, pause, equipment and disabled payments.
- No new dependencies, provider calls or background QA servers left running.

## Review Focus

- Full-race driving across all four tracks, including progress beyond three laps.
- Exactly timed finish, no incomplete time-attack lap or fake podium.
- Eliminated cars cannot affect active players; ties deterministic.
- Restart, pause, hidden tab and cleanup keep the selected rules consistent.
- Old records remain readable, formats never mislabelled as classic.

### Task 1: Registry and simulation

Files: `src/shared/race-formats.ts`, `src/game/simulation.ts`, `src/game/simulation.test.ts`.

Contract: `RaceFormatId`, `RaceFormat`, `RACE_FORMATS`, `getRaceFormat(id)`, `RaceResult`. `createRace(track, carVariant=0, formatId='classic')`; `advanceProgress(..., lapTarget=3)` accepts null for unlimited. RaceState adds `formatId`, `nextEliminationAt`. Car adds `bestLap`, `lapStartedAt`, `eliminatedAt`, `eliminationPlace`. `getRaceResult(race)` returns the shared result shape.

- [x] Add failing tests for one-lap finish, timed solo best lap/no full lap, endurance beyond three laps, elimination order/pause and inactive-car interactions.
- [x] Implement rules and stable ranking; preserve current driving tests.
- [x] Run simulation suite, report exact outcomes for independent review.

### Task 2: Race presentation

Files: `src/game/Race.tsx`, `src/game/Race.css`, `src/game/Race.test.tsx`.

Contract: optional `formatId` prop defaults classic; use shared rules and `getRaceResult`. Hide retired cars and time-attack pickups. Dynamic HUD, standings, result text and restart preserve format.

- [x] Add meaningful UI tests for nonclassic HUD, solo/no-bonus presentation, result callback and restart.
- [x] Implement adaptive UI while preserving existing controls and cleanup.
- [x] Run Race suite and review.

### Task 3: Selection and records

Files: `src/App.tsx`, `src/components/RaceFormatPicker.tsx`, `src/components/RaceFormatPicker.test.tsx`, `src/styles.css`, `src/lib/records.ts`, `src/lib/records.test.ts`.

Contract: shared `RaceResult` plus date and optional carVariant; legacy format is classic. Selection passes format to Race. History shows/filter formats and appropriate metric.

- [x] Verify failing tests for selection rules and preservation/validation of new records.
- [x] Implement picker, metadata, history filter and formatting.
- [x] Run relevant suites.

### Task 4: Integration and acceptance

- [x] Independent review of complete diff; resolve concrete findings.
- [x] Run full tests, build, formatting checks.
- [x] Browser: select all modes, launch/restart/pause; desktop/mobile visual check; record evidence and clean QA processes.
- [x] Update research acceptance note, commit exact owned files, leave the local game running.
