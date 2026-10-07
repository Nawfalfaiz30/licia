"use client";

import { isWidgetVisible, widgetOrder, type DashboardWidgetId } from "@/lib/dashboardLayout";
import { useDashboardLayout } from "@/components/dashboard/DashboardLayoutProvider";

/**
 * Pembungkus satu bagian dashboard. Anak (komponen server) tetap dirender server; di sini hanya urutan CSS
 * (`order`) dan penyembunyian (`hidden`) yang diatur, jadi tidak ada data tambahan yang diambil.
 */
export function DashboardWidget({ id, children }: { id: DashboardWidgetId; children: React.ReactNode }) {
  const { layout, ready } = useDashboardLayout();
  if (!ready)
    return (
      <div style={{ order: 0 }} data-widget={id}>
        {children}
      </div>
    );
  if (!isWidgetVisible(layout, id)) return null;
  return (
    <div style={{ order: widgetOrder(layout, id) + 1 }} data-widget={id}>
      {children}
    </div>
  );
}
