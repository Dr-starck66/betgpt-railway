export function Methodology({
  n,
  asOf,
  extra,
}: {
  n: number;
  asOf?: string;
  extra?: string;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4 text-sm text-mist">
      <h2 className="text-base font-semibold text-paper">Méthode</h2>
      <p className="mt-2 leading-relaxed">
        Les fréquences viennent de l’archive ESPN des scores officiels ({n.toLocaleString("fr-FR")} matches). Le
        Score Hunter 0–100 mélange l’estimation du modèle Poisson / Dixon-Coles (70 %), la fréquence de ligue si
        n≥30 (20 %) et l’ajustement clubs (10 %). Un échantillon trop petit ramène le score vers 50. 91/100 est un
        classement relatif entre matches du desk — ce n’est pas la probabilité que le score sorte (celle-ci est
        l’estimation modèle, souvent autour de 8–15 % pour un score exact). Ce n’est pas une cote, pas une
        garantie, pas un conseil de mise.
      </p>
      {extra ? <p className="mt-2">{extra}</p> : null}
      {asOf ? <p className="mt-2 text-xs text-muted">Dernière mise à jour desk : {asOf}</p> : null}
    </section>
  );
}
