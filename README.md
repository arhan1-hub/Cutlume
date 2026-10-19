# Cutlume

**Reusable product-demo recordings for indie founders — early prototype.**

Cutlume is exploring two related workflows: creating launch-style videos and replaying browser demos after a product changes. The demo-replay prototype is a local Node.js + Playwright script, separate from the hosted creative studio.

## Demo replay prototype

Define a browser workflow in JSON, replay it against a local or deployed web app, and save a fresh recording. JSON files can be version-controlled; credentials should stay in local environment variables and never be committed.

### Requirements

- Node.js 20+
- Chromium installed through Playwright
- A desktop environment or headless browser environment
- Optional: FFmpeg installed and available on PATH for automatic WebM-to-MP4 conversion

### Reusable captions and effects

Each JSON step can optionally include a `caption` that appears in the recorded video while that step runs. Use `"effect": "spotlight"` to add a pulsing highlight around a locator target or coordinate click. Set a shared accent with `"recordingStyle": { "accentColor": "#8b5cf6" }`. These overlays are injected into the recorded page, so they are replayed with the workflow rather than manually rebuilt in an editor. They are visual overlays, not a full timeline editor; captions currently appear at the bottom of the viewport.

Example step:

```json
{
  "action": "click",
  "selector": "button[type='submit']",
  "caption": "Generate your result",
  "effect": "spotlight",
  "pauseAfter": 900
}
```

### Automated smoke test

The `Replay smoke test` GitHub Actions workflow exercises a successful replay and an intentional missing-selector failure. It checks that WebM recordings and failure screenshots/reports are preserved and that MP4 conversion produces a non-empty file when FFmpeg is installed. Run it from **GitHub → Actions → Replay smoke test → Run workflow** on the prototype branch. Artifacts are retained for 7 days. This test uses a local fixture page; it does not validate the founder's Flutter app.

### Quick start

```bash
npm install
npx playwright install chromium
cp demo-flow.example.json demo-flow.json
npm run demo:replay
```

Edit `demo-flow.json` so `baseUrl` points to your app and its selectors match the UI. To run headlessly:

```bash
npm run demo:replay -- --headless
```

To use a different URL without editing the config:

```bash
npm run demo:replay -- --url https://your-demo.example
```

### Flutter Web founder workflow template

A starter workflow matching the founder's proposed demo (login → prompt → wait for streamed answer → attach image → ask about image → open paywall) is in `demo-flow.flutter-founder.example.json`.

Copy it and edit the target URL/selectors after the founder sends their separate demo deployment:

```bash
cp demo-flow.flutter-founder.example.json demo-flow.json
```

The template deliberately uses placeholder accessibility names and `[data-testid='assistant-response']`; those must be adjusted to the real app. Do not guess selectors before inspecting the deployed demo. It uses `{{env:DEMO_EMAIL}}` and `{{env:DEMO_PASSWORD}}` placeholders so secrets can be supplied locally without putting credentials in JSON. Set those environment variables in your terminal before replaying. Never commit the local `demo-flow.json` file or real credentials.

The template includes `fixtures/demo-image.svg` as a harmless sample upload. It opens the app's file chooser through the configured attachment button, which is useful when a Flutter app does not expose a straightforward file input.

### Locators and Flutter canvas support

Supported targets include CSS `selector`, accessible `role` + `name`, visible `text`, `label`, `placeholder`, and `testId`. Prefer Flutter's semantics/accessibility tree where the app exposes it. If the app renders controls on a canvas and semantics are unavailable, actions can use coordinates:

```json
{ "action": "clickAt", "x": 640, "y": 420, "label": "Tap the prompt field" }
{ "action": "typeAt", "x": 640, "y": 420, "value": "Hello", "label": "Type into the focused field" }
```

Coordinates depend on viewport size and layout, so they are a fallback rather than the preferred locator strategy.

### Streamed answers, uploads, and failures

The runner supports `goto`, `click`/`clickAt`, `fill`, `type`/`typeAt`, `press`, `upload`, `wait`, `waitForSelector`, `waitForText`, `waitForStableText`, `scroll`, and `screenshot`. `waitForStableText` waits until a target's text stops changing for a configured period, which can help with streamed AI responses.

Each run writes a JSON report in `recordings/` with completed steps and any failure details. When possible, it also saves a screenshot of the failure point and finalizes the partial recording. This is intended to make a failed test diagnosable instead of leaving an unexplained “no such file” error.

### MP4 export

The replay records a WebM first. If FFmpeg is installed and available on PATH, the runner automatically converts the video to H.264 MP4 with fast-start metadata. If FFmpeg is unavailable, the WebM remains available and the report explains why no MP4 was created. Use `--no-mp4` to skip the conversion check.

This is separate from the creative studio's existing browser-based MP4 storyboard export. Replay MP4 conversion depends on FFmpeg; it is not a pure browser conversion.

### Safety

- Use only a separate demo deployment and test credentials.
- Keep the test database isolated.
- Do not run real payment actions or submit real personal data.
- Keep credentials out of version-controlled JSON and screenshots.
- Replay is local; the app URL is visited from your machine.

## Hosted replay worker prototype

The website's Demo Replay workspace can submit a job to a separately hosted worker through protected Next.js API routes. The worker implementation and Dockerfile are in `replay-worker/`. It runs Playwright and FFmpeg outside Vercel, exposes job status, and serves the finished recording through an authenticated worker endpoint proxied by the website.

See [replay-worker/README.md](replay-worker/README.md) and [docs/replay-worker-setup.md](docs/replay-worker-setup.md). The worker is **not deployed or configured by committing this code**. Set `CUTLUME_REPLAY_WORKER_URL`, `CUTLUME_REPLAY_WORKER_TOKEN`, and `CUTLUME_REPLAY_ALLOWED_HOSTS` only in a prototype/preview environment after deploying the worker. Hosted browser requests are restricted to allowlisted hosts, and upload and additional navigation actions are disabled in hosted mode.

This is an MVP worker: its job registry is in memory and resets on restart. Before public production use, add a durable queue/store, per-job container isolation, network egress controls that block private and metadata IP ranges, robust rate limiting, and short-lived authenticated video storage. Do not use production credentials, real customer data, or real payment flows.

## Existing creative studio

The hosted studio remains an early prototype for editable launch-film storyboards:

- Responsive landing page and creative workspace.
- Editable creative direction and storyboard scenes.
- Local browser draft persistence.
- Downloadable storyboard JSON.
- Browser-based MP4 export for text-led launch films (silent output; requires WebCodecs-compatible browser).

It does not automatically analyse reference videos or composite uploaded product footage into the launch film.

## Run the web studio

```bash
npm install
npm run dev
```

Open the local URL shown by Next.js.

Project settings and storyboard are stored in the current browser using localStorage. The prototype has no accounts, cloud uploads, or cross-device project sync. Cutlume is an early validation prototype; its brand name has not been legally cleared.
