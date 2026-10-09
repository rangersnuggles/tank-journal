export const runtime = "edge";

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { getPublicTank, publicTankSummary } from "@/lib/publicTank";
import { SITE_URL } from "@/lib/site";
import TankJournal from "@/components/TankJournal";
import PublicTankBanner, { PublicTankFooterCta } from "@/components/PublicTankBanner";

export async function generateMetadata(props) {
  const { username, slug } = await props.params;
  const data = await getPublicTank(username, slug);
  if (!data) return { title: "Tank not found · AquaSlog", robots: { index: false } };

  const { tank, stats } = data;
  const title = `${tank.name} by ${tank.ownerName} · AquaSlog`;
  const description = publicTankSummary(tank, stats);
  const url = `${SITE_URL}/t/${tank.username}/${tank.slug}`;

  // og:image / twitter:image come from ./opengraph-image.jsx (file convention).
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "AquaSlog", title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicTankPage(props) {
  const { username, slug } = await props.params;
  const data = await getPublicTank(username, slug);
  if (!data) notFound();

  const { tank: row, entries, inhabitants } = data;
  const user = await getSession({ headers: await headers() });
  const viewer = !user ? "anonymous" : user.user_id === row.user_id ? "owner" : "member";

  // Only what the client journal needs (no user_id etc.).
  const tank = {
    id: row.id,
    name: row.name,
    description: row.description,
    slug: row.slug,
    is_public: row.is_public,
    user_display_name: row.user_display_name,
    username: row.username,
    ownerName: row.ownerName,
  };

  return (
    <>
      <TankJournal
        tankId={row.id}
        tank={tank}
        readOnly={true}
        initialEntries={entries}
        initialInhabitants={inhabitants}
        // key: React dev warns about un-keyed server elements passed through props.
        publicBanner={<PublicTankBanner key="public-banner" tank={tank} viewer={viewer} />}
      />
      {viewer === "anonymous" && <PublicTankFooterCta tank={tank} />}
    </>
  );
}
