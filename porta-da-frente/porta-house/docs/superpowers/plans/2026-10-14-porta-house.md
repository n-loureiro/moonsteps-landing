# Porta House Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn Porta da Frente URLs into reviewable, portable interactive house models.

**Architecture:** A collector writes a cached evidence manifest. A vision interpreter or human produces constrained scene JSON; a shared Three.js renderer produces offline HTML. A loopback app and batch CLI share the same pipeline.

**Tech Stack:** Node.js 20+, Three.js, Ajv, optional Playwright browser for dynamic floor-plan delivery, OpenAI Responses API for optional automatic interpretation.

**Spec:** `docs/spec.md`

## Global Constraints

- A model is an architectural approximation, not a survey.
- Never silently substitute a generic house for a failed reconstruction.
- The API key stays in the local process environment.
- The app runs on loopback.
- Every modeled object carries evidence references, confidence and notes.

## Review Focus

- Listing changes or unsupported URLs: fail clearly instead of extracting another property.
- Floor plans behind an HTML wrapper: resolve with a browser or preserve an explicit uninspected warning.
- No API key or refused/incomplete responses: preserve sources without fabricating a scene.
- Malformed geometry, duplicate IDs or unknown evidence references: reject before rendering.
- Batch partial failure and hostile paths: continue independent listings, return nonzero for failures, constrain local writes and reads.

### Task 1: Evidence collection

**Files:** `src/collect.mjs`, `src/network.mjs`, `tests/collect.test.mjs`.
**Interfaces:** `parseListing(html,url) -> listing`; `collect(url,directory,options) -> manifest`.

- [x] Write tests for a chunk-split Next flight property, JSON-LD fallback, domain validation and real media identification; run and observe failure.
- [x] Extract property JSON without executing page scripts; download bounded assets and record failures. Resolve public plan wrappers using optional browser automation.
- [x] Run collector tests and a real collection of PF39051.

### Task 2: Scene and interpretation

**Files:** `src/scene.mjs`, `src/interpret.mjs`, `tests/scene.test.mjs`.
**Interfaces:** `validateScene(scene,manifest?) -> scene`; `interpret(manifest,directory,options) -> scene`.

- [x] Write tests rejecting invalid dimensions, overlapping openings, unknown sources, malformed API outputs and duplicate IDs; observe failure.
- [x] Define strict scene schema and semantic validation. Build Responses multimodal payload from inspected sources only, with explicit limits and evidence IDs.
- [x] Verify local fixtures and complete schema validation of the hand-reviewed example. No live paid request without configured credentials.

### Task 3: Viewer and example

**Files:** `web/viewer.js`, `web/viewer.css`, `src/export.mjs`, `examples/PF39051/scene.json`, `tests/export.test.mjs`.
**Interfaces:** `exportViewer(scene,manifest,directory,target) -> html path`.

- [x] Write tests for safe offline HTML serialization and source portability; observe failure.
- [x] Build polygons, walls with actual openings, hipped roofs, stairs, trees and furniture. Add orbit/pan/zoom, floor isolation, plan view, layer controls, object evidence, source gallery and scene download.
- [x] Trace example main-floor layout from the linked plan; estimate heights/site from aerial photos, with confidence notes.
- [x] Bundle Three.js and export the example; inspect exterior, plan, selected object and narrow viewport in browser.

### Task 4: App, CLI and delivery

**Files:** `src/server.mjs`, `src/cli.mjs`, `web/studio.html`, `README.md`, `Start.command`, tests.
**Interfaces:** CLI collect/generate/render/batch/serve; loopback `/api/jobs`, `/api/status`, `/api/library`.

- [x] Write integration tests for path constraints, request origin checks and batch partial failures; observe failure.
- [x] Implement sequential persistent jobs, per-URL caching, source-only collection, scene import and configurable model.
- [x] Run complete test suite; exercise real collection and offline export. Document API setup, known limitations and development commands; package project zip.
