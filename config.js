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

  // ─── About Us page copy
  about: {
    eyebrow:  'Our Story',
    title:    'Modesty without compromise.',
    subtitle: 'KADH was born from a simple observation: that the modern Muslim woman deserves clothing that moves with her, not against her.',

    blocks: [
      {
        eyebrow: 'Our Story',
        title:   'Founded in Kuala Lumpur, made for everywhere',
        body:    "KADH was started in 2024 with one promise — that an abaya should feel as considered as the woman who wears it. We grew tired of choosing between modesty and ease, between elegance and the realities of daily life. So we made the brand we wanted to wear. Every collection begins with a question: what would she actually want?",
      },
      {
        eyebrow: 'Our Values',
        title:   'What we stand for',
        body:    "Modesty without compromise. Craftsmanship over speed. Pieces built for everyday rhythm — for prayer, work, school runs, and the quiet moments in between. We choose intention over trend, and we'd rather make fewer things well than many things fast.",
      },
      {
        eyebrow: 'Behind The Process',
        title:   'Slow on purpose',
        body:    "Each piece begins as a conversation — between us, our seamstresses, and the women who'll wear it. We work in small batches with fabric chosen for breathability and drape. Every abaya is hand-finished in our atelier in KL: seams pressed twice, hems blind-stitched, labels sewn by hand. Built to last seasons, not trends.",
      },
      {
        eyebrow: 'The All-Girls Community',
        title:   'A sisterhood, not a customer base',
        body:    "KADH is more than a label. The women who wear our pieces are part of the brand — not as customers, but as collaborators. We host gatherings, listen to feedback, and design with their lives in mind. There is no marketing without them. There is no KADH without them.",
      },
    ],

    cta: {
      title:     'Step into the collection.',
      subtitle:  'Pieces made with intention, ready when you are.',
      primary:   { label: 'Shop Collection',     href: '#collection' },
      secondary: { label: 'Join the Community',  href: '/community' },
    },
  },

  // ─── Community page copy (Phase 5c)
  community: {
    eyebrow:  'Community',
    title:    'A sisterhood, gathered.',
    subtitle: 'Stories, gatherings, and the women behind KADH. This is the heart of what we do.',

    // ─── Instagram strip — manually-curated tiles ─────────────
    // Edit these to feature your favourite IG posts. Each tile
    // links to the post; image is the post's cover. Aim for 6.
    // (Live IG API integration deferred — too much friction for V1.)
    instagram: {
      handle: '@kadhcollective',
      tiles: [
        // { image: 'https://...jpg', url: 'https://instagram.com/p/XXX' },
      ],
    },

    journal: {
      eyebrow: 'Journal',
      title:   'Field notes.',
      empty:   'New entries are on the way. Check back soon.',
    },

    events: {
      eyebrow:        'Events',
      title:          'Where we gather.',
      upcomingHeader: 'Upcoming',
      pastHeader:     'Past gatherings',
      empty:          'No events scheduled right now. Watch this space.',
    },

    newsletter: {
      eyebrow:    'Stay close',
      title:      'Letters from KADH.',
      subtitle:   'Collection drops, restocks, and small notes from our atelier. No spam — promise.',
      ctaLabel:   'Subscribe',
      successMsg: "Thank you. We'll be in touch soon.",
      errorMsg:   "Something went wrong. Please try again.",
      dupeMsg:    "You're already on the list — thank you.",
    },
  },

}
