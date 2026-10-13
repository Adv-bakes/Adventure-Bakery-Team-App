// "Records" on a finished lot's row of the Today page (owner's request, 2026-10-12): the lot's
// records in the order they were made, each with its name and form number, to open and read.
//
// It is the Release menu's list (today.ts releaseSteps) plus the dispatch, with one difference:
// it only ever OPENS a record. Nothing is started or filled in from here - the lot is finished, and
// a record that was never made is not made up afterwards. So it is safe for everyone to have.

import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDashed, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { LotRecordLine } from "@/lib/today";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

export function LotRecordsButton({ lines, lang }: { lines: LotRecordLine[]; lang: TodayLang }) {
  const R = TODAY_MSG[lang].records;
  const S = TODAY_MSG[lang].releaseSteps;
  const icon = (l: LotRecordLine) => l.state === "done"
    ? <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-700 shrink-0" />
    : l.state === "open"
      ? <AlertTriangle className="w-4 h-4 mr-2 text-amber-600 shrink-0" />
      : <CircleDashed className="w-4 h-4 mr-2 opacity-60 shrink-0" />;
  const status = (l: LotRecordLine) => l.sample
    ? (l.sample.stage === "started" ? R.draft : l.sample.stage === "on_shelf" ? S.sampleOnShelf(l.sample.discardDue) : S.sampleDisposed)
    : l.state === "done" ? R.submitted : l.state === "open" ? R.draft : R.none;
  const row = (l: LotRecordLine, i: number) => (
    <>
      {icon(l)}
      <span className="flex-1">
        <span className="block">{i + 1}. {R.name[l.key]}</span>
        <span className={`block text-xs ${l.state === "open" ? "text-amber-700" : "opacity-70"}`}>{status(l)}</span>
      </span>
    </>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <FolderOpen className="w-4 h-4 mr-1" />{R.button}
          <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[22rem]">
        <DropdownMenuLabel className="text-xs font-normal opacity-80">{R.heading}</DropdownMenuLabel>
        {lines.map((l, i) => l.entryId && l.docId ? (
          <DropdownMenuItem key={l.key} asChild className="items-start cursor-pointer">
            <Link to={`/team/compliance/forms/${l.docId}/entries/${l.entryId}?from=today`}>{row(l, i)}</Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem key={l.key} disabled className="items-start">{row(l, i)}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
