-- D-36: FSQM-037 - waste goes out at the end of the DAY, not at the end of each run.
--
-- Owner, 2026-09-28, reading the PDF: "Take out the part about it being at the end of each run. If the
-- bin is not filled, we would tie the plastic lining at the end of the day, but not necessarily taken to
-- the dumpster." Asked what happens to food waste, the owner confirmed it goes out the same day.
--
-- So: the liner is tied off at the end of the day and taken out then; a bin that fills during the day is
-- taken out when it fills; and anything from the food process goes out the same day it is made, which is
-- the limb 11.8.1.2 actually protects. The "end of each run" wording is removed from the responsibility
-- line and from the taking-waste-out Part, and the bin line no longer says bins must not stand full
-- overnight when what is meant is that they must not overflow.
--
-- Draft content edit, guarded on the md5 of the whole content.

begin;

do $guard$
declare h text; st text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-037';
  if st is distinct from 'draft' or h <> '8bd00706edb2fab61a213a6e5f84ba3a' then
    raise exception 'FSQM-037 is % or changed since this migration was written (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents
   set content = content || jsonb_build_object(
         'procedure',        $t$["Waste inside the building", "• Each production and packaging area has a bin for its waste. Bins are lined, are emptied before they overflow, and are never left standing full or overflowing overnight (SQF 11.8.1.2).", "• Bins that hold food waste are kept covered when not in use.", "• Every bin is lined, and the liner is replaced each time the bin is emptied, so waste does not touch the bin itself.", "• Dry waste: trimmings, rejected or damaged product, empty ingredient packaging, spoiled pouches, and used packaging materials (SQF 11.8.1.5).", "• Waste is never put on a product-contact surface, never sits on a stock rack, and never travels through the dry storage room with open product.", "• A bin is washed and sanitised when it needs it - when a liner leaks or splits, when anything is spilled into the bin, and whenever it is found soiled - not to a schedule (SQF 11.8.1.4).", "> THE LINER IS THE CONTROL AND THE INSPECTION IS WHAT MAKES IT REGULAR. 11.8.1.4 asks for collection bins to be cleaned and sanitised regularly. Here waste does not touch the bin, so washing on a calendar would clean bins that are already clean and would still miss the one that a split liner soiled on the day after it was washed. Instead every bin is looked at on the monthly GMP inspection, and one that is soiled is washed then and the finding recorded. Condition decides, and the inspection is what stops 'as necessary' from meaning 'never'.", "Taking waste out", "• At the end of the day the liner is tied off and taken out to the lidded dumpster outside. A bin that fills during the day is tied off and taken out then, rather than being pressed down or left to overflow (SQF 11.8.1.1, 11.8.1.2).", "• Waste holding anything from the food process - trimmings, rejected product, syrup-soaked material - goes out the same day it is made, whether or not the bin is full. Nothing that can attract pests or sour stays in the building overnight.", "• The dumpster is provided and emptied by the building's waste service, not by a contract the site holds. The site's part is to keep its own waste bagged and the lid closed, and to tell the landlord if the dumpster is overfull or not being emptied (SQF 11.8.1.6).", "• The lid stays closed. An open dumpster beside a food plant is a pest attractant, and the dumpster stands away from the doors (SQF 11.8.1.8).", "• Anyone handling waste washes their hands before returning to production (FSQM-012).", "Liquid waste", "• Wash water from cleaning goes to the sink and the floor drain (SQF 11.8.1.3, 11.8.1.9).", "• Small amounts of leftover syrup go down the drain with plenty of water behind them. Larger amounts go into a closed container, and the closed container goes into the dumpster - never a loose or open container, and never poured out where it can stand (SQF 11.8.1.9).", "• No liquid waste is held on site overnight in an open container.", "Trademarked material - what is high-risk here, and what is not", "> 11.8.1.6 asks for controlled disposal of trademarked waste WHERE APPLICABLE and where it is CONSIDERED HIGH-RISK for handling or other reasons. The site decides which of its trademarked waste that is, and this Part is that decision.", "• NOT HIGH-RISK, and disposed of as ordinary waste: bulk printed packaging that carries brand artwork only and no product identity - film rolls, plain printed cartons and master cases. It goes out whole, in the dumpster or to recycling, with nothing done to it first.", "> WHY. To misuse a roll of printed film somebody would need the same product, the same machine and the same customer, and the roll carries no lot code, no best-by date and no allergen statement. Unrolling hundreds or thousands of feet to tear through it would be a gesture, not a control, and a control nobody can perform is one the site would be found not performing.", "• HIGH-RISK, and defaced before it goes out: anything carrying PRODUCT IDENTITY - a lot code, a best-by date, an allergen statement or a label ready to apply. Spoiled and mis-printed labels, coded cartons and coded master cases are torn or marked through the code and the brand so they cannot be read or re-used (SQF 11.8.1.6).", "> WHY THESE ARE DIFFERENT. Identity is the part that can be reapplied: a printed label carrying a customer's brand and a lot code can be taken out of a shared dumpster and put on something the site never made, and it is a traceability exercise's worst answer. Defacing one takes a second, which is the whole argument for keeping it.", "• A CUSTOMER'S PACKAGING AGREEMENT OVERRIDES this determination. Where a customer requires their branded material to be destroyed or returned, that is done for that customer and their instruction is kept with the agreement.", "• This determination is reviewed when the packaging changes, when a customer sets a requirement, and with the food defence and food fraud assessment, which looks at counterfeit packaging from the other direction.", "What does not apply here", "• No waste leaves this site as animal feed, so no denaturant is used and 11.8.1.7 does not engage.", "• The site holds no waste disposal contract of its own; the building's service collects. If the site ever contracts one, its performance is reviewed at least annually and recorded on FRM-206 (SQF 11.8.1.6).", "Checks and review", "• Waste handling, the bins and the dumpster area are checked on the monthly GMP inspection (FRM-913, row 11.8.1), and anything found is recorded and corrected there (SQF 11.8.1.10, 2.5.4.3).", "• A repeated finding - an overflowing dumpster, waste left standing, labels going out intact - is raised as a corrective action on FRM-007 under FSQM-009."]$t$::jsonb,
         'responsibility',   $t$Production staff - keep waste in the bins provided, tie off the liner and take the waste out at the end of the day, and deface anything carrying product identity before it goes out.
Management team - keeps the bins serviceable, and raises anything the building's waste service is not doing with the landlord.
SQF Practitioner - checks waste handling and the dumpster area on the monthly GMP inspection.$t$::text,
         'revision_history', (content->>'revision_history') || $t$

WASTE GOES OUT AT THE END OF THE DAY, NOT AT THE END OF EACH RUN (owner, 2026-09-28, reading the issued PDF). The first draft had waste taken out at the end of each run as well. It is not: the liner is tied off at the end of the day and taken out then, and a bin that fills during the day is taken out when it fills. Food waste still goes out the same day it is made, which is what 11.8.1.2 is protecting - waste building up in a food handling area - and the owner confirmed that is what happens.$t$)
 where sop_number = 'FSQM-037';

do $verify$
declare c jsonb;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-037';
  if jsonb_array_length(c->'procedure') <> 32 then
    raise exception 'FSQM-037 procedure is % lines, expected 32.', jsonb_array_length(c->'procedure');
  end if;
  if (c->'procedure')::text like '%end of each run%' or (c->>'responsibility') like '%end of each run%' then
    raise exception 'FSQM-037 still tells staff to take waste out at the end of each run.';
  end if;
  if (select count(*) from jsonb_array_elements_text(c->'procedure') l
       where l like '%goes out the same day it is made%') <> 1 then
    raise exception 'the food-waste same-day rule is missing.';
  end if;
end $verify$;

commit;
