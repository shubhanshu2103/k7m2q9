import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { prefetch, replayPath } from "../api";
import type { Scenario } from "../scenario";
import { weekdayLabel } from "../format";

type Props = {
  scenario: Scenario;
  dayRuns: string[];
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  onChange: (patch: Partial<Scenario>) => void;
};

const STEP_MS = 1400;
const minutes = (hhmm: string) =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * The purchase day as a timeline of forecast publications. The selected forecast can only
 * change when a run is published, so those moments are the useful cutoffs to step through.
 */
export function CutoffTimeline({
  scenario,
  dayRuns,
  playing,
  setPlaying,
  onChange,
}: Props) {
  const { decision, cutoff, rule } = scenario;
  // "00:00" stands for whatever the previous evening's runs already provided.
  const stops = Array.from(
    new Set(["00:00", ...dayRuns.map((t) => t.slice(11, 16))]),
  );
  const now = minutes(cutoff);
  const activeIndex = stops.reduce(
    (best, t, i) => (minutes(t) <= now ? i : best),
    0,
  );
  const [preparing, setPreparing] = useState(false);

  // Advance one run at a time while playing; stop at the last publication of the day.
  useEffect(() => {
    if (!playing) return;
    const next = stops[activeIndex + 1];
    if (!next) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => onChange({ cutoff: next }), STEP_MS);
    return () => clearTimeout(id);
    // Keyed on the position, not the stops array, which is rebuilt every render.
  }, [playing, activeIndex]);

  async function togglePlay() {
    if (playing) return setPlaying(false);
    setPreparing(true);
    // Load every stop first so playback never flashes a loading state between runs.
    await prefetch(
      stops.map((c) =>
        replayPath({ decision, cutoff: c, rule, reveal: false }),
      ),
    );
    setPreparing(false);
    // Always replay the whole day from the overnight position.
    onChange({ cutoff: stops[0] });
    setPlaying(true);
  }

  const go = (i: number) => {
    setPlaying(false);
    onChange({ cutoff: stops[i] });
  };

  return (
    <section className="panel timeline" aria-labelledby="timeline-title">
      <div className="timeline-head">
        <div>
          <h2 id="timeline-title">Watch the forecast arrive</h2>
          <p>
            Forecast runs published on {weekdayLabel(decision)} for this
            delivery day. The selected forecast only changes when a run is
            published, so step through the day or press play.
          </p>
        </div>
        <div className="timeline-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous run"
            disabled={activeIndex === 0}
            onClick={() => go(activeIndex - 1)}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="play"
            aria-pressed={playing}
            disabled={preparing}
            onClick={togglePlay}
          >
            {playing ? (
              <Pause size={16} aria-hidden />
            ) : (
              <Play size={16} aria-hidden />
            )}
            {playing ? "Pause" : preparing ? "Loading…" : "Play the day"}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Next run"
            disabled={activeIndex === stops.length - 1}
            onClick={() => go(activeIndex + 1)}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      </div>
      <div className="timeline-track" aria-hidden>
        <div
          className="timeline-fill"
          style={{ width: `${(now / 1440) * 100}%` }}
        />
        {stops.map((t, i) => (
          <span
            key={t}
            className={i <= activeIndex ? "tick past" : "tick"}
            style={{ left: `${(minutes(t) / 1440) * 100}%` }}
          />
        ))}
        <span className="cursor" style={{ left: `${(now / 1440) * 100}%` }}>
          <b>{cutoff}</b>
        </span>
        <span className="timeline-label start">00:00</span>
        <span className="timeline-label end">24:00</span>
      </div>
      <ol
        className="stops"
        aria-label="Set the cutoff to a run publication time"
      >
        {stops.map((t, i) => (
          <li key={t}>
            <button
              type="button"
              className={
                i === activeIndex
                  ? "stop active"
                  : i < activeIndex
                    ? "stop past"
                    : "stop"
              }
              aria-current={i === activeIndex ? "step" : undefined}
              aria-label={
                i === 0
                  ? "Set cutoff to 00:00, using only runs from the previous day"
                  : `Set cutoff to ${t}, when a run was published`
              }
              onClick={() => go(i)}
            >
              {i === 0 ? "00:00 overnight" : t}
            </button>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        Cutoff {cutoff} UTC
      </p>
    </section>
  );
}
