import { redirect } from "next/navigation";

// "/" is the queue; the console guard sends signed-out visitors to /login.
export default function HomePage() {
  redirect("/tickets");
}
