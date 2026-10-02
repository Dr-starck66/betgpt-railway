import fs from "node:fs";

const shellPath = new URL("../src/components/shell.tsx", import.meta.url);
const ageGatePath = new URL("../src/components/age-gate.tsx", import.meta.url);
const consentPath = new URL("../src/components/consent-ads.tsx", import.meta.url);
const shell = fs.readFileSync(shellPath, "utf8");
const ageGate = fs.readFileSync(ageGatePath, "utf8");
const consent = fs.readFileSync(consentPath, "utf8");

const failures = [];

if (!shell.includes("const MOBILE_PRIMARY = [")) failures.push("MOBILE_PRIMARY is missing");
if (!shell.includes('{ to: "/chat", label: "Chat IA", icon: MessageCircle }')) failures.push("Chat IA is not a first-level mobile destination");
if (shell.includes("PRIMARY.slice(0, 4)")) failures.push("mobile navigation still depends on PRIMARY.slice(0, 4)");
if (!shell.includes('<MenuLink to="/resultats-football" label="Résultats" />')) failures.push("Résultats is missing from the mobile-accessible menu");
if (!shell.includes('<MenuLink to="/actualites" label="Actualités" />')) failures.push("Actualités is missing from the mobile-accessible menu");
if (!shell.includes('<MenuLink to="/comparer-cotes" label="Comparer les cotes" />')) failures.push("Comparer les cotes is missing from the mobile-accessible menu");
if (!shell.includes('<MenuLink to="/ledger" label="Bilan public" />') && !shell.includes('"/ledger"')) failures.push("Bilan ROI is missing from the mobile-accessible menu");
if (!ageGate.includes('aria-modal="true"') || !ageGate.includes("bg-slate-950")) failures.push("18+ gate must be an explicit opaque modal, not an ambiguous click-blocking overlay");
if (!ageGate.includes("AGE_GATE_ACCEPTED_EVENT")) failures.push("18+ gate does not publish acceptance to dependent UI");
if (!consent.includes("AGE_GATE_ACCEPTED_EVENT") || !consent.includes("!ageAccepted")) failures.push("cookie consent can still stack underneath the 18+ gate");

if (failures.length) {
  console.error("ASTRA_MOBILE_PARITY_FAIL");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("ASTRA_MOBILE_PARITY_PASS");
