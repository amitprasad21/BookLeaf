import type { ComponentType, ReactNode } from "react";
import { cx } from "./cx.js";

/** The props a link needs here; next/link's Link satisfies it, so the package needs no Next.js. */
export interface LinkLikeProps {
  href: string;
  className?: string;
  children?: ReactNode;
  "aria-current"?: "page";
}
export type LinkComponent = ComponentType<LinkLikeProps>;

function Anchor(props: LinkLikeProps) {
  return <a {...props} />;
}

export interface NavItem {
  href: string;
  label: string;
  current?: boolean;
}

export interface NavBarProps {
  items: readonly NavItem[];
  label?: string;
  link?: LinkComponent;
}

export function NavBar({ items, label = "Main", link: Link = Anchor }: NavBarProps) {
  return (
    <nav className="bl-nav" aria-label={label}>
      <ul className="bl-nav__list">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="bl-nav__link" aria-current={item.current ? "page" : undefined}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface AppShellProps {
  portal: "author" | "admin";
  brand: string;
  homeHref?: string;
  nav?: readonly NavItem[];
  /** Signed-in user and sign-out control. */
  account?: ReactNode;
  link?: LinkComponent;
  children: ReactNode;
}

/** Page frame: skip link, header with brand, navigation and account, then the main landmark. */
export function AppShell({
  portal,
  brand,
  homeHref = "/",
  nav = [],
  account,
  link: Link = Anchor,
  children,
}: AppShellProps) {
  return (
    <div className={cx("bl-shell", portal === "admin" && "bl-shell--admin")}>
      <a className="bl-skip-link" href="#main">
        Skip to main content
      </a>
      <header className="bl-header">
        <div className="bl-header__inner">
          <Link href={homeHref} className="bl-header__brand">
            {brand}
          </Link>
          {nav.length > 0 ? <NavBar items={nav} link={Link} /> : null}
          {account ? <div className="bl-header__account">{account}</div> : null}
        </div>
      </header>
      <main id="main" className="bl-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
