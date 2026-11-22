export default function MenuCard({ item }) {
  return (
    <article className="paper menu-card">
      <header>
        <h3>{item.name}</h3>
        <span className="price">₱{item.price}</span>
      </header>
      <p>{item.note}</p>
    </article>
  );
}
