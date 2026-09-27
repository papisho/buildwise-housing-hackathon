import { loadEnvConfig } from "@next/env";
import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import { lookupHudRentBenchmark } from "@/lib/financial/hud";
import { runFinancialStatusTests } from "@/lib/financial/run-status-tests";

loadEnvConfig(process.cwd());

function printFinancial(
  title: string,
  result: Awaited<ReturnType<typeof findParcelForAddress>>,
) {
  console.log(`\n=== ${title} ===`);
  if (result.status !== "ok") {
    console.log({
      status: result.status,
      message: "message" in result ? result.message : null,
    });
    return;
  }
  const financial = result.financialContext;
  console.log({
    validatedPin: result.parcel.pin,
    financialParcelId: financial.parcelId,
    pinsMatch: result.parcel.pin === financial.parcelId,
    scoreComplete: result.decision.score.complete,
    developmentEase: result.decision.score.value,
    coveragePercent: result.decision.coverage.percent,
    overallStatus: financial.overallStatus,
    salesStatus: financial.sales.status,
    salesCount:
      financial.sales.status === "ok" ? financial.sales.records.length : null,
    salesFilter:
      financial.sales.status === "ok" ? financial.sales.validatedFilter : financial.sales.message,
    salesPreview:
      financial.sales.status === "ok"
        ? financial.sales.records.map((sale) => ({
            parid: sale.parid,
            saleDate: sale.saleDate,
            price: sale.price,
            distanceFeet: Math.round(sale.distanceFeet),
            saleCode: sale.saleCode,
            provenance: sale.provenance,
          }))
        : null,
    hudStatus: financial.hud.status,
    hud:
      financial.hud.status === "ok"
        ? {
            year: financial.hud.year,
            geographyType: financial.hud.geographyType,
            zip: financial.hud.zip,
            areaName: financial.hud.areaName,
            entityId: financial.hud.entityId,
            rents: financial.hud.rents,
            provenance: financial.hud.provenance,
            queryUrl: financial.hud.source.queryUrl,
            retrievedAt: financial.hud.source.retrievedAt,
          }
        : financial.hud.message,
    claudeSalesProvenance:
      result.claudeContext.financial_context.nearby_sales[0]?.provenance ??
      null,
    claudeHudProvenance:
      result.claudeContext.financial_context.hud?.provenance ?? null,
    claudeScenario: result.claudeContext.financial_context.scenario,
  });
}

async function main() {
  runFinancialStatusTests();
  const fifth = await findParcelForAddress(
    "5061 5TH AVE, PITTSBURGH, PA 15232",
  );
  printFinancial("5061 5TH AVE", fifth);
  const grant = await findParcelForAddress(
    "414 GRANT ST, PITTSBURGH, PA 15219",
  );
  printFinancial("414 GRANT ST", grant);

  const invalidHud = await lookupHudRentBenchmark({
    zip: "15219",
    accessToken: "invalid-hud-token",
  });
  if (invalidHud.status !== "not_evaluated") {
    throw new Error("invalid HUD token must be Not Evaluated");
  }
  if (
    !invalidHud.message.includes("authentication failed") &&
    !invalidHud.message.includes("request failed")
  ) {
    throw new Error(`unexpected invalid-token HUD message: ${invalidHud.message}`);
  }
  console.log("\n=== invalid HUD token ===");
  console.log({
    hudStatus: invalidHud.status,
    message: invalidHud.message,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
