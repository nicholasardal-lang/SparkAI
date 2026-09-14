import { legalDocuments, LEGAL_VERSION } from "@/lib/spark/legal";
export default function LegalContent({ kind }: { kind: keyof typeof legalDocuments }) {
  return <div className="legal-content"><p className="legal-draft">Preview draft · {LEGAL_VERSION}. Owner identity, contact details, and launch policies are still being finalized.</p>{legalDocuments[kind].sections.map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}</div>;
}
