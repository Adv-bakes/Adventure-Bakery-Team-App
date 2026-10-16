// The form's own printed reference tables (reference_table fields), handed down to the grid cells so
// a column can offer a table's rows as its pick-list (GridColumn.pickFromTable). FormRenderer provides
// it from the schema on screen; a grid rendered without it simply has nothing to offer.

import { createContext, useContext } from "react";

export type ReferenceTables = Record<string, { label?: string; columns: string[]; rows: string[][] }>;

export const ReferenceTablesContext = createContext<ReferenceTables>({});

export const useReferenceTables = () => useContext(ReferenceTablesContext);
