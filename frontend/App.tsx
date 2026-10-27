import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, Wind } from "lucide-react";
import {
  change,
  fromSearch,
  toSearch,
  type Scenario,
  type View,
} from "./scenario";
import { ReplayScreen } from "./screens/ReplayScreen";
import { AnalysisScreen } from "./screens/AnalysisScreen";
import { MethodScreen } from "./screens/MethodScreen";
import { Notice } from "./ui";

const SCREENS: {
  view: View;
  label: string;
  num: string;
  eyebrow: string;
  title: string;
  subtitle: string;
}[] = [
  {
    view: "replay",
    label: "Decision replay",
    num: "01",
    eyebrow: "Know what was known",
    title: "Tomorrow, as seen yesterday.",
    subtitle:
      "Pick a January purchase day and cutoff. See the wind forecast the team could have used, where it came from and how it had been moving, before choosing to reveal what happened.",
  },
  {
    view: "analysis",
    label: "Accuracy lab",
    num: "02",
    eyebrow: "Measure the uncertainty",
    title: "How much did the forecast miss?",
    subtitle:
      "All 31 purchase days at one consistent cutoff. Find the days and hours that went wrong, and see whether a later decision would have helped.",
  },
  {
    view: "method",
    label: "Data & method",
    num: "03",
    eyebrow: "Trace every number",
    title: "Small snapshot. Visible assumptions.",
    subtitle: "An auditable pilot, with its limits kept in view.",
  },
];

/** Keeps the scenario in the address bar so any view can be shared, reloaded or stepped back to. */
function useScenario() {
  const initial = useRef(fromSearch(window.location.search));
  const [scenario, setScenario] = useState(initial.current.scenario);
  const [invalid, setInvalid] = useState(initial.current.invalid);
  const latest = useRef(scenario);

  useEffect(() => {
    // Normalise the starting URL (drops invalid values) without adding a history entry.
    window.history.replaceState(null, "", toSearch(initial.current.scenario));
    const onPop = () => {
      const parsed = fromSearch(window.location.search);
      latest.current = parsed.scenario;
      setScenario(parsed.scenario);
      setInvalid(parsed.invalid);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function update(patch: Partial<Scenario>) {
    const current = latest.current;
    const next = change(current, patch);
    // Moving between screens or opening a day is a step worth going back to; tweaking a
    // control replaces the entry so Back does not replay every keystroke.
    const step = next.view !== current.view || next.from !== current.from;
    const url = toSearch(next);
    if (url !== window.location.search)
      window.history[step ? "pushState" : "replaceState"](null, "", url);
    latest.current = next;
    setScenario(next);
    setInvalid([]);
  }
  return { scenario, invalid, update };
}

export function App() {
  const { scenario, invalid, update } = useScenario();
  const screen = SCREENS.find((s) => s.view === scenario.view)!;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = `${screen.label} | Wind replay, January 2026`;
    // Move focus to the new screen's heading for keyboard and screen-reader users.
    if (!firstRender.current) headingRef.current?.focus();
    firstRender.current = false;
  }, [screen]);

  return (
    <div className="app">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="?view=replay">
          <span className="brand-icon">
            <Wind size={23} aria-hidden />
          </span>
          Wind replay<span className="pilot">Pilot</span>
        </a>
        <p className="side-label">January 2026 snapshot</p>
        <nav aria-label="Main navigation">
          {SCREENS.map((s) => (
            <button
              key={s.view}
              type="button"
              className={scenario.view === s.view ? "nav active" : "nav"}
              aria-current={scenario.view === s.view ? "page" : undefined}
              onClick={() => update({ view: s.view })}
            >
              <span>{s.num}</span>
              {s.label}
              <ChevronRight size={14} aria-hidden />
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <p>
            <span className="dot" aria-hidden /> Fixed snapshot, not live
          </p>
          <p>
            GB transmission-metered wind
            <br />
            Elexon WINDFOR + FUELHH
          </p>
          <p className="side-note">
            Decision support for a pilot. Not a procurement recommendation.
          </p>
        </div>
      </aside>
      <main id="content">
        <header>
          <div className="breadcrumb">
            Wind intelligence <ChevronRight size={14} aria-hidden />{" "}
            {screen.label}
          </div>
          <div className="snapshot-tag">
            Jan 2026 <span aria-hidden>•</span> times in UTC = GMT
          </div>
        </header>
        <section className="page-head">
          <div>
            <p className="eyebrow">{screen.eyebrow}</p>
            <h1 ref={headingRef} tabIndex={-1}>
              {screen.title}
            </h1>
            <p className="subtitle">{screen.subtitle}</p>
          </div>
          <span className="scope-badge">
            GB wind
            <br />
            <strong>National aggregate*</strong>
          </span>
        </section>
        {invalid.length > 0 && (
          <Notice tone="warn">
            This link contained invalid {invalid.join(", ")} value
            {invalid.length > 1 ? "s" : ""}. The default
            {invalid.length > 1 ? "s are" : " is"} shown instead.
          </Notice>
        )}
        {scenario.view === "replay" && (
          <ReplayScreen scenario={scenario} onChange={update} />
        )}
        {scenario.view === "analysis" && (
          <AnalysisScreen scenario={scenario} onChange={update} />
        )}
        {scenario.view === "method" && <MethodScreen />}
        <footer>
          <span>Wind replay · January 2026 pilot</span>
          <span>
            *GB transmission / operationally metered wind. Not total UK wind.
          </span>
        </footer>
      </main>
    </div>
  );
}
