import Link from "next/link";
import { SidebarNav } from "@/components/layouts/SidebarNav";

/**
 * DashboardLayout — left-sidebar shell for all /dashboard/* pages.
 *
 * Server component. Active nav state is handled by the SidebarNav
 * client component (which uses usePathname()).
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--to-background)" }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col shrink-0 border-r overflow-y-auto"
        style={{
          width: "224px",
          backgroundColor: "var(--to-sidebar-bg)",
          borderColor: "var(--to-border)",
        }}
      >
        {/* Brand wordmark */}
        <div
          className="px-4 py-4 border-b shrink-0"
          style={{ borderColor: "var(--to-border)" }}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold tracking-tight shrink-0"
              style={{
                backgroundColor: "var(--to-sage-bg)",
                color: "var(--to-sage-text)",
                border: "1px solid var(--to-sage-mid)",
              }}
            >
              TO
            </span>
            <span
              className="text-sm font-semibold tracking-tight"
              style={{ color: "var(--to-text-primary)" }}
            >
              ThreadOps
            </span>
          </Link>
        </div>

        {/* Navigation — client component for active-state highlighting */}
        <SidebarNav />

        {/* Footer — role indicator */}
        <div
          className="px-4 py-3 border-t shrink-0"
          style={{ borderColor: "var(--to-border)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0"
              style={{
                backgroundColor: "var(--to-sage-bg)",
                color: "var(--to-sage-text)",
                border: "1px solid var(--to-sage-mid)",
              }}
            >
              O
            </span>
            <div className="min-w-0">
              <p
                className="text-xs font-semibold leading-tight truncate"
                style={{ color: "var(--to-text-primary)" }}
              >
                Owner
              </p>
              <p
                className="text-[11px] leading-tight"
                style={{ color: "var(--to-text-muted)" }}
              >
                Full access
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
