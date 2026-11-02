/** 28-field layout supplied with the October 21 eligibility guide. */
export type EligibilityIssue = { row: number; field: string; message: string };
const STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI AA AE AP".split(" "));
const LENGTHS = [3, 15, 1, 20, 4, 12, 2, 0, 33, 33, 21, 2, 5, 4, 10, 10, 2, 10, 8, 8, 8, 1, 1, 0, 1, 64, 100, 1];
const FIELDS = ["title", "firstName", "middleName", "lastName", "suffix", "uniqueId", "seqNum", "filler", "address", "address2", "city", "state", "zip", "plus4", "homePhone", "workPhone", "coverage", "groupCode", "termDate", "effectiveDate", "dateOfBirth", "relationship", "studentStatus", "filler", "gender", "email", "reportingSegment", "guardian"];

export function isPipeEligibility(content: string): boolean {
  const first = content.replace(/^\uFEFF/, "").split(/\r?\n/).find(line => line.trim());
  return Boolean(first && (first.trimStart().startsWith("|") || first.split("|").length >= 20));
}

export function isMmddyyyy(value: string): boolean {
  if (!/^\d{8}$/.test(value)) return false;
  const iso = `${value.slice(4)}-${value.slice(0, 2)}-${value.slice(2, 4)}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === iso;
}

/** Errors identify fields and data-row numbers, never member identifiers or values. */
export function validatePipeEligibility(content: string, options: { requireEmail?: boolean; requireFirstOfMonth?: boolean } = {}): EligibilityIssue[] {
  const errors: EligibilityIssue[] = [];
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  const tuples = new Set<string>();
  let currentHousehold: string | undefined;
  for (const [index, line] of lines.entries()) {
    const row = index + 1;
    const issue = (field: string, message: string) => errors.push({ row, field, message: `Row ${row}: ${message}` });
    const cells = line.split("|").map(value => value.trim());
    if (cells.length !== 28) {
      issue("layout", `expected 28 fields (27 pipes), found ${cells.length} fields`);
      // A malformed primary must not let following dependents attach to an earlier family.
      currentHousehold = undefined;
      continue;
    }
    cells.forEach((value, column) => {
      if (LENGTHS[column] && value.length > LENGTHS[column]) issue(FIELDS[column], `${FIELDS[column]} exceeds ${LENGTHS[column]} characters`);
      if (/^(?:N\/A|NULL)$/i.test(value)) issue(FIELDS[column], `${FIELDS[column]} must be blank instead of a placeholder`);
    });
    for (const column of [1, 3, 5, 6, 8, 10, 11, 12, 16, 17, 19, 20, 27]) {
      if (!cells[column]) issue(FIELDS[column], `${FIELDS[column]} is required`);
    }
    if (cells[5] && !/^\d{1,12}$/.test(cells[5])) issue("uniqueId", "Unique ID must contain only digits, up to 12 characters; never use an SSN");
    if (cells[6] && !/^\d{2}$/.test(cells[6])) issue("seqNum", "Sequence Number must be two digits (00 for the primary)");
    if (cells[7] || cells[23]) issue("filler", "Filler fields must be empty");
    if (cells[11] && !STATES.has(cells[11])) issue("state", "State must be a valid two-letter uppercase postal code");
    if (cells[12] && !/^\d{5}$/.test(cells[12])) issue("zip", "Zip must contain five digits");
    if (cells[13] && !/^\d{4}$/.test(cells[13])) issue("plus4", "Plus 4 must contain four digits");
    for (const column of [14, 15]) if (cells[column] && !/^\d{10}$/.test(cells[column])) issue(FIELDS[column], `${FIELDS[column]} must contain ten digits`);
    if (cells[16] && !["MO", "MS", "MD", "MF"].includes(cells[16])) issue("coverage", "Coverage must be MO, MS, MD or MF");
    for (const column of [18, 19, 20]) {
      if (cells[column] && !isMmddyyyy(cells[column])) issue(FIELDS[column], `${FIELDS[column]} must be a real date in MMDDYYYY format`);
    }
    if (options.requireFirstOfMonth !== false && isMmddyyyy(cells[19]) && cells[19].slice(2, 4) !== "01") issue("effectiveDate", "Effective Date must be the first day of a month");
    if (cells[24] && !["M", "F"].includes(cells[24])) issue("gender", "Gender must be M or F when supplied");
    if (cells[27] && !["0", "1"].includes(cells[27])) issue("guardian", "Guardian must be 0 or 1");
    if (cells[25] && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(cells[25])) issue("email", "Email Address is invalid");
    if (options.requireEmail !== false && cells[6] === "00" && !cells[25]) issue("email", "Email Address is required for primary e-fulfillment");
    const household = `${cells[5]}|${cells[17]}`;
    const tuple = `${household}|${cells[6]}`;
    if (tuples.has(tuple)) issue("seqNum", "Duplicate member ID, sequence and group combination");
    tuples.add(tuple);
    if (cells[6] === "00") currentHousehold = household;
    else {
      if (!currentHousehold || currentHousehold !== household) issue("uniqueId", "Dependent must follow its primary and share the primary's Unique ID and Group Code");
      if (!["S", "C", "O"].includes(cells[21])) issue("relationship", "Dependent Relation must be S, C or O");
      if (cells[22] && !["Y", "N"].includes(cells[22])) issue("studentStatus", "Student Status must be Y or N when supplied");
    }
  }
  return errors;
}
