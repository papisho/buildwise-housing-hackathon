import {
  addressMatchesAssessment,
  houseAndStreetMatch,
  parseHouseAndStreet,
} from "@/lib/parcels/match-address";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

export function runAddressMatchTests() {
  assert(
    parseHouseAndStreet("5061 Fifth Ave, Pittsburgh, PA 15232").streetName ===
      "5TH AVE",
    "FIFTH should normalize to 5TH",
  );
  assert(
    parseHouseAndStreet("5061 5TH AVE, PITTSBURGH, PA 15232").streetName ===
      "5TH AVE",
    "5TH AVE should stay 5TH AVE",
  );
  assert(
    parseHouseAndStreet("414 Grant Street").streetName === "GRANT ST",
    "STREET should normalize to ST",
  );
  assert(
    parseHouseAndStreet("100 North Avenue").streetName === "N AVE",
    "NORTH should normalize to N",
  );

  assert(
    houseAndStreetMatch(
      parseHouseAndStreet("5061 FIFTH AVE"),
      "5061",
      "5TH AVE",
      null,
    ),
    "house + ordinal street should match assessment 5TH",
  );
  assert(
    !houseAndStreetMatch(
      parseHouseAndStreet("5061 FIFTH AVE"),
      "5057",
      "5TH AVE",
      null,
    ),
    "wrong house number must not match",
  );
  assert(
    !houseAndStreetMatch(
      parseHouseAndStreet("5622 DELLAGLEN AVE"),
      "0",
      "DELLAGLEN AVE",
      null,
    ),
    "house number 0 must never match a numbered input",
  );
  assert(
    addressMatchesAssessment(
      "5061 Fifth Ave, Pittsburgh, PA 15232",
      "5061 5TH AVE, PITTSBURGH, PA, 15232",
      "5061",
      "5TH AVE",
      null,
    ),
    "entered Fifth / Census 5TH should match assessment 5061 5TH",
  );

  console.log("address-match unit tests passed");
}

if (process.argv[1]?.includes("run-match-address")) {
  runAddressMatchTests();
}
