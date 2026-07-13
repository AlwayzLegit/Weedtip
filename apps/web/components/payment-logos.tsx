/**
 * Full-color card-brand marks (Visa, Mastercard, American Express, Discover),
 * rendered as inline SVG badges. Card processors require the four color logos
 * to appear somewhere on an e-commerce site; the footer renders these sitewide.
 */

function Badge({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-11 items-center justify-center overflow-hidden rounded border border-black/10 bg-white shadow-sm"
    >
      {children}
    </span>
  );
}

export function PaymentLogos({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="inline-flex items-center gap-1.5">
        {/* Visa — blue wordmark with gold accent */}
        <Badge label="Visa">
          <svg viewBox="0 0 44 28" className="h-full w-full">
            <rect width="44" height="28" fill="#fff" />
            <rect y="24.5" width="44" height="3.5" fill="#F7B600" />
            <rect width="44" height="3.5" fill="#1A1F71" />
            <text
              x="22"
              y="19"
              textAnchor="middle"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize="11"
              fontStyle="italic"
              fontWeight="bold"
              fill="#1A1F71"
            >
              VISA
            </text>
          </svg>
        </Badge>
        {/* Mastercard — interlocking red/orange circles */}
        <Badge label="Mastercard">
          <svg viewBox="0 0 44 28" className="h-full w-full">
            <rect width="44" height="28" fill="#fff" />
            <circle cx="18" cy="14" r="8.5" fill="#EB001B" />
            <circle cx="26" cy="14" r="8.5" fill="#F79E1B" />
            <path
              d="M22 7.4a8.5 8.5 0 0 1 0 13.2 8.5 8.5 0 0 1 0-13.2z"
              fill="#FF5F00"
            />
          </svg>
        </Badge>
        {/* American Express — blue field wordmark */}
        <Badge label="American Express">
          <svg viewBox="0 0 44 28" className="h-full w-full">
            <rect width="44" height="28" fill="#016FD0" />
            <text
              x="22"
              y="16"
              textAnchor="middle"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize="7.5"
              fontWeight="bold"
              fill="#fff"
            >
              AMEX
            </text>
            <text
              x="22"
              y="23"
              textAnchor="middle"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize="4.5"
              fontWeight="bold"
              fill="#fff"
            >
              AMERICAN EXPRESS
            </text>
          </svg>
        </Badge>
        {/* Discover — wordmark with orange sunrise disc */}
        <Badge label="Discover">
          <svg viewBox="0 0 44 28" className="h-full w-full">
            <rect width="44" height="28" fill="#fff" />
            <path d="M0 28h44v-9c-14 7-30 9-44 9z" fill="#F76E20" opacity="0.9" />
            <text
              x="19"
              y="15.5"
              textAnchor="middle"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize="7"
              fontWeight="bold"
              fill="#231F20"
            >
              DISC
              <tspan fill="#F76E20">O</tspan>
              VER
            </text>
          </svg>
        </Badge>
      </span>
    </span>
  );
}
