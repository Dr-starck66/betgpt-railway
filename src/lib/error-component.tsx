import type { ErrorComponentProps } from "@tanstack/react-router";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-pitch px-6 text-center text-paper">
      <h1 className="text-2xl font-semibold tracking-tight">Le desk a buté</h1>
      <p className="max-w-md text-sm break-words text-mist">
        {error.message || "Une erreur inattendue s'est produite."}
      </p>
      <button
        type="button"
        className="rounded-md bg-sage px-4 py-2 text-sm font-medium text-ink"
        onClick={() => window.location.reload()}
      >
        Recharger
      </button>
    </main>
  );
}