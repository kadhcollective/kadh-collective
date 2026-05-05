// ============================================================
//  KADH Collective — Static Brand Configuration
//  Edit this file to update brand copy, social links, and
//  other rarely-changing values. Push to GitHub to deploy.
//
//  Operational values (shipping, WhatsApp #, FX, API keys)
//  live in the Supabase site_settings table — edit those
//  in the admin panel, not here.
// ============================================================

window.KADH_CONFIG = {

  // ─── Brand identity
  brand: {
    name:        'KADH Collective',
    tagline:     'Modest abayas, crafted in quiet elegance.',
    established: '2024, Kuala Lumpur',
  },

  // ─── Hero section (landing page)
  hero: {
    eyebrow:    'New Collection — Raya 2025',
    titleLine1: 'Dressed in',
    titleLine2: 'quiet elegance',
    subtitle:   'Abayas crafted for the modern Muslim woman — modest, refined, and made to move with you.',
    badge:      'Worldwide shipping available',
    primaryCta:   { label: 'Shop Collection', href: '#collection' },
    secondaryCta: { label: 'Our Story',       href: '/about' },
  },

  // ─── Footer
  footer: {
    tagline:       'Modest fashion, thoughtfully made.',
    address:       'Kuala Lumpur, Malaysia',
    contactEmail:  'hello@kadhcollective.com',
    copyrightYear: 2024,
  },

  // ─── Social links — leave '' to hide
  social: {
    instagram: 'https://instagram.com/kadhcollective',
    tiktok:    '',
    pinterest: '',
    facebook:  '',
  },

  // ─── Brand color tokens
  colors: {
    maroon: '#6B0E0E',
    cream:  '#F2F0ED',
    ink:    '#000000',
    paper:  '#FFFFFF',
    border: '#ddd9d3',
    muted:  '#999999',
  },

  // ─── Typography
  fonts: {
    display: "'Forum', Georgia, serif",
    body:    "'Tenor Sans', Georgia, serif",
  },

  // ─── Courier tracking URLs (replace {{tracking}})
  courierTrackingUrls: {
    'pos-laju': 'https://www.pos.com.my/tracking?id={{tracking}}',
    'jnt':      'https://www.jtexpress.my/tracking?awb={{tracking}}',
    'gdex':     'https://www.gdexpress.com/tracking?ref={{tracking}}',
    'dhl':      'https://www.dhl.com/track?awb={{tracking}}',
    'fedex':    'https://www.fedex.com/fedextrack/?trknbr={{tracking}}',
    'aramex':   'https://www.aramex.com/track/results?ShipmentNumber={{tracking}}',
  },

  // ─── About Us page copy (filled in Phase 5)
  about: {},

  // ─── Community page copy (filled in Phase 5)
  community: {},

}
