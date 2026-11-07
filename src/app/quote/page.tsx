import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { QuoteFlow } from "@/components/parcel/QuickQuote";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Get a quote" };

// Guest quote: a quick price first, then the full form; we only ask for an account at payment.
export default async function QuotePage({ searchParams }: PageProps<"/quote">) {
  const { q } = await searchParams;
  const session = await getSession();
  return (
    <>
      <SiteHeader active="Send a parcel" />
      <main className="bg-grid flex-1 px-4 py-10">
        <div className="card mx-auto max-w-2xl sm:p-8">
          <QuoteFlow signedIn={Boolean(session)} resumeId={typeof q === "string" ? q : undefined} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
