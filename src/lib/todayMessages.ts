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
  };
  recordSealChecks: string;
  ccpTodayNone: string;
  ccpBakingToday(n: number): string;
  ccpSealingToday(n: number): string;
  receiving: string;
  receiveDelivery: string;
  lastReceipt(date: string, lines: number, suppliers: string): string;
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
    lastBatchHelp: "This product's sealing and boxing checks are finished for today.",
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
  pack: {
    button: "Record packing",
    doneTip: "Record packing - first pack checked and counts entered",
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
  },
  recordSealChecks: "Record seal checks (FRM-606)",
  ccpTodayNone: "No CCP record started today.",
  ccpBakingToday: n => n === 0 ? "Today's baking record is open." : `Today's baking record has ${n} oven load${n === 1 ? "" : "s"}.`,
  ccpSealingToday: n => `${n} sealing record${n === 1 ? "" : "s"} today.`,
  receiving: "Receiving",
  receiveDelivery: "Receive a delivery (FRM-301)",
  lastReceipt: (date, lines, suppliers) => `Last receiving log ${date}: ${lines} line${lines === 1 ? "" : "s"}${suppliers ? ` from ${suppliers}` : ""}.`,
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
    lastBatchHelp: "Las revisiones de sellado y de empaque de este producto ya terminaron por hoy.",
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
  pack: {
    button: "Registrar empaque",
    doneTip: "Registrar empaque - primer empaque revisado y conteos anotados",
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
  },
  recordSealChecks: "Registrar las revisiones de sellado (FRM-606)",
  ccpTodayNone: "Hoy no se ha empezado ningún registro de PCC.",
  ccpBakingToday: n => n === 0 ? "El registro de horneado de hoy está abierto." : `El registro de horneado de hoy tiene ${n} hornada${n === 1 ? "" : "s"}.`,
  ccpSealingToday: n => `${n} registro${n === 1 ? "" : "s"} de sellado hoy.`,
  receiving: "Recepción",
  receiveDelivery: "Recibir una entrega (FRM-301)",
  lastReceipt: (date, lines, suppliers) => `Última recepción ${date}: ${lines} línea${lines === 1 ? "" : "s"}${suppliers ? ` de ${suppliers}` : ""}.`,
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
