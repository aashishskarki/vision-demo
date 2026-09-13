export type Country = { iso: string; name: string; location: string };

// `location` is the DataForSEO location_name; `iso` the web-search country code.
export const COUNTRIES: Country[] = [
  { iso: "US", name: "United States", location: "United States" },
  { iso: "IN", name: "India", location: "India" },
  { iso: "GB", name: "United Kingdom", location: "United Kingdom" },
  { iso: "CA", name: "Canada", location: "Canada" },
  { iso: "AU", name: "Australia", location: "Australia" },
  { iso: "AE", name: "United Arab Emirates", location: "United Arab Emirates" },
  { iso: "SG", name: "Singapore", location: "Singapore" },
  { iso: "DE", name: "Germany", location: "Germany" },
  { iso: "FR", name: "France", location: "France" },
  { iso: "NL", name: "Netherlands", location: "Netherlands" },
  { iso: "ZA", name: "South Africa", location: "South Africa" },
  { iso: "BR", name: "Brazil", location: "Brazil" },
];

export const DEFAULT_ISO = "US";

export function countryByIso(iso: string | null | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.iso === iso);
}
