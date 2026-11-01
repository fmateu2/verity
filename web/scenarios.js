/**
 * VERITY — scenario data and scoring configuration.
 *
 * Load before signals.jsx and cockpit.jsx. Exposes browser globals for the
 * lexicons, reference values, heuristic rules and six scenario categories.
 * The original constants are preserved; these are demonstration settings,
 * not calibrated probabilities or validated indicators of deception.
 */

window.VERITY_LEXICONS = {
  HEDGES: [
    "maybe",
    "perhaps",
    "possibly",
    "might",
    "could",
    "sort of",
    "kind of",
    "i think",
    "i believe",
    "not sure",
    "probably",
    "i guess",
    "roughly",
    "around",
    "approximately",
    "i suppose",
    "more or less",
    "i assume",
  ],
  DENIALS: [
    "never",
    "not",
    "no",
    "didn't",
    "didnt",
    "wasn't",
    "wasnt",
    "couldn't",
    "couldnt",
    "wouldn't",
    "wouldnt",
    "can't",
    "cant",
    "don't",
    "dont",
    "isn't",
    "isnt",
    "haven't",
    "havent",
    "hadnt",
    "hadn't",
    "none",
    "nothing",
    "nobody",
  ],
  DISTANCERS: ["they", "their", "it", "its", "someone", "somebody", "whoever", "anyone"],
  INTENSIFIERS: [
    "absolutely",
    "completely",
    "totally",
    "extremely",
    "incredibly",
    "amazing",
    "perfect",
    "best",
    "fantastic",
    "wonderful",
    "magnificent",
    "extraordinary",
    "flawless",
    "exceptional",
    "greatest",
    "most",
    "beyond",
    "unbelievable",
    "definitely",
    "certainly",
    "always",
    "everything",
    "nothing",
    "everyone",
  ],
  POSITIVE: [
    "great",
    "good",
    "excellent",
    "nice",
    "wonderful",
    "clean",
    "comfortable",
    "friendly",
    "helpful",
    "fine",
    "okay",
    "alright",
  ],
  NEGATIVE: [
    "bad",
    "poor",
    "terrible",
    "awful",
    "dirty",
    "rude",
    "noisy",
    "disappointing",
    "wrong",
    "problem",
    "issue",
  ],
  // Filler / hesitation tokens — strong deception cue (Vrij 2008)
  HESITATIONS: [
    "uh",
    "um",
    "er",
    "erm",
    "ah",
    "hmm",
    "mmm",
    "like",
    "you know",
    "i mean",
    "well,",
    "well…",
    "actually",
    "basically",
    "essentially",
    "obviously",
    "i guess",
  ],
  // Reformulation / self-correction phrases
  REFORMULATIONS: [
    "i mean",
    "what i meant",
    "let me",
    "or rather",
    "wait",
    "sorry",
    "actually no",
    "i don't know what i mean",
    "what i'm trying to say",
    "okay so",
  ],
  // Truth-anchored specificity markers — places, times, concrete actions
  SPECIFICITY: [
    "pm",
    "am",
    "yesterday",
    "this morning",
    "last night",
    "last week",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "metro",
    "bus",
    "train",
    "car",
    "walking",
    "drove",
    "minutes",
    "hour",
    "hours",
    "seconds",
    "euros",
    "$",
  ],
};

window.VERITY_BASELINES = {
  // Truthful (mean) baselines from report
  hr_mean: { truth: 74, decep: 88, unit: "bpm", noise: 4 },
  hrv: { truth: 55, decep: 35, unit: "ms", noise: 6 },
  au1_inner_brow: { truth: 0.12, decep: 0.38, unit: "", noise: 0.06 },
  au4_brow_lower: { truth: 0.08, decep: 0.35, unit: "", noise: 0.05 },
  au7_lid_tighten: { truth: 0.1, decep: 0.42, unit: "", noise: 0.07 },
  au12_lip_corner: { truth: 0.55, decep: 0.25, unit: "", noise: 0.08 },
  blink_rate: { truth: 18, decep: 26, unit: "bpm", noise: 3 },
};

// Feature importances (Random Forest top features from report)
window.VERITY_IMPORTANCES = {
  au7_lid_tighten: 0.217,
  au4_brow_lower: 0.15,
  hr_mean: 0.111,
  hrv: 0.096, // inverse — high HRV = truthful
  n_exclamations: 0.089,
  au12_lip_corner: 0.078, // inverse
  specificity_score: 0.065, // inverse
  blink_rate: 0.057,
  denial_ratio: 0.045,
  hedge_ratio: 0.035, // inverse
  repetition_ratio: 0.03,
  first_person_ratio: 0.028,
};

window.VERITY_INVERSE_FEATURES = new Set([
  "hrv",
  "au12_lip_corner",
  "specificity_score",
  "hedge_ratio",
]);

// Sensitivity factor — applied to the physiological delta so smaller changes
// register as deception. The literature delta (88-74=14 bpm for HR) assumes
// strong lab-condition deception; in a casual demo with short answers,
// changes are smaller. Scaling down makes the model more responsive.
window.VERITY_SENSITIVITY = 0.4;

// Rule-based recalibration thresholds (from mv1.py)
window.VERITY_RULES = {
  denial_ratio: { dir: "high", thr: 0.04, w: 2.0 },
  repetition_ratio: { dir: "high", thr: 0.15, w: 1.5 },
  n_exclamations: { dir: "high", thr: 1.5, w: 1.5 },
  specificity_score: { dir: "low", thr: 0.25, w: 1.5 },
  hedge_ratio: { dir: "low", thr: 0.02, w: 1.2 },
  first_person_ratio: { dir: "high", thr: 0.25, w: 1.0 },
  avg_sentence_len: { dir: "low", thr: 6.5, w: 0.8 },
  // Extra rules tuned for short interrogation-style answers
  n_words: { dir: "low", thr: 8, w: 1.3 }, // Very short answers
  distancing_ratio: { dir: "high", thr: 0.1, w: 1.0 }, // "they/it/someone…"
  denial_count: { dir: "high", thr: 3, w: 1.6 }, // Stack of denials
  // New disfluency rules — Vrij 2008
  hesitation_count: { dir: "high", thr: 2, w: 1.4 }, // "uh", "um", "you know"
  reformulation_count: { dir: "high", thr: 2, w: 1.2 }, // "I mean", "wait", "actually no"
  specificity_hits: { dir: "low", thr: 1, w: 1.0 }, // No concrete time/place anchors
};

window.VERITY_SCENARIOS = {
  WORKPLACE: [
    {
      ctx: "Your manager calls you in. A confidential project file went missing yesterday afternoon.",
      q: "Where were you between 3pm and 6pm yesterday, and what were you working on?",
    },
    {
      ctx: "HR is investigating an anonymous complaint about a team conflict last week.",
      q: "Did you say anything negative about a colleague during the team meeting on Thursday?",
    },
    {
      ctx: "The IT department flagged the company laptop being used outside office hours.",
      q: "Did you use company equipment for any personal tasks this week?",
    },
    {
      ctx: "A USB drive with sensitive client data was reported missing from the meeting room.",
      q: "Did you handle or move any USB device from the conference room on Monday?",
    },
    {
      ctx: "Two emails were sent from your account at 2am — outside your normal pattern.",
      q: "Were you the one who sent those late-night messages, or did someone else have access?",
    },
    {
      ctx: "A confidential strategy document appeared on a competitor's blog this week.",
      q: "Have you shared, forwarded, or discussed our Q2 strategy with anyone outside the company?",
    },
  ],
  PERSONAL: [
    {
      ctx: "Your partner found an unfamiliar receipt in your jacket pocket.",
      q: "Did you spend money on anything unusual this week that you haven't mentioned?",
    },
    {
      ctx: "A mutual friend told your partner they saw you somewhere you said you weren't.",
      q: "Where exactly did you go on Saturday afternoon, between 2pm and 5pm?",
    },
    {
      ctx: "Your roommate thinks someone went through their belongings while they were away.",
      q: "Did you go into your roommate's room at any point while they were on holiday?",
    },
    {
      ctx: "Your phone showed location data near a place you said you didn't visit.",
      q: "Have you been to the bar on Carrer Diputació in the last two weeks?",
    },
    {
      ctx: "A close friend says you have been avoiding their calls and messages lately.",
      q: "Is there something specific you have been hiding from your closest friends recently?",
    },
    {
      ctx: "Your sibling claims a small heirloom from your grandmother went missing last month.",
      q: "Do you know what happened to grandmother's silver ring? Did you borrow or move it?",
    },
  ],
  ACADEMIC: [
    {
      ctx: "Your professor calls you in. The plagiarism detector flagged your last submission.",
      q: "Did you write this assignment entirely on your own, without copying from any source?",
    },
    {
      ctx: "The exam supervisor noticed unusual behavior during your last test.",
      q: "Did you look at anyone else's paper or use any unauthorized material during the exam?",
    },
    {
      ctx: "Two students submitted nearly identical projects. You are one of them.",
      q: "Did you share your project files or discuss specific solutions with any classmate?",
    },
    {
      ctx: "Your professor asks you to explain a key concept from your final paper.",
      q: "Without notes — explain the main thesis of your paper and the methodology you used.",
    },
    {
      ctx: "A classmate accuses you of taking photos of their lab report.",
      q: "Did you photograph, copy, or look at someone else's lab notebook this semester?",
    },
  ],
  LEGAL: [
    {
      ctx: "A police officer is questioning witnesses after an incident on your street last night.",
      q: "Do you know anything about what happened outside on 4th Street around midnight?",
    },
    {
      ctx: "Security footage shows someone matching your description near a restricted area.",
      q: "Were you near the building on Carrer Gran at any point yesterday evening?",
    },
    {
      ctx: "An investigator is asking about a vehicle accident that occurred last week.",
      q: "Were you driving on the highway between exits 12 and 15 last Friday around 8pm?",
    },
    {
      ctx: "A neighbor reported hearing a loud argument coming from your apartment.",
      q: "Was anyone else in your apartment last Saturday night between 10pm and midnight?",
    },
    {
      ctx: "An eyewitness places you at a bar where a fight broke out two hours later.",
      q: "Were you at El Bosc Bar on the 14th, and if so, what time did you leave?",
    },
  ],
  FINANCIAL: [
    {
      ctx: "Your company accountant found an unexplained expense in last month's report.",
      q: "Can you account for a charge of €280 on the company card on the 14th of this month?",
    },
    {
      ctx: "The bank flagged a series of unusual small transactions on your account.",
      q: "Did you personally authorize all transactions on your account over the last two weeks?",
    },
    {
      ctx: "A client claims they paid an invoice that your company says was never received.",
      q: "Did you receive or process any payment from this client in the last 30 days?",
    },
    {
      ctx: "An auditor found that the petty cash float is short by €450.",
      q: "When was the last time you accessed the petty cash, and how much did you withdraw?",
    },
    {
      ctx: "Your shared business account shows a wire transfer to an unfamiliar account.",
      q: "Did you authorize the transfer of €1,200 to BeneFlex on the 22nd?",
    },
  ],
  TRAP: [
    {
      ctx: "VERITY CALIBRATION — Designed to stress-test the system. Any answer may trigger signals.",
      q: "Have you ever told a lie you believed was completely justified? Answer honestly.",
    },
    {
      ctx: "VERITY PARADOX TEST — Read carefully before answering.",
      q: "Are you lying right now? Answer in exactly one sentence.",
    },
    {
      ctx: "VERITY BASELINE — No right or wrong answer. Just respond naturally.",
      q: "Describe what you had for breakfast this morning in as much detail as possible.",
    },
    {
      ctx: "VERITY MORAL PROBE — Anonymity is not guaranteed. Answer if you wish.",
      q: "Describe the worst thing you have ever done that no one in this room knows about.",
    },
    {
      ctx: "VERITY ETHICAL TEST — There is no surveillance, no consequence. Be honest.",
      q: "If you could break one law today without any consequence, which one would it be and why?",
    },
  ],
};

window.VERITY_CATEGORIES = [
  {
    id: "WORKPLACE",
    label: "Workplace",
    desc: "Office incidents, missing files, unauthorized access",
    code: "01",
  },
  { id: "PERSONAL", label: "Personal", desc: "Trust, whereabouts, privacy", code: "02" },
  { id: "ACADEMIC", label: "Academic", desc: "Plagiarism, exam fraud, collaboration", code: "03" },
  { id: "LEGAL", label: "Legal", desc: "Police questioning, witness statements", code: "04" },
  {
    id: "FINANCIAL",
    label: "Financial",
    desc: "Transactions, expenses, unauthorized payments",
    code: "05",
  },
  { id: "TRAP", label: "Trap", desc: "Stress-test calibration scenarios", code: "06" },
];
