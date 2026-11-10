/** The swaying CSS flower from SignIn.dc.html. Decorative; motion stops for reduced-motion users (pages.css). */
export default function Flower() {
  const petals = ["var(--mauve)", "var(--lavender)", "var(--sky)", "var(--mauve)", "var(--lavender)", "var(--sky)"];
  return (
    <div aria-hidden="true" className="flower">
      <span className="stem" />
      <span className="leaf1" />
      <span className="leaf2" />
      {petals.map((c, i) => (
        <span key={i} className="petal" style={{ background: c, transform: `rotate(${i * 60}deg)` }} />
      ))}
      <span className="core" />
    </div>
  );
}
