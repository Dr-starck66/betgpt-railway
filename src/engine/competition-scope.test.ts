import assert from "node:assert/strict";
import test from "node:test";
import {
  INTERNATIONAL_UNKNOWN,
  internationalCompetitionKeyOf,
  internationalCompetitionKeysOf,
  rowsForInternationalCompetition,
} from "./competition-scope.ts";

test("explicit provider competition keys remain exact", () => {
  assert.equal(
    internationalCompetitionKeyOf({ league: "NL", competition: "Qualifications Coupe du monde - CAF", competitionKey: "fifa.worldq.caf" }),
    "fifa.worldq.caf",
  );
  assert.equal(
    internationalCompetitionKeyOf({ league: "NL", competition: "Ligue des nations", competitionKey: "uefa.nations" }),
    "uefa.nations",
  );
});

test("competition names infer separate international buckets", () => {
  assert.equal(internationalCompetitionKeyOf({ league: "NL", competition: "Ligue des nations" }), "uefa.nations");
  assert.equal(internationalCompetitionKeyOf({ league: "NL", competition: "Qualifications Coupe d'Afrique des Nations" }), "caf.nations_qual");
  assert.equal(internationalCompetitionKeyOf({ league: "NL", competition: "Qualifications Coupe du monde - CAF" }), "fifa.worldq.caf");
  assert.equal(internationalCompetitionKeyOf({ league: "NL", competition: "Copa América" }), "conmebol.america");
});

test("club matches never enter an international competition bucket", () => {
  assert.equal(internationalCompetitionKeyOf({ league: "PL", competition: "Premier League", competitionKey: "eng.1" }), null);
});

test("unknown international rows fail closed into their own bucket", () => {
  assert.equal(internationalCompetitionKeyOf({ league: "NL", competition: "Tournoi amical inconnu" }), INTERNATIONAL_UNKNOWN);
});

test("Nations League cannot contaminate AFCON or World Cup qualifying rows", () => {
  const rows = [
    { id: "nations", league: "NL" as const, competitionKey: "uefa.nations" },
    { id: "afconq", league: "NL" as const, competitionKey: "caf.nations_qual" },
    { id: "wcaf", league: "NL" as const, competitionKey: "fifa.worldq.caf" },
    { id: "unknown", league: "NL" as const, competition: "Friendly Invitational" },
  ];

  assert.deepEqual(rowsForInternationalCompetition(rows, "uefa.nations").map((r) => r.id), ["nations"]);
  assert.deepEqual(rowsForInternationalCompetition(rows, "caf.nations_qual").map((r) => r.id), ["afconq"]);
  assert.deepEqual(rowsForInternationalCompetition(rows, "fifa.worldq.caf").map((r) => r.id), ["wcaf"]);
  assert.deepEqual(rowsForInternationalCompetition(rows, INTERNATIONAL_UNKNOWN).map((r) => r.id), ["unknown"]);
  assert.deepEqual(
    internationalCompetitionKeysOf(rows).sort(),
    [INTERNATIONAL_UNKNOWN, "caf.nations_qual", "fifa.worldq.caf", "uefa.nations"].sort(),
  );
});
