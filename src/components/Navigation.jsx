const LINKS = [
  { href: "#menu", label: "Menu" },
  { href: "#card", label: "My card" },
  { href: "#rewards", label: "Rewards" },
  { href: "/login", label: "Login" },
];

export default function Navigation() {
  const homePrefix = window.location.pathname === "/login" ? "/" : "";

  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => (
        <a key={l.href} href={l.href.startsWith("#") ? `${homePrefix}${l.href}` : l.href}>{l.label}</a>
      ))}
    </nav>
  );
}
