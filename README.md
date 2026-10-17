# Cutlume

**Reusable product-demo recordings for indie founders — early prototype.**

Cutlume is exploring two related workflows: creating launch-style videos and replaying browser demos when a product changes. The current demo-replay prototype is a local Node.js + Playwright script, separate from the hosted creative studio.

## Demo replay prototype (experimental)

The first experiment lets you define a browser workflow in JSON, replay it against a local or deployed web build, and save a fresh WebM screen recording. It is designed to validate the core “re-run the same demo after a UI change” problem before building a polished recorder UI.

### Requirements

- Node.js 20+
- A desktop environment where Chromium can open a browser window (use `--headless` for a headless environment)
- A local web app running, such as a Flutter web build

### Try it

```bash
npm install
npx playwright install chromium
cp demo-flow.example.json demo-flow.json
```

Edit `demo-flow.json` so `baseUrl` points to your app and each step uses selectors that actually exist in your UI. Then run:

```bash
npm run demo:replay
```

To override the target URL:

```bash
npm run demo:replay -- --url http://127.0.0.1:3000
```

To run without showing the browser window:

```bash
npm run demo:replay -- --headless
```

The script supports `goto`, `click`, `fill`, `type`, `press`, `wait`, `waitForSelector`, `scroll`, and `screenshot` steps. Use stable selectors where possible. If a selector breaks after a UI change, replay stops and reports which step failed instead of pretending the recording succeeded.

Recordings are written to `recordings/` as WebM files. The example flow is only a template; its selectors are placeholders and must be adapted to your app. Use a test account and avoid real payment flows or sensitive personal data.

### Current limitations

- This is a developer-oriented proof of concept, not a no-code recorder UI.
- The workflow is configured in JSON; it does not yet record actions by clicking a “record” button.
- It works with browser-based apps, including Flutter web builds. Native Flutter emulators/simulators are not supported yet.
- It captures a fresh browser video, but does not yet reapply caption/motion templates or export MP4.
- Dynamic UI changes can break selectors. Failure detection exists, but automatic repair does not.
- It runs locally, so your local development server does not need to be exposed publicly.

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

## Privacy and safety notes

- Demo replay runs on your own machine and visits the URL you configure.
- Avoid using production credentials or real payment actions in a demo flow.
- Project settings and storyboard are stored in the current browser using localStorage.
- The prototype has no accounts, cloud uploads, or cross-device sync.
- Browser video recording uses your device and can be slow on lower-powered hardware.
- Cutlume is an early validation prototype; its brand name has not been legally cleared.
