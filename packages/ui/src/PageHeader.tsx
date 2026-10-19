import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

/** The page's single h1, an optional line beneath it and the page's main actions. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="bl-page-header">
      <div>
        <h1 className="bl-page-header__title">{title}</h1>
        {description ? <p className="bl-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="bl-page-header__actions">{actions}</div> : null}
    </div>
  );
}
