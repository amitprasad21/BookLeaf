import type { Metadata } from "next";
import { BooksScreen } from "@/features/books/BooksScreen";

export const metadata: Metadata = { title: "My Books" };

export default function BooksPage() {
  return <BooksScreen />;
}
