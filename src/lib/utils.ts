import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits).replace(".", ",")}\u00a0%`;
}

export function fmtOdds(x: number): string {
  return x.toFixed(2).replace(".", ",");
}

export function fmtScore(x: number, digits = 0): string {
  return x.toFixed(digits).replace(".", ",");
}

export function fmtSignedPct(x: number, digits = 1): string {
  const sign = x > 0 ? "+" : x < 0 ? "−" : "";
  return `${sign}${Math.abs(x * 100).toFixed(digits).replace(".", ",")}\u00a0%`;
}

export function fmtEur(n: number, signed = false): string {
  const sign = signed ? (n > 0 ? "+" : n < 0 ? "−" : "") : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const body = abs.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${sign}${body}\u00a0€`;
}
