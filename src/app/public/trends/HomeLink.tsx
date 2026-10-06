"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Kept as its own client island: reading the session in the page would force dynamic rendering and defeat ISR.
export default function HomeLink() {
  const { role, isLoading } = useAuth();

  const href =
    role === "ADMIN" || role === "SUPER_ADMIN"
      ? "/admin"
      : role === "PATIENT"
        ? "/patient"
        : role === "RESEARCHER"
          ? "/researcher"
          : "/";
  const label = isLoading ? "Home" : role ? "Dashboard" : "Home";

  return (
    <Link href={href} className="tab-link flex items-center gap-1">
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}
