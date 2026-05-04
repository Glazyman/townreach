import type { StateRecord } from "./types";

/** U.S. states + D.C. with 2020 Census state FIPS (2-digit). */
export const states: StateRecord[] = [
  { id: "al", name: "Alabama", abbreviation: "AL", fips: "01" },
  { id: "ak", name: "Alaska", abbreviation: "AK", fips: "02" },
  { id: "az", name: "Arizona", abbreviation: "AZ", fips: "04" },
  { id: "ar", name: "Arkansas", abbreviation: "AR", fips: "05" },
  { id: "ca", name: "California", abbreviation: "CA", fips: "06" },
  { id: "co", name: "Colorado", abbreviation: "CO", fips: "08" },
  { id: "ct", name: "Connecticut", abbreviation: "CT", fips: "09" },
  { id: "de", name: "Delaware", abbreviation: "DE", fips: "10" },
  { id: "dc", name: "District of Columbia", abbreviation: "DC", fips: "11" },
  { id: "fl", name: "Florida", abbreviation: "FL", fips: "12" },
  { id: "ga", name: "Georgia", abbreviation: "GA", fips: "13" },
  { id: "hi", name: "Hawaii", abbreviation: "HI", fips: "15" },
  { id: "id", name: "Idaho", abbreviation: "ID", fips: "16" },
  { id: "il", name: "Illinois", abbreviation: "IL", fips: "17" },
  { id: "in", name: "Indiana", abbreviation: "IN", fips: "18" },
  { id: "ia", name: "Iowa", abbreviation: "IA", fips: "19" },
  { id: "ks", name: "Kansas", abbreviation: "KS", fips: "20" },
  { id: "ky", name: "Kentucky", abbreviation: "KY", fips: "21" },
  { id: "la", name: "Louisiana", abbreviation: "LA", fips: "22" },
  { id: "me", name: "Maine", abbreviation: "ME", fips: "23" },
  { id: "md", name: "Maryland", abbreviation: "MD", fips: "24" },
  { id: "ma", name: "Massachusetts", abbreviation: "MA", fips: "25" },
  { id: "mi", name: "Michigan", abbreviation: "MI", fips: "26" },
  { id: "mn", name: "Minnesota", abbreviation: "MN", fips: "27" },
  { id: "ms", name: "Mississippi", abbreviation: "MS", fips: "28" },
  { id: "mo", name: "Missouri", abbreviation: "MO", fips: "29" },
  { id: "mt", name: "Montana", abbreviation: "MT", fips: "30" },
  { id: "ne", name: "Nebraska", abbreviation: "NE", fips: "31" },
  { id: "nv", name: "Nevada", abbreviation: "NV", fips: "32" },
  { id: "nh", name: "New Hampshire", abbreviation: "NH", fips: "33" },
  { id: "nj", name: "New Jersey", abbreviation: "NJ", fips: "34" },
  { id: "nm", name: "New Mexico", abbreviation: "NM", fips: "35" },
  { id: "ny", name: "New York", abbreviation: "NY", fips: "36" },
  { id: "nc", name: "North Carolina", abbreviation: "NC", fips: "37" },
  { id: "nd", name: "North Dakota", abbreviation: "ND", fips: "38" },
  { id: "oh", name: "Ohio", abbreviation: "OH", fips: "39" },
  { id: "ok", name: "Oklahoma", abbreviation: "OK", fips: "40" },
  { id: "or", name: "Oregon", abbreviation: "OR", fips: "41" },
  { id: "pa", name: "Pennsylvania", abbreviation: "PA", fips: "42" },
  { id: "ri", name: "Rhode Island", abbreviation: "RI", fips: "44" },
  { id: "sc", name: "South Carolina", abbreviation: "SC", fips: "45" },
  { id: "sd", name: "South Dakota", abbreviation: "SD", fips: "46" },
  { id: "tn", name: "Tennessee", abbreviation: "TN", fips: "47" },
  { id: "tx", name: "Texas", abbreviation: "TX", fips: "48" },
  { id: "ut", name: "Utah", abbreviation: "UT", fips: "49" },
  { id: "vt", name: "Vermont", abbreviation: "VT", fips: "50" },
  { id: "va", name: "Virginia", abbreviation: "VA", fips: "51" },
  { id: "wa", name: "Washington", abbreviation: "WA", fips: "53" },
  { id: "wv", name: "West Virginia", abbreviation: "WV", fips: "54" },
  { id: "wi", name: "Wisconsin", abbreviation: "WI", fips: "55" },
  { id: "wy", name: "Wyoming", abbreviation: "WY", fips: "56" }
];

const byId = new Map(states.map((s) => [s.id, s]));
const byFips = new Map(states.map((s) => [s.fips, s]));

export function getStateById(id: string): StateRecord | undefined {
  return byId.get(id);
}

export function getStateByFips(fips: string): StateRecord | undefined {
  return byFips.get(fips);
}
