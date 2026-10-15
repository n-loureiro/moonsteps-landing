# Porta House

Build a local, reusable URL-to-HTML/JavaScript workflow for Porta da Frente properties. Inspect public listing facts, all gallery photos, linked floor plans and available videos. Preserve evidence and explicitly state what could not be inspected. Produce editable scene JSON, then deterministic Three.js geometry and a standalone offline HTML viewer. Provide a small local app and a batch CLI. Include the supplied PF39051 example, grounded in its actual aerial photos and main-floor plan.

A model is an architectural approximation, not a survey. Never silently substitute a generic house for a failed reconstruction. Every modeled object carries evidence references, confidence and notes. Dimensions inferred from photographs must remain labeled estimates. Public video links are inventoried; local video files can be sampled when FFmpeg is installed. Do not claim video inspection when frames were unavailable.

Use a single scene schema across manually authored, imported and AI-generated models. A hosted vision API is optional and must only be called by an explicit generate action. The API key stays in the local process environment. The app runs on loopback, validates requests and paths, and never exposes arbitrary filesystem reads or arbitrary URL fetching.
