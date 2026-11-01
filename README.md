# VERITY

### From raw responses to an inspectable machine learning pipeline.

An academic prototype exploring feature engineering, supervised classification and an interactive presentation layer. Developed by **Francesc Mateu Vallespín** and **Jan Francesc Porcar Guillen** for Machine Learning at La Salle.

**Python · scikit-learn · pandas · NumPy · React · JavaScript**

## At a glance

| Component     | Included implementation                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| Dataset       | 150 labelled examples: 100 hotel reviews and 50 interrogation-style responses                |
| Class balance | 75 examples per class                                                                        |
| Features      | 15 linguistic features, 7 simulated physiological features and 1 context feature             |
| Models        | Random Forest, Logistic Regression and Support Vector Machine                                |
| Evaluation    | Stratified 75/25 split; five-fold cross-validation; accuracy, ROC AUC and confusion matrices |
| Demonstration | Python terminal session, complete browser frontend and a portfolio text explorer             |

**Scope:** this is an educational ML experiment, not a validated lie detector. Synthetic signals and hand-labelled examples support a demonstration of the pipeline; they do not establish real-world validity.

## The engineering work

The project turns an unstructured response into measurable inputs, compares alternative classifiers and makes their output visible through an interactive interface. Its most useful technical themes are:

- **Feature engineering:** sentence and word statistics, lexicon indicators, repetition and contextual features.
- **Model comparison:** a tree ensemble alongside linear and kernel-based baselines.
- **Signal-processing architecture:** browser modules for text, face landmarks, camera-derived pulse estimation, audio and transcription.
- **Interpretation:** feature importance, visual diagnostics and a rule-based layer combined with model output.

## Two implementation layers

### Python experiment

`python/verity.py` contains the dataset, feature extraction, training, evaluation plots and an interactive terminal session. The script trains the models from the embedded data; a separate dataset download is not required.

The training pipeline is:

1. Assemble the 150 text examples and labels.
2. Extract 15 text features; generate 7 synthetic physiological variables; assign a keyword-based pressure level.
3. Apply IQR-based clipping and create a stratified 75/25 train/test split with seed 42.
4. Fit a scaler for Logistic Regression and SVM; train Random Forest on unscaled features.
5. Compare the three classifiers and create diagnostic plots.
6. Combine Random Forest output with a rule-based score for the terminal demonstration.

The combined score is a hand-adjusted demonstration score, not a calibrated probability.

### Browser presentation

`web/signals.jsx` contains text extraction, a heuristic browser scoring function and experimental sensor modules. The browser score is **not an exported scikit-learn model**. This snapshot does not establish a live connection between the Python classifiers and the frontend.

**The complete frontend source is included.** `scenarios.js` supplies six categories, 32 scenario prompts, lexicons and scoring constants. `cockpit.jsx` implements the three-turn interface, signal panels, response submission and session report. These modules work alongside the supplied `signals.jsx`, styles and app entry point.

The portfolio includes a separate, working **text feature explorer**. It adapts selected text statistics from the Python implementation and makes no truthfulness prediction. It is a lightweight presentation addition, separate from the downloadable cockpit.

## Run the Python prototype

Use a recent Python 3 environment. Python 3.11 or newer is recommended for this package.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python python/verity.py
```

On Windows, activate with `.venv\Scripts\activate` instead. Run from the project root so generated charts remain in this directory.

For a basic training smoke check:

```bash
python scripts/smoke_check.py
```

The terminal session is protected by `if __name__ == "__main__"`. Importing the module still trains the embedded experiment, but no longer starts an interactive conversation. The original Colab notebook link is omitted from the public source header; the experiment logic and author credits are preserved.

## Run the browser cockpit

From the extracted project directory:

```bash
python -m http.server 8000 --directory web
```

Open `http://localhost:8000` and scroll to the cockpit. Choose **Try text-only** to complete a three-turn session without granting device access, or **Start with sensors** to request camera and microphone access. The sensor path collects a 15-second personal baseline. Missing measurements remain unavailable; they are not replaced with synthetic live readings.

React and Babel load from a CDN, so the original page needs internet access. Optional sensor features also load model assets and depend on browser support. Use localhost or HTTPS for device access. Browser speech recognition may use a remote service; the entire application should not be described as offline.

See [`web/README.md`](web/README.md) for the module map, state transitions, configuration and troubleshooting.

## Reading the results responsibly

The package preserves the original experiment rather than silently changing its scientific claims. Several constraints matter when interpreting it:

- **Synthetic physiology is generated from the class label.** High scores on those signals can reflect how the synthetic data was constructed.
- **Preprocessing needs stronger isolation.** Clipping uses the full dataset; the rule thresholds also use full-data statistics. Cross-validation of scaled models uses data scaled before the folds. A revised experiment should fit these transformations within each training fold.
- **The text extractor is intentionally simple.** Some lexicons use substring matches, so counts are not equivalent to a linguistic parser.
- **The dataset is small and handcrafted.** The source does not provide evidence of representative real-world deception data.
- **The model and interface are separate layers.** Sensor estimates and browser heuristic scores should not be described as validated predictions from the Python model.
- **The original documents describe different revisions.** The slides mention five models and an 80/20 split; the supplied Python snapshot implements three models and a 75/25 split. This README follows the supplied code. Performance percentages from the slides are not treated as reproduced results.

The original report and slides are included for provenance. No external accuracy, latency or deployment claim is made for this packaged snapshot.

## Next engineering steps

- Verify camera, microphone, face landmarks and speech backends on supported physical devices.
- Put preprocessing and estimators into fold-local pipelines.
- Compare a text-only baseline against the synthetic multimodal experiment.
- Evaluate on an independently collected, appropriately labelled dataset.
- Add a documented model-serving interface if the browser should use the trained Python model.

## Repository guide

| Path                        | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `python/verity.py`          | Original Python experiment with an entry-point guard                 |
| `web/cockpit.jsx`           | React session state, input, visual readouts and result panels        |
| `web/scenarios.js`          | Six categories, 32 prompts, lexicons and heuristic configuration     |
| `web/signals.jsx`           | Text features, heuristic scoring and optional sensor processors      |
| `web/index.html`            | Standalone browser entry point with CDN dependencies                 |
| `web/README.md`             | Frontend architecture and setup guide                                |
| `docs/technical-report.pdf` | Original academic report                                             |
| `docs/presentation.pdf`     | Original presentation; describes a different revision in places      |
| `scripts/smoke_check.py`    | Checks dataset dimensions and trained classifier output              |
| `requirements.txt`          | Python runtime dependencies; intentionally not a historical lockfile |

## Source preparation

The submitted `cockpit.jsx` and pasted `scenarios.js` have been restored to the source package. Both use consistent formatting and UTF-8; broken punctuation and currency symbols in the pasted text have been repaired. The scenario content and scoring constants are retained.

Small presentation fixes align the interface with its implementation: the calibration description now says 15 seconds, unavailable sensors are described as text-only fallback, speech-service dependencies are explicit, and session recommendations describe heuristic outputs. A direct text-only entry point makes the interface accessible without device permissions. The numerical scoring logic has not been replaced with a trained model.

## Credits and reuse

**Authors:** Francesc Mateu Vallespín and Jan Francesc Porcar Guillen.

Prepared as an academic portfolio project. No new open-source licence has been assigned by this packaging work; contact the authors about reuse.
