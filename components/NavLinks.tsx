"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ admin = false }: { admin?: boolean }) {
  const p = usePathname();
  const items = [
    { href: "/", label: "Proyectos", on: p === "/" || p.startsWith("/proyectos") },
    { href: "/editor", label: "Editor de video", on: p.startsWith("/editor") },
    { href: "/videos", label: "Todos los videos", on: p === "/videos" || p.startsWith("/videos/") },
    { href: "/tutoriales", label: "Tutoriales", on: p.startsWith("/tutoriales") },
    { href: "/planes", label: "Plan y créditos", on: p.startsWith("/planes") },
    ...(admin ? [{ href: "/admin", label: "Usuarios", on: p.startsWith("/admin") }] : []),
  ];
  return (
    <div className="nav">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={i.on ? "active" : undefined}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}
