// Every sentence the voice feature shows a person, in each language.
//
// The English entries are the exact strings the feature shipped with; the tests pin some of them.
// Spanish uses "usted", and names the English form's controls and values in parentheses - "toque
// Save Draft", "NO APROBADO (Fail)" - because the form itself stays in English and the operator has to
// find the same words on it.
//
// Pure, relative imports only.

import type { VoiceLang } from "./voiceLexicon";

export interface VoiceMessages {
  noCommand(titles: string[]): string;
  missing(heardAs: string, names: string[]): string;
  badValue(heard: string, name: string, range: [number, number]): string;

  lotCheck(lot: string): string;
  bakeTempMiss(temp: number, limit: number): string;
  bakeTimeMiss(minutes: number, limit: number): string;
  bakeFail(saidPass: boolean, misses: string[]): string;
  spokenFail: string;
  vacuumUnjudged: string;
  pickCheck: string;
  vacuumHigh(vacuum: number): string;
  sealFail(visual: boolean, pull: boolean): string;

  limitsChanged: string;
  noTable(gridId: string): string;
  noColumn(key: string): string;
  noInitials: string;
  productMismatch(current: string, spoken: string): string;
  dateMismatch(date: string, today: string): string;

  summary: {
    product: string; lot: string; ovenTemp: string; bakeTime: string; withinLimits: string;
    check: string; vacuum: string; visual: string; pull: string;
    pass: string; fail: string; pickInForm: string;
    temp(t: number): string; minutes(m: number): string; inches(v: number): string;
    checkValue(option: string): string;
  };

  panel: {
    title: string; intro: string; language: string; noSpeech: string; listening: string; tapToStart: string;
    startListening: string; stopListening: string; tryAgain: string; sayRest: string; heard(t: string): string;
    productionDate: string; cutShort: string; otherProduct(form: string): string; addTo(product: string): string;
    noProduct: string; startNew(product: string): string; open(form: string): string;
    typeInstead: string; hideTyped: string; useLine: string; placeholder: string; print: string;
    leaveConfirm: string; openFailed: string;
  };

  banner: {
    addedLead: string; addedBody(row: number, grid: string): string; addedTail: string; heard(t: string): string;
    goToSection3: string; undo: string; dismiss: string;
    refusedSubmitted: string; refusedNotMine: string; stale: string; reload: string;
  };

  card: { intro: string; example: string; optional: string; footer(version: number, form: string, printed: string): string };

  speech: {
    blocked: string; noSpeech: string; noMic: string; network: string; langNotSupported: string;
    unsupportedBrowser: string; generic(code: string): string;
  };
}

const joinAnd = (items: string[], and: string) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const EN: VoiceMessages = {
  noCommand: titles => `I didn't hear a command. Start with ${titles.map(t => `"Create a ${t}"`).join(" or ")}.`,
  missing: (heardAs, names) => `I heard ${heardAs} but not the ${joinAnd(names, "and")}. Say the whole line again, or tap "Say the rest".`,
  badValue: (heard, name, range) => `I heard ${heard} for the ${name.toLowerCase()}, which is outside ${range[0]}–${range[1]}. Say the line again.`,

  lotCheck: lot => `Check the lot code "${lot}" against the label before saving.`,
  bakeTempMiss: (t, l) => `oven temperature ${t}°F is below the ${l}°F limit`,
  bakeTimeMiss: (m, l) => `bake time ${m} minutes is under the ${l}-minute limit`,
  bakeFail: (saidPass, misses) =>
    `${saidPass ? "You said Passed, but the " : "The "}${misses.join(" and ")}. Recorded as FAIL. Do not release this load - follow Section 3.`,
  spokenFail: "You said Failed. The readings are within the limits, but the row is recorded as FAIL as you said. Add a note saying why, and follow Section 3.",
  vacuumUnjudged: "The vacuum limit is not yet confirmed for this machine, so the reading is recorded but not judged.",
  pickCheck: "Pick the check type in the row: Set-up, Hourly, After a change or adjustment, or End of run.",
  vacuumHigh: v => `A vacuum reading of ${v} in. Hg is higher than a sealer can pull. Was it misheard? Check the gauge.`,
  sealFail: (visual, pull) => {
    const failed = [visual ? "the visual check" : "", pull ? "the pull test" : ""].filter(Boolean);
    return capitalise(`${failed.join(" and ")} failed. Stop sealing, hold everything sealed since the last check that passed, and follow Section 3.`);
  },

  limitsChanged: "The critical limits printed on this form have changed, so the app has not judged Pass or Fail. Judge this row against the form's limits yourself.",
  noTable: g => `This entry has no "${g}" table, so the spoken reading could not be added. It may have been filled on an older revision of the form.`,
  noColumn: k => `This form has no "${k}" column, so that part of the line was not recorded.`,
  noInitials: "Your initials could not be filled in - add them to the row.",
  productMismatch: (c, s) => `This record is for "${c}", but you said "${s}". The row was added here - check it is the right record.`,
  dateMismatch: (d, t) => `This record is dated ${d}, not today (${t}). Check it is the right record.`,

  summary: {
    product: "Product", lot: "Lot", ovenTemp: "Oven temperature", bakeTime: "Bake time",
    withinLimits: "Within critical limits", check: "Check", vacuum: "Vacuum gauge", visual: "Visual",
    pull: "Pull test", pass: "PASS", fail: "FAIL", pickInForm: "— pick in the form",
    temp: t => `${t}°F`, minutes: m => `${m} min`, inches: v => `${v} in. Hg`, checkValue: o => o,
  },

  panel: {
    title: "Record a CCP check by voice",
    intro: "Tap the microphone and read the line from the card on the wall. The record opens with the row filled in - check it, then tap Save Draft.",
    language: "Language",
    noSpeech: "This browser has no speech recognition. Use Chrome on the tablet, or type the line below.",
    listening: "Listening - read the line now…",
    tapToStart: "Tap to start",
    startListening: "Start listening",
    stopListening: "Stop listening",
    tryAgain: "Try again",
    sayRest: "Say the rest",
    heard: t => `Heard: "${t}"`,
    productionDate: "Production date",
    cutShort: " · the line may have been cut short - check every value",
    otherProduct: f => `You already have a ${f} record today for a different product. Where should this row go?`,
    addTo: p => `Add to the record for "${p}"`,
    noProduct: "no product",
    startNew: p => `Start a new record for "${p}"`,
    open: f => `Open ${f}`,
    typeInstead: "Type the line instead",
    hideTyped: "Hide the typed line",
    useLine: "Use this line",
    placeholder: "e.g. Create a CCP Baking Record for Product …, Lot …, Temperature 350 for 27 minutes.",
    print: "Print the wall script",
    leaveConfirm: "The form you have open has unsaved changes. Leave it without saving?",
    openFailed: "Could not open the record",
  },

  banner: {
    addedLead: "Added by voice.",
    addedBody: (row, grid) => ` Check row ${row} of ${grid} — especially the lot code — then tap `,
    addedTail: ". Nothing is saved until you do.",
    heard: t => `Heard: "${t}"`,
    goToSection3: "Go to Section 3",
    undo: "Undo",
    dismiss: "Dismiss",
    refusedSubmitted: "This record has been submitted, so the spoken reading could not be added. Ask an admin to reopen it.",
    refusedNotMine: "This record belongs to someone else, so the spoken reading could not be added to it.",
    stale: "This record was saved somewhere else while the spoken row was waiting, so it could not be saved over it.",
    reload: "Reload and add the row again",
  },

  card: {
    intro: "Tap the Manufacturing Coach button (bottom right), then the microphone, and read:",
    example: "Example: ",
    optional: " (optional)",
    footer: (v, f, p) => `Voice script v${v} · ${f} · printed ${p}`,
  },

  speech: {
    blocked: "The microphone is blocked. In Chrome, tap the lock icon beside the address, allow Microphone, then try again.",
    noSpeech: "I didn't hear anything. Tap the microphone and read the line.",
    noMic: "No microphone was found on this device.",
    network: "Voice recognition needs an internet connection. Check the Wi-Fi, or type the line below.",
    langNotSupported: "This device can't recognise speech in this language. Switch language, or type the line below.",
    unsupportedBrowser: "This browser has no speech recognition. Use Chrome, or type the line below.",
    generic: c => `Voice recognition stopped (${c}). Try again, or type the line below.`,
  },
};

const ES_CHECK_LABEL: Record<string, string> = {
  "Set-up": "Arranque (Set-up)",
  "Hourly": "Cada hora (Hourly)",
  "After a change or adjustment": "Después de un ajuste (After a change or adjustment)",
  "End of run": "Fin de corrida (End of run)",
};

const joinNi = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ni ${items[items.length - 1]}`;

const ES: VoiceMessages = {
  noCommand: titles => `No escuché un comando. Empiece con ${titles.map(t => `"${t}"`).join(" o ")}.`,
  missing: (heardAs, names) => `Escuché ${heardAs}, pero no escuché ${joinNi(names)}. Diga toda la línea otra vez, o toque "Decir lo que falta".`,
  badValue: (heard, name, range) => `Escuché ${heard} para ${name}, que está fuera de ${range[0]}–${range[1]}. Diga la línea otra vez.`,

  lotCheck: lot => `Compare el código de lote "${lot}" con la etiqueta antes de guardar.`,
  bakeTempMiss: (t, l) => `la temperatura del horno de ${t} °F está por debajo del límite de ${l} °F`,
  bakeTimeMiss: (m, l) => `el tiempo de horneado de ${m} minutos es menor que el límite de ${l} minutos`,
  bakeFail: (saidPass, misses) =>
    `${saidPass ? `Usted dijo Aprobado, pero ${misses.join(" y ")}.` : `${capitalise(misses.join(" y "))}.`} Se registró como NO APROBADO (Fail). No libere esta hornada: siga la Sección 3.`,
  spokenFail: "Usted dijo Rechazado. Las lecturas están dentro de los límites, pero la fila se registró como NO APROBADO (Fail), como usted dijo. Agregue una nota explicando por qué y siga la Sección 3.",
  vacuumUnjudged: "El límite de vacío todavía no está confirmado para esta máquina, así que la lectura se registra pero no se evalúa.",
  pickCheck: "Elija el tipo de revisión en la fila: Set-up (arranque), Hourly (cada hora), After a change or adjustment (después de un ajuste) o End of run (fin de corrida).",
  vacuumHigh: v => `Una lectura de vacío de ${v} pulg. Hg es más de lo que una selladora puede alcanzar. ¿Se escuchó mal? Revise el manómetro.`,
  sealFail: (visual, pull) => {
    const what = visual && pull ? "La inspección visual y la prueba de jalón fallaron."
      : visual ? "La inspección visual falló." : "La prueba de jalón falló.";
    return `${what} Detenga el sellado, retenga todo lo sellado desde la última revisión aprobada y siga la Sección 3.`;
  },

  limitsChanged: "Los límites críticos impresos en este formulario cambiaron, así que la app no evaluó si pasó o no. Evalúe esta fila usted mismo con los límites del formulario.",
  noTable: g => `Este registro no tiene la tabla "${g}", así que no se pudo agregar la lectura. Puede que se haya llenado con una revisión anterior del formulario.`,
  noColumn: k => `Este formulario no tiene la columna "${k}", así que esa parte de la línea no se registró.`,
  noInitials: "No se pudieron llenar sus iniciales; agréguelas a la fila.",
  productMismatch: (c, s) => `Este registro es para "${c}", pero usted dijo "${s}". La fila se agregó aquí; confirme que es el registro correcto.`,
  dateMismatch: (d, t) => `Este registro tiene fecha ${d}, no de hoy (${t}). Confirme que es el registro correcto.`,

  summary: {
    product: "Producto", lot: "Lote", ovenTemp: "Temperatura del horno", bakeTime: "Tiempo de horneado",
    withinLimits: "Dentro de los límites críticos", check: "Revisión", vacuum: "Manómetro de vacío",
    visual: "Visual", pull: "Prueba de jalón", pass: "APROBADO (Pass)", fail: "NO APROBADO (Fail)",
    pickInForm: "— elíjalo en el formulario",
    temp: t => `${t} °F`, minutes: m => `${m} min`, inches: v => `${v} pulg. Hg`,
    checkValue: o => ES_CHECK_LABEL[o] ?? o,
  },

  panel: {
    title: "Registrar una revisión PCC por voz",
    intro: "Toque el micrófono y lea la línea del cartel de la pared. El registro se abre con la fila llena: revísela y toque Save Draft.",
    language: "Idioma",
    noSpeech: "Este navegador no reconoce voz. Use Chrome en la tableta, o escriba la línea abajo.",
    listening: "Escuchando: lea la línea ahora…",
    tapToStart: "Toque para empezar",
    startListening: "Empezar a escuchar",
    stopListening: "Dejar de escuchar",
    tryAgain: "Intentar de nuevo",
    sayRest: "Decir lo que falta",
    heard: t => `Escuchado: "${t}"`,
    productionDate: "Fecha de producción",
    cutShort: " · puede que la línea se haya cortado: revise cada valor",
    otherProduct: f => `Ya tiene un registro ${f} de hoy para otro producto. ¿Dónde va esta fila?`,
    addTo: p => `Agregar al registro de "${p}"`,
    noProduct: "sin producto",
    startNew: p => `Empezar un registro nuevo para "${p}"`,
    open: f => `Abrir ${f}`,
    typeInstead: "Escribir la línea",
    hideTyped: "Ocultar la línea escrita",
    useLine: "Usar esta línea",
    placeholder: "p. ej. Registro de horneado, producto …, lote …, temperatura 350 grados por 27 minutos.",
    print: "Imprimir el cartel de la pared",
    leaveConfirm: "El formulario abierto tiene cambios sin guardar. ¿Salir sin guardar?",
    openFailed: "No se pudo abrir el registro",
  },

  banner: {
    addedLead: "Agregado por voz.",
    addedBody: (row, grid) => ` Revise la fila ${row} de ${grid} (sobre todo el código de lote) y toque `,
    addedTail: ". No se guarda nada hasta que lo haga.",
    heard: t => `Escuchado: "${t}"`,
    goToSection3: "Ir a la Sección 3",
    undo: "Deshacer",
    dismiss: "Cerrar",
    refusedSubmitted: "Este registro ya se envió, así que no se pudo agregar la lectura. Pida a un administrador que lo vuelva a abrir.",
    refusedNotMine: "Este registro es de otra persona, así que no se pudo agregar la lectura.",
    stale: "Este registro se guardó en otro lugar mientras la fila esperaba, así que no se pudo guardar encima.",
    reload: "Volver a cargar y agregar la fila otra vez",
  },

  card: {
    intro: "Toque el botón del Manufacturing Coach (abajo a la derecha), luego el micrófono, y lea:",
    example: "Ejemplo: ",
    optional: " (opcional)",
    footer: (v, f, p) => `Guion de voz v${v} · ${f} · impreso ${p}`,
  },

  speech: {
    blocked: "El micrófono está bloqueado. En Chrome, toque el candado junto a la dirección, permita el Micrófono y vuelva a intentar.",
    noSpeech: "No escuché nada. Toque el micrófono y lea la línea.",
    noMic: "No se encontró un micrófono en este dispositivo.",
    network: "El reconocimiento de voz necesita internet. Revise el Wi-Fi, o escriba la línea abajo.",
    langNotSupported: "Este dispositivo no reconoce voz en español. Cambie a English, o escriba la línea abajo.",
    unsupportedBrowser: "Este navegador no reconoce voz. Use Chrome, o escriba la línea abajo.",
    generic: c => `El reconocimiento de voz se detuvo (${c}). Intente de nuevo, o escriba la línea abajo.`,
  },
};

export const VOICE_MSG: Record<VoiceLang, VoiceMessages> = { en: EN, es: ES };
