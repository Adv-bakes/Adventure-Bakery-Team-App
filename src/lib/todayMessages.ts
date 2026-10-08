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
