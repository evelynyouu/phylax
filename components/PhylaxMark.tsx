/** The four-petal Phylax mark from the final designs. */
export default function PhylaxMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g fill="none" stroke="#344C3D" strokeWidth="2">
        <path d="M16 16c-4-6-4-11 0-13 4 2 4 7 0 13z" fill="#D8959B" />
        <path d="M16 16c6-4 11-4 13 0-2 4-7 4-13 0z" fill="#D0DBE7" />
        <path d="M16 16c4 6 4 11 0 13-4-2-4-7 0-13z" fill="#E3DADE" />
        <path d="M16 16c-6 4-11 4-13 0 2-4 7-4 13 0z" fill="#829672" />
      </g>
    </svg>
  );
}
