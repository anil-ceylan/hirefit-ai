import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Dna, Navigation, Wallet, Target, LineChart, GraduationCap, MapPin, Gauge } from "lucide-react";
import CareerDnaResultCard from "../CareerDnaResultCard.jsx";
import { getRoleLabel, getIndustryLabel } from "../../../lib/careerOnboarding/industries.js";
import { getLanguageLevelLabel } from "../../../lib/careerOnboarding/onboardingOptions.js";
import { getEnglishLevelLabel } from "../../../lib/careerOnboarding/languageProfile.js";

export function CollapsibleSection({
  sectionId,
  title,
  subtitle,
  icon: Icon,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const toggle = () => {
    if (onToggle && sectionId) onToggle(sectionId);
    else setInternalOpen((v) => !v);
  };
  return (
    <section className="hf-os-section" data-open={open ? "true" : "false"}>
      <button type="button" className="hf-os-section__trigger" onClick={toggle} aria-expanded={open}>
        <span className="hf-os-section__icon">{Icon ? <Icon size={15} /> : null}</span>
        <span className="hf-os-section__titles">
          <span className="hf-os-section__title">{title}</span>
          {subtitle ? <span className="hf-os-section__subtitle">{subtitle}</span> : null}
        </span>
        <ChevronDown size={16} className="hf-os-section__chevron" aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="hf-os-section__body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div className="hf-os-stat-pill" style={{ "--hf-os-accent": accent || "#818cf8" }}>
      <span className="hf-os-stat-pill__value">{value}</span>
      <span className="hf-os-stat-pill__label">{label}</span>
    </div>
  );
}

function MiniBarChart({ points, color = "#6366f1" }) {
  if (!points?.length) return null;
  const max = Math.max(...points.map((p) => p.score), 1);
  return (
    <div className="hf-os-chart" role="img" aria-hidden>
      {points.map((p) => (
        <div key={p.monthKey || p.month} className="hf-os-chart__col">
          <div
            className="hf-os-chart__bar"
            style={{ height: `${Math.max(8, (p.score / max) * 100)}%`, background: color }}
            title={`${p.month}: ${p.score}`}
          />
          <span className="hf-os-chart__label">{p.month?.slice(0, 3) || ""}</span>
        </div>
      ))}
    </div>
  );
}

function profileBasic(careerProfile, lang = "TR") {
  const b = careerProfile?.basic_profile || {};
  const goals = careerProfile?.career_goals || {};
  const industryId = careerProfile?.primary_industry || goals.primaryIndustry || goals.industries?.[0] || "";
  return {
    name: [b.firstName, b.lastName].filter(Boolean).join(" ") || b.fullName || careerProfile?.career_identity || "—",
    university: b.university || b.school || "—",
    degree: b.department || b.degree || b.field || "—",
    experience: careerProfile?.career_level || b.experienceLevel || b.seniority || "—",
    industryId,
    industryLabel:
      careerProfile?.career_gps?.industryLabel ||
      (industryId ? getIndustryLabel(industryId, lang) : industryId),
    languages: (b.languages || [])
      .filter((l) => l?.name || l?.language)
      .map((l) => {
        const name = l.name || l.language;
        const levelLabel =
          l.levelLabel ||
          getEnglishLevelLabel(l.level, lang) ||
          getLanguageLevelLabel(l.level, lang);
        return `${name}${levelLabel ? ` · ${levelLabel}` : ""}`;
      }),
    countries: goals.targetCountries || b.targetCountries || [],
    primaryRole: goals.primaryRole || careerProfile?.career_goals?.primaryRole || "",
    roles: careerProfile?.target_roles || careerProfile?.best_fit_roles || [],
    dna: careerProfile?.career_dna,
  };
}

export function CareerDNAModule({ careerProfile, lang, sectionId = "dna", open, onToggle }) {
  const tr = lang === "TR";
  const p = profileBasic(careerProfile, lang);
  const dna = p.dna;
  return (
    <CollapsibleSection
      sectionId={sectionId}
      icon={Dna}
      title="Career DNA"
      subtitle={tr ? "Kimlik ve hedef profil" : "Identity & target profile"}
      open={open}
      onToggle={onToggle}
    >
      <div className="hf-os-grid hf-os-grid--2">
        <div className="hf-os-kv">
          <span className="hf-os-kv__k">{tr ? "Profil" : "Profile"}</span>
          <span className="hf-os-kv__v">{p.name}</span>
        </div>
        <div className="hf-os-kv">
          <span className="hf-os-kv__k">{tr ? "Üniversite" : "University"}</span>
          <span className="hf-os-kv__v">{p.university}</span>
        </div>
        <div className="hf-os-kv">
          <span className="hf-os-kv__k">{tr ? "Bölüm" : "Degree"}</span>
          <span className="hf-os-kv__v">{p.degree}</span>
        </div>
        <div className="hf-os-kv">
          <span className="hf-os-kv__k">{tr ? "Deneyim" : "Experience"}</span>
          <span className="hf-os-kv__v">{p.experience}</span>
        </div>
        {p.industryLabel ? (
          <div className="hf-os-kv">
            <span className="hf-os-kv__k">{tr ? "Sektör" : "Sector"}</span>
            <span className="hf-os-kv__v">{p.industryLabel}</span>
          </div>
        ) : null}
      </div>
      {dna?.typeLabel || dna?.typeId ? (
        <>
          <CareerDnaResultCard dna={dna} lang={lang} />
        </>
      ) : (
        <p className="hf-os-muted">{tr ? "DNA testini tamamla → /onboarding" : "Complete DNA test → /onboarding"}</p>
      )}
      {p.languages.length ? (
        <div className="hf-os-tags">
          <span className="hf-os-tags__label">{tr ? "Diller" : "Languages"}</span>
          {p.languages.map((x) => (
            <span key={x} className="hf-os-tag">{x}</span>
          ))}
        </div>
      ) : null}
      {p.countries.length ? (
        <div className="hf-os-tags">
          <span className="hf-os-tags__label">{tr ? "Hedef ülkeler" : "Target countries"}</span>
          {p.countries.map((x) => (
            <span key={x} className="hf-os-tag hf-os-tag--blue">{x}</span>
          ))}
        </div>
      ) : null}
      {p.primaryRole ? (
        <div className="hf-os-kv" style={{ marginTop: 8 }}>
          <span className="hf-os-kv__k">{tr ? "Birincil hedef" : "Primary target"}</span>
          <span className="hf-os-kv__v">{getRoleLabel(p.primaryRole, lang)}</span>
        </div>
      ) : null}
      {p.roles.length ? (
        <div className="hf-os-tags">
          <span className="hf-os-tags__label">{tr ? "Hedef roller" : "Preferred roles"}</span>
          {p.roles.slice(0, 6).map((x) => (
            <span key={x} className="hf-os-tag hf-os-tag--violet">{getRoleLabel(x, lang)}</span>
          ))}
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

function ListBlock({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="hf-os-list-block">
      <span className="hf-os-list-block__title">{title}</span>
      <ul className="hf-os-list">
        {items.map((s) => (
          <li key={String(s)}>{String(s)}</li>
        ))}
      </ul>
    </div>
  );
}

export function CareerGPSModule({ vm, careerProfile, lang, sectionId = "gps", open, onToggle }) {
  const tr = lang === "TR";
  const gps = careerProfile?.career_gps;
  if (gps?.currentPosition) {
    return (
      <CollapsibleSection sectionId={sectionId} icon={Navigation} title="Career GPS" subtitle={tr ? "Uzun vadeli yol haritası" : "Long-term career roadmap"} open={open} onToggle={onToggle}>
        <div className="hf-os-kv">
          <span className="hf-os-kv__k">{tr ? "Mevcut konum" : "Current position"}</span>
          <span className="hf-os-kv__v">{gps.currentPosition}</span>
        </div>
        <div className="hf-os-kv">
          <span className="hf-os-kv__k">{tr ? "Hedef konum" : "Target position"}</span>
          <span className="hf-os-kv__v">{gps.targetPosition}</span>
        </div>
        <StatPill label={tr ? "Tahmini süre" : "Est. timeline"} value={gps.estimatedTimelineLabel || `${gps.timelineMonths}mo`} accent="#38bdf8" />
        <p className="hf-os-muted">{gps.longTermVision}</p>
        {gps.marketIntelligence ? (
          <p className="hf-os-muted"><strong>{tr ? "Pazar: " : "Market: "}</strong>{gps.marketIntelligence}</p>
        ) : null}
        {gps.suggestedJobs?.length ? (
          <ListBlock title={tr ? "Önerilen işler" : "Suggested jobs"} items={gps.suggestedJobs} />
        ) : null}
        {gps.atsKeywords?.length ? (
          <div className="hf-os-tags">
            <span className="hf-os-tags__label">{tr ? "ATS anahtar kelimeler" : "ATS keywords"}</span>
            {gps.atsKeywords.map((k) => (
              <span key={k} className="hf-os-tag hf-os-tag--blue">{k}</span>
            ))}
          </div>
        ) : null}
        {gps.roleScores?.length ? (
          <div className="hf-os-lanes" style={{ marginTop: 8 }}>
            {gps.roleScores.map((r) => (
              <div key={r.roleValue || r.role} className="hf-os-lane">
                <div className="hf-os-lane__head">
                  <span>{r.label || getRoleLabel(r.roleValue || r.role, lang)}</span>
                  <span style={{ color: "#818cf8" }}>{r.score}</span>
                </div>
                <div className="hf-os-lane__track">
                  <div className="hf-os-lane__fill" style={{ width: `${r.score}%`, background: "#818cf8" }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {gps.cvImprovementTips?.length ? (
          <ListBlock title={tr ? "CV önerileri" : "CV tips"} items={gps.cvImprovementTips} />
        ) : null}
        {(gps.roadmap || []).map((phase) => (
          <div key={phase.phase} className="hf-ci-card" style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#a5b4fc", marginBottom: 4 }}>{phase.title}</div>
            <ul className="hf-os-list" style={{ margin: 0 }}>
              {(phase.actions || []).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ))}
      </CollapsibleSection>
    );
  }

  const current = vm?.careerWallet?.careerScore ?? 0;
  const target = vm?.outcomeProjection?.projectedScore ?? Math.min(100, current + 18);
  const gap = Math.max(0, target - current);
  const weeks = vm?.outcomeProjection?.weeksToTarget || (gap > 15 ? 8 : 4);

  return (
    <CollapsibleSection sectionId={sectionId} icon={Navigation} title="Career GPS" subtitle={tr ? "Analiz sonrası yol haritası" : "Post-analysis roadmap"} open={open} onToggle={onToggle}>
      <p className="hf-os-muted">{tr ? "Career DNA onboarding'i tamamla veya CV analizi çalıştır." : "Complete Career DNA onboarding or run a CV analysis."}</p>
      {vm ? (
        <div className="hf-os-grid hf-os-grid--3">
          <StatPill label={tr ? "Mevcut" : "Current"} value={current} />
          <StatPill label={tr ? "Hedef" : "Target"} value={target} accent="#34d399" />
          <StatPill label={tr ? "Süre" : "Timeline"} value={`${weeks}w`} accent="#38bdf8" />
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

export function UniversityIntelligenceModule({ careerProfile, lang, sectionId = "university", open, onToggle }) {
  const tr = lang === "TR";
  const u = careerProfile?.university_intelligence;
  if (!u?.university) {
    return (
      <CollapsibleSection sectionId={sectionId} icon={GraduationCap} title={tr ? "University Intelligence" : "University Intelligence"} subtitle={tr ? "Kampüs stratejisi" : "Campus strategy"} open={open} onToggle={onToggle}>
        <p className="hf-os-muted">{tr ? "Üniversite bilgisi için Career DNA profilini tamamla." : "Complete Career DNA profile for university insights."}</p>
      </CollapsibleSection>
    );
  }
  return (
    <CollapsibleSection sectionId={sectionId} icon={GraduationCap} title="University Intelligence" subtitle={u.university} open={open} onToggle={onToggle}>
      <ListBlock title={tr ? "Güçlü yönler" : "Strengths"} items={u.strengths} />
      <ListBlock title={tr ? "Önerilen kulüpler" : "Recommended clubs"} items={u.recommendedClubs} />
      <ListBlock title={tr ? "Önerilen aktiviteler" : "Recommended activities"} items={u.recommendedActivities} />
      <ListBlock title={tr ? "Kariyer avantajları" : "Career advantages"} items={u.careerAdvantages} />
      <ListBlock title={tr ? "Kariyer riskleri" : "Career risks"} items={u.careerRisks} />
    </CollapsibleSection>
  );
}

export function CityIntelligenceModule({ careerProfile, lang, sectionId = "city", open, onToggle }) {
  const tr = lang === "TR";
  const c = careerProfile?.city_intelligence;
  if (!c?.city && !c?.country) {
    return (
      <CollapsibleSection sectionId={sectionId} icon={MapPin} title="City Intelligence" subtitle={tr ? "Şehir ekosistemi" : "City ecosystem"} open={open} onToggle={onToggle}>
        <p className="hf-os-muted">{tr ? "Şehir ve ülke bilgisi için profilini tamamla." : "Add city and country in your profile."}</p>
      </CollapsibleSection>
    );
  }
  return (
    <CollapsibleSection sectionId={sectionId} icon={MapPin} title="City Intelligence" subtitle={[c.city, c.country].filter(Boolean).join(", ")} open={open} onToggle={onToggle}>
      <p className="hf-os-muted"><strong>{tr ? "Startup ekosistemi: " : "Startup ecosystem: "}</strong>{c.startupEcosystem}</p>
      <ListBlock title={tr ? "Networking" : "Networking"} items={c.networkingOpportunities} />
      <ListBlock title={tr ? "Kariyer etkinlikleri" : "Career events"} items={c.careerEvents} />
      <ListBlock title={tr ? "Profesyonel topluluklar" : "Professional communities"} items={c.professionalCommunities} />
    </CollapsibleSection>
  );
}

export function CareerReadinessModule({ careerProfile, lang, sectionId = "readiness", open, onToggle }) {
  const tr = lang === "TR";
  const r = careerProfile?.career_readiness;
  if (!r?.score) {
    return (
      <CollapsibleSection sectionId={sectionId} icon={Gauge} title={tr ? "Career Readiness" : "Career Readiness"} subtitle={tr ? "CV olmadan hazırlık" : "Ready before a CV"} open={open} onToggle={onToggle}>
        <p className="hf-os-muted">{tr ? "Hazırlık skoru için onboarding adım 4'ü tamamla." : "Complete onboarding step 4 for readiness score."}</p>
      </CollapsibleSection>
    );
  }
  return (
    <CollapsibleSection sectionId={sectionId} icon={Gauge} title="Career Readiness" subtitle={tr ? "CV olmadan ölçüm" : "Measured without a CV"} open={open} onToggle={onToggle}>
      <div className="hf-os-wallet-hero">
        <span className="hf-os-wallet-hero__label">{tr ? "Hazırlık skoru" : "Readiness score"}</span>
        <span className="hf-os-wallet-hero__score">{r.score}</span>
      </div>
      <p className="hf-os-muted">{r.summary}</p>
      <div className="hf-os-lanes">
        {(r.pillars || []).map((p) => (
          <div key={p.key} className="hf-os-lane">
            <div className="hf-os-lane__head">
              <span>{p.label}</span>
              <span style={{ color: "#818cf8" }}>{p.benchmarkLabel || p.score}</span>
            </div>
            <div className="hf-os-lane__track">
              <div className="hf-os-lane__fill" style={{ width: `${p.score}%`, background: "#818cf8" }} />
            </div>
            {p.tip ? <p className="hf-os-muted" style={{ marginTop: 4 }}>{p.tip}</p> : null}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

export function CareerWalletModule({ vm, careerGrowth, history, lang, sectionId = "wallet", open, onToggle }) {
  const tr = lang === "TR";
  const wallet = vm?.careerWallet;
  const applications = history?.length ?? 0;
  const interviews = history?.filter((h) => Number(h.score) >= 65).length ?? 0;
  const missions = Math.max(0, (careerGrowth?.timeline?.length || 1) - 1);
  const monthly = wallet?.monthlyGrowth ?? careerGrowth?.scoreDelta ?? 0;
  const monthlyLabel = monthly > 0 ? `+${monthly}` : String(monthly);

  return (
    <CollapsibleSection
      sectionId={sectionId}
      icon={Wallet}
      title="Career Wallet"
      subtitle={tr ? "Kariyer metrikleri" : "Career metrics"}
      open={open}
      onToggle={onToggle}
    >
      <div className="hf-os-wallet-hero">
        <span className="hf-os-wallet-hero__label">Career Score</span>
        <span className="hf-os-wallet-hero__score">{wallet?.careerScore ?? careerGrowth?.careerScore ?? "—"}</span>
        <span className={`hf-os-wallet-hero__delta${monthly > 0 ? " hf-os-wallet-hero__delta--up" : ""}`}>
          {tr ? "Aylık" : "Monthly"} {monthlyLabel}
        </span>
      </div>
      <div className="hf-os-grid hf-os-grid--4">
        <StatPill label={tr ? "Başvuru" : "Applications"} value={applications} />
        <StatPill label={tr ? "Mülakat" : "Interviews"} value={interviews} accent="#34d399" />
        <StatPill label={tr ? "Görevler" : "Missions"} value={missions} accent="#fbbf24" />
        <StatPill label={tr ? "Büyüme" : "Growth"} value={monthlyLabel} accent="#818cf8" />
      </div>
      {wallet?.roleLanes?.length ? (
        <div className="hf-os-lanes">
          {wallet.roleLanes.map((lane) => (
            <div key={lane.key} className="hf-os-lane">
              <div className="hf-os-lane__head">
                <span>{lane.label}</span>
                <span style={{ color: lane.color }}>{lane.score}</span>
              </div>
              <div className="hf-os-lane__track">
                <div className="hf-os-lane__fill" style={{ width: `${lane.score}%`, background: lane.color }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

export function CareerMissionsModule({ vm, lang, sectionId = "missions", open, onToggle }) {
  const tr = lang === "TR";
  const fixes = (vm?.fixEngine?.fixes || []).slice(0, 3);
  const missing = (vm?.atsKeywordRemedies || []).map((k) => k.keyword).slice(0, 2);
  const daily = fixes[0]?.suggestedRewrite || fixes[0]?.problem || (tr ? "CV'de en kritik satırı güncelle" : "Update your top CV line");
  const weekly = [
    fixes[1]?.categoryLabel || fixes[1]?.category,
    missing[0],
    tr ? "Bir hedef role özel analiz çalıştır" : "Run one analysis for a target role",
  ].filter(Boolean);
  const xpBase = fixes.reduce((s, f) => s + (Number(f.pointsGain) || 0), 0) || 24;

  return (
    <CollapsibleSection
      sectionId={sectionId}
      icon={Target}
      title={tr ? "Career Görevleri" : "Career Missions"}
      subtitle={tr ? "Günlük ve haftalık odak" : "Daily & weekly focus"}
      open={open}
      onToggle={onToggle}
    >
      <div className="hf-os-mission hf-os-mission--daily">
        <span className="hf-os-mission__badge">{tr ? "Günlük" : "Daily"}</span>
        <p>{daily}</p>
        <span className="hf-os-mission__xp">+{Math.round(xpBase * 0.4)} XP</span>
      </div>
      <div className="hf-os-mission hf-os-mission--weekly">
        <span className="hf-os-mission__badge">{tr ? "Haftalık" : "Weekly"}</span>
        <ul>
          {weekly.map((item) => (
            <li key={String(item)}>{String(item)}</li>
          ))}
        </ul>
        <span className="hf-os-mission__xp">+{xpBase} XP</span>
      </div>
    </CollapsibleSection>
  );
}

export function ProgressTimelineModule({ careerGrowth, lang, sectionId = "timeline", open, onToggle }) {
  const tr = lang === "TR";
  const timeline = careerGrowth?.timeline || [];
  const delta = careerGrowth?.scoreDelta ?? 0;

  return (
    <CollapsibleSection
      sectionId={sectionId}
      icon={LineChart}
      title={tr ? "İlerleme Zaman Çizelgesi" : "Progress Timeline"}
      subtitle={tr ? "Skor geçmişi ve haftalık trend" : "Score history & weekly trend"}
      open={open}
      onToggle={onToggle}
    >
      {timeline.length ? (
        <>
          <MiniBarChart points={timeline} color="#34d399" />
          <p className="hf-os-muted">
            {tr ? "Haftalık trend: " : "Weekly trend: "}
            <strong style={{ color: delta >= 0 ? "#86efac" : "#fca5a5" }}>{delta >= 0 ? `+${delta}` : delta}</strong>
            {tr ? " puan" : " pts"}
          </p>
        </>
      ) : (
        <p className="hf-os-muted">{tr ? "Henüz ilerleme verisi yok." : "No progress data yet."}</p>
      )}
    </CollapsibleSection>
  );
}

function CareerOsHomeItem({ label, value, why, wide = false }) {
  if (value == null || value === "") return null;
  return (
    <div className={`hf-os-home__item${wide ? " hf-os-home__item--wide" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {why ? <p>{why}</p> : null}
    </div>
  );
}

export function CareerOSHomeBlock({ careerProfile, lang = "TR" }) {
  const tr = lang === "TR";
  const snapshot = careerProfile?.career_snapshot || careerProfile?.career_gps?.snapshot || {};
  const home = snapshot.careerOsHome;
  if (!home) return null;
  const gpsActions = home.careerGps?.actions || [];

  return (
    <section className="hf-os-home">
      <header className="hf-os-home__head">
        <div>
          <span>Career OS</span>
          <h3>{tr ? "Kariyer Ana Ekranı" : "Career Home"}</h3>
        </div>
        <p>{tr ? "Bugünkü yönün, en büyük açığın ve sıradaki hareketin." : "Your current direction, biggest gap, and next move."}</p>
      </header>
      <div className="hf-os-home__grid">
        <CareerOsHomeItem label={tr ? "Kariyer Kimliği" : "Career Identity"} value={home.identity?.value} why={home.identity?.why} />
        <CareerOsHomeItem label="Career Score" value={home.careerScore?.value != null ? `${home.careerScore.value}/100` : ""} why={home.careerScore?.why} />
        <CareerOsHomeItem
          label={tr ? "En Güçlü Rol" : "Top Role Match"}
          value={[home.topRole?.value, home.topRole?.fitBand?.label].filter(Boolean).join(" · ")}
          why={home.topRole?.why}
        />
        <CareerOsHomeItem label={tr ? "Tahmin Güveni" : "Confidence"} value={home.confidence?.value} why={home.confidence?.why} />
        <CareerOsHomeItem label={tr ? "En Büyük Açık" : "Biggest Gap"} value={home.biggestGap?.title} why={home.biggestGap?.whyItMatters} wide />
        <CareerOsHomeItem label={tr ? "Sıradaki Aksiyon" : "Next Action"} value={home.nextAction?.value} why={home.nextAction?.why} wide />
        <CareerOsHomeItem label={tr ? "Büyüme Potansiyeli" : "Growth Potential"} value={home.growthPotential?.label} why={home.growthPotential?.why} wide />
      </div>
      {gpsActions.length ? (
        <div className="hf-os-home__gps">
          <span>{tr ? "Önündeki 30 Gün" : "Next 30 Days"}</span>
          <ol>
            {gpsActions.slice(0, 4).map((item) => (
              <li key={item.action}>
                <strong>{item.action}</strong>
                <small>{item.why}</small>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

export function CareerOSProfileStack({ vm, careerProfile, careerGrowth, history, lang }) {
  const [openId, setOpenId] = useState("readiness");
  const onToggle = (id) => setOpenId((cur) => (cur === id ? null : id));
  const shared = { onToggle, lang };
  return (
    <div className="hf-os-stack">
      <CareerOSHomeBlock careerProfile={careerProfile} lang={lang} />
      <CareerDNAModule {...shared} careerProfile={careerProfile} open={openId === "dna"} />
      <CareerGPSModule {...shared} vm={vm} careerProfile={careerProfile} open={openId === "gps"} />
      <UniversityIntelligenceModule {...shared} careerProfile={careerProfile} open={openId === "university"} />
      <CityIntelligenceModule {...shared} careerProfile={careerProfile} open={openId === "city"} />
      <CareerReadinessModule {...shared} careerProfile={careerProfile} open={openId === "readiness"} />
      {vm ? <CareerWalletModule {...shared} vm={vm} careerGrowth={careerGrowth} history={history} open={openId === "wallet"} /> : null}
      {vm ? <CareerMissionsModule {...shared} vm={vm} open={openId === "missions"} /> : null}
      <ProgressTimelineModule {...shared} careerGrowth={careerGrowth} open={openId === "timeline"} />
    </div>
  );
}

