'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Work' },
  { href: '/shop', label: 'Shop' },
] as const

const NavLinks = () => {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1" aria-label="Primary">
      {LINKS.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'type-button rounded-pill px-3 py-2 transition-colors',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default NavLinks
