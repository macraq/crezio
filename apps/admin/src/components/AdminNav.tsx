export default function AdminNav() {
  const items = [
    { href: '/brands', label: 'Marki' },
    { href: '/influencers', label: 'Influencerzy' },
    { href: '/campaigns', label: 'Kampanie' },
    { href: '/audit-logs', label: 'Logi' },
  ] as const;

  return (
    <nav className="tabs tabs-boxed">
      {items.map((it) => (
        <a key={it.href} className="tab" href={it.href}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}

