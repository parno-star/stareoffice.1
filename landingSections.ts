// Shared constant: available landing page sections with display labels.
// Kept free of server imports so both frontend and backend can import it
// without pulling Convex server code into the browser bundle.
export const LANDING_SECTIONS = [
  { id: "hero", label: "Hero Banner" },
  { id: "stats", label: "Statistik" },
  { id: "trustedBy", label: "Dipercaya Oleh" },
  { id: "features", label: "Fitur Unggulan" },
  { id: "demo", label: "Product Demo" },
  { id: "benefits", label: "Manfaat" },
  { id: "modules", label: "Modul Terintegrasi" },
  { id: "workflow", label: "Alur Kerja" },
  { id: "calls", label: "Panggilan Audio & Video" },
  { id: "security", label: "Keamanan & Compliance" },
  { id: "testimonial", label: "Testimoni" },
  { id: "pricing", label: "Paket & Harga" },
  { id: "cta", label: "Call to Action" },
  { id: "footer", label: "Footer" },
] as const;

export type SectionId = (typeof LANDING_SECTIONS)[number]["id"];
