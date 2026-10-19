import { buttonClassName } from "./Button.js";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="bl-pagination">
      <button
        type="button"
        className={buttonClassName({ size: "small" })}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span className="bl-pagination__status">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        className={buttonClassName({ size: "small" })}
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
