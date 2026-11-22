const LINKS = [
  { href: "#menu", label: "Menu" },
  { href: "#card", label: "My card" },
  { href: "#staff", label: "Staff" },
  { href: "#rewards", label: "Rewards" },
];

export default function Navigation() {
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => (
        <a key={l.href} href={l.href}>{l.label}</a>
      ))}
    </nav>
  );
}
