import { useEffect, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { ChevronDown, ChevronRight, ExternalLink, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  appendFindingRows, docsForSection, guideDocGroup, sectionOfOption, subSectionsOf,
  type GuideDoc, type GuideDocGroup,
} from "@/lib/auditGuide";
import { loadAuditGuideData } from "@/lib/formResponses";
import type { SelectField } from "@/lib/formSchema";

const GROUPS: { key: GuideDocGroup; title: string }[] = [
  { key: "programs", title: "Programs and procedures - what the site says it does" },
  { key: "records", title: "Records to sample - submitted entries in the last 12 months" },
  { key: "training", title: "Training" },
];

type GuideData = { docs: GuideDoc[]; counts: Map<string, number> };

/**
 * The audit guide under FRM-010's "Sections audited" (SelectField.auditGuide): one panel
 * per ticked section with the Code's sub-sections, the documents whose SQF reference falls
 * in it, and how many entries each form has had - with a button that puts a findings line
 * per sub-section into the grid. Loaded once per mount; nothing here is written until the
 * auditor taps "Add to findings", and that only edits the unsaved entry.
 */
export function SqfSectionGuide({ field, form, disabled }: {
  field: SelectField;
  form: UseFormReturn<Record<string, any>>;
  disabled?: boolean;
}) {
  const guide = field.auditGuide!;
  const watched = useWatch({ control: form.control, name: field.id });
  const chosen: string[] = Array.isArray(watched) ? watched : watched ? [String(watched)] : [];
  // Keep the order of the option list, not the order they were ticked.
  const sections = field.options.filter(o => chosen.includes(o) && sectionOfOption(o));

  const [data, setData] = useState<GuideData | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let live = true;
    loadAuditGuideData()
      .then(d => { if (live) setData(d); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  if (sections.length === 0) return null;

  const addToFindings = (option: string) => {
    const subs = subSectionsOf(sectionOfOption(option)!);
    const { rows, added } = appendFindingRows(form.getValues(guide.findingsGrid), subs, guide.clauseColumn);
    if (added === 0) {
      toast.info("Every sub-section of this section is already in Findings.");
      return;
    }
    form.setValue(guide.findingsGrid, rows, { shouldDirty: true, shouldValidate: false });
    toast.success(`Added ${added} line${added === 1 ? "" : "s"} to Findings - fill in the result and evidence for each.`);
  };

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-semibold text-[#2A1F0E]">What to audit in the sections ticked</p>
      {failed && (
        <p className="text-xs text-red-600">Couldn't load the site's documents for the guide. Reload the page to try again.</p>
      )}
      {sections.map(option => {
        const section = sectionOfOption(option)!;
        const subs = subSectionsOf(section);
        const docs = data ? docsForSection(data.docs, section) : [];
        const isOpen = open[option] ?? false;
        return (
          <div key={option} className="rounded-md border" style={{ borderColor: "rgba(200,155,60,0.35)" }}>
            <button
              type="button"
              onClick={() => setOpen(o => ({ ...o, [option]: !isOpen }))}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#C89B3C]/5"
            >
              {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-[#9A6F1E]" /> : <ChevronRight className="h-4 w-4 shrink-0 text-[#9A6F1E]" />}
              <span className="text-sm font-medium text-[#2A1F0E]">{option}</span>
              <span className="ml-auto text-xs text-[#2A1F0E]/55">
                {subs.length} sub-section{subs.length === 1 ? "" : "s"}
                {data && ` · ${docs.length} document${docs.length === 1 ? "" : "s"}`}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-3 border-t px-3 py-3" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#2A1F0E]/80">What the Code asks - one findings line each</p>
                    {!disabled && subs.length > 0 && (
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => addToFindings(option)}>
                        <ListPlus className="mr-1 h-3.5 w-3.5" /> Add to findings
                      </Button>
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {subs.map(s => (
                      <li key={s.id} className="text-xs text-[#2A1F0E]">
                        <a href={s.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[#9A6F1E] hover:underline">
                          <span className="font-medium">{s.id}</span> {s.title}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                        {s.clauseCount > 0 && <span className="text-[#2A1F0E]/50"> · {s.clauseCount} clause{s.clauseCount === 1 ? "" : "s"}</span>}
                      </li>
                    ))}
                  </ul>
                </div>

                {!data && !failed && <p className="text-xs text-muted-foreground">Loading the site's documents…</p>}
                {data && docs.length === 0 && (
                  <p className="text-xs text-amber-700">No site document references this section yet - that is likely a finding.</p>
                )}
                {data && GROUPS.map(g => {
                  const inGroup = docs.filter(d => guideDocGroup(d.sop_number) === g.key);
                  if (inGroup.length === 0) return null;
                  return (
                    <div key={g.key} className="space-y-1">
                      <p className="text-xs font-semibold text-[#2A1F0E]/80">{g.title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {inGroup.map(d => {
                          const isForm = d.sop_number.toUpperCase().startsWith("FRM-");
                          const n = data.counts.get(d.id) ?? 0;
                          const empty = isForm && d.status === "active" && n === 0;
                          return (
                            <a
                              key={d.id}
                              href={`/team/compliance/sops?doc=${d.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Open ${d.sop_number} in a new tab`}
                              className={cn(
                                "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-[#C89B3C]/10",
                                empty ? "border-amber-500/60 bg-amber-50" : "border-[#C89B3C]/40",
                              )}
                            >
                              <span className="font-medium text-[#9A6F1E]">{d.sop_number}</span>
                              <span className="truncate text-[#2A1F0E]">{d.title}</span>
                              {d.status === "draft" && <span className="rounded bg-[#2A1F0E]/10 px-1 text-[10px] uppercase text-[#2A1F0E]/60">draft</span>}
                              {isForm && (
                                <span className={cn("shrink-0", empty ? "font-medium text-amber-700" : "text-[#2A1F0E]/55")}>· {n}</span>
                              )}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
