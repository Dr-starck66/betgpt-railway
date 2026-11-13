/**
 * Research-only loader seam: models.ts imports lookupTeam from the large live
 * runtime solely for estimateRho. The forward probe sets rho explicitly and
 * never calls estimateRho, so this scoped stub avoids unrelated app deps.
 * Actual runStatisticalStack and all six model functions remain unchanged.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "./live" && context.parentURL?.endsWith("/src/engine/models.ts")) {
    return {url:"data:text/javascript,export function lookupTeam(){throw Error('NOT_ALLOWED_IN_PROSPECTIVE_MODEL_PROBE')}",shortCircuit:true};
  }
  return nextResolve(specifier,context);
}
