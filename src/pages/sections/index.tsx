import SectionPlaceholder from "./SectionPlaceholder";

export const SalesPipeline = () => (
  <SectionPlaceholder
    title="Sales Pipeline"
    subtitle="All clients moving through the sales journey."
    stages={["Lead In", "Send Documents", "Follow-Up", "Quote", "First Order"]}
  />
);

export const SalesClients = () => (
  <SectionPlaceholder
    title="Clients"
    subtitle="Search and open any client folder."
  />
);

export const SalesDocumentsInbox = () => (
  <SectionPlaceholder
    title="Documents Inbox"
    subtitle="Incoming PRFs, signed NDAs, completed PSS."
  />
);

export const OpsPipeline = () => (
  <SectionPlaceholder
    title="Operations Pipeline"
    subtitle="Active orders moving from confirmation to production."
    stages={[
      "Order Received & Confirmed",
      "Materials Sourced",
      "Scheduled",
      "Produced",
    ]}
  />
);

export const OpsOrders = () => (
  <SectionPlaceholder
    title="Order Board"
    subtitle="Active orders Kanban. New Order: select company → products → confirm."
    stages={["Confirmed", "In Estimation", "Sourcing", "Scheduled", "In Production", "QC", "Shipped"]}
  />
);

export const OpsFloorExecution = () => (
  <SectionPlaceholder
    title="Floor Execution"
    subtitle="Production schedule, station work cards (Measuring, Mixing, Depositing, Baking, Packaging), and QA sign-off."
  />
);

export const OpsInsights = () => (
  <SectionPlaceholder
    title="Insights"
    subtitle="Cost variance, yield variance, waste factor analysis, and full production reports."
  />
);

export const OpsSchedule = () => (
  <SectionPlaceholder
    title="Production Schedule"
    subtitle="Batches by date and line."
  />
);

export const ComplianceSops = () => (
  <SectionPlaceholder
    title="SOPs Library"
    subtitle="Versioned standard operating procedures."
  />
);

export const ComplianceTraceability = () => (
  <SectionPlaceholder
    title="Production Traceability"
    subtitle="Lot code → ingredients → batch → order → client → shipped."
  />
);

export const ComplianceCertifications = () => (
  <SectionPlaceholder
    title="Certifications"
    subtitle="Audit-ready document archive."
  />
);

export const HrDirectory = () => (
  <SectionPlaceholder
    title="Team Directory"
    subtitle="Employees, roles, contact, emergency info."
  />
);

export const InternalEmail = () => (
  <SectionPlaceholder
    title="Email Inbox"
    subtitle="Curated, important inbound emails only."
  />
);

export const InternalFinance = () => (
  <SectionPlaceholder
    title="Finance"
    subtitle="QuickBooks links and financial reports. Owner only."
  />
);
