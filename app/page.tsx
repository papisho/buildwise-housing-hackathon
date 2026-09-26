import { FindParcelForm } from "@/components/find-parcel-form";

export const maxDuration = 120;

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">BuildWise</h1>
      <p className="mt-2 text-sm">
        Know what could complicate a housing site before deeper due diligence.
      </p>
      <p className="mt-4 text-sm text-neutral-600">
        Currently supports City of Pittsburgh parcels.
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        Decision support only. This tool is not legal, zoning, engineering,
        environmental, or financial advice.
      </p>
      <FindParcelForm />
    </main>
  );
}
