// ============================================================
//  KADH Collective — Static Brand Configuration
//  config.js
//
//  Edit this file to update brand copy, social links, and
//  other rarely-changing values. Push to GitHub to deploy.
//
//  ─── WHAT GOES HERE ────────────────────────────────────────
//  Things that almost never change without a brand refresh:
//    - Hero / About / Community page copy
//    - Brand colors and typography tokens
//    - Social media URLs
//    - Courier tracking URL templates
//
//  ─── WHAT GOES IN site_settings INSTEAD ───────────────────
//  Things that change without a brand refresh — edit these
//  in the Admin panel, not here:
//    - Shipping zones and prices
//    - WhatsApp number and message templates
//    - Currency exchange rates (auto-refreshed)
//    - API keys (Resend, EasyParcel, Stripe pub key)
//    - BNPL on/off toggle
// ============================================================

window.KADH_CONFIG = {

  // ─── Brand identity ────────────────────────────────────────
  brand: {
    name:        'KADH Collective',
    tagline:     'Modest abayas, crafted in quiet elegance.',
    established: '2024, Kuala Lumpur',
  },

  // ─── Hero section (landing page) ──────────────────────────
  hero: {
    eyebrow:    'New Collection — Raya 2025',
    titleLine1: 'Dressed in',
    titleLine2: 'quiet elegance',
    subtitle:   'Abayas crafted for the modern Muslim woman — modest, refined, and made to move with you.',
    badge:      'Worldwide shipping available',
    primaryCta:   { label: 'Shop Collection', href: '#collection' },
    secondaryCta: { label: 'Our Story',       href: '/about' },
  },

  // ─── Footer ───────────────────────────────────────────────
  footer: {
    tagline:       'Modest fashion, thoughtfully made.',
    address:       'Kuala Lumpur, Malaysia',
    contactEmail:  'hello@kadhcollective.com',
    copyrightYear: 2024,
  },

  // ─── Social links ─ leave empty string '' to hide ─────────
  social: {
    instagram: 'https://instagram.com/kadhcollective',
    tiktok:    '',
    pinterest: '',
    facebook:  '',
  },

  // ─── Brand color tokens (matches existing CSS variables) ──
  colors: {
    maroon: '#6B0E0E',
    cream:  '#F2F0ED',
    ink:    '#000000',
    paper:  '#FFFFFF',
    border: '#ddd9d3',
    muted:  '#999999',
  },

  // ─── Typography ───────────────────────────────────────────
  fonts: {
    display: "'Forum', Georgia, serif",
    body:    "'Tenor Sans', Georgia, serif",
  },

  // ─── Courier tracking URL templates ───────────────────────
  // Replace {{tracking}} with the AWB / tracking number.
  courierTrackingUrls: {
    'pos-laju': 'https://www.pos.com.my/tracking?id={{tracking}}',
    'jnt':      'https://www.jtexpress.my/tracking?awb={{tracking}}',
    'gdex':     'https://www.gdexpress.com/tracking?ref={{tracking}}',
    'dhl':      'https://www.dhl.com/track?awb={{tracking}}',
    'fedex':    'https://www.fedex.com/fedextrack/?trknbr={{tracking}}',
    'aramex':   'https://www.aramex.com/track/results?ShipmentNumber={{tracking}}',
  },

  // ─── About Us page (filled in Phase 5) ────────────────────
  about: {
    // Drafted in Phase 5: Story, Values, Behind The Process, All Girls Community
  },

  // ─── Community page (filled in Phase 5) ───────────────────
  community: {
    // Drafted in Phase 5: IG embed, Journal, Events, Newsletter signup
  },

}
