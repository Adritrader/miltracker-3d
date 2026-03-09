/**
 * LegalModal – full-screen modal for Privacy Policy, Cookie Policy and Terms of Use.
 * Opens via CookieBanner links or FooterLinks component.
 * Styled to match the LiveWar3D dark military HUD aesthetic.
 */

import React, { useEffect } from 'react';

const SITE = 'livewar3d.com';
const DATE = 'March 9, 2026';
const EMAIL = 'legal@livewar3d.com';

// ── Content ───────────────────────────────────────────────────────────────────

const PRIVACY_CONTENT = () => (
  <>
    <Section title="1. Who We Are">
      <P>LiveWar3D (<b>livewar3d.com</b>) is a public, free-to-use military situation-awareness platform. We aggregate publicly available data from open sources (ADS-B feeds, AIS transponders, GDELT news, NASA FIRMS) and present it on an interactive 3D globe.</P>
      <P>Contact: <a href={`mailto:${EMAIL}`} className="underline" style={{ color: '#00e5ff' }}>{EMAIL}</a></P>
    </Section>
    <Section title="2. Data We Collect">
      <P>We collect minimal data required to operate the service:</P>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <Li><b>Locally stored preferences</b> — filters, basemap selection and tracked entities are saved in your browser's <code>localStorage</code>. This data never leaves your device.</Li>
        <Li><b>Cookie consent record</b> — when you accept or decline cookies we store that choice locally in <code>localStorage</code>.</Li>
        <Li><b>Anonymous analytics</b> — if you accept analytics cookies, we may collect aggregated, anonymized data such as page views, session duration and feature interactions. No personally identifiable information (PII) is stored.</Li>
        <Li><b>Server logs</b> — our backend (hosted on Railway) may log IP addresses in standard access logs for security and debugging purposes. Logs are retained for a maximum of 30 days.</Li>
      </ul>
    </Section>
    <Section title="3. Data We Do NOT Collect">
      <ul className="list-disc list-inside space-y-1">
        <Li>We do not collect names, email addresses, or any registration data — no account is required.</Li>
        <Li>We do not sell, share, or trade any data with third parties.</Li>
        <Li>We do not use advertising networks or behavioural tracking.</Li>
      </ul>
    </Section>
    <Section title="4. Third-Party Data Sources">
      <P>The application displays data from the following public sources:</P>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <Li>ADS-B flight data: <b>adsb.lol</b>, <b>adsb.fi</b> (public cooperative network)</Li>
        <Li>AIS vessel data: public AIS aggregators</Li>
        <Li>News events: <b>GDELT Project</b> (gdeltproject.org)</Li>
        <Li>Fire / hotspot data: <b>NASA FIRMS</b> (firms.modaps.eosdis.nasa.gov)</Li>
        <Li>Live cameras: publicly accessible YouTube live streams and EarthCam feeds</Li>
      </ul>
      <P>We do not control these sources and are not responsible for their content or availability.</P>
    </Section>
    <Section title="5. Your Rights (GDPR / CCPA)">
      <P>You have the right to: access any data we hold about you; request deletion; withdraw cookie consent at any time by clearing your browser's localStorage; lodge a complaint with your local data protection authority.</P>
      <P>To exercise any of these rights, contact us at <a href={`mailto:${EMAIL}`} className="underline" style={{ color: '#00e5ff' }}>{EMAIL}</a>.</P>
    </Section>
    <Section title="6. Data Retention">
      <P>Browser-stored preferences are kept until you clear them or uninstall the PWA. Server access logs are deleted after 30 days. We do not maintain any external database of user data.</P>
    </Section>
    <Section title="7. Security">
      <P>All traffic is encrypted via HTTPS/WSS. The backend implements CORS restrictions, rate limiting, and input validation. We follow OWASP best practices.</P>
    </Section>
    <Section title="8. Changes to This Policy">
      <P>We may update this Privacy Policy. The "Last updated" date at the top of this page will reflect any changes. Continued use of the service constitutes acceptance.</P>
    </Section>
  </>
);

const COOKIES_CONTENT = () => (
  <>
    <Section title="1. What Are Cookies">
      <P>Cookies and similar technologies (such as <code>localStorage</code>) are small pieces of data stored in your browser. LiveWar3D uses <code>localStorage</code> (client-side storage) rather than HTTP cookies, so no data is transmitted to our servers with each request.</P>
    </Section>
    <Section title="2. Essential Storage (Always Active)">
      <P>These are required for the application to function correctly:</P>
      <table className="w-full text-xs mt-2 border-collapse">
        <thead>
          <tr style={{ color: '#00ff88', borderBottom: '1px solid rgba(0,255,136,0.2)' }}>
            <Th>Key</Th><Th>Purpose</Th><Th>Retention</Th>
          </tr>
        </thead>
        <tbody style={{ color: '#8a9bb0' }}>
          <tr><Td><code>milt_filters</code></Td><Td>Your selected map filters (aircraft, ships, etc.)</Td><Td>Until cleared</Td></tr>
          <tr><Td><code>milt_basemap</code></Td><Td>Selected map style (dark, satellite, etc.)</Td><Td>Until cleared</Td></tr>
          <tr><Td><code>milt_tracked</code></Td><Td>Your tracked aircraft / vessels</Td><Td>Until cleared</Td></tr>
          <tr><Td><code>lw3d_cookie_consent</code></Td><Td>Your cookie consent preference</Td><Td>Until cleared</Td></tr>
        </tbody>
      </table>
    </Section>
    <Section title="3. Analytics Storage (Optional)">
      <P>Only activated if you choose "Accept All". These collect aggregated, anonymous usage statistics to help us improve the application. No PII is involved.</P>
      <P>You can withdraw this consent at any time by clearing your browser's localStorage or by re-visiting the cookie banner (clear <code>lw3d_cookie_consent</code> from DevTools → Application → Local Storage).</P>
    </Section>
    <Section title="4. Third-Party Embeds">
      <P>When you open a live camera feed (YouTube, EarthCam), that service may set its own cookies subject to its own privacy policy. We do not control these cookies. Camera feeds are only loaded on explicit user action (clicking a camera pin).</P>
    </Section>
    <Section title="5. Managing Cookies">
      <P>You can clear all LiveWar3D storage at any time via your browser's developer tools (Application → Local Storage → livewar3d.com → Clear All). This will reset all preferences and consent choices.</P>
    </Section>
  </>
);

const TERMS_CONTENT = () => (
  <>
    <Section title="1. Acceptance">
      <P>By accessing or using LiveWar3D (<b>livewar3d.com</b>) you agree to these Terms of Use. If you do not agree, do not use the service.</P>
    </Section>
    <Section title="2. Description of Service">
      <P>LiveWar3D is a free, read-only situational-awareness tool that aggregates publicly available data from open sources. It is intended for informational and educational purposes only. The service is not affiliated with any government, military organisation, intelligence agency, or defence contractor.</P>
    </Section>
    <Section title="3. Permitted Use">
      <ul className="list-disc list-inside space-y-1">
        <Li>Personal, non-commercial situational awareness and research.</Li>
        <Li>Journalism, academic research, and open-source intelligence (OSINT) analysis.</Li>
        <Li>Educational use in schools, universities, and training institutions.</Li>
      </ul>
    </Section>
    <Section title="4. Prohibited Use">
      <ul className="list-disc list-inside space-y-1">
        <Li>Using the service to plan, facilitate, or support any illegal activity.</Li>
        <Li>Automated scraping or bulk extraction of data without prior written consent.</Li>
        <Li>Re-publishing or commercialising our data aggregation without attribution.</Li>
        <Li>Attempting to disrupt the service, its infrastructure, or backend systems.</Li>
        <Li>Presenting LiveWar3D data as authoritative or official military intelligence.</Li>
      </ul>
    </Section>
    <Section title="5. Data Accuracy Disclaimer">
      <P><b>IMPORTANT:</b> All data displayed is sourced from public, cooperative networks and may be delayed, incomplete, or inaccurate. ADS-B and AIS transponder coverage is not global. Aircraft and vessels may not broadcast their true identity or position. <b>LiveWar3D makes no warranty as to the accuracy, completeness, or fitness for any purpose of the data displayed.</b></P>
      <P>Do not use this service for navigation, operational planning, or any safety-critical decision-making.</P>
    </Section>
    <Section title="6. Intellectual Property">
      <P>The LiveWar3D application code, UI design, and branding are protected by copyright. The underlying tracking data belongs to its respective public-domain or open-license sources. You may share screenshots with attribution to <b>livewar3d.com</b>.</P>
    </Section>
    <Section title="7. Limitation of Liability">
      <P>To the maximum extent permitted by law, LiveWar3D and its operators shall not be liable for any direct, indirect, incidental, or consequential damages arising from use of, or inability to use, this service.</P>
    </Section>
    <Section title="8. Availability">
      <P>We make no guarantee of uptime or continuous availability. The service may be suspended or terminated at any time without notice.</P>
    </Section>
    <Section title="9. Governing Law">
      <P>These terms are governed by applicable law. Disputes shall be resolved in the jurisdiction of the service operator.</P>
    </Section>
    <Section title="10. Contact">
      <P>Questions about these terms: <a href={`mailto:${EMAIL}`} className="underline" style={{ color: '#00e5ff' }}>{EMAIL}</a></P>
    </Section>
  </>
);

// ── Micro-components ──────────────────────────────────────────────────────────

const Section = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="font-mono font-bold text-sm mb-2" style={{ color: '#00ff88' }}>{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const P = ({ children }) => (
  <p className="font-mono text-xs leading-relaxed" style={{ color: '#c0cfe0' }}>{children}</p>
);

const Li = ({ children }) => (
  <li className="font-mono text-xs leading-relaxed" style={{ color: '#c0cfe0' }}>{children}</li>
);

const Th = ({ children }) => (
  <th className="text-left py-1 px-2 font-mono text-xs font-bold">{children}</th>
);

const Td = ({ children }) => (
  <td className="py-1 px-2 font-mono text-xs border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>{children}</td>
);

// ── Config ────────────────────────────────────────────────────────────────────

const PAGES = {
  privacy: {
    title: 'Privacy Policy',
    subtitle: `Last updated: ${DATE}`,
    content: PRIVACY_CONTENT,
  },
  cookies: {
    title: 'Cookie Policy',
    subtitle: `Last updated: ${DATE}`,
    content: COOKIES_CONTENT,
  },
  terms: {
    title: 'Terms of Use',
    subtitle: `Last updated: ${DATE}`,
    content: TERMS_CONTENT,
  },
};

// ── Modal ─────────────────────────────────────────────────────────────────────

const LegalModal = ({ page, onClose }) => {
  const cfg = PAGES[page];

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!cfg) return null;
  const Content = cfg.content;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col rounded-lg overflow-hidden w-full"
        style={{
          maxWidth: 720,
          maxHeight: '88vh',
          background: 'rgba(5,8,16,0.98)',
          border: '1px solid rgba(0,255,136,0.2)',
          boxShadow: '0 0 48px rgba(0,229,255,0.06)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(0,255,136,0.15)', background: 'rgba(0,0,0,0.4)' }}
        >
          <div>
            <div className="font-mono font-bold text-sm tracking-widest" style={{ color: '#00ff88' }}>
              ⬡ LIVEWAR3D — {cfg.title.toUpperCase()}
            </div>
            <div className="font-mono text-xs mt-0.5" style={{ color: '#4a6080' }}>
              {cfg.subtitle}
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-xl leading-none transition-colors hover:text-white ml-4"
            style={{ color: '#4a6080' }}
            title="Close"
          >&times;</button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Content />
        </div>

        {/* Footer */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-2.5"
          style={{ borderTop: '1px solid rgba(0,255,136,0.1)', background: 'rgba(0,0,0,0.3)' }}
        >
          <span className="font-mono text-xs" style={{ color: '#2a3a50' }}>
            {SITE}
          </span>
          <button
            onClick={onClose}
            className="font-mono text-xs px-4 py-1 rounded font-bold transition-all hover:opacity-90"
            style={{ background: '#00ff88', color: '#050810' }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
