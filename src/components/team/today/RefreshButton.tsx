// The refresh icon beside the title of the Today page and the lot / batch pages (useRefreshOnReturn).

import { RefreshCw } from "lucide-react";

export function RefreshButton({ onClick, spinning, label, tip }: {
  onClick: () => void; spinning: boolean; label: string; tip: string;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={spinning} title={tip} aria-label={label}
      className="inline-flex items-center justify-center rounded-full border border-[#F5F1E6]/40 bg-black/25 p-1.5 align-middle text-[#F5F1E6] hover:bg-black/50 disabled:opacity-70"
    >
      <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
    </button>
  );
}
