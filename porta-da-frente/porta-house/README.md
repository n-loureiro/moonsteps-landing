# Porta House

Turn a Porta da Frente listing URL into a reviewable architectural model and a self-contained HTML + JavaScript viewer.

**Recommended approach:** collect evidence → interpret it into constrained scene JSON → review → render with a shared Three.js engine. This makes batch generation repeatable and corrections cheap: change the scene rather than rewriting a viewer for each property.

The included PF39051 example is **hand-authored**, using its 31 listing photos and linked main-floor plan. It demonstrates the renderer and review format; it is not evidence of the automatic model's accuracy. The example reconstructs the main floor only. Dimensions, roofs and terrain are approximations.

## Open it

- `examples/PF39051/house.html` opens directly in a browser. No installation, API key, Internet connection or server is needed for its 3D model and embedded source gallery. External source links require Internet access.
- On macOS, open `Start.command` to launch the local app. It installs pinned npm dependencies on first launch if needed. Node.js **20 or newer** must be installed. Keep the terminal window open; Control-C stops the app.
- From a terminal on any supported platform:

```sh
cd /path/to/porta-house
npm ci
npm start
```

Open **http://127.0.0.1:4318**. The default server listens only on your computer.

For public floor plans delivered through Salesforce's interactive viewer, install the optional browser once:

```sh
npx playwright install chromium
```

The collector also tries an installed Google Chrome if Playwright's browser is unavailable. If neither is available, photos still collect and the manifest reports the uninspected plan. Supply the downloaded plan with `--asset` to continue.

## Generate many properties

Configure a compatible vision model and an API key in your terminal, then start the app from that same terminal:

```sh
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="gpt-4.1"
npm start
```

`gpt-4.1` is a configurable baseline, not a claim about the best current model. Use a model your API account supports with image inputs, Responses and strict JSON-schema output. The key is read from the server environment, never sent to the browser or written into exported HTML. No `.env` file is loaded automatically.

Paste one URL or several URLs, one per line, then choose **Generate 3D model**. That action sends the collected public listing facts, image bytes and floor-plan documents to OpenAI and uses your API account. **Collect sources only** does not call the model API.

Each URL gets a stable project directory under `data/`. Downloaded assets are cached with SHA-256 hashes. Repeated collection reuses valid files; `--refresh` re-fetches them. Generation is an explicit action and will call the API again even when sources are cached. No automatic paid retries are performed. Invalid model output preserves the sources and response for inspection, instead of exporting a generic house.

For a batch, create `urls.txt` with one property URL per line (`#` comments are allowed):

```sh
node src/cli.mjs batch urls.txt --generate --out ./data
```

The batch runs sequentially, continues after a failed listing, and writes `data/batch-report.json`. Its exit status is nonzero if any property failed. Restarting after interruption is manual: submit the URL again to reuse collected sources. The app labels unfinished previous jobs as interrupted.

## Review and correct

1. Inspect the collected floor plans and photos in the property library.
2. Open the model. Orbit, zoom and pan; choose exterior, floor plan or garden. Choose **Roof overhead** to compare the connected ridge and valley layout with aerial photographs. Use the prominent **Blueprints & photos** button in the header or beside the view controls to open the source gallery. Toggle the roof, furniture, walls, slabs and site. Choose a floor to isolate it. For a below-grade floor, hide the site if it obscures the interior.
3. Click geometry to see its label, confidence, notes and source references.
4. In **Scene editor**, import a corrected scene JSON or edit the current one. **Validate & rebuild viewer** checks it and regenerates the portable HTML without another AI request.
5. Share `house.html`. Geometry, JavaScript, styles and collected source images/documents are embedded in the file. It may contain many megabytes of listing material.

`observed` means the feature or room relationship is visible in a source; it does **not** mean its dimensions were measured. `inferred` means estimated. `unknown` marks illustrative or unresolved content. The renderer validates data structure, dimensions, polygon intersections, opening bounds, duplicate IDs, level references and evidence IDs. It does not certify architectural accuracy or detect all furniture collisions, disconnected rooms, roof intersections or scale errors. Review those visually.

If no API key is available, collect the sources and prepare a scene manually or with an agent. Use `scene.schema.json`, `src/interpret.mjs`'s reconstruction instructions and the included example scene as the contract; import the resulting JSON in the app.

## Command-line use

```sh
# Download source material only; no paid API call.
node src/cli.mjs collect "https://www.portadafrente.com/pt/imoveis/PROPERTY"

# Add a locally downloaded plan or supplemental measurements image/PDF.
node src/cli.mjs collect "URL" --asset ./floor-plan.jpg

# Include sampled frames from a local video; FFmpeg must be installed.
node src/cli.mjs generate "URL" --video ./tour.mp4

# Re-fetch public material and interpret again.
node src/cli.mjs generate "URL" --refresh --model gpt-4.1

# Rebuild from corrected JSON with no AI request.
node src/cli.mjs render ./data/PROJECT_ID --scene ./corrected-scene.json --out ./house.html

# Re-render the included example.
node src/cli.mjs render ./examples/PF39051 --out ./example.html

# Skip dynamic browser resolution or export the schema.
node src/cli.mjs collect "URL" --no-browser
node src/cli.mjs schema --out ./scene.schema.json
```

URL strings must be quoted in a terminal. The collector accepts HTTPS property URLs on `portadafrente.com` and `www.portadafrente.com`. It is a site adapter, not a general web crawler.

## What it examines, and what it cannot know

- Listing facts and descriptions are read from structured JSON and Next.js flight records without evaluating page scripts. JSON-LD is a limited fallback if the site's internal structure changes.
- Up to **120 gallery photos** are collected. All 31 photos were collected for the supplied example.
- A direct PDF or image floor plan is downloaded. Salesforce image wrappers are resolved through an optional isolated browser. The supplied wrapper resolved automatically during verification. A multipage PDF is passed as a PDF. Multiple images are collected when the wrapper exposes them; the tool does not promise to discover every page in every third-party document viewer.
- The vision request prioritizes plans and supplementary material, then photos, up to **80 assets** and **34 MB of binary input**. Exceeding the byte budget fails before sending a request; reduce image sizes before retrying. Evidence beyond the count limit is explicitly listed as uninspected and cannot be cited by the interpreted scene. PDF/model context limits can impose additional restrictions.
- Linked YouTube videos and virtual tours are inventoried, **not automatically watched or downloaded**. Supply a local video with `--video`, or extracted frames with `--asset`. FFmpeg samples one frame every eight seconds, up to 24 frames / the first 192 seconds. This is sparse visual evidence, not full video inspection. Audio is not transcribed.
- The example's lower floor and garage are not reconstructed because the retrieved plan only covers the main floor. Conflicting listing facts, archival changes, unseen sides, exact scale, grade and property boundaries need human review.

This approach creates stylized, editable spatial studies in the spirit of the supplied interactive example. It does not reproduce the detail of a carefully prepared Blender model automatically. Photorealistic reconstruction, measured CAD and navigable interiors with survey accuracy require stronger inputs, usually complete floor plans with dimensions or a purpose-captured scan. Sparse marketing photos alone leave gaps.

## Files and architecture

```text
src/collect.mjs       listing parser, media collection, dynamic plan resolution
src/network.mjs       URL allowlists, bounded downloads and redirect checks
src/scene.mjs         strict schema and semantic geometry validation
src/interpret.mjs     multimodal Responses request, evidence-aware scene validation
src/video.mjs         optional FFmpeg frame extraction from a local video
src/export.mjs        self-contained, safely serialized HTML export
src/pipeline.mjs      shared single-property and batch workflow
src/server.mjs        loopback app, sequential jobs, source review, scene import
src/cli.mjs           command-line entry point
web/viewer.js         deterministic Three.js geometry and interaction
web/viewer.bundle.js  committed browser bundle; no CDN required
web/studio.*          local app interface
examples/PF39051/     actual evidence manifest, source images and hand-authored scene
scene.schema.json    scene contract for other models or manual editing
```

Coordinates are metres, Y up, X/Z in the ground plane. An object's position is its **bottom centre**; Y is absolute, not relative to its floor. Rotation is degrees about Y. `wall` size is `[length, height, thickness]`; openings are measured along its local X axis from the wall centre. `slab` / `pool` polygon points are local `[x,z]`. `roof_mesh` uses complete triangles in `points`: every three consecutive local `[x,y,z]` vertices form one roof surface. The supplied example uses a connected roof traced from the user’s top-view photograph; `src/roof.mjs` clips away overlapping hipped sections to preserve valleys. Other primitives include hipped and gabled roofs, stairs, trees and simplified furniture. This schema is the seam for changing the interpreter or adding a Blender exporter later.

## Validation and development

```sh
npm test
npm run build
```

The bundle is already included; rebuild it after editing `web/viewer.js`. The automated suite covers extraction, identity checks, input boundaries, source-file detection, scene validation, API request/response handling, offline export and batch failure behavior. Browser checks covered the live listing collection, invalid-scene rejection, scene import/rebuild, exterior and plan views, source gallery and responsive layout.

**Live paid generation was not tested in this workspace:** no API key was configured. API payload and response handling were checked with fixtures against the documented Responses contract. Interpretations from a real model will need visual review and may need manual correction or another explicitly requested generation.

## Sources

- [Supplied Porta da Frente listing](https://www.portadafrente.com/pt/imoveis/moradia-isolada-t5-com-piscina-paco-de-arcos-oeiras-venda-a0cTg00000CVdSoIAL)
- [Reference interactive viewer](https://moonsteps.tech/house/): an existing embedded Blender model, used as a feature reference; its model and source code were not copied.
- [Three.js documentation](https://threejs.org/docs/)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs)
- [GPT-4.1 capabilities](https://developers.openai.com/api/docs/models/gpt-4.1)

Source listing photos and plans remain the material of their respective rights holders. They are included here as evidence for this requested local example. Review permission before redistributing source imagery publicly. Third-party JavaScript licenses are recorded in `THIRD_PARTY_NOTICES.txt`.
