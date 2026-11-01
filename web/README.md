# VERITY · Browser cockpit

A React interface for exploring a three-turn academic classification experiment. The source separates scenario data, feature extraction, optional sensor processing and presentation.

## Quick start

From the project root:

```bash
python -m http.server 8000 --directory web
```

Open `http://localhost:8000`, scroll to the cockpit and select **Try text-only**. Choose a category, enter a response, submit it, and continue through three turns to the session report. **Run New Session** clears the response history.

No API key, database or Python model server is required for this browser interface. Internet access is required for the React/Babel CDN dependencies. Serve the files over HTTP; do not open `index.html` directly through `file://`.

## Module map

| File           | Responsibility                                                                       |
| -------------- | ------------------------------------------------------------------------------------ |
| `scenarios.js` | Six categories, 32 prompts, text lexicons, reference values and heuristic rules      |
| `signals.jsx`  | Text extraction, browser scoring, baseline/response collectors and sensor processors |
| `cockpit.jsx`  | React components, session state, input, charts and result presentation               |
| `app.jsx`      | Mounts `Cockpit` into `#cockpit-mount`                                               |
| `tokens.css`   | Color, spacing, typography and shared UI tokens                                      |
| `cockpit.css`  | Dashboard layout and component styling                                               |
| `index.html`   | Project presentation and ordered script loading                                      |

`scenarios.js` loads first. `signals.jsx` consumes its `window.VERITY_*` values; `cockpit.jsx` consumes both; `app.jsx` mounts the interface last. JSX is transformed in the browser by Babel. This is a standalone source package, not an npm application.

## Session flow

| Phase         | What happens                                          | Next phase                  |
| ------------- | ----------------------------------------------------- | --------------------------- |
| `idle`        | Choose text-only or sensor-assisted mode              | `awaiting` or `calibrating` |
| `calibrating` | Collect a 15-second personal baseline                 | `awaiting`                  |
| `awaiting`    | Read a scenario and type or dictate a response        | `analyzing`                 |
| `analyzing`   | Compute text features and the browser heuristic score | `result`                    |
| `result`      | Inspect the response and contributing signals         | Next turn or `final`        |
| `final`       | Review three turns and start another session          | `awaiting`                  |

The scenario pool is shuffled when the category changes. Each of the three turns selects a different index from that order. A new session clears results but retains the selected category and its current question order.

## Configure scenarios

Add prompts to the relevant array in `scenarios.js`. Each entry needs a context and question:

```js
// Shape example; the shipped scenarios retain the original project content.
{
  ctx: "A fictional setting for the response.",
  q: "The question shown to the participant?",
}
```

Keep at least three prompts per category. Every category in `VERITY_CATEGORIES` must have a matching key in `VERITY_SCENARIOS`. Lexicons and thresholds are intentionally separate from JSX so the interface can stay unchanged when configuration changes.

## Optional sensors

- **Camera:** MediaPipe face landmarks and a green-channel pulse estimate. Requires a supported browser, HTTPS or localhost, device permission and downloadable model assets.
- **Audio:** Web Audio measurements and speech input. The interface selects Web Speech when available, with a Whisper-based fallback in the supplied signal module.
- **Transcription:** Web Speech may use the browser provider's remote service. Whisper downloads model assets. Do not describe every path as fully offline.
- **Without devices:** use **Try text-only**. The original permission-failure path also continues with typed responses; absent physiological measurements remain unavailable.

The browser uses heuristic scoring, not an exported Random Forest. The Python training experiment and the frontend are separate layers. A displayed score is not a calibrated probability of deception or a verified judgment about a person.

## Troubleshooting

| Symptom                          | Check                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Empty cockpit                    | Serve over HTTP; check CDN access and the browser console; keep all seven frontend files together |
| Camera or microphone unavailable | Use localhost/HTTPS, check site permissions, or choose text-only mode                             |
| Face/pulse values remain blank   | Confirm model downloads, lighting and a visible face; allow time for signal collection            |
| Speech input unavailable         | Type the response instead; speech support and model loading vary by browser                       |

## Verification scope

The package is checked for JSX compilation, scenario/configuration consistency, initial React rendering and finite text-only heuristic outputs. A browser check also exercised all three text-only turns, the session report and reset. The original page loaded with its React/Babel CDN dependencies. Physical sensor capture and external speech/model services require testing on the intended device. These checks do not validate the scientific accuracy of the classifier or the browser heuristic.

The main [README](../README.md) documents the Python experiment, evaluation limits, source preparation and authorship.
