# Cutlume

**Reference-guided cinematic launch videos for indie founders.**

Cutlume is an early-stage, mobile-first prototype exploring a workflow for turning real product footage and a visual reference into an editable launch-video storyboard.

## Current prototype capabilities

- Responsive landing page and creative workspace.
- Local file selection for a reference video and product footage/screenshots.
- Editable creative direction (mood and aspect ratio).
- Editable scene storyboard with headlines, supporting copy, durations, and motion preset labels.
- Local browser draft persistence for project settings and storyboard.
- Downloadable storyboard JSON.
- Browser-based MP4 export for text-led launch films (silent output; requires WebCodecs-compatible browser).

## Not implemented yet

- Automatic reference-video analysis.
- Automatic AI writing or generation.
- Compositing uploaded footage into a rendered film (still planned).
- Cloud uploads, accounts, or cross-device project sync.
- Server-side feedback collection.

The UI intentionally describes these limits instead of presenting mock functionality as working AI.

## Run locally

Requirements: Node.js 20+ recommended.

```bash
npm install
npm run dev
```

Open the local URL shown by Next.js.

## Notes

- Project settings and storyboard are stored in the current browser using localStorage. Clearing browser data can remove the saved draft.
- Uploaded files are selected locally by the browser and are not sent to a server by this prototype.
- MP4 export currently renders the editable storyboard scenes with original generated graphics and text. It does not yet composite the selected reference video or product footage, and it does not add music or audio.
- Browser rendering uses the visitor's device and may fail on unsupported browsers or low-memory devices. The page checks for WebCodecs support and reports rendering errors.
- The project is currently a validation prototype; its brand name has not been legally cleared.
