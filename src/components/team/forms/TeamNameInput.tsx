// A name cell that offers the team directory (GridColumn.teamPick - FRM-953's attendee name).
//
// It is the browser's own list (<datalist>), not a drawn one: the grid sits in a box that scrolls
// sideways, which would clip a drawn list, and the native one also works with a tablet keyboard.
// The list is an offer - a contractor or a temporary worker is typed in as before.
//
// The names load once per page load and are shared by every cell. If they cannot be read the cell
// is simply a text box.

import { useEffect, useId, useState } from "react";
import { useController, type Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { loadTeamDirectoryNames, type TeamDirectoryName } from "@/lib/formResponses";

let cache: Promise<TeamDirectoryName[]> | null = null;
const teamNames = () => (cache ??= loadTeamDirectoryNames().catch(() => { cache = null; return []; }));

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface TeamNameInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** With `titlePath`, the row's title cell is filled when a listed name is entered and it is empty. */
  control?: Control<Record<string, any>>;
  titlePath?: string;
}

export function TeamNameInput({ control, titlePath, ...rest }: TeamNameInputProps) {
  return control && titlePath
    ? <WithTitle control={control} titlePath={titlePath} {...rest} />
    : <NameInput {...rest} />;
}

function WithTitle({ control, titlePath, ...rest }: TeamNameInputProps & { control: Control<Record<string, any>>; titlePath: string }) {
  const { field: title } = useController({ control, name: titlePath });
  return (
    <NameInput
      {...rest}
      // Only an empty cell is filled: a title somebody typed is never replaced.
      onMatch={(person) => { if (person.title && !String(title.value ?? "").trim()) title.onChange(person.title); }}
    />
  );
}

function NameInput({ value, onChange, className, onMatch }: TeamNameInputProps & { onMatch?: (p: TeamDirectoryName) => void }) {
  const listId = useId();
  const [people, setPeople] = useState<TeamDirectoryName[]>([]);
  useEffect(() => {
    let live = true;
    teamNames().then(p => { if (live) setPeople(p); });
    return () => { live = false; };
  }, []);

  return (
    <>
      <Input
        className={className}
        value={value ?? ""}
        list={listId}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          const person = people.find(p => same(p.name, v));
          if (person) onMatch?.(person);
        }}
      />
      <datalist id={listId}>
        {people.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
      </datalist>
    </>
  );
}
