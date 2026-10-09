/** The journal entry types the app understands. Keep in sync with ENTRY_TYPES in components/TankJournal.jsx. */
export const ENTRY_TYPE_KEYS = ["parameters", "changes", "observations", "medical", "co2"];

export function isValidEntryType(type) {
  return ENTRY_TYPE_KEYS.includes(type);
}
