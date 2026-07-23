import AdminAffiliatesClient from "./AdminAffiliatesClient";
import { readAdminAffiliatePage, type AdminAffiliateFilters } from "../../../lib/affiliateData";
import { createRequestTimer } from "../../../lib/requestDiagnostics";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage({
  searchParams
}: {
  searchParams: Promise<AdminAffiliateFilters>;
}) {
  const timer = createRequestTimer("render complete", { route: "/admin/affiliates" });
  const pageData = await readAdminAffiliatePage(await searchParams);
  timer.end({ rows: pageData.affiliates.length, totalRows: pageData.total });
  return <AdminAffiliatesClient {...pageData} />;
}
