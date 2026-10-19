import { redirect } from "next/navigation";

// "/" is My Books; the portal guard sends signed-out visitors to /login.
export default function HomePage() {
  redirect("/books");
}
