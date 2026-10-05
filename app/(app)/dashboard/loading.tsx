import { PageSkeleton } from "@/components/ui/Skeleton";
import { getServerI18n } from "@/lib/i18n/server";

export default async function Loading() {
  const { tr } = await getServerI18n();
  return <PageSkeleton title={tr("Memuat Beranda…")} variant="cards" />;
}
