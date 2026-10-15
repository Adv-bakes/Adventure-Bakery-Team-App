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
  /** A new lot started from its formula sheet and taken step by step (LotFlow.tsx). */
  batchFormMissing: string;
  startLotSteps: string; startLotStepsTip: string; pickFormulaTitle: string; pickFormula: string; lotExists(lot: string, product: string): string; lotSubmitted(lot: string, product: string): string;
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
    /** A batch made on site the lot was dunked in. */
    batchName(title: string): string;
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
    step: Record<"mixing" | "baking" | "dunking" | "sealing" | "packing" | "submit" | "retention" | "bakeReview" | "sealReview" | "release", string>;
    state: Record<"done" | "open" | "none", string>;
    loads(n: number): string; checks(n: number): string;
    bakeDone: string; sealDone: string;
    mixingLater: string; mixingProgress(done: number, lines: number): string; openLotRecord: string;
    /** Mixing, one screen at a time: the batches, each ingredient of each batch, the rework question. */
    /** A batch made on site for use in other products (FRM-530: the syrup), and its offer at Dunking. */
    batch: {
      title(product: string, lot: string): string; notFound: string;
      step: Record<"ingredients" | "finish", string>;
      finishLead: string; quantityMade: string; quantityHelp: string; useBy: string; useByHelp: string; labelled: string; notes: string;
      signAndSubmit(name: string): string; submitted(product: string, lot: string, useBy: string): string; failed: string;
      done(useBy: string): string; needsRecord: string; openRecord: string;
      onToday(product: string, lot: string): string; continue: string;
      offer: string; offerLine(lot: string, madeOn: string, useBy: string): string; draft: string; expired(useBy: string): string;
      shelfTitle: string; shelfToDiscard(n: number): string; labelsButton: string;
      labels: {
        lead: string; count: string; print(n: number): string; each(q: string): string; noQuantity(made: string): string; badCount(max: number): string; failed: string;
        sendToPrinter: string; sendLead: string; sendTo: string; choose: string; notePlaceholder: string; send(n: number): string; sent(n: number, who: string): string; sendFailed: string;
        pageTitle(product: string, lot: string): string; pageLead: string; printed: string; markedPrinted: string; notSigned: string; notFound: string; back: string;
      }; shelfLine(product: string, lot: string, madeOn: string, useBy: string): string; shelfExpired(product: string, lot: string, useBy: string): string;
    };
    /** Dunking: the lots of the syrup and the rum each lot is dunked in. */
    dunk: {
      lead: string; where(position: number, of: number): string;
      amountLabel: string; amountHelp: string; anotherLot(ingredient: string): string; removeLine: string;
      done: string; submitted: string; added(ingredient: string): string;
    };
    mix: {
      batchesQ: string; batchesHelp: string; batchN(n: number): string;
      where(batch: number, batches: number, position: number, of: number): string; whereOne(position: number, of: number): string;
      lotLabel: string; lotIs(lot: string): string; noLotYet: string; otherLot: string;
      scan: string; scanning: string; scanNone: string; scanFailed: string; scanReads(text: string): string; scanOffer: string;
      weightLabel(batch: number): string; weighedOne: string; formula(qty: string, unit: string): string; takeFigure(qty: string, unit: string): string;
      optionalWeight: string; badWeight: string; needLot: string; unitLabel: string; needUnit: string;
      save: string; back: string; skip: string; saveFailed: string; moved: string;
      reworkQ: string; reworkNo: string; reworkYes: string; reworkYesBody: string; answered(answer: string): string;
      stillOpen(n: number): string; goToOpen: string; done: string;
      noLines: string; fromFormula: string; formulaFilled(n: number): string; submitted: string; mapping(missing: string): string;
    };
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
  collectLot: string;
  collectFailed: string;
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
  /** The refresh icon beside a page title, and its tooltip. */
  refresh: string;
  refreshTip: string;
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
  batchFormMissing: "The batch record (FRM-530) could not be found, so the batch was not started.",
  startLotSteps: "Start a lot step by step",
  startLotStepsTip: "Pick the product's formula sheet, then mix one ingredient at a time",
  pickFormulaTitle: "Start a lot step by step",
  pickFormula: "Pick the product. Its ingredients and expected quantities start today's lot record; the lots and the weights are left blank for you to enter.",
  lotExists: (lot, product) => `Lot ${lot} · ${product} is already started today. It has been opened.`,
  lotSubmitted: (lot, product) => `Lot ${lot} · ${product} already has a submitted lot record today, so a second one was not started. To add to it, an admin reopens that record.`,
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
    batchName: title => `${title} - made here (FRM-530)`,
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
    step: { mixing: "Mixing", baking: "Baking", dunking: "Dunking", sealing: "Seal checks", packing: "Packing", submit: "Sign and submit", retention: "Retention sample", bakeReview: "Review baking", sealReview: "Review seal checks", release: "Release" },
    state: { done: "Done", open: "In progress", none: "Not started" },
    loads: n => n === 0 ? "No oven load recorded yet." : n === 1 ? "1 oven load recorded." : `${n} oven loads recorded.`,
    checks: n => n === 0 ? "No seal check recorded yet." : n === 1 ? "1 seal check recorded." : `${n} seal checks recorded.`,
    bakeDone: "Baking is marked finished for this batch.",
    sealDone: "The checks are marked finished for this batch.",
    mixingLater: "The ingredients, their lots and the weights are recorded on the lot record.",
    mixingProgress: (done, lines) => `${done} of ${lines} ingredients complete.`,
    openLotRecord: "Open the lot record",
    mix: {
      batchesQ: "How many batches are being mixed for this lot?",
      batchesHelp: "Each batch is weighed and recorded on its own.",
      batchN: n => n === 1 ? "1 batch" : `${n} batches`,
      where: (batch, batches, position, of) => `Batch ${batch} of ${batches} · ingredient ${position} of ${of}`,
      whereOne: (position, of) => `Ingredient ${position} of ${of}`,
      lotLabel: "Lot on the container",
      lotIs: lot => `Lot on the container: ${lot}`,
      noLotYet: "No lot is recorded for this ingredient yet. Go back to batch 1 for it.",
      otherLot: "A different container for this batch? Add it as a line of its own on the lot record.",
      scan: "Scan the label",
      scanning: "Reading the label…",
      scanNone: "No lot code could be read on that photo. Type it as printed on the container.",
      scanFailed: "The label could not be read. Type the lot as printed on the container.",
      scanReads: text => `The label reads: ${text}`,
      scanOffer: "Also read on the label - tap to use:",
      weightLabel: batch => `Batch ${batch} weighed`,
      weighedOne: "Weighed",
      formula: (qty, unit) => `Formula: ${qty}${unit ? ` ${unit}` : ""} per batch`,
      takeFigure: (qty, unit) => `Use ${qty}${unit ? ` ${unit}` : ""}`,
      optionalWeight: "The formula sheet gives no quantity for this line. Enter a weight if it was weighed; otherwise leave it empty.",
      badWeight: "Enter the weight as a number.",
      unitLabel: "Unit",
      needUnit: "Choose the unit the weight is in.",
      needLot: "Enter the lot printed on the container.",
      save: "Save and next",
      back: "Back",
      skip: "Skip for now",
      saveFailed: "That could not be saved.",
      moved: "The lot record was changed somewhere else. It has been read again - check this line.",
      reworkQ: "Was rework used in this lot?",
      reworkNo: "No rework used",
      reworkYes: "Rework was used",
      reworkYesBody: "Rework is a line of its own in the table, with its original lot code. Add it on the lot record and answer the rework question there.",
      answered: answer => `Answered: ${answer}`,
      stillOpen: n => n === 1 ? "1 screen was skipped and still needs its answer." : `${n} screens were skipped and still need their answers.`,
      goToOpen: "Go to the first one",
      done: "Mixing is complete.",
      noLines: "This lot record has no ingredients yet.",
      fromFormula: "Start from the formula sheet",
      formulaFilled: n => n === 1 ? "1 ingredient taken from the formula sheet." : `${n} ingredients taken from the formula sheet.`,
      submitted: "The lot record is submitted. Its mixing is on the record.",
      mapping: missing => `The lot record form no longer has: ${missing}. Mixing is recorded on the record itself.`,
    },
    batch: {
      title: (product, lot) => `${product || "Batch"} · Lot ${lot || "—"}`,
      notFound: "This batch could not be found. It may have been deleted.",
      step: { ingredients: "Ingredients", finish: "Finish and sign" },
      finishLead: "Seal the container and label it with what it is, its lot code and the date it was made. Then sign the batch record.",
      quantityMade: "Quantity made",
      quantityHelp: "For example 5 gal.",
      useBy: "Use by",
      useByHelp: "30 days from the date it was made (FSQM-016).",
      labelled: "The container is sealed and labelled with what it is, its lot code and the date made",
      notes: "Notes",
      signAndSubmit: name => `Sign as ${name} and submit`,
      submitted: (product, lot, useBy) => `${product} lot ${lot} recorded. Use by ${useBy}.`,
      failed: "The batch record could not be submitted.",
      done: useBy => `This batch is recorded. Its lot code is offered at Dunking until ${useBy}.`,
      needsRecord: "This batch record has to be finished on the record itself.",
      openRecord: "Open the batch record",
      onToday: (product, lot) => `${product} · Lot ${lot} - being made`,
      continue: "Follow this batch",
      offer: "Made on site - tap the one in use:",
      offerLine: (lot, madeOn, useBy) => `Lot ${lot} · made ${madeOn} · use by ${useBy}`,
      draft: "not yet signed",
      expired: useBy => `Past its use-by date (${useBy}). FSQM-016: syrup is used within 30 days of being made.`,
      shelfTitle: "Made here, on the shelf",
      labelsButton: "Labels",
      labels: {
        lead: "Print a label for each container it was put into.",
        count: "Containers",
        print: n => n === 1 ? "Print 1 label" : `Print ${n} labels`,
        each: q => `Each label shows ${q}.`,
        noQuantity: made => made ? `"${made}" cannot be shared out, so the labels leave the quantity off.` : "No quantity made is recorded, so the labels leave it off.",
        badCount: max => `Enter a whole number from 1 to ${max}.`,
        failed: "The labels could not be made.",
        sendToPrinter: "Send to the label printer",
        sendLead: "The label printer is at one computer. Ask the person there to print these labels - it reaches them as a notification with a link.",
        sendTo: "Send to",
        choose: "Choose a person",
        notePlaceholder: "Note (optional)",
        send: n => n === 1 ? "Send 1 label" : `Send ${n} labels`,
        sent: (n, who) => `${n === 1 ? "1 label" : `${n} labels`} sent to ${who || "the label printer"}.`,
        sendFailed: "The request could not be sent.",
        pageTitle: (product, lot) => `Labels: ${product || "batch"} lot ${lot || "?"}`,
        pageLead: "Print on the 4 x 6 in label printer at actual size. When the labels are printed, mark them printed to close the request.",
        printed: "The labels are printed",
        markedPrinted: "Marked printed. The request is closed.",
        notSigned: "This batch is not signed yet, so its labels cannot be printed.",
        notFound: "This batch record could not be found. It may have been deleted.",
        back: "Back to Notifications",
      },
      shelfToDiscard: n => n === 1 ? "1 to discard" : `${n} to discard`,
      shelfLine: (product, lot, madeOn, useBy) => `${product} · Lot ${lot} · made ${madeOn} · use by ${useBy || "—"}`,
      shelfExpired: (product, lot, useBy) => `${product} · Lot ${lot} · past its use-by on ${useBy} - discard`,
    },
    dunk: {
      lead: "The syrup and the rum this lot is dunked in: the lot printed on each container.",
      where: (position, of) => `Dunking line ${position} of ${of}`,
      amountLabel: "Amount used (optional)",
      amountHelp: "If you know it, for example 2 gal. It is not weighed.",
      anotherLot: ingredient => `Another lot of ${ingredient}`,
      removeLine: "Remove this extra line",
      done: "Dunking is complete.",
      submitted: "The lot record is submitted. Its dunking is on the record.",
      added: ingredient => `A second line of ${ingredient} was added for the other lot.`,
    },
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
  collectLot: "Record collection",
  collectFailed: "The dispatch record could not be opened.",
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
  refresh: "Refresh",
  refreshTip: "Read the records again (also done by itself when you come back to this screen)",
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
  batchFormMissing: "No se encontró el registro de tanda (FRM-530), así que no se empezó la tanda.",
  startLotSteps: "Empezar un lote paso a paso",
  startLotStepsTip: "Elija la hoja de fórmula del producto y mezcle un ingrediente a la vez",
  pickFormulaTitle: "Empezar un lote paso a paso",
  pickFormula: "Elija el producto. Sus ingredientes y cantidades esperadas inician el registro del lote de hoy; los lotes y los pesos quedan en blanco para que usted los anote.",
  lotExists: (lot, product) => `El lote ${lot} · ${product} ya está empezado hoy. Se abrió.`,
  lotSubmitted: (lot, product) => `El lote ${lot} · ${product} ya tiene hoy un registro de lote enviado, así que no se empezó otro. Para añadirle, un administrador reabre ese registro.`,
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
    batchName: title => `${title} - hecho aquí (FRM-530)`,
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
    step: { mixing: "Mezclado", baking: "Horneado", dunking: "Remojo", sealing: "Revisiones de sellado", packing: "Empaque", submit: "Firmar y enviar", retention: "Muestra de retención", bakeReview: "Revisar horneado", sealReview: "Revisar sellado", release: "Liberación" },
    state: { done: "Hecho", open: "En curso", none: "Sin empezar" },
    loads: n => n === 0 ? "Aún no hay cargas de horno registradas." : n === 1 ? "1 carga de horno registrada." : `${n} cargas de horno registradas.`,
    checks: n => n === 0 ? "Aún no hay revisiones de sellado registradas." : n === 1 ? "1 revisión de sellado registrada." : `${n} revisiones de sellado registradas.`,
    bakeDone: "El horneado está marcado como terminado para este lote de producto.",
    sealDone: "Las revisiones están marcadas como terminadas para este lote de producto.",
    mixingLater: "Los ingredientes, sus lotes y los pesos se anotan en el registro del lote.",
    mixingProgress: (done, lines) => `${done} de ${lines} ingredientes completos.`,
    openLotRecord: "Abrir el registro del lote",
    mix: {
      batchesQ: "¿Cuántas tandas se mezclan para este lote?",
      batchesHelp: "Cada tanda se pesa y se anota por separado.",
      batchN: n => n === 1 ? "1 tanda" : `${n} tandas`,
      where: (batch, batches, position, of) => `Tanda ${batch} de ${batches} · ingrediente ${position} de ${of}`,
      whereOne: (position, of) => `Ingrediente ${position} de ${of}`,
      lotLabel: "Lote en el envase",
      lotIs: lot => `Lote en el envase: ${lot}`,
      noLotYet: "Este ingrediente todavía no tiene lote anotado. Vuelva a la tanda 1 para anotarlo.",
      otherLot: "¿Otro envase para esta tanda? Añádalo como una línea propia en el registro del lote.",
      scan: "Escanear la etiqueta",
      scanning: "Leyendo la etiqueta…",
      scanNone: "No se pudo leer un código de lote en esa foto. Escríbalo como está impreso en el envase.",
      scanFailed: "No se pudo leer la etiqueta. Escriba el lote como está impreso en el envase.",
      scanReads: text => `La etiqueta dice: ${text}`,
      scanOffer: "También se leyó en la etiqueta - toque para usar:",
      weightLabel: batch => `Tanda ${batch} pesada`,
      weighedOne: "Pesado",
      formula: (qty, unit) => `Fórmula: ${qty}${unit ? ` ${unit}` : ""} por tanda`,
      takeFigure: (qty, unit) => `Usar ${qty}${unit ? ` ${unit}` : ""}`,
      optionalWeight: "La hoja de fórmula no da cantidad para esta línea. Escriba un peso si se pesó; si no, déjelo vacío.",
      badWeight: "Escriba el peso como un número.",
      unitLabel: "Unidad",
      needUnit: "Elija la unidad del peso.",
      needLot: "Escriba el lote impreso en el envase.",
      save: "Guardar y seguir",
      back: "Atrás",
      skip: "Saltar por ahora",
      saveFailed: "No se pudo guardar.",
      moved: "El registro del lote se cambió en otro lugar. Se leyó de nuevo - revise esta línea.",
      reworkQ: "¿Se usó reproceso en este lote?",
      reworkNo: "No se usó reproceso",
      reworkYes: "Se usó reproceso",
      reworkYesBody: "El reproceso es una línea propia en la tabla, con su código de lote original. Añádalo en el registro del lote y conteste allí la pregunta de reproceso.",
      answered: answer => `Contestado: ${answer}`,
      stillOpen: n => n === 1 ? "Se saltó 1 pantalla y todavía falta su respuesta." : `Se saltaron ${n} pantallas y todavía faltan sus respuestas.`,
      goToOpen: "Ir a la primera",
      done: "El mezclado está completo.",
      noLines: "Este registro del lote todavía no tiene ingredientes.",
      fromFormula: "Empezar desde la hoja de fórmula",
      formulaFilled: n => n === 1 ? "1 ingrediente tomado de la hoja de fórmula." : `${n} ingredientes tomados de la hoja de fórmula.`,
      submitted: "El registro del lote está enviado. Su mezclado está en el registro.",
      mapping: missing => `El formulario del registro del lote ya no tiene: ${missing}. El mezclado se anota en el propio registro.`,
    },
    batch: {
      title: (product, lot) => `${product || "Tanda"} · Lote ${lot || "—"}`,
      notFound: "No se encontró esta tanda. Puede que se haya borrado.",
      step: { ingredients: "Ingredientes", finish: "Terminar y firmar" },
      finishLead: "Selle el envase y rotúlelo con lo que es, su código de lote y la fecha en que se hizo. Luego firme el registro de la tanda.",
      quantityMade: "Cantidad hecha",
      quantityHelp: "Por ejemplo 5 gal.",
      useBy: "Usar antes de",
      useByHelp: "30 días desde la fecha en que se hizo (FSQM-016).",
      labelled: "El envase está sellado y rotulado con lo que es, su código de lote y la fecha en que se hizo",
      notes: "Notas",
      signAndSubmit: name => `Firmar como ${name} y enviar`,
      submitted: (product, lot, useBy) => `${product} lote ${lot} registrado. Usar antes de ${useBy}.`,
      failed: "No se pudo enviar el registro de la tanda.",
      done: useBy => `Esta tanda está registrada. Su código de lote se ofrece en el remojo hasta el ${useBy}.`,
      needsRecord: "Este registro de tanda debe terminarse en el propio registro.",
      openRecord: "Abrir el registro de la tanda",
      onToday: (product, lot) => `${product} · Lote ${lot} - en preparación`,
      continue: "Seguir esta tanda",
      offer: "Hecho aquí - toque el que está en uso:",
      offerLine: (lot, madeOn, useBy) => `Lote ${lot} · hecho ${madeOn} · usar antes de ${useBy}`,
      draft: "sin firmar",
      expired: useBy => `Pasó su fecha de uso (${useBy}). FSQM-016: el almíbar se usa dentro de los 30 días de hecho.`,
      shelfTitle: "Hecho aquí, en el estante",
      labelsButton: "Etiquetas",
      labels: {
        lead: "Imprima una etiqueta para cada envase en que se puso.",
        count: "Envases",
        print: n => n === 1 ? "Imprimir 1 etiqueta" : `Imprimir ${n} etiquetas`,
        each: q => `Cada etiqueta muestra ${q}.`,
        noQuantity: made => made ? `"${made}" no se puede repartir, así que las etiquetas no muestran la cantidad.` : "No hay cantidad hecha anotada, así que las etiquetas no la muestran.",
        badCount: max => `Escriba un número entero de 1 a ${max}.`,
        failed: "No se pudieron hacer las etiquetas.",
        sendToPrinter: "Enviar a la impresora de etiquetas",
        sendLead: "La impresora de etiquetas está en una computadora. Pida a la persona que está allí que imprima estas etiquetas - le llega como notificación con un enlace.",
        sendTo: "Enviar a",
        choose: "Elija una persona",
        notePlaceholder: "Nota (opcional)",
        send: n => n === 1 ? "Enviar 1 etiqueta" : `Enviar ${n} etiquetas`,
        sent: (n, who) => `${n === 1 ? "1 etiqueta enviada" : `${n} etiquetas enviadas`} a ${who || "la impresora de etiquetas"}.`,
        sendFailed: "No se pudo enviar el pedido.",
        pageTitle: (product, lot) => `Etiquetas: ${product || "tanda"} lote ${lot || "?"}`,
        pageLead: "Imprima en la impresora de etiquetas de 4 x 6 pulgadas a tamaño real. Cuando estén impresas, márquelas como impresas para cerrar el pedido.",
        printed: "Las etiquetas están impresas",
        markedPrinted: "Marcadas como impresas. El pedido está cerrado.",
        notSigned: "Esta tanda no está firmada todavía, así que sus etiquetas no se pueden imprimir.",
        notFound: "No se encontró este registro de tanda. Puede que se haya borrado.",
        back: "Volver a Notificaciones",
      },
      shelfToDiscard: n => n === 1 ? "1 para desechar" : `${n} para desechar`,
      shelfLine: (product, lot, madeOn, useBy) => `${product} · Lote ${lot} · hecho ${madeOn} · usar antes de ${useBy || "—"}`,
      shelfExpired: (product, lot, useBy) => `${product} · Lote ${lot} · pasó su fecha de uso el ${useBy} - desechar`,
    },
    dunk: {
      lead: "El almíbar y el ron en que se remoja este lote: el lote impreso en cada envase.",
      where: (position, of) => `Línea de remojo ${position} de ${of}`,
      amountLabel: "Cantidad usada (opcional)",
      amountHelp: "Si la sabe, por ejemplo 2 gal. No se pesa.",
      anotherLot: ingredient => `Otro lote de ${ingredient}`,
      removeLine: "Quitar esta línea de más",
      done: "El remojo está completo.",
      submitted: "El registro del lote está enviado. Su remojo está en el registro.",
      added: ingredient => `Se añadió una segunda línea de ${ingredient} para el otro lote.`,
    },
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
  collectLot: "Registrar recogida",
  collectFailed: "No se pudo abrir el registro de despacho.",
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
  refresh: "Actualizar",
  refreshTip: "Volver a leer los registros (también se hace solo al volver a esta pantalla)",
  opening: "Abriendo…",
};

export const TODAY_MSG: Record<TodayLang, TodayMessages> = { en, es };
