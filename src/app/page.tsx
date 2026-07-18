"use client";

import { useEffect, useRef } from "react";

const PHONE_DISPLAY = "(316) 555-0142";
const PHONE_TEL = "+13165550142";

const NAV = [
  { label: "Systems", href: "#systems" },
  { label: "Verticals", href: "#verticals" },
  { label: "Approach", href: "#approach" },
  { label: "Coverage", href: "#coverage" },
];

const STATS = [
  { value: "40", suffix: "+", label: "Years of combined roofing experience" },
  { value: "Statewide", suffix: "", label: "Kansas coverage, corner to corner" },
  { value: "0.71", suffix: "", label: "EMR safety rating" },
];

const SYSTEMS = [
  { name: "TPO", note: "Single-ply thermoplastic membrane for reflective, energy-efficient low-slope roofs." },
  { name: "PVC", note: "Chemical- and fire-resistant membrane for restaurants, plants, and processing." },
  { name: "EPDM", note: "Durable synthetic rubber built to take Kansas heat, hail, and freeze cycles." },
  { name: "Wind-Vented", note: "Engineered systems that use uplift to hold the membrane down in high wind." },
  { name: "Coatings", note: "Restoration coatings that extend roof life and seal without a full tear-off." },
  { name: "BUR / Mod-Bit", note: "Built-up and modified bitumen assemblies for proven, layered protection." },
  { name: "Metal", note: "Standing seam and structural metal for long-span, long-life roofs." },
  { name: "Roofscapes", note: "Green roof and rooftop assemblies that add value above the deck." },
];

const VERTICALS = [
  "Hospitality", "Education", "Federal", "Multi-Family", "Aviation",
  "Churches", "Retail", "Healthcare", "Technology", "Food Processing",
  "Warehousing & Logistics", "Sports & Recreation", "Manufacturing",
  "Cultural & Entertainment", "Penitentiaries",
];

const APPROACH = [
  {
    kicker: "Free Storm Report & Inspection",
    title: "We start on the roof, not in a quote.",
    body:
      "Every engagement opens with a free, no-obligation roof inspection and evaluation report. We document the deck, the membrane, the flashings, and the storm damage \u2014 then hand you an honest read on what your building actually needs, before a dollar is spent.",
  },
  {
    kicker: "24/7 Emergency Service",
    title: "A leak doesn't wait for business hours.",
    body:
      "When water is coming in, response time is everything. Our crews are on call around the clock for rapid, professional emergency service \u2014 stabilizing the roof, stopping the damage, and protecting what's inside before it spreads.",
  },
  {
    kicker: "Value Engineering",
    title: "The right system for the building and the budget.",
    body:
      "Choosing the wrong commercial roofer leads to costly interior and exterior damage. We engineer for value \u2014 matching membrane, insulation, and detailing to your building's use, so you get the longest service life for the smartest spend.",
  },
  {
    kicker: "Safety & Quality You Can Trust",
    title: "Certified crews. Manufacturer-backed warranties.",
    body:
      "We're certified in installing, repairing, and maintaining a wide range of commercial roof systems, and we hold safety to the same standard as the work. The result is audit-ready quality and warranty coverage that stands behind every square.",
  },
];

const CERTS = ["GAF", "Carlisle", "Versico", "Elevate", "Duro-Last", "Johns Manville"];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = ref.current?.querySelectorAll<HTMLElement>(".reveal");
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

function Wordmark() {
  return (
    <a href="#top" className="group flex items-center gap-2.5" aria-label="Kansas Commercial Roofers home">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="24" height="24" rx="4" stroke="#C8262B" strokeWidth="1.5" />
        <path d="M5 15L13 7l8 8" stroke="#F4F2EE" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19h16" stroke="#C8262B" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[13px] font-600 uppercase tracking-[0.14em] leading-none">
        Kansas Commercial<br />Roofers
      </span>
    </a>
  );
}

/* Signature element: a technical cross-section of a commercial roof assembly,
   drawn as a fine engineered line diagram that animates on load. */
function RoofSection() {
  return (
    <svg
      viewBox="0 0 1200 260"
      className="w-full h-auto"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C8262B" stopOpacity="0" />
          <stop offset="0.5" stopColor="#C8262B" stopOpacity="0.9" />
          <stop offset="1" stopColor="#C8262B" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* deck */}
      <path className="draw-line" style={{ ["--len" as string]: 1220 }} d="M0 210 H1200" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      {/* insulation zig */}
      <path
        className="draw-line"
        style={{ ["--len" as string]: 1400 }}
        d="M0 168 L60 150 L120 168 L180 150 L240 168 L300 150 L360 168 L420 150 L480 168 L540 150 L600 168 L660 150 L720 168 L780 150 L840 168 L900 150 L960 168 L1020 150 L1080 168 L1140 150 L1200 168"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      />
      {/* membrane (accent) */}
      <path className="draw-line" style={{ ["--len" as string]: 1220 }} d="M0 108 H1200" stroke="url(#fade)" strokeWidth="1.5" />
      {/* fastener ticks */}
      {Array.from({ length: 13 }).map((_, i) => (
        <line
          key={i}
          x1={40 + i * 96}
          y1={108}
          x2={40 + i * 96}
          y2={210}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

export default function Home() {
  const ref = useReveal();

  return (
    <main id="top" ref={ref} className="relative min-h-screen bg-base text-ink">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-50 border-b hairline bg-base/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-5 sm:px-8">
          <Wordmark />
          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-[13px] text-muted transition-colors hover:text-ink"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <a href={`tel:${PHONE_TEL}`} className="hidden text-[13px] text-ink transition-colors hover:text-accent sm:block">
              {PHONE_DISPLAY}
            </a>
            <a
              href="#contact"
              className="rounded-full bg-accent px-4 py-2 text-[13px] font-500 text-ink transition-colors hover:bg-accentdark"
            >
              Request Service
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden px-5 pt-40 pb-24 sm:px-8 sm:pt-48 sm:pb-28">
        <div
          className="pointer-events-none absolute inset-0 grain"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
          style={{
            background:
              "radial-gradient(80% 120% at 50% -20%, rgba(200,38,43,0.18), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-shell">
          <p className="eyebrow rise" style={{ animationDelay: "0.05s" }}>
            Industrial &amp; Commercial Roofing &middot; Kansas
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-[2.6rem] font-600 leading-[1.02] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
            <span className="rise block" style={{ animationDelay: "0.12s" }}>Relentless in our</span>
            <span className="rise block" style={{ animationDelay: "0.22s" }}>pursuit to build the</span>
            <span className="rise block" style={{ animationDelay: "0.32s" }}>
              best <span className="text-accent">tomorrow.</span>
            </span>
          </h1>
          <p
            className="rise mt-8 max-w-2xl text-lg leading-relaxed text-muted"
            style={{ animationDelay: "0.42s" }}
          >
            Kansas Commercial Roofers is a Kansas-based commercial roofing team
            built on a culture of care for our people and our customers. From
            complex low-slope installs to emergency repairs, no job is outside
            our wheelhouse &mdash; we bring experience, precision, and a commitment
            to protecting your building for the long run.
          </p>
          <div className="rise mt-10 flex flex-wrap items-center gap-4" style={{ animationDelay: "0.52s" }}>
            <a
              href="#contact"
              className="rounded-full bg-accent px-6 py-3 text-sm font-500 text-ink transition-colors hover:bg-accentdark"
            >
              Get a Free Storm Report
            </a>
            <a
              href="#systems"
              className="rounded-full border hairline px-6 py-3 text-sm font-500 text-ink transition-colors hover:border-ink/40"
            >
              Explore Our Systems
            </a>
          </div>

          {/* Signature roof cross-section */}
          <div className="mt-16">
            <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted">
              <span>Deck</span>
              <span>Insulation</span>
              <span className="text-accent">Membrane</span>
            </div>
            <RoofSection />
            <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted">
              From deck to membrane &mdash; engineered as one system
            </p>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y hairline px-5 sm:px-8">
        <div className="mx-auto grid max-w-shell grid-cols-1 divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {STATS.map((s) => (
            <div key={s.label} className="reveal py-10 sm:px-8 sm:first:pl-0">
              <div className="font-display text-4xl font-600 tracking-tight sm:text-5xl">
                {s.value}
                <span className="text-accent">{s.suffix}</span>
              </div>
              <p className="mt-3 text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SYSTEMS */}
      <section id="systems" className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-shell">
          <div className="reveal max-w-2xl">
            <p className="eyebrow">Roofing Systems</p>
            <h2 className="mt-5 font-display text-3xl font-600 tracking-tight sm:text-4xl">
              Certified in every commercial roof system worth installing.
            </h2>
            <p className="mt-5 text-muted">
              With decades of combined experience across market sectors, our team
              is prepared to deliver the best value and solution &mdash; regardless of
              the project's complexity.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-lg border hairline bg-white/5 sm:grid-cols-2 lg:grid-cols-4">
            {SYSTEMS.map((sys, i) => (
              <div
                key={sys.name}
                className="reveal group bg-base p-6 transition-colors hover:bg-surface"
                style={{ transitionDelay: `${(i % 4) * 40}ms` }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-xl font-600">{sys.name}</span>
                  <span className="text-[11px] tabular-nums text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-4 h-px w-8 bg-accent transition-all duration-300 group-hover:w-14" />
                <p className="mt-4 text-sm leading-relaxed text-muted">{sys.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VERTICALS */}
      <section id="verticals" className="border-t hairline px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto grid max-w-shell gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="reveal">
            <p className="eyebrow">Client Verticals</p>
            <h2 className="mt-5 font-display text-3xl font-600 tracking-tight sm:text-4xl">
              Built for the buildings Kansas runs on.
            </h2>
            <p className="mt-5 text-muted">
              From warehouses and food processing plants to schools, hospitals,
              and federal facilities &mdash; we've roofed the full range of commercial
              and industrial property across the state.
            </p>
          </div>
          <div className="reveal flex flex-wrap gap-2.5 lg:pt-2">
            {VERTICALS.map((v) => (
              <span
                key={v}
                className="rounded-full border hairline px-4 py-2 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* APPROACH */}
      <section id="approach" className="border-t hairline px-5 sm:px-8">
        <div className="mx-auto max-w-shell">
          {APPROACH.map((a, i) => (
            <div
              key={a.kicker}
              className="reveal grid gap-6 border-b hairline py-16 last:border-b-0 sm:py-20 lg:grid-cols-[0.5fr_1fr] lg:gap-16"
            >
              <div className="flex items-start gap-4">
                <span className="font-display text-sm tabular-nums text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="eyebrow pt-0.5">{a.kicker}</p>
              </div>
              <div>
                <h3 className="font-display text-2xl font-600 tracking-tight sm:text-3xl">
                  {a.title}
                </h3>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
                  {a.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CERTS */}
      <section id="coverage" className="border-t hairline px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-shell">
          <p className="reveal eyebrow text-center">Trusted to Protect</p>
          <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {CERTS.map((c) => (
              <span
                key={c}
                className="font-display text-lg font-500 tracking-tight text-muted/70 grayscale transition-colors hover:text-ink"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="reveal mt-6 text-center text-sm text-muted">
            Manufacturer-certified installations &amp; warranty-backed systems.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="reveal relative mx-auto max-w-shell overflow-hidden rounded-2xl border hairline bg-surface px-8 py-16 sm:px-16 sm:py-20">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background:
                "radial-gradient(90% 140% at 90% 10%, rgba(200,38,43,0.16), transparent 55%)",
            }}
            aria-hidden="true"
          />
          <div className="relative max-w-2xl">
            <p className="eyebrow">Free Storm Report &amp; Inspection</p>
            <h2 className="mt-5 font-display text-3xl font-600 leading-tight tracking-tight sm:text-5xl">
              Get your free storm report &amp; inspection.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              Join the property owners and facility managers who trust Kansas
              Commercial Roofers to protect their buildings. Whether you're
              starting a new project or maintaining an existing structure, our
              team is ready to help &mdash; with precision and professionalism.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href={`tel:${PHONE_TEL}`}
                className="rounded-full bg-accent px-6 py-3 text-sm font-500 text-ink transition-colors hover:bg-accentdark"
              >
                Call {PHONE_DISPLAY}
              </a>
              <a
                href={`tel:${PHONE_TEL}`}
                className="rounded-full border hairline px-6 py-3 text-sm font-500 text-ink transition-colors hover:border-ink/40"
              >
                Schedule an Inspection
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t hairline px-5 py-14 sm:px-8">
        <div className="mx-auto flex max-w-shell flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4">
            <Wordmark />
            <p className="max-w-xs text-sm text-muted">
              Industrial &amp; commercial roofing across Kansas. Relentless in our
              pursuit to build the best tomorrow.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm sm:items-end">
            <a href={`tel:${PHONE_TEL}`} className="text-ink transition-colors hover:text-accent">
              {PHONE_DISPLAY}
            </a>
            <span className="text-muted">Serving all of Kansas</span>
            <nav className="flex flex-wrap gap-4 text-muted sm:justify-end">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="transition-colors hover:text-ink">
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-shell border-t hairline pt-6 text-xs text-muted">
          &copy; {new Date().getFullYear()} Kansas Commercial Roofers. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
