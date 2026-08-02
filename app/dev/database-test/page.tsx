/**
 * /app/dev/database-test/page.tsx
 *
 * Development-only page to verify:
 *  - Supabase connection is live
 *  - The `departments` table exists and was seeded correctly
 *
 * Remove or gate behind an env check before going to production.
 */

import { createClient } from "@/lib/supabase/server";
import type { Department } from "@/types/database";

export const metadata = {
  title: "DB Test | ThreadOps Dev",
  description: "Development database connection verification page",
};

async function getDepartments(): Promise<{
  data: Department[] | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name");

    if (error) {
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default async function DatabaseTestPage() {
  const { data: departments, error } = await getDepartments();

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.badge}>DEV ONLY</div>
          <h1 style={styles.title}>Database Connection Test</h1>
          <p style={styles.subtitle}>ThreadOps · Supabase Foundation Verification</p>
        </div>

        {/* Status */}
        <div style={error ? styles.statusError : styles.statusOk}>
          <span style={styles.statusDot(!!error)} />
          {error
            ? `Connection failed: ${error}`
            : `Supabase connected — ${departments?.length ?? 0} department(s) found`}
        </div>

        {/* Table */}
        {departments && departments.length > 0 ? (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Department</th>
                  <th style={styles.th}>PIN</th>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Created At</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept, i) => (
                  <tr key={dept.id} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                    <td style={styles.td}>{i + 1}</td>
                    <td style={{ ...styles.td, ...styles.deptName }}>{dept.name}</td>
                    <td style={styles.td}>
                      <code style={styles.pin}>{dept.pin}</code>
                    </td>
                    <td style={{ ...styles.td, ...styles.mono }}>{dept.id}</td>
                    <td style={{ ...styles.td, ...styles.mono }}>
                      {new Date(dept.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !error ? (
          <p style={styles.empty}>
            No departments found — run the seed migration.
          </p>
        ) : null}

        {/* Checklist */}
        <div style={styles.checklist}>
          <h2 style={styles.checklistTitle}>Verification Checklist</h2>
          <CheckItem ok={!error} label="Supabase connection established" />
          <CheckItem
            ok={!error && (departments?.length ?? 0) === 7}
            label="7 departments seeded"
          />
          <CheckItem ok={!error} label="departments table exists" />
        </div>

        <p style={styles.footer}>
          This page is for development verification only. Remove before production.
        </p>
      </div>
    </main>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={styles.checkItem}>
      <span style={styles.checkIcon(ok)}>{ok ? "✅" : "❌"}</span>
      <span style={{ color: ok ? "#4ade80" : "#f87171" }}>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles — no external CSS dependency for this dev-only page
// ---------------------------------------------------------------------------

const styles = {
  main: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  } as React.CSSProperties,

  card: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    padding: "2.5rem",
    maxWidth: "900px",
    width: "100%",
    backdropFilter: "blur(20px)",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  } as React.CSSProperties,

  header: {
    marginBottom: "2rem",
    textAlign: "center" as const,
  } as React.CSSProperties,

  badge: {
    display: "inline-block",
    background: "rgba(251,191,36,0.15)",
    border: "1px solid rgba(251,191,36,0.4)",
    color: "#fbbf24",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.15em",
    padding: "0.2rem 0.75rem",
    borderRadius: "99px",
    marginBottom: "1rem",
  } as React.CSSProperties,

  title: {
    color: "#f1f5f9",
    fontSize: "2rem",
    fontWeight: 700,
    margin: "0 0 0.5rem",
  } as React.CSSProperties,

  subtitle: {
    color: "#94a3b8",
    fontSize: "0.95rem",
    margin: 0,
  } as React.CSSProperties,

  statusOk: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    background: "rgba(74,222,128,0.1)",
    border: "1px solid rgba(74,222,128,0.3)",
    color: "#4ade80",
    padding: "0.75rem 1.25rem",
    borderRadius: "8px",
    marginBottom: "1.5rem",
    fontSize: "0.9rem",
    fontWeight: 500,
  } as React.CSSProperties,

  statusError: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.3)",
    color: "#f87171",
    padding: "0.75rem 1.25rem",
    borderRadius: "8px",
    marginBottom: "1.5rem",
    fontSize: "0.9rem",
    fontWeight: 500,
  } as React.CSSProperties,

  statusDot: (isError: boolean): React.CSSProperties => ({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
    background: isError ? "#f87171" : "#4ade80",
    boxShadow: isError
      ? "0 0 8px rgba(248,113,113,0.8)"
      : "0 0 8px rgba(74,222,128,0.8)",
  }),

  tableWrapper: {
    overflowX: "auto" as const,
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: "2rem",
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.875rem",
  } as React.CSSProperties,

  th: {
    background: "rgba(255,255,255,0.05)",
    color: "#94a3b8",
    fontWeight: 600,
    letterSpacing: "0.05em",
    fontSize: "0.75rem",
    textTransform: "uppercase" as const,
    padding: "0.75rem 1rem",
    textAlign: "left" as const,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  } as React.CSSProperties,

  td: {
    padding: "0.75rem 1rem",
    color: "#cbd5e1",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    verticalAlign: "middle" as const,
  } as React.CSSProperties,

  trEven: {
    background: "transparent",
  } as React.CSSProperties,

  trOdd: {
    background: "rgba(255,255,255,0.02)",
  } as React.CSSProperties,

  deptName: {
    color: "#f1f5f9",
    fontWeight: 600,
  } as React.CSSProperties,

  pin: {
    background: "rgba(139,92,246,0.15)",
    border: "1px solid rgba(139,92,246,0.3)",
    color: "#a78bfa",
    padding: "0.15rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.85rem",
    fontFamily: "monospace",
    letterSpacing: "0.15em",
  } as React.CSSProperties,

  mono: {
    fontFamily: "monospace",
    fontSize: "0.78rem",
    color: "#64748b",
  } as React.CSSProperties,

  empty: {
    textAlign: "center" as const,
    color: "#64748b",
    padding: "2rem",
  } as React.CSSProperties,

  checklist: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "8px",
    padding: "1.25rem 1.5rem",
    marginBottom: "1.5rem",
  } as React.CSSProperties,

  checklistTitle: {
    color: "#94a3b8",
    fontSize: "0.8rem",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    margin: "0 0 0.75rem",
  } as React.CSSProperties,

  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.35rem 0",
    fontSize: "0.875rem",
  } as React.CSSProperties,

  checkIcon: (_ok: boolean): React.CSSProperties => ({
    fontSize: "1rem",
    lineHeight: 1,
  }),

  footer: {
    textAlign: "center" as const,
    color: "#475569",
    fontSize: "0.78rem",
    margin: 0,
  } as React.CSSProperties,
};
