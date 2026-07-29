/**
 * LandingPage – editorial content landing shown on first visit per browser session.
 *
 * Purpose: Google AdSense requires publisher-content pages (not tool/navigation pages).
 * This page satisfies that requirement while showcasing the platform.
 * Once the user clicks "Enter Live Tracker", sessionStorage is set and subsequent
 * page loads go straight to the globe.
 */

import React, { useEffect, useRef, useState } from 'react';

// AdSense auto ad
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || 'ca-pub-6813391861469052';
const ADSENSE_SLOT   = import.meta.env.VITE_ADSENSE_SLOT   || '';

function AdUnit({ className = '' }) {
  const ref = useRef(null);
  const pushed = useRef(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!ADSENSE_SLOT || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch { setBlocked(true); }
  }, []);

  useEffect(() => {
    if (!ADSENSE_SLOT) return;
    const t = setTimeout(() => {
      if (ref.current && ref.current.offsetHeight === 0) setBlocked(true);
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  if (!ADSENSE_SLOT || blocked) return null;

  return (
    <div className={className}>
      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 2, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Advertisement
      </p>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

// ── Static editorial content ──────────────────────────────────────────────────

const CONFLICT_ZONES = [
  {
    id: 'ukraine',
    name: 'Ukraine–Russia War',
    flag: '🇺🇦',
    status: 'Active',
    color: '#ff6b35',
    href: '/conflicts/ukraine-russia.html',
    summary: `The war in Ukraine has entered its fourth year with fighting concentrated along a roughly 1,000-kilometre front line stretching from Kherson in the south through Zaporizhzhia, Donetsk, and Luhansk oblasts to the Kharkiv region in the north-east. Russian forces have maintained pressure on multiple axes, while Ukrainian defences have relied heavily on Western-supplied artillery, air defence systems, and domestically produced long-range drones capable of reaching deep into Russian territory.

Air activity remains intense on both sides. Russian aerospace forces continue to launch regular waves of Shahed-136 loitering munitions and Kalibr cruise missiles targeting Ukrainian infrastructure, particularly power generation and substations. Ukraine's F-16 fleet, augmented by transfers from NATO partners, has improved but not eliminated Russian air superiority. ADS-B data on this platform reflects military aircraft operating at the edges of their transponder coverage areas near the conflict zone.

Naval operations in the Black Sea shifted dramatically after Ukraine's successful anti-ship drone campaign forced Russian surface vessels to retreat from the western Black Sea. Ukraine's grain export corridor has largely held, though periodic Russian missile strikes continue to threaten port infrastructure at Odesa.`,
  },
  {
    id: 'taiwan',
    name: 'Taiwan Strait',
    flag: '🇹🇼',
    status: 'Elevated Tension',
    color: '#00e5ff',
    href: '/conflicts/taiwan-strait.html',
    summary: `The Taiwan Strait remains one of the world's most closely watched military flashpoints. People's Liberation Army Air Force (PLAAF) incursions into Taiwan's Air Defence Identification Zone (ADIZ) have become a near-daily occurrence, with sorties by J-10, J-11, J-16, and H-6 aircraft tracked by the Republic of China Air Force and reported through official channels.

People's Liberation Army Navy (PLAN) exercises have grown in frequency and complexity, including multi-carrier task group operations in the Western Pacific that challenge US Navy freedom-of-navigation operations. The USS Ronald Reagan and USS Carl Vinson carrier strike groups have both conducted patrols in the Indo-Pacific region, with their AIS tracks visible on this platform during non-emission-control periods.

Japan's Air Self-Defence Force has scrambled fighters at record rates to intercept Chinese and Russian aircraft approaching the Japanese archipelago. The Australia–UK–US (AUKUS) nuclear submarine agreement has added a long-term dimension to Indo-Pacific security architecture that extends the strategic competition well beyond the strait itself.`,
  },
  {
    id: 'red-sea',
    name: 'Red Sea / Yemen',
    flag: '🇾🇪',
    status: 'Active Operations',
    color: '#ff3d71',
    href: '/conflicts/red-sea.html',
    summary: `Houthi (Ansar Allah) attacks on commercial and military shipping in the Red Sea and Gulf of Aden have continued to disrupt one of the world's most critical maritime trade routes. The group has employed a combination of anti-ship ballistic missiles, cruise missiles, and one-way attack drones (UAVs) targeting vessels it considers linked to Israel or Western nations supporting Israeli operations in Gaza.

The US-led Operation Prosperity Guardian and the parallel EU Operation Aspides provide naval escort and active air defence for commercial shipping transiting the corridor. US Navy Arleigh Burke-class destroyers, including USS Gravely, USS Mason, and USS Carney, have intercepted dozens of Houthi missiles and drones using SM-2 and SM-6 air defence missiles. Their AIS tracks appear intermittently on this platform.

The economic impact has been significant: shipping insurance premiums for Red Sea transits have risen sharply, and major carriers including Maersk, MSC, and CMA CGM have rerouted vessels around the Cape of Good Hope, adding 10-14 days to Europe-Asia voyages and raising global freight costs.`,
  },
  {
    id: 'south-china-sea',
    name: 'South China Sea',
    flag: '🌏',
    status: 'Ongoing Dispute',
    color: '#00ff88',
    href: '/conflicts/south-china-sea.html',
    summary: `The South China Sea dispute remains a persistent source of regional tension involving overlapping territorial claims by China, Vietnam, the Philippines, Malaysia, Brunei, and Taiwan. China's extensive artificial island construction in the Spratly and Paracel Islands — complete with military runways, hangars, radar installations, and surface-to-air missile systems — has fundamentally altered the strategic landscape of the region.

Philippine Coast Guard and Navy vessels operating in waters near Scarborough Shoal and the Second Thomas Shoal (Ayungin Shoal) have reported repeated confrontations with China Coast Guard and maritime militia vessels attempting to block resupply missions to the BRP Sierra Madre, a deliberately grounded ship serving as a forward operating base.

US Navy carrier strike groups and the Japan Maritime Self-Defence Force conduct regular transits asserting freedom of navigation under international law. B-52H Stratofortress bombers from Andersen Air Force Base in Guam make regular overflights. PLAN warship and Type-054A frigate positions are tracked via AIS on this platform.`,
  },
];

const FEATURES = [
  { icon: '✈', title: 'Military Aircraft', desc: 'Track fighters, bombers, tankers, ISR aircraft, and drones in real time using public ADS-B transponder data from cooperative networks worldwide.' },
  { icon: '⚓', title: 'Naval Vessels', desc: 'Monitor aircraft carriers, destroyers, frigates, and submarines globally using public AIS transponder feeds — updated every 30 seconds.' },
  { icon: '🔥', title: 'NASA FIRMS Fire Data', desc: 'Satellite thermal anomalies from NASA\'s FIRMS system identify hotspots including potential airstrikes, industrial fires, and battlefield activity.' },
  { icon: '📰', title: 'Geolocated War News', desc: 'Breaking conflict news from the GDELT Project — geocoded and pinned to the globe so you can read what\'s happening at each location.' },
  { icon: '🤖', title: 'AI Threat Analysis', desc: 'On-demand AI-generated intelligence summaries for selected aircraft and vessels, including mission assessment and threat level (Pro).' },
  { icon: '📷', title: 'Live Conflict Cameras', desc: 'Curated live camera feeds from active conflict regions — Ukraine frontlines, Korean DMZ, Taiwan Strait and more (Pro).' },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function LandingPage({ onEnter }) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ background: '#050810', color: '#c0cfe0', fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", minHeight: '100vh', overflowY: 'auto' }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <header style={{ background: 'rgba(0,229,255,0.04)', borderBottom: '1px solid rgba(0,229,255,0.12)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00e5ff', letterSpacing: '0.06em' }}>LiveWar3D</span>
          <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#4a5568', letterSpacing: '0.15em', textTransform: 'uppercase', paddingLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            Real-Time Military Intelligence
          </span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {[
            { href: '/about.html', label: 'About' },
            { href: '/conflicts/ukraine-russia.html', label: 'Conflicts' },
            { href: '/privacy.html', label: 'Privacy' },
          ].map(({ href, label }) => (
            <a key={href} href={href} style={{ color: '#8a9bb0', fontSize: '0.85rem', textDecoration: 'none' }}>{label}</a>
          ))}
          <button
            onClick={onEnter}
            style={{ background: '#00e5ff', color: '#050810', fontWeight: 700, fontSize: '0.85rem', padding: '7px 18px', borderRadius: 5, border: 'none', cursor: 'pointer', letterSpacing: '0.04em' }}
          >
            Launch Tracker →
          </button>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '56px 24px 40px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#4a5568', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
          ● LIVE INTELLIGENCE PLATFORM
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
          The World's Military Activity,{' '}
          <span style={{ color: '#00e5ff' }}>Tracked in Real Time</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#8a9bb0', maxWidth: 620, margin: '0 auto 32px', lineHeight: 1.7 }}>
          LiveWar3D aggregates live ADS-B transponder, AIS vessel, NASA fire satellite, GDELT news, and ACLED conflict data onto a single interactive 3D globe — updated every 30 seconds. Free, open, and built for journalists, researchers, and citizens who need to understand what's happening now.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onEnter}
            style={{ background: '#00e5ff', color: '#050810', fontWeight: 800, fontSize: '1rem', padding: '14px 36px', borderRadius: 6, border: 'none', cursor: 'pointer', letterSpacing: '0.05em' }}
          >
            ▶ Open Live 3D Tracker
          </button>
          <a
            href="/about.html"
            style={{ color: '#00ff88', fontSize: '1rem', fontWeight: 600, padding: '14px 24px', borderRadius: 6, border: '1px solid rgba(0,255,136,0.3)', textDecoration: 'none', display: 'inline-block' }}
          >
            Learn More
          </a>
        </div>
        {/* Live stats strip */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 36, flexWrap: 'wrap' }}>
          {[
            { value: '100+', label: 'Aircraft Categories' },
            { value: '30s', label: 'Update Interval' },
            { value: '50+', label: 'Conflict Zones' },
            { value: '100%', label: 'Free & Open' },
          ].map(({ value, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#00e5ff', fontFamily: 'monospace' }}>{value}</div>
              <div style={{ fontSize: '0.75rem', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AdSense unit (leaderboard) ─────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto 8px', padding: '0 24px' }}>
        <AdUnit />
      </div>

      {/* ── Intelligence Brief ─────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 48px' }}>
        <div style={{ borderBottom: '1px solid rgba(0,255,136,0.2)', marginBottom: 24, paddingBottom: 10, display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00ff88', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
            ▸ Active Conflict Zones
          </h2>
          <span style={{ fontSize: '0.75rem', color: '#4a5568', fontFamily: 'monospace' }}>{today}</span>
        </div>

        <div style={{ display: 'grid', gap: 24 }}>
          {CONFLICT_ZONES.map((zone, i) => (
            <article
              key={zone.id}
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '20px 24px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: '1.2rem' }}>{zone.flag}</span>
                <h3 style={{ color: zone.color, fontWeight: 700, fontSize: '1rem', fontFamily: 'monospace' }}>{zone.name}</h3>
                <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontFamily: 'monospace', color: zone.color, background: `${zone.color}18`, padding: '2px 8px', borderRadius: 3, border: `1px solid ${zone.color}40` }}>
                  ● {zone.status}
                </span>
              </div>
              {zone.summary.split('\n\n').map((para, j) => (
                <p key={j} style={{ fontSize: '0.9rem', color: '#8a9bb0', lineHeight: 1.75, marginBottom: j < zone.summary.split('\n\n').length - 1 ? 12 : 0 }}>
                  {para}
                </p>
              ))}
              <div style={{ marginTop: 16 }}>
                <a href={zone.href} style={{ color: zone.color, fontSize: '0.8rem', fontFamily: 'monospace', textDecoration: 'none', borderBottom: `1px solid ${zone.color}50`, paddingBottom: 1 }}>
                  Full briefing & tracking data →
                </a>
                <button
                  onClick={onEnter}
                  style={{ marginLeft: 20, color: '#00e5ff', fontSize: '0.8rem', fontFamily: 'monospace', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  View live on 3D globe →
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* ── AdSense unit (in-content) ──────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto 16px', padding: '0 24px' }}>
        <AdUnit />
      </div>

      {/* ── Features ───────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 56px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00ff88', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace', borderBottom: '1px solid rgba(0,255,136,0.2)', paddingBottom: 10, marginBottom: 24 }}>
          ▸ Platform Features
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(0,229,255,0.1)', borderRadius: 8, padding: 18 }}>
              <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{icon}</div>
              <h3 style={{ color: '#00e5ff', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{title}</h3>
              <p style={{ color: '#6a7d94', fontSize: '0.85rem', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Data Sources ───────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 56px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00ff88', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace', borderBottom: '1px solid rgba(0,255,136,0.2)', paddingBottom: 10, marginBottom: 20 }}>
          ▸ Open-Source Data Only
        </h2>
        <p style={{ fontSize: '0.95rem', color: '#8a9bb0', lineHeight: 1.75, marginBottom: 16 }}>
          LiveWar3D operates exclusively on publicly available, unclassified data. Every position, every news pin, every fire hotspot — all sourced from open networks accessible to anyone. We aggregate, we enrich with context, and we display. No government feed. No backdoors. No classified access.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {[
            { name: 'adsb.lol / adsb.fi', type: 'ADS-B Aircraft Positions' },
            { name: 'Public AIS Aggregators', type: 'Naval Vessel Positions' },
            { name: 'GDELT Project', type: 'Conflict News Events' },
            { name: 'NASA FIRMS', type: 'Satellite Fire / Thermal' },
            { name: 'ACLED', type: 'Armed Conflict Events' },
            { name: 'YouTube / EarthCam', type: 'Live Conflict Cameras' },
          ].map(({ name, type }) => (
            <div key={name} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '10px 14px' }}>
              <div style={{ color: '#00e5ff', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace' }}>{name}</div>
              <div style={{ color: '#4a5568', fontSize: '0.75rem', marginTop: 2 }}>{type}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA Banner ─────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(0,229,255,0.05)', borderTop: '1px solid rgba(0,229,255,0.12)', borderBottom: '1px solid rgba(0,229,255,0.12)', padding: '40px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>
          Start Monitoring Now — <span style={{ color: '#00e5ff' }}>100% Free</span>
        </h2>
        <p style={{ color: '#8a9bb0', fontSize: '1rem', maxWidth: 500, margin: '0 auto 24px', lineHeight: 1.7 }}>
          No registration required. No download needed. The live 3D tracker runs in any modern browser with WebGL support.
        </p>
        <button
          onClick={onEnter}
          style={{ background: '#00e5ff', color: '#050810', fontWeight: 800, fontSize: '1.1rem', padding: '14px 44px', borderRadius: 6, border: 'none', cursor: 'pointer', letterSpacing: '0.05em' }}
        >
          ▶ Open Live Tracker
        </button>
      </div>

      {/* ── Footer AdSense ─────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px 0' }}>
        <AdUnit />
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '24px', textAlign: 'center', color: '#4a5568', fontSize: '0.82rem', marginTop: 16 }}>
        <p>&copy; 2026 LiveWar3D. All rights reserved. Not affiliated with any government, military, or intelligence agency. All data is publicly available.</p>
        <p style={{ marginTop: 8 }}>
          {[
            { href: '/about.html', label: 'About' },
            { href: '/conflicts/ukraine-russia.html', label: 'Conflicts' },
            { href: '/privacy.html', label: 'Privacy Policy' },
            { href: '/terms.html', label: 'Terms of Use' },
            { href: 'mailto:info@livewar3d.com', label: 'Contact' },
          ].map(({ href, label }, i) => (
            <React.Fragment key={href}>
              {i > 0 && <span style={{ margin: '0 8px' }}>·</span>}
              <a href={href} style={{ color: '#8a9bb0', textDecoration: 'none' }}>{label}</a>
            </React.Fragment>
          ))}
        </p>
      </footer>

    </div>
  );
}
