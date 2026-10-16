import { CATEGORY_LABELS, TICKET_CATEGORIES } from "@bookleaf/shared";
import { Panel } from "@bookleaf/ui";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
      <Panel title="BookLeaf Support Console" headingLevel={1}>
        <p style={{ marginTop: 0, color: "var(--color-text-muted)" }}>
          Workspace scaffold is running. Sign-in and the ticket queue arrive in tasks FE-M1 to FE-M4.
        </p>
        <h2 style={{ fontSize: "var(--text-md)", marginBottom: "var(--space-2)" }}>Ticket categories</h2>
        <ul style={{ margin: 0, paddingLeft: "var(--space-5)" }}>
          {TICKET_CATEGORIES.map((category) => (
            <li key={category}>{CATEGORY_LABELS[category]}</li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
