export default function Footer() {
  const currentYear = new Date().getFullYear();
  const displayYear = currentYear > 2026 ? currentYear : 2026;

  return (
    <footer className="footer">
      <span className="footer-year">2026 - {displayYear}</span>
      <span className="footer-brand">Toll</span>
      <span className="footer-credit">Made by Doomhyena</span>
    </footer>
  );
}
