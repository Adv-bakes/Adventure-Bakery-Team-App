// Every sentence the Today page shows, in each language. The operator's profile sets the start
// language (the production operator's is Spanish); the page keeps a switch. Form numbers and the
// English names of the forms' own controls stay as they are, because the forms are in English.
// Pure, no imports.

export type TodayLang = "en" | "es";

export interface TodayMessages {
  title: string;
  intro: string;
  startDay: string;
  preopNotDone: string;
  preopDraft: string;
  preopDone(time: string, by: string): string;
  startPreop: string;
  continuePreop: string;
  openPreop: string;
  production: string;
  blockedTitle: string;
  blockedBody: string;
  startLot: string;
  continueLot: string;
  noLots: string;
  bakedOn(date: string): string;
  stage: Record<string, string>;
  onHold: string;
  recordOvenLoad: string;
  /** The bake button on a lot's row, its menu and its dialog. */
  bake: {
    button: string; speak: string; open: string;
    title(lot: string, product: string): string;
    listening: string; say(line: string, withProbe: string): string; heard(t: string): string;
    typeHere: string; use: string; again: string; accept: string; openInstead: string; cancel: string;
    initials: string; passLead: string; saved(lot: string, product: string): string;
    failLead: string; openFailed: string; noSpeech: string; needsRecord: string;
    /** Entering a reading in a pop-up, and marking the last load of the batch or of the lot. */
    enter: string; done: string; notDone: string; doneTitle(lot: string, product: string): string;
    temp: string; minutes: string; probe: string; optional: string; save: string;
    useSuggested(value: number): string; suggestedFrom: string;
    lastLabel: string; lastNone: string; lastBatch: string; lastLot: string;
    lastBatchHelp: string; lastLotHelp: string; sayLast: string;
    sendTo: string; choose: string; noReviewers: string;
    markOnly(which: string): string; noLoadYet: string;
    savedBatch(lot: string, product: string): string; savedLot(lot: string, reviewer: string): string;
    reviewFailed: string; reopened(lot: string, product: string): string; nothingToReopen: string;
    doneTip: string; reviewNote(date: string, lot: string): string; awaitingReview(by: string): string;
  };
  /** The seal-check button on a lot's row. The dialog's common wording (Accept, Try again ...) is `bake`'s. */
  seal: {
    button: string; speak: string; open: string;
    title(lot: string, product: string): string; say: string;
    passLead: string; saved(lot: string, product: string): string;
    failLead: string; unclear: string; openFailed: string;
    /** Entering a check in a pop-up, and marking the last check of the batch or of the lot. */
    enter: string; done: string; notDone: string; doneTitle(lot: string, product: string): string;
    checkType: string; airCheck: string; pullTest: string; vacuum: string; pass: string; fail: string; notDoneYet: string;
    lastLabel: string; lastNone: string; lastBatch: string; lastLot: string; lastBatchHelp: string; lastLotHelp: string; sayLast: string;
    markOnly(which: string): string; noCheckYet: string;
    savedBatch(lot: string, product: string): string; savedLot(lot: string, reviewer: string, records: number): string;
    reopened(lot: string, product: string): string; nothingToReopen: string; doneTip: string;
    reviewNote(date: string, lot: string, product: string): string; awaitingReview(by: string): string;
  };
  /** The Release button on a lot awaiting release: the steps before the release, in order. */
  releaseSteps: {
    button: string; heading: string; done: string; open: string; none: string; start: string; startFailed: string;
    step: Record<"lot" | "baking" | "sealing" | "retention" | "release", string>;
    /** The retention sample's record stays a draft while the sample is on the shelf. */
    sampleStarted: string; sampleOnShelf(due: string): string; sampleDisposed: string;
    noRecord: Record<"lot" | "baking" | "sealing" | "retention" | "release", string>;
  };
  /** "Records" on a finished lot's row: the lot's records in order, to open and read. */
  records: {
    button: string; heading: string; submitted: string; draft: string; none: string;
    name: Record<"lot" | "baking" | "sealing" | "retention" | "release" | "dispatch", string>;
  };
  /** The packing button on a lot's row: the first pack from a photo, and the three counts. */
  pack: {
    button: string; doneTip: string; photo: string; counts: string; open: string;
    title(lot: string, product: string): string; countsTitle(lot: string, product: string): string;
    reading: string; photoHelp: string; again: string; matches: string; saved(lot: string, product: string): string;
    incomplete: string; mismatch: string; unreadable: string; openFailed: string; needsRecord: string; alreadyChecked: string;
    racked: string; packed: string; notPacked: string; filmLot: string; notes: string;
    countsHelp: string; addsUp(sum: string, racked: number): string;
    short(n: number, sum: string, racked: number): string; over(n: number, sum: string, racked: number): string;
    sayWhy: string; notANumber: string; savedCounts(lot: string, product: string): string;
    firstPackDone: string; countsDone: string; optional: string;
    answer: string; answerHelp: string; answerDisagrees: string; savedAnswer(lot: string, product: string): string;
    /** The three packs of the net-weight check, weighed at packing (FRM-520 v2). */
    weigh: string; weighDone: string; weighTitle(lot: string, product: string): string; weighHelp: string;
    declared: string; tare: string; unit: string; packWeight(n: number): string;
    weightOk(average: number, declared: number, unit: string): string; weightBelow(average: number, declared: number, unit: string): string;
    weightUnreadable: string; savedWeights(lot: string, product: string): string; savedBelow: string;
  };
  /** "Follow this lot": one lot + product, step by step (LotFlow.tsx). */
  flow: {
    follow: string; followTip: string; backToToday: string; notFound: string; previous: string; next: string;
    step: Record<"mixing" | "baking" | "sealing" | "packing" | "submit" | "retention" | "bakeReview" | "sealReview" | "release", string>;
    state: Record<"done" | "open" | "none", string>;
    loads(n: number): string; checks(n: number): string;
    bakeDone: string; sealDone: string;
    mixingLater: string; mixingProgress(done: number, lines: number): string; openLotRecord: string;
    firstPackDone: string; firstPackNeeded: string; countsDone: string;
    submitLead: string; submitReady: string; missing: string; missingLine(table: string, line: number, column: string): string; statement: string; signAndSubmit(name: string): string;
    submitted(lot: string, product: string): string; submitFailed: string; needsRecord: string; alreadySubmitted: string;
    finished: string; adminNext: string; openStep: string; startStep: string;
    olderRecord: string;
    /** Reviewing a CCP record (FRM-507, FRM-606) and submitting it, before the release. */
    review: {
      lead: Record<"baking" | "sealing", string>; noRecord: Record<"baking" | "sealing", string>; submitted: string; date: string;
      monitoredBy(name: string, at: string): string; notSigned: string; notFinished: Record<"baking" | "sealing", string>; noRows: string;
      otherLot: string; deviations: string; noDeviations: string; missing: string; ready: string;
      verify(name: string): string; verified(form: string, date: string): string; failed: string; needsRecord: string;
      notReviewed: Record<"baking" | "sealing", string>;
    };
    sampleLead: string; sampleNoDiscard: string; sampleNeedsRecord: string; signSample(name: string): string;
    sampleLogged(lot: string, product: string, discard: string): string; sampleFailed: string;
  };
  recordSealChecks: string;
  ccpBakingToday(n: number): string;
  ccpSealingToday(n: number): string;
  receiving: string;
  receiveDelivery: string;
  lastReceipt(date: string, lines: number, suppliers: string): string;
  /** A further receiving log of the last day, and the tag for one not yet submitted. */
  otherReceipt(date: string, lines: number, suppliers: string): string;
  receiptDraft: string;
  noReceipts: string;
  holdsOpen(n: number): string;
  finished: string;
  awaitingRelease(n: number): string;
  awaitingCollection(n: number): string;
  release: string;
  shipping: string;
  recordCollection: string;
  lastDispatch(date: string, customer: string, lots: number, draft: boolean): string;
  noDispatches: string;
  attention: string;
  overdue(n: number): string;
  due(n: number): string;
  askedOfYou(n: number): string;
  alerts(n: number): string;
  openNotifications: string;
  mappingProblem: string;
  draft: string;
  loading: string;
  loadError: string;
  opening: string;
}

const en: TodayMessages = {
  title: "Today",
  intro: "What the day needs, in order. Each button opens the record for that piece of work.",
  startDay: "Start the day",
  preopNotDone: "Daily Sanitation & Pre-Op (FRM-903) has not been done today.",
  preopDraft: "Daily Sanitation & Pre-Op (FRM-903) is started but not submitted.",
  preopDone: (time, by) => `Daily Sanitation & Pre-Op (FRM-903) submitted at ${time}${by ? ` by ${by}` : ""}.`,
  startPreop: "Complete Daily Sanitation",
  continuePreop: "Continue Daily Sanitation",
  openPreop: "Open today's record",
  production: "Production",
  blockedTitle: "Production cannot start yet.",
  blockedBody: "Today's Daily Sanitation & Pre-Op record (FRM-903) must be submitted first. Production records stay closed until it is.",
  startLot: "Start a lot",
  continueLot: "Continue",
  noLots: "No lot is in progress.",
  bakedOn: date => `baked ${date}`,
  stage: {
    preparing: "Preparing the batch",
    in_progress: "In progress",
    awaiting_release: "Awaiting release (SQF Practitioner)",
    not_released: "NOT released",
    released: "Released, awaiting collection",
    shipped: "Shipped",
  },
  onHold: "On hold (FRM-702)",
  recordOvenLoad: "Record an oven load (FRM-507)",
  bake: {
    button: "Record bake",
    speak: "Speak the reading",
    open: "Open the record",
    title: (lot, product) => `Oven load · Lot ${lot} · ${product}`,
    listening: "Listening…",
    say: (line, withProbe) => `Say: "${line}". If the load was probed: "${withProbe}".`,
    heard: t => `Heard: "${t}"`,
    typeHere: "Or type it here",
    use: "Use",
    again: "Try again",
    accept: "Accept",
    openInstead: "Open the record instead",
    cancel: "Cancel",
    initials: "Initials",
    passLead: "Within the critical limits. Check the row, then accept it.",
    saved: (lot, product) => `Oven load recorded for Lot ${lot} · ${product}.`,
    failLead: "A limit was not met. Opening the record…",
    openFailed: "Could not open the baking record",
    noSpeech: "This browser has no speech recognition. Type it below, or open the record.",
    needsRecord: "This row needs to be checked in the record. Opening it…",
    enter: "Enter the reading",
    done: "Baking done…",
    notDone: "Baking not finished",
    doneTitle: (lot, product) => `Baking done · Lot ${lot} · ${product}`,
    temp: "Oven temperature (°F)",
    minutes: "Bake time (min)",
    probe: "Internal temperature (°F)",
    optional: "if probed",
    useSuggested: v => `Use ${v}`,
    suggestedFrom: "The figure on this product's formula sheet (FRM-501). Tap to enter it if it is what the oven read.",
    save: "Save",
    lastLabel: "Is this the last load?",
    lastNone: "More loads to come",
    lastBatch: "Last load of this batch",
    lastLot: "Last load of this lot",
    lastBatchHelp: "This product is finished baking for today.",
    lastLotHelp: "All of today's baking is finished. The record is signed in your name and sent for review.",
    sayLast: 'On the final load, add "last load of this batch" or "last load of this lot".',
    sendTo: "Send for review to",
    choose: "Choose…",
    noReviewers: "No reviewer could be listed. Open the record and use Request signature.",
    markOnly: which => `Marks the load recorded last for this batch as: ${which}.`,
    noLoadYet: "No oven load is recorded for this batch on your record today, so there is nothing to mark.",
    savedBatch: (lot, product) => `Baking finished for Lot ${lot} · ${product}.`,
    savedLot: (lot, reviewer) => `Baking finished for Lot ${lot}. The record was sent to ${reviewer} for review.`,
    reviewFailed: "The load was saved, but the review request could not be sent. Open the record and use Request signature.",
    reopened: (lot, product) => `Baking reopened for Lot ${lot} · ${product}.`,
    nothingToReopen: "There is no finished mark on your record for this batch.",
    doneTip: "Record bake - baking finished",
    reviewNote: (date, lot) => `Baking record for ${date}: the last load of lot ${lot} is recorded. Please review and sign.`,
    awaitingReview: by => `Today's baking is finished and signed by ${by}. Waiting for review.`,
  },
  seal: {
    button: "Record seal check",
    speak: "Speak the check",
    open: "Open the record",
    title: (lot, product) => `Seal check · Lot ${lot} · ${product}`,
    say: 'Say: "Air check passed". At boxing: "Pull test passed" or "Boxing check passed". Start with "Set up", "After adjustment" or "End of run" when it is one of those.',
    passLead: "Check passed. Look at the row, then accept it.",
    saved: (lot, product) => `Seal check recorded for Lot ${lot} · ${product}.`,
    failLead: "A check failed. Opening the record…",
    unclear: 'I did not hear which check, or its result. Say it again, for example "Air check passed".',
    openFailed: "Could not open the sealing record",
    enter: "Enter the check",
    done: "Checks done…",
    notDone: "Checks not finished",
    doneTitle: (lot, product) => `Checks done · Lot ${lot} · ${product}`,
    checkType: "Check",
    airCheck: "Air check (visual)",
    pullTest: "Pull test",
    vacuum: "Vacuum gauge (in. Hg)",
    pass: "Pass",
    fail: "Fail",
    notDoneYet: "Not done",
    lastLabel: "Is this the last check?",
    lastNone: "More checks to come",
    lastBatch: "Last check of this batch",
    lastLot: "Last check of this lot",
    lastBatchHelp: "This product's sealing and boxing checks are finished for today. The record is signed in your name.",
    lastLotHelp: "All of today's checks are finished. The records for this lot are signed in your name and sent for review.",
    sayLast: 'On the final check, add "last check of this batch" or "last check of this lot".',
    markOnly: which => `Marks the check recorded last for this batch as: ${which}.`,
    noCheckYet: "No check is recorded for this batch on your record today, so there is nothing to mark.",
    savedBatch: (lot, product) => `Checks finished for Lot ${lot} · ${product}.`,
    savedLot: (lot, reviewer, n) => `Checks finished for Lot ${lot}. ${n === 1 ? "The record was" : `${n} records were`} sent to ${reviewer} for review.`,
    reopened: (lot, product) => `Checks reopened for Lot ${lot} · ${product}.`,
    nothingToReopen: "There is no finished mark on your records for this batch.",
    doneTip: "Record seal check - checks finished",
    reviewNote: (date, lot, product) => `Sealing record for ${date}, lot ${lot}, ${product}: the last check is recorded. Please review and sign.`,
    awaitingReview: by => `Today's seal checks are finished and signed by ${by}. Waiting for review.`,
  },
  releaseSteps: {
    button: "Release",
    heading: "Before the release, in order. Choose a step to open its record.",
    done: "Submitted",
    open: "Still a draft - review, sign and submit it",
    none: "No record found for this lot",
    start: "Not started - start it now",
    startFailed: "The record could not be started.",
    sampleStarted: "Started - complete it and sign \"Sample taken by\"",
    sampleOnShelf: due => `Logged - on the shelf${due ? `, discard due ${due}` : ""}`,
    sampleDisposed: "Logged - since disposed of",
    step: {
      lot: "Lot record (FRM-520)",
      baking: "Baking record reviewed and signed (FRM-507)",
      sealing: "Seal check records reviewed and signed (FRM-606)",
      retention: "Retention sample logged (FRM-703)",
      release: "Release the lot (FRM-701)",
    },
    noRecord: {
      lot: "The lot record could not be found.",
      baking: "No baking record carries an oven load for this lot. Look in the SOPs Library under FRM-507.",
      sealing: "No seal check record was found for this lot. Look in the SOPs Library under FRM-606.",
      retention: "The Retention Sample Log (FRM-703) could not be found.",
      release: "The release record form (FRM-701) could not be found.",
    },
  },
  records: {
    button: "Records",
    heading: "This lot's records, in order. Choose one to open it.",
    submitted: "Submitted",
    draft: "Still a draft",
    none: "None found for this lot",
    name: {
      lot: "Lot record - mixing and packing (FRM-520)",
      baking: "Baking record (FRM-507)",
      sealing: "Seal check record (FRM-606)",
      retention: "Retention sample (FRM-703)",
      release: "Release record (FRM-701)",
      dispatch: "Dispatch record (FRM-801)",
    },
  },
  pack: {
    button: "Record packing",
    doneTip: "Record packing - first pack checked, counts entered and packs weighed",
    photo: "Photograph the first pack",
    counts: "Enter the counts",
    open: "Open the record",
    title: (lot, product) => `First pack · Lot ${lot} · ${product}`,
    countsTitle: (lot, product) => `Packing counts · Lot ${lot} · ${product}`,
    reading: "Reading the pack...",
    photoHelp: "One photo with the flavor, lot code, best-by date and bar code in view. The photo is kept on the lot record.",
    again: "Take another photo",
    matches: "I checked the pack - it matches",
    saved: (lot, product) => `First pack recorded as matching · Lot ${lot} · ${product}`,
    incomplete: "Look at the points marked above on the pack itself, then take a clearer photo or answer in the record.",
    mismatch: "Stop packing. Correct the coder or the film, then photograph the next first pack. Product already packed with the wrong code is held on FRM-702.",
    unreadable: "The photo could not be read. It was kept on the lot record.",
    openFailed: "The lot record could not be saved. Open the record instead.",
    needsRecord: "This lot record has to be opened to do this.",
    alreadyChecked: "The first pack is already answered on the record. A new photo is added to it.",
    racked: "Counted on the baking rack",
    packed: "Units packed",
    notPacked: "Not packed",
    filmLot: "Film / bag lot",
    notes: "Notes",
    countsHelp: "Count all three. The app only adds them up: counted on the rack = units packed + not packed.",
    addsUp: (sum, racked) => `Adds up: ${sum}, and ${racked} were counted on the rack.`,
    short: (n, sum, racked) => `${n} unaccounted for: ${sum}, but ${racked} were counted on the rack.`,
    over: (n, sum, racked) => `${n} more than were racked: ${sum}, but only ${racked} were counted on the rack.`,
    sayWhy: "Recount, or say why in Notes.",
    notANumber: "Units packed has to be a plain number of units to be added up.",
    savedCounts: (lot, product) => `Packing counts saved · Lot ${lot} · ${product}`,
    firstPackDone: "First pack checked",
    countsDone: "Counts entered",
    optional: "optional",
    answer: "Answer the first pack",
    answerHelp: "What the code on the first pack shows, and who checked it. Use this when there is no photo, or to record a pack that did not match.",
    answerDisagrees: "The last photo did not agree with this answer. Photograph the corrected pack, or change the answer.",
    savedAnswer: (lot, product) => `First pack answered · Lot ${lot} · ${product}`,
    weigh: "Weigh three packs",
    weighDone: "Three packs weighed",
    weighTitle: (lot, product) => `Net weight · Lot ${lot} · ${product}`,
    weighHelp: "Weigh three finished packs from this lot, each one whole, on the calibrated scale. The app takes the empty packaging off and averages them.",
    declared: "Net weight on the label",
    tare: "Empty packaging weight",
    unit: "Unit weighed in",
    packWeight: n => `Pack ${n} weight`,
    weightOk: (average, declared, unit) => `Average net weight ${average} ${unit}, at or above the ${declared} ${unit} on the label.`,
    weightBelow: (average, declared, unit) => `Average net weight ${average} ${unit} is BELOW the ${declared} ${unit} on the label. Stop packing, hold the lot on FRM-702 and tell the SQF Practitioner. The weights are still saved.`,
    weightUnreadable: "The net weight cannot be worked out. Write the label weight as one figure with its unit (for example 4 oz), choose the unit, and enter each weight as a number above zero.",
    savedWeights: (lot, product) => `Pack weights saved · Lot ${lot} · ${product}`,
    savedBelow: "Pack weights saved. The average is BELOW the label: stop packing, hold the lot on FRM-702 and tell the SQF Practitioner.",
  },
  flow: {
    follow: "Follow this lot",
    followTip: "One step at a time, from mixing to packing",
    backToToday: "Back to Today",
    notFound: "This lot could not be found. It may have been deleted.",
    previous: "Previous step",
    next: "Next step",
    step: { mixing: "Mixing", baking: "Baking", sealing: "Seal checks", packing: "Packing", submit: "Sign and submit", retention: "Retention sample", bakeReview: "Review baking", sealReview: "Review seal checks", release: "Release" },
    state: { done: "Done", open: "In progress", none: "Not started" },
    loads: n => n === 0 ? "No oven load recorded yet." : n === 1 ? "1 oven load recorded." : `${n} oven loads recorded.`,
    checks: n => n === 0 ? "No seal check recorded yet." : n === 1 ? "1 seal check recorded." : `${n} seal checks recorded.`,
    bakeDone: "Baking is marked finished for this batch.",
    sealDone: "The checks are marked finished for this batch.",
    mixingLater: "The ingredients, their lots and the weights are recorded on the lot record.",
    mixingProgress: (done, lines) => `${done} of ${lines} ingredients complete.`,
    openLotRecord: "Open the lot record",
    firstPackDone: "First pack checked.",
    firstPackNeeded: "The first pack still needs its answer: photograph it, or answer it here.",
    countsDone: "Counts entered.",
    submitLead: "The lot record (FRM-520) is finished when it is signed and submitted.",
    submitReady: "Everything the lot record needs is there.",
    missing: "Still needed before it can be submitted:",
    missingLine: (table, line, column) => `${table}, line ${line}: ${column}`,
    statement: "The lots and quantities in this entry are the ones used.",
    signAndSubmit: name => `Sign as ${name} and submit`,
    submitted: (lot, product) => `Lot record submitted · Lot ${lot} · ${product}`,
    submitFailed: "The lot record could not be submitted.",
    needsRecord: "This lot record has to be finished on the record itself.",
    alreadySubmitted: "The lot record is submitted.",
    finished: "This lot is finished on the floor. It now waits for its release.",
    adminNext: "Next: the release.",
    sampleLead: "Take one finished pack of this lot. Read what is shown against the pack in your hand, correct what differs, then put it on the retention shelf and sign.",
    sampleNoDiscard: "The discard date could not be worked out from that best-by date. Write it as printed on the pack (for example October 2027), or open the record.",
    sampleNeedsRecord: "This retention sample has to be completed on the record itself.",
    olderRecord: "This lot record was started on an earlier version of the form, so its packing is finished on the record itself.",
    review: {
      lead: { baking: "The baking record (FRM-507) that carries this lot's oven loads. Check each load against the critical limits, then sign as verifier and submit it.",
        sealing: "The seal check record (FRM-606) of this lot. Check each check against the critical limits, then sign as verifier and submit it." },
      noRecord: { baking: "No baking record carries an oven load for this lot.", sealing: "No seal check record was found for this lot." },
      submitted: "Reviewed and submitted.",
      date: "Production date",
      monitoredBy: (name, at) => `Monitored by ${name}, signed ${at}.`,
      notSigned: "The operator has not signed \"Monitored by\". The record cannot be verified until they have: they sign it when they mark the last load or the last check, or on the record itself.",
      notFinished: { baking: "Today's baking is not marked finished. Submitting now would close the day's record to further loads.",
        sealing: "This batch's checks are not marked finished. Submitting now would close the record to further checks." },
      noRows: "Nothing is recorded on this record yet.",
      otherLot: "Greyed lines are another product or lot on the same record.",
      deviations: "Deviations recorded",
      noDeviations: "No deviation: every line met the limits.",
      missing: "Still needed before it can be submitted:",
      ready: "The record is complete.",
      verify: name => `Sign as verifier (${name}) and submit`,
      verified: (form, date) => `${form} for ${date} verified and submitted.`,
      failed: "The record could not be submitted.",
      needsRecord: "This record has to be reviewed on the record itself.",
      notReviewed: { baking: "The baking record for this lot is not yet reviewed and submitted (step \"Review baking\").",
        sealing: "The seal check record for this lot is not yet reviewed and submitted (step \"Review seal checks\")." },
    },
    signSample: name => `Sign as ${name} - sample on the shelf`,
    sampleLogged: (lot, product, discard) => `Retention sample logged · Lot ${lot} · ${product}${discard ? ` · discard due ${discard}` : ""}`,
    sampleFailed: "The retention sample could not be logged.",
    openStep: "Open the record",
    startStep: "Start the record",
  },
  recordSealChecks: "Record seal checks (FRM-606)",
  ccpBakingToday: n => n === 0 ? "Today's baking record is open." : `Today's baking record has ${n} oven load${n === 1 ? "" : "s"}.`,
  ccpSealingToday: n => `${n} sealing record${n === 1 ? "" : "s"} today.`,
  receiving: "Receiving",
  receiveDelivery: "Receive a delivery (FRM-301)",
  lastReceipt: (date, lines, suppliers) => `Last receiving log ${date}: ${lines} line${lines === 1 ? "" : "s"}${suppliers ? ` from ${suppliers}` : ""}.`,
  otherReceipt: (date, lines, suppliers) => `Receiving log ${date}: ${lines} line${lines === 1 ? "" : "s"}${suppliers ? ` from ${suppliers}` : ""}.`,
  receiptDraft: "draft",
  noReceipts: "No receiving log yet.",
  holdsOpen: n => n === 0 ? "No material on hold." : `${n} hold${n === 1 ? "" : "s"} open without a disposition.`,
  finished: "Finished product",
  awaitingRelease: n => `Awaiting release: ${n}`,
  awaitingCollection: n => `Released, awaiting collection: ${n}`,
  release: "Release (FRM-701)",
  shipping: "Shipping",
  recordCollection: "Record a collection (FRM-801)",
  lastDispatch: (date, customer, lots, draft) => `Last dispatch ${date}${customer ? ` to ${customer}` : ""}, ${lots} lot${lots === 1 ? "" : "s"}${draft ? " (draft)" : ""}.`,
  noDispatches: "No dispatch recorded yet.",
  attention: "Attention",
  overdue: n => `Overdue: ${n}`,
  due: n => `Due: ${n}`,
  askedOfYou: n => `Signatures asked of you: ${n}`,
  alerts: n => `Temperature alerts: ${n}`,
  openNotifications: "Open Notifications",
  mappingProblem: "A form this page reads has changed. Until it is fixed, that part of the page may be wrong:",
  draft: "draft",
  loading: "Loading today…",
  loadError: "Could not load today's records.",
  opening: "Opening…",
};

const es: TodayMessages = {
  title: "Hoy",
  intro: "Lo que necesita el día, en orden. Cada botón abre el registro de ese trabajo.",
  startDay: "Empezar el día",
  preopNotDone: "La Limpieza Diaria y Pre-Operación (FRM-903) no se ha hecho hoy.",
  preopDraft: "La Limpieza Diaria y Pre-Operación (FRM-903) está empezada pero no enviada.",
  preopDone: (time, by) => `Limpieza Diaria y Pre-Operación (FRM-903) enviada a las ${time}${by ? ` por ${by}` : ""}.`,
  startPreop: "Completar la Limpieza Diaria",
  continuePreop: "Continuar la Limpieza Diaria",
  openPreop: "Abrir el registro de hoy",
  production: "Producción",
  blockedTitle: "La producción no puede empezar todavía.",
  blockedBody: "Primero hay que enviar el registro de Limpieza Diaria y Pre-Operación de hoy (FRM-903). Los registros de producción quedan cerrados hasta entonces.",
  startLot: "Empezar un lote",
  continueLot: "Continuar",
  noLots: "No hay ningún lote en curso.",
  bakedOn: date => `horneado ${date}`,
  stage: {
    preparing: "Preparando la mezcla",
    in_progress: "En curso",
    awaiting_release: "Esperando la liberación (SQF Practitioner)",
    not_released: "NO liberado",
    released: "Liberado, esperando la recogida",
    shipped: "Enviado",
  },
  onHold: "Retenido (FRM-702)",
  recordOvenLoad: "Registrar una hornada (FRM-507)",
  bake: {
    button: "Registrar horneado",
    speak: "Decir la lectura",
    open: "Abrir el registro",
    title: (lot, product) => `Hornada · Lote ${lot} · ${product}`,
    listening: "Escuchando…",
    say: (line, withProbe) => `Diga: "${line}". Si se midió con la sonda: "${withProbe}".`,
    heard: t => `Escuchado: "${t}"`,
    typeHere: "O escríbalo aquí",
    use: "Usar",
    again: "Intentar otra vez",
    accept: "Aceptar",
    openInstead: "Abrir el registro",
    cancel: "Cancelar",
    initials: "Iniciales",
    passLead: "Dentro de los límites críticos. Revise la fila y acéptela.",
    saved: (lot, product) => `Hornada registrada para el Lote ${lot} · ${product}.`,
    failLead: "No se cumplió un límite. Abriendo el registro…",
    openFailed: "No se pudo abrir el registro de horneado",
    noSpeech: "Este navegador no tiene reconocimiento de voz. Escríbalo abajo o abra el registro.",
    needsRecord: "Esta fila debe revisarse en el registro. Abriéndolo…",
    enter: "Escribir la lectura",
    done: "Horneado terminado…",
    notDone: "El horneado no ha terminado",
    doneTitle: (lot, product) => `Horneado terminado · Lote ${lot} · ${product}`,
    temp: "Temperatura del horno (°F)",
    minutes: "Tiempo de horneado (min)",
    probe: "Temperatura interna (°F)",
    optional: "si se midió",
    useSuggested: v => `Usar ${v}`,
    suggestedFrom: "La cifra de la hoja de fórmula de este producto (FRM-501). Toque para escribirla si es lo que marcó el horno.",
    save: "Guardar",
    lastLabel: "¿Es la última hornada?",
    lastNone: "Faltan más hornadas",
    lastBatch: "Última hornada de esta tanda",
    lastLot: "Última hornada del lote",
    lastBatchHelp: "Este producto ya terminó de hornearse por hoy.",
    lastLotHelp: "Todo el horneado de hoy terminó. El registro se firma con su nombre y se envía a revisión.",
    sayLast: 'En la última hornada, agregue "última hornada de esta tanda" o "última hornada del lote".',
    sendTo: "Enviar a revisión a",
    choose: "Elija…",
    noReviewers: "No se pudo mostrar a quién enviarlo. Abra el registro y use Solicitar firma.",
    markOnly: which => `Marca la última hornada registrada de esta tanda como: ${which}.`,
    noLoadYet: "No hay ninguna hornada de esta tanda en su registro de hoy, así que no hay nada que marcar.",
    savedBatch: (lot, product) => `Horneado terminado para el Lote ${lot} · ${product}.`,
    savedLot: (lot, reviewer) => `Horneado terminado para el Lote ${lot}. El registro se envió a ${reviewer} para revisión.`,
    reviewFailed: "La hornada se guardó, pero no se pudo enviar la solicitud de revisión. Abra el registro y use Solicitar firma.",
    reopened: (lot, product) => `Horneado reabierto para el Lote ${lot} · ${product}.`,
    nothingToReopen: "No hay marca de terminado en su registro para esta tanda.",
    doneTip: "Registrar horneado - horneado terminado",
    reviewNote: (date, lot) => `Baking record for ${date}: the last load of lot ${lot} is recorded. Please review and sign.`,
    awaitingReview: by => `El horneado de hoy terminó y lo firmó ${by}. En espera de revisión.`,
  },
  seal: {
    button: "Registrar sellado",
    speak: "Decir la revisión",
    open: "Abrir el registro",
    title: (lot, product) => `Revisión de sellado · Lote ${lot} · ${product}`,
    say: 'Diga: "Revisión de aire aprobada". Al empacar: "Prueba de jalón aprobada" o "Revisión de empaque aprobada". Empiece con "Arranque", "Después de un ajuste" o "Fin de corrida" cuando sea una de esas.',
    passLead: "Revisión aprobada. Revise la fila y acéptela.",
    saved: (lot, product) => `Revisión de sellado registrada para el Lote ${lot} · ${product}.`,
    failLead: "Una revisión falló. Abriendo el registro…",
    unclear: 'No escuché qué revisión, o su resultado. Dígalo otra vez, por ejemplo "Revisión de aire aprobada".',
    openFailed: "No se pudo abrir el registro de sellado",
    enter: "Escribir la revisión",
    done: "Revisiones terminadas…",
    notDone: "Las revisiones no han terminado",
    doneTitle: (lot, product) => `Revisiones terminadas · Lote ${lot} · ${product}`,
    checkType: "Revisión",
    airCheck: "Revisión de aire (visual)",
    pullTest: "Prueba de jalón",
    vacuum: "Manómetro de vacío (pulg. Hg)",
    pass: "Aprobada",
    fail: "Rechazada",
    notDoneYet: "No se hizo",
    lastLabel: "¿Es la última revisión?",
    lastNone: "Faltan más revisiones",
    lastBatch: "Última revisión de esta tanda",
    lastLot: "Última revisión del lote",
    lastBatchHelp: "Las revisiones de sellado y de empaque de este producto ya terminaron por hoy. El registro se firma con su nombre.",
    lastLotHelp: "Todas las revisiones de hoy terminaron. Los registros de este lote se firman con su nombre y se envían a revisión.",
    sayLast: 'En la última revisión, agregue "última revisión de esta tanda" o "última revisión del lote".',
    markOnly: which => `Marca la última revisión registrada de esta tanda como: ${which}.`,
    noCheckYet: "No hay ninguna revisión de esta tanda en su registro de hoy, así que no hay nada que marcar.",
    savedBatch: (lot, product) => `Revisiones terminadas para el Lote ${lot} · ${product}.`,
    savedLot: (lot, reviewer, n) => `Revisiones terminadas para el Lote ${lot}. ${n === 1 ? "El registro se envió" : `Se enviaron ${n} registros`} a ${reviewer} para revisión.`,
    reopened: (lot, product) => `Revisiones reabiertas para el Lote ${lot} · ${product}.`,
    nothingToReopen: "No hay marca de terminado en sus registros para esta tanda.",
    doneTip: "Registrar sellado - revisiones terminadas",
    reviewNote: (date, lot, product) => `Sealing record for ${date}, lot ${lot}, ${product}: the last check is recorded. Please review and sign.`,
    awaitingReview: by => `Las revisiones de sellado de hoy terminaron y las firmó ${by}. En espera de revisión.`,
  },
  releaseSteps: {
    button: "Liberar",
    heading: "Antes de la liberación, en orden. Elija un paso para abrir su registro.",
    done: "Enviado",
    open: "Aún en borrador - revíselo, fírmelo y envíelo",
    none: "No se encontró registro para este lote",
    start: "Sin empezar - empezarlo ahora",
    startFailed: "No se pudo empezar el registro.",
    sampleStarted: "Empezada - complétela y firme \"Muestra tomada por\"",
    sampleOnShelf: due => `Anotada - en el estante${due ? `, desechar el ${due}` : ""}`,
    sampleDisposed: "Anotada - ya desechada",
    step: {
      lot: "Registro del lote (FRM-520)",
      baking: "Registro de horneado revisado y firmado (FRM-507)",
      sealing: "Registros de sellado revisados y firmados (FRM-606)",
      retention: "Muestra de retención anotada (FRM-703)",
      release: "Liberar el lote (FRM-701)",
    },
    noRecord: {
      lot: "No se encontró el registro del lote.",
      baking: "Ningún registro de horneado tiene una carga de horno de este lote. Búsquelo en la biblioteca, en FRM-507.",
      sealing: "No se encontró registro de sellado para este lote. Búsquelo en la biblioteca, en FRM-606.",
      retention: "No se encontró el registro de muestras de retención (FRM-703).",
      release: "No se encontró el formulario de liberación (FRM-701).",
    },
  },
  records: {
    button: "Registros",
    heading: "Los registros de este lote, en orden. Elija uno para abrirlo.",
    submitted: "Enviado",
    draft: "Aún en borrador",
    none: "No se encontró ninguno para este lote",
    name: {
      lot: "Registro del lote - mezclado y empaque (FRM-520)",
      baking: "Registro de horneado (FRM-507)",
      sealing: "Registro de revisiones de sellado (FRM-606)",
      retention: "Muestra de retención (FRM-703)",
      release: "Registro de liberación (FRM-701)",
      dispatch: "Registro de despacho (FRM-801)",
    },
  },
  pack: {
    button: "Registrar empaque",
    doneTip: "Registrar empaque - primer empaque revisado, conteos anotados y empaques pesados",
    photo: "Fotografiar el primer empaque",
    counts: "Anotar los conteos",
    open: "Abrir el registro",
    title: (lot, product) => `Primer empaque · Lote ${lot} · ${product}`,
    countsTitle: (lot, product) => `Conteos de empaque · Lote ${lot} · ${product}`,
    reading: "Leyendo el empaque...",
    photoHelp: "Una foto donde se vean el sabor, el código de lote, la fecha de consumo preferente y el código de barras. La foto se guarda en el registro del lote.",
    again: "Tomar otra foto",
    matches: "Revisé el empaque - coincide",
    saved: (lot, product) => `Primer empaque registrado como correcto · Lote ${lot} · ${product}`,
    incomplete: "Revise en el empaque los puntos marcados arriba; luego tome una foto más clara o conteste en el registro.",
    mismatch: "Detenga el empaque. Corrija el codificador o la película y fotografíe el siguiente primer empaque. El producto ya empacado con el código equivocado se retiene en FRM-702.",
    unreadable: "No se pudo leer la foto. Se guardó en el registro del lote.",
    openFailed: "No se pudo guardar el registro del lote. Abra el registro.",
    needsRecord: "Para esto hay que abrir el registro del lote.",
    alreadyChecked: "El primer empaque ya está contestado en el registro. La foto nueva se agrega.",
    racked: "Contados en el carro de horneado",
    packed: "Unidades empacadas",
    notPacked: "No empacadas",
    filmLot: "Lote de película / bolsa",
    notes: "Notas",
    countsHelp: "Cuente los tres. La aplicación solo los suma: contados en el carro = unidades empacadas + no empacadas.",
    addsUp: (sum, racked) => `Cuadra: ${sum}, y se contaron ${racked} en el carro.`,
    short: (n, sum, racked) => `Faltan ${n}: ${sum}, pero se contaron ${racked} en el carro.`,
    over: (n, sum, racked) => `Sobran ${n}: ${sum}, pero solo se contaron ${racked} en el carro.`,
    sayWhy: "Vuelva a contar, o explique por qué en Notas.",
    notANumber: "Unidades empacadas debe ser un número de unidades para poder sumarse.",
    savedCounts: (lot, product) => `Conteos de empaque guardados · Lote ${lot} · ${product}`,
    firstPackDone: "Primer empaque revisado",
    countsDone: "Conteos anotados",
    optional: "opcional",
    answer: "Contestar el primer empaque",
    answerHelp: "Lo que muestra el código del primer empaque, y quién lo revisó. Úselo cuando no hay foto, o para anotar un empaque que no coincidió.",
    answerDisagrees: "La última foto no coincidió con esta respuesta. Fotografíe el empaque corregido, o cambie la respuesta.",
    savedAnswer: (lot, product) => `Primer empaque contestado · Lote ${lot} · ${product}`,
    weigh: "Pesar tres empaques",
    weighDone: "Tres empaques pesados",
    weighTitle: (lot, product) => `Peso neto · Lote ${lot} · ${product}`,
    weighHelp: "Pese tres empaques terminados de este lote, cada uno entero, en la báscula calibrada. La aplicación resta el empaque vacío y saca el promedio.",
    declared: "Peso neto en la etiqueta",
    tare: "Peso del empaque vacío",
    unit: "Unidad de pesado",
    packWeight: n => `Peso del empaque ${n}`,
    weightOk: (average, declared, unit) => `Peso neto promedio ${average} ${unit}, igual o mayor que los ${declared} ${unit} de la etiqueta.`,
    weightBelow: (average, declared, unit) => `El peso neto promedio ${average} ${unit} está POR DEBAJO de los ${declared} ${unit} de la etiqueta. Detenga el empaque, retenga el lote en FRM-702 y avise al SQF Practitioner. Los pesos se guardan igual.`,
    weightUnreadable: "No se puede calcular el peso neto. Escriba el peso de la etiqueta como una sola cifra con su unidad (por ejemplo 4 oz), elija la unidad y anote cada peso como un número mayor que cero.",
    savedWeights: (lot, product) => `Pesos de empaque guardados · Lote ${lot} · ${product}`,
    savedBelow: "Pesos guardados. El promedio está POR DEBAJO de la etiqueta: detenga el empaque, retenga el lote en FRM-702 y avise al SQF Practitioner.",
  },
  flow: {
    follow: "Seguir este lote",
    followTip: "Un paso a la vez, del mezclado al empaque",
    backToToday: "Volver a Hoy",
    notFound: "No se encontró este lote. Puede que se haya eliminado.",
    previous: "Paso anterior",
    next: "Paso siguiente",
    step: { mixing: "Mezclado", baking: "Horneado", sealing: "Revisiones de sellado", packing: "Empaque", submit: "Firmar y enviar", retention: "Muestra de retención", bakeReview: "Revisar horneado", sealReview: "Revisar sellado", release: "Liberación" },
    state: { done: "Hecho", open: "En curso", none: "Sin empezar" },
    loads: n => n === 0 ? "Aún no hay cargas de horno registradas." : n === 1 ? "1 carga de horno registrada." : `${n} cargas de horno registradas.`,
    checks: n => n === 0 ? "Aún no hay revisiones de sellado registradas." : n === 1 ? "1 revisión de sellado registrada." : `${n} revisiones de sellado registradas.`,
    bakeDone: "El horneado está marcado como terminado para este lote de producto.",
    sealDone: "Las revisiones están marcadas como terminadas para este lote de producto.",
    mixingLater: "Los ingredientes, sus lotes y los pesos se anotan en el registro del lote.",
    mixingProgress: (done, lines) => `${done} de ${lines} ingredientes completos.`,
    openLotRecord: "Abrir el registro del lote",
    firstPackDone: "Primer empaque revisado.",
    firstPackNeeded: "Falta la respuesta del primer empaque: fotografíelo, o contéstelo aquí.",
    countsDone: "Conteos anotados.",
    submitLead: "El registro del lote (FRM-520) queda terminado cuando se firma y se envía.",
    submitReady: "El registro del lote tiene todo lo que necesita.",
    missing: "Falta antes de poder enviarlo:",
    missingLine: (table, line, column) => `${table}, línea ${line}: ${column}`,
    statement: "Los lotes y las cantidades de este registro son los que se usaron.",
    signAndSubmit: name => `Firmar como ${name} y enviar`,
    submitted: (lot, product) => `Registro del lote enviado · Lote ${lot} · ${product}`,
    submitFailed: "No se pudo enviar el registro del lote.",
    needsRecord: "Este registro del lote debe terminarse en el propio registro.",
    alreadySubmitted: "El registro del lote está enviado.",
    finished: "Este lote está terminado en planta. Ahora espera su liberación.",
    adminNext: "Sigue: la liberación.",
    sampleLead: "Tome un empaque terminado de este lote. Compare lo que se muestra con el empaque que tiene en la mano, corrija lo que difiera, póngalo en el estante de retención y firme.",
    sampleNoDiscard: "No se pudo calcular la fecha de desecho con esa fecha de consumo preferente. Escríbala como está impresa en el empaque (por ejemplo October 2027), o abra el registro.",
    sampleNeedsRecord: "Esta muestra de retención debe completarse en el propio registro.",
    olderRecord: "Este registro del lote se empezó con una versión anterior del formulario, así que su empaque se termina en el propio registro.",
    review: {
      lead: { baking: "El registro de horneado (FRM-507) que lleva las cargas de horno de este lote. Revise cada carga contra los límites críticos, luego firme como verificador y envíelo.",
        sealing: "El registro de revisiones de sellado (FRM-606) de este lote. Revise cada revisión contra los límites críticos, luego firme como verificador y envíelo." },
      noRecord: { baking: "Ningún registro de horneado lleva una carga de horno de este lote.", sealing: "No se encontró registro de revisiones de sellado para este lote." },
      submitted: "Revisado y enviado.",
      date: "Fecha de producción",
      monitoredBy: (name, at) => `Monitoreado por ${name}, firmado ${at}.`,
      notSigned: "El operador no ha firmado \"Monitoreado por\". El registro no puede verificarse hasta que lo haga: lo firma al marcar la última carga o la última revisión, o en el propio registro.",
      notFinished: { baking: "El horneado de hoy no está marcado como terminado. Enviarlo ahora cerraría el registro del día a más cargas.",
        sealing: "Las revisiones de este lote de producto no están marcadas como terminadas. Enviarlo ahora cerraría el registro a más revisiones." },
      noRows: "Aún no hay nada anotado en este registro.",
      otherLot: "Las líneas en gris son de otro producto o lote en el mismo registro.",
      deviations: "Desviaciones anotadas",
      noDeviations: "Sin desviaciones: cada línea cumplió los límites.",
      missing: "Falta antes de poder enviarlo:",
      ready: "El registro está completo.",
      verify: name => `Firmar como verificador (${name}) y enviar`,
      verified: (form, date) => `${form} del ${date} verificado y enviado.`,
      failed: "No se pudo enviar el registro.",
      needsRecord: "Este registro debe revisarse en el propio registro.",
      notReviewed: { baking: "El registro de horneado de este lote aún no está revisado y enviado (paso \"Revisar horneado\").",
        sealing: "El registro de revisiones de sellado de este lote aún no está revisado y enviado (paso \"Revisar sellado\")." },
    },
    signSample: name => `Firmar como ${name} - muestra en el estante`,
    sampleLogged: (lot, product, discard) => `Muestra de retención anotada · Lote ${lot} · ${product}${discard ? ` · desechar el ${discard}` : ""}`,
    sampleFailed: "No se pudo anotar la muestra de retención.",
    openStep: "Abrir el registro",
    startStep: "Empezar el registro",
  },
  recordSealChecks: "Registrar las revisiones de sellado (FRM-606)",
  ccpBakingToday: n => n === 0 ? "El registro de horneado de hoy está abierto." : `El registro de horneado de hoy tiene ${n} hornada${n === 1 ? "" : "s"}.`,
  ccpSealingToday: n => `${n} registro${n === 1 ? "" : "s"} de sellado hoy.`,
  receiving: "Recepción",
  receiveDelivery: "Recibir una entrega (FRM-301)",
  lastReceipt: (date, lines, suppliers) => `Última recepción ${date}: ${lines} línea${lines === 1 ? "" : "s"}${suppliers ? ` de ${suppliers}` : ""}.`,
  otherReceipt: (date, lines, suppliers) => `Recepción ${date}: ${lines} línea${lines === 1 ? "" : "s"}${suppliers ? ` de ${suppliers}` : ""}.`,
  receiptDraft: "borrador",
  noReceipts: "Todavía no hay registro de recepción.",
  holdsOpen: n => n === 0 ? "No hay material retenido." : `${n} retención${n === 1 ? "" : "es"} sin disposición final.`,
  finished: "Producto terminado",
  awaitingRelease: n => `Esperando la liberación: ${n}`,
  awaitingCollection: n => `Liberados, esperando la recogida: ${n}`,
  release: "Liberar (FRM-701)",
  shipping: "Envíos",
  recordCollection: "Registrar una recogida (FRM-801)",
  lastDispatch: (date, customer, lots, draft) => `Último envío ${date}${customer ? ` a ${customer}` : ""}, ${lots} lote${lots === 1 ? "" : "s"}${draft ? " (borrador)" : ""}.`,
  noDispatches: "Todavía no hay envíos registrados.",
  attention: "Atención",
  overdue: n => `Vencidas: ${n}`,
  due: n => `Por vencer: ${n}`,
  askedOfYou: n => `Firmas que le piden: ${n}`,
  alerts: n => `Alertas de temperatura: ${n}`,
  openNotifications: "Abrir Notificaciones",
  mappingProblem: "Un formulario que lee esta página ha cambiado. Hasta que se corrija, esa parte de la página puede estar mal:",
  draft: "borrador",
  loading: "Cargando el día…",
  loadError: "No se pudieron cargar los registros de hoy.",
  opening: "Abriendo…",
};

export const TODAY_MSG: Record<TodayLang, TodayMessages> = { en, es };
