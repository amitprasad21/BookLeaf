import { Panel } from "@bookleaf/ui";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
      <Panel title="BookLeaf Author Portal" headingLevel={1}>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          Workspace scaffold is running. Sign-in, My Books and support tickets arrive in tasks FE-A1 to FE-A4.
        </p>
      </Panel>
    </main>
  );
}
