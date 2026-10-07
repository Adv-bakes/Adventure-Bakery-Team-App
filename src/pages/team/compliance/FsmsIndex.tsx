// The FSMS Index (D-08, SQF 2.2.1.1; FSQM-010).
//
// Every clause of the SQF Food Safety Code: Food Manufacturing against the documents that cite it,
// read live from each document's SQF reference. It replaces a typed clause-to-document matrix,
// which would be out of date after the next document was issued.
//
// It shows what each document CLAIMS to cover. Whether the document really meets the clause is
// what the internal audit tests, and the page says so.

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, ListTree } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ClauseState, IndexClause, IndexDoc, IndexedDoc, STATE_LABEL, buildFsmsIndex, clauseLines, fsmsIndexRows,
} from "@/lib/fsmsIndex";

const STATES: ClauseState[] = ["issued", "draft", "no_program", "none"];

const STATE_STYLE: Record<ClauseState, string> = {
  issued: "bg-green-500/15 text-green-800 border-green-600/30",
  draft: "bg-[#C89B3C]/20 text-[#7A5714] border-[#C89B3C]/50",
  no_program: "bg-amber-500/20 text-amber-800 border-amber-600/40",
  none: "bg-red-500/15 text-red-800 border-red-600/30",
};

const STATE_HELP: Record<ClauseState, string> = {
  issued: "An issued program, procedure or policy cites the clause.",
  draft: "A program cites the clause, but it is still a draft.",
  no_program: "Only records or training cite the clause; no program states the rule.",
  none: "No document cites the clause.",
};

function DocLink({ d }: { d: IndexedDoc }) {
  const label = d.sop_number ?? d.title;
  return (
    <a
      href={`/team/compliance/sops?doc=${d.id}`}
      target="_blank"
      rel="noreferrer"
      title={`${d.title}${d.status === "draft" ? " (draft)" : ""}${d.exact ? "" : " - cites the whole section"}`}
      className={`font-mono text-xs hover:underline ${d.status === "draft" ? "text-[#9A6F1E] italic" : "text-[#2A1F0E]"}`}
    >
      {label}{d.status === "draft" ? " (draft)" : ""}
    </a>
  );
}

function DocGroup({ label, docs }: { label: string; docs: IndexedDoc[] }) {
  if (docs.length === 0) return null;
  return (
    <p className="text-xs leading-relaxed">
      <span className="text-muted-foreground">{label}: </span>
      {docs.map((d, i) => (
        <span key={d.id}>{i > 0 && ", "}<DocLink d={d} /></span>
      ))}
    </p>
  );
}

function ClauseRow({ c }: { c: IndexClause }) {
  const [open, setOpen] = useState(false);
  const long = c.text.length > 180;
  return (
    <div className="grid gap-x-4 gap-y-1 px-4 py-2.5 border-t md:grid-cols-[5.5rem_1fr_7.5rem]">
      <a href={c.href} target="_blank" rel="noreferrer"
        className="font-mono text-xs font-semibold text-[#9A6F1E] hover:underline" title="Open the Code at this clause">
        {c.id}
      </a>
      <div className="min-w-0 space-y-1">
        <div className="text-sm text-[#2A1F0E]">
          {open || !long ? (
            // The Code prints its numbered items down the page; so does this.
            clauseLines(c.text).map((line, i) => line.marker ? (
              <p key={i} className="flex gap-2 pl-3">
                <span className="shrink-0 w-6 text-right text-muted-foreground">{line.marker}.</span>
                <span>{line.text}</span>
              </p>
            ) : <p key={i}>{line.text}</p>)
          ) : (
            <p>{c.text.slice(0, 180).trimEnd() + "…"}</p>
          )}
          {long && (
            <button type="button" className="text-xs text-[#9A6F1E] hover:underline"
              onClick={() => setOpen((v) => !v)}>
              {open ? "less" : "more"}
            </button>
          )}
        </div>
        <DocGroup label="Programs" docs={c.docs.filter((d) => d.role === "program")} />
        <DocGroup label="Records" docs={c.docs.filter((d) => d.role === "record")} />
        <DocGroup label="Training" docs={c.docs.filter((d) => d.role === "training")} />
      </div>
      <div>
        <span title={STATE_HELP[c.state]}
          className={`inline-block text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${STATE_STYLE[c.state]}`}>
          {STATE_LABEL[c.state]}
        </span>
      </div>
    </div>
  );
}

function downloadCsv(rows: string[][]) {
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `fsms-index-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FsmsIndex() {
  const [docs, setDocs] = useState<IndexDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<ClauseState | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("sop_documents")
        .select("id, sop_number, title, type, status, sqf_reference")
        .in("status", ["active", "draft"])
        .not("sqf_reference", "is", null);
      if (error) toast.error(error.message);
      setDocs((data ?? []) as unknown as IndexDoc[]);
      setLoading(false);
    })();
  }, []);

  const index = useMemo(() => buildFsmsIndex(docs), [docs]);

  const q = search.trim().toLowerCase();
  const filtering = !!q || !!only;
  const matches = (c: IndexClause) =>
    (!only || c.state === only) &&
    (!q || c.id.startsWith(q) || c.text.toLowerCase().includes(q)
      || c.docs.some((d) => `${d.sop_number ?? ""} ${d.title}`.toLowerCase().includes(q)));

  const sections = useMemo(() => index.sections
    .map((s) => ({
      ...s,
      subSections: s.subSections
        .map((sub) => ({ ...sub, clauses: sub.clauses.filter(matches) }))
        .filter((sub) => sub.clauses.length > 0),
    }))
    .filter((s) => s.subSections.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, q, only]);

  const toggle = (id: string) => setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: "#F5F1E6" }}>
          <ListTree className="w-7 h-7 text-[#C89B3C]" />
          FSMS Index
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(245,241,230,0.75)" }}>
          FSMS stands for Food Safety Management System. This page lists every clause of the SQF Food
          Safety Code: Food Manufacturing, with the documents that cite it.
          The list is read from each document's SQF reference, so it is always current. It shows what
          a document says it covers; the internal audit checks that it does.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {STATES.map((s) => (
              <button
                key={s}
                type="button"
                title={STATE_HELP[s]}
                onClick={() => setOnly((v) => (v === s ? null : s))}
                style={{ backgroundColor: "#F5F1E6" }}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border ${STATE_STYLE[s]} ${only === s ? "ring-2 ring-[#C89B3C]" : ""}`}
              >
                {STATE_LABEL[s]} · {index.counts[s]}
              </button>
            ))}
            <span className="text-xs" style={{ color: "rgba(245,241,230,0.75)" }}>of {index.total} clauses</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Search by clause, document number or words…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" size="sm" onClick={() => downloadCsv(fsmsIndexRows(index))}>
              <Download className="w-4 h-4 mr-1" /> Download CSV
            </Button>
          </div>

          {sections.length === 0 && (
            <p className="text-sm" style={{ color: "rgba(245,241,230,0.75)" }}>No clause matches.</p>
          )}

          {sections.map((s) => {
            const open = filtering || openSections.has(s.id);
            const shown = s.subSections.reduce((n, sub) => n + sub.clauses.length, 0);
            return (
              <Card key={s.id} className="overflow-hidden" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-[#F5F1E6] text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#2A1F0E]">
                    <ChevronDown className={`w-4 h-4 transition-transform ${open ? "" : "-rotate-90"}`} />
                    {s.id} {s.title}
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap justify-end">
                    {filtering && <span className="text-[11px] text-muted-foreground">{shown} shown</span>}
                    {STATES.filter((st) => s.counts[st] > 0).map((st) => (
                      <span key={st} title={STATE_LABEL[st]}
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${STATE_STYLE[st]}`}>
                        {s.counts[st]}
                      </span>
                    ))}
                  </span>
                </button>
                {open && s.subSections.map((sub) => (
                  <div key={sub.id}>
                    <p className="px-4 py-1.5 text-xs font-semibold bg-muted/60 border-t text-[#2A1F0E]">
                      {sub.id} {sub.title}
                    </p>
                    {sub.clauses.map((c) => <ClauseRow key={c.id} c={c} />)}
                  </div>
                ))}
              </Card>
            );
          })}

          {index.unmatched.length > 0 && (
            <Card className="p-4" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
              <h2 className="text-sm font-semibold text-[#2A1F0E]">
                References that match no clause ({index.unmatched.length})
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                These documents carry an SQF reference that is not a clause of this Code, so it is not
                counted above. Correct the reference on the document.
              </p>
              <ul className="mt-2 space-y-1">
                {index.unmatched.map((u, i) => (
                  <li key={`${u.doc.id}-${i}`} className="text-xs">
                    <a href={`/team/compliance/sops?doc=${u.doc.id}`} target="_blank" rel="noreferrer"
                      className="font-mono hover:underline text-[#2A1F0E]">
                      {u.doc.sop_number ?? u.doc.title}
                    </a>
                    <span className="text-muted-foreground"> cites "{u.token}"</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
