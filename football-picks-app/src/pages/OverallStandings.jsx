import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { statsAPI, authAPI } from '../services/api';
import { sanitizeString } from '../utils/sanitize';
import CustomDropdown from '../components/CustomDropdown';

/**
 * Overall standings, redesigned.
 *
 * Desktop: one season matrix — every player x every week, heat-colored by
 * score, plus Total and % correct. Sized with fractional columns so a full
 * 18-week season fits with no horizontal scrolling.
 * Mobile/tablet: ranked cards; tap a player to expand their weekly scores.
 */
function OverallStandings() {
  const { user } = useAuth();
  const [standings, setStandings] = useState([]);
  const [weeks, setWeeks] = useState([]);          // [{id, number}] ascending
  const [weeklyScores, setWeeklyScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState(0);
  const [availableTags, setAvailableTags] = useState([{ id: 0, name: 'All' }]);
  const [expandedId, setExpandedId] = useState(null);
  const [mobileGrid, setMobileGrid] = useState(false);

  useEffect(() => {
    authAPI.getUserTags()
      .then(r => { if (r.data.success) setAvailableTags(r.data.tags); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const response = await statsAPI.getOverallStandingsDetailed(selectedTag);
        if (cancelled || !response.data.success) return;
        const clean = response.data.standings.map(p => ({
          ...p,
          nickname: sanitizeString(p.nickname || ''),
          total_score: parseInt(p.total_score) || 0,
          total_correct: parseInt(p.total_correct) || 0,
          total_picks: parseInt(p.total_picks) || 0,
          weeks_played: parseInt(p.weeks_played) || 0,
        }));
        // Total points, then % correct as the tiebreaker
        clean.sort((a, b) =>
          b.total_score - a.total_score ||
          (pct(b) ?? -1) - (pct(a) ?? -1)
        );
        setStandings(clean);
        setWeeks([...response.data.weeks].sort((a, b) => a.number - b.number));
        setWeeklyScores(response.data.weeklyScores || {});
      } catch (e) {
        console.error('Error loading overall standings:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedTag]);

  function pct(p) {
    if (!p.total_picks) return null;
    return (p.total_correct / p.total_picks) * 100;
  }
  const pctLabel = (p) => {
    const v = pct(p);
    return v === null ? '—' : `${Math.round(v)}%`;
  };

  // Per-week best score, for the heatmap normalization and the crown ring
  const weekMax = useMemo(() => {
    const max = {};
    for (const w of weeks) {
      let m = 0;
      for (const p of standings) {
        const s = weeklyScores[p.id]?.[w.number]?.score || 0;
        if (s > m) m = s;
      }
      max[w.number] = m;
    }
    return max;
  }, [weeks, standings, weeklyScores]);

  const heat = (score, max) => {
    if (!score || !max) return 'transparent';
    const t = score / max;
    return `rgba(100, 150, 255, ${(0.06 + 0.34 * t * t).toFixed(3)})`;
  };

  const leader = standings[0];
  const myRow = standings.find(p => p.id === user?.id);
  const myRank = myRow ? standings.indexOf(myRow) + 1 : null;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const rankClass = (i) =>
    i === 0 ? 'os-rank-gold' : i === 1 ? 'os-rank-silver' : i === 2 ? 'os-rank-bronze' : '';

  return (
    <div className="os-page">
      <div className="os-header glass-container">
        <div className="os-hero">
        <h1>Overall Standings</h1>
        {availableTags.length > 1 && (
          <div className="os-filter">
            <label>Filter</label>
            <CustomDropdown
              options={availableTags.map(t => ({ value: t.id, label: t.name }))}
              value={selectedTag}
              onChange={(v) => setSelectedTag(parseInt(v))}
              placeholder="All"
            />
          </div>
        )}
        <div className="os-stats">
          <div className="os-stat">
            <span className="os-stat-value">{standings.length}</span>
            <span className="os-stat-label">Players</span>
          </div>
          <div className="os-stat">
            <span className="os-stat-value os-stat-leader">
              <Trophy size={17} /> {leader ? leader.nickname : '—'}
            </span>
            <span className="os-stat-label">{leader ? `Leads with ${leader.total_score}` : 'Leader'}</span>
          </div>
          <div className="os-stat">
            <span className="os-stat-value">{myRank ? `#${myRank}` : '—'}</span>
            <span className="os-stat-label">Your rank</span>
          </div>
          <div className="os-stat">
            <span className="os-stat-value">{myRow ? pctLabel(myRow) : '—'}</span>
            <span className="os-stat-label">Your accuracy</span>
          </div>
        </div>
        </div>
      </div>

      <div className="glass-container os-board">
        {standings.length === 0 ? (
          <div className="os-empty">No standings yet — check back after week 1.</div>
        ) : (
          <div className={mobileGrid ? 'os-views os-grid-forced' : 'os-views'}>
            <button
              type="button"
              className="os-viewtoggle"
              onClick={() => setMobileGrid(g => !g)}
            >
              {mobileGrid ? <><List size={14} /> Card view</> : <><LayoutGrid size={14} /> Full grid view</>}
            </button>

            {/* ---- Full season matrix (desktop, or forced on mobile) ---- */}
            <div
              className="os-matrix"
              style={{ '--os-week-count': weeks.length }}
            >
              <div className="os-matrix-row os-matrix-head">
                <span className="os-cell-rank">#</span>
                <span className="os-cell-name">Player</span>
                {weeks.map(w => (
                  <span key={w.id} className="os-cell-week">W{w.number}</span>
                ))}
                <span className="os-cell-total">Total</span>
                <span className="os-cell-pct">Corr%</span>
              </div>

              {standings.map((p, i) => (
                <div
                  key={p.id}
                  className={`os-matrix-row ${p.id === user?.id ? 'os-row-me' : ''}`}
                >
                  <span className={`os-cell-rank ${rankClass(i)}`}>{i + 1}</span>
                  <span className="os-cell-name" title={p.nickname}>{p.nickname}</span>
                  {weeks.map(w => {
                    const cell = weeklyScores[p.id]?.[w.number];
                    const best = cell && cell.score > 0 && cell.score === weekMax[w.number];
                    return (
                      <span
                        key={w.id}
                        className={`os-cell-week os-cell-score ${best ? 'os-cell-best' : ''}`}
                        style={{ background: heat(cell?.score, weekMax[w.number]) }}
                        title={cell ? `Week ${w.number}: ${cell.score} pts, ${cell.correct} correct` : `Week ${w.number}: no picks`}
                      >
                        {cell ? (
                          <>
                            <span className="os-score-num">{cell.score}</span>
                            <span className="os-score-right">{cell.correct}✓</span>
                          </>
                        ) : '·'}
                      </span>
                    );
                  })}
                  <span className="os-cell-total">{p.total_score}</span>
                  <span className="os-cell-pct">{pctLabel(p)}</span>
                </div>
              ))}
            </div>

            {/* ---- Mobile / tablet: ranked expandable cards ---- */}
            <div className="os-cards">
              <div className="os-card os-card-head">
                <span className="os-cell-rank">#</span>
                <span className="os-cell-name">Player</span>
                <span className="os-cell-total">Total</span>
                <span className="os-cell-pct">Corr%</span>
                <span className="os-card-chev" />
              </div>
              {standings.map((p, i) => {
                const open = expandedId === p.id;
                return (
                  <div key={p.id} className={`os-card-wrap ${p.id === user?.id ? 'os-row-me' : ''}`}>
                    <button
                      type="button"
                      className="os-card"
                      onClick={() => setExpandedId(open ? null : p.id)}
                      aria-expanded={open}
                    >
                      <span className={`os-cell-rank ${rankClass(i)}`}>{i + 1}</span>
                      <span className="os-cell-name">{p.nickname}</span>
                      <span className="os-cell-total">{p.total_score}</span>
                      <span className="os-cell-pct">{pctLabel(p)}</span>
                      <span className={`os-card-chev ${open ? 'open' : ''}`}><ChevronDown size={16} /></span>
                    </button>
                    {open && (
                      <div className="os-card-weeks">
                        {weeks.map(w => {
                          const cell = weeklyScores[p.id]?.[w.number];
                          return (
                            <div key={w.id} className="os-week-chip">
                              <span className="os-week-chip-label">W{w.number}</span>
                              <span className="os-week-chip-score">{cell ? cell.score : '—'}</span>
                              <span className="os-week-chip-right">{cell ? `${cell.correct}✓` : ''}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style jsx="true">{`
        .os-page {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 1rem 4rem;
        }

        .os-header {
          margin-bottom: 1.25rem;
          padding: 1.25rem 1.5rem;
        }

        .os-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .os-header h1 {
          font-size: 1.5rem;
          white-space: nowrap;
        }

        .os-filter {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .os-filter label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(150, 200, 255, 0.85);
        }

        .os-stats {
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
        }

        .os-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
        }

        .os-stat-value {
          font-size: 1.45rem;
          font-weight: 700;
          color: rgba(190, 215, 255, 1);
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .os-stat-leader svg {
          color: #ffd700;
        }

        .os-stat-label {
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.55);
        }

        .os-board {
          padding: 1rem;
        }

        .os-empty {
          text-align: center;
          padding: 2rem;
          color: rgba(255, 255, 255, 0.6);
          font-style: italic;
        }

        /* ---------- Season matrix (desktop) ---------- */
        .os-matrix {
          display: none;
          flex-direction: column;
          gap: 2px;
          font-variant-numeric: tabular-nums;
        }

        .os-matrix-row {
          display: grid;
          grid-template-columns:
            34px minmax(96px, 150px)
            repeat(var(--os-week-count), minmax(0, 1fr))
            56px 52px;
          gap: 2px;
          align-items: stretch;
          border-radius: 8px;
        }

        .os-matrix-head {
          position: sticky;
          top: 0;
          z-index: 2;
          background: rgba(25, 35, 55, 0.95);
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: rgba(150, 200, 255, 0.9);
          padding: 0.4rem 0;
        }

        .os-matrix-head .os-cell-week,
        .os-matrix-head .os-cell-total,
        .os-matrix-head .os-cell-pct {
          text-align: center;
        }

        .os-matrix-row:not(.os-matrix-head) {
          background: rgba(255, 255, 255, 0.03);
          padding: 0.28rem 0;
          font-size: 0.78rem;
        }

        .os-matrix-row:not(.os-matrix-head):hover {
          background: rgba(255, 255, 255, 0.07);
        }

        .os-matrix .os-row-me {
          outline: 1px solid rgba(255, 215, 0, 0.55);
          background: rgba(255, 215, 0, 0.07);
        }

        .os-cell-rank {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.55);
        }

        .os-rank-gold { color: #ffd700; }
        .os-rank-silver { color: #c8d2e0; }
        .os-rank-bronze { color: #cd9a62; }

        .os-cell-name {
          display: flex;
          align-items: center;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding-right: 0.4rem;
        }

        .os-cell-week {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
          overflow: hidden;
          font-size: 0.72rem;
        }

        .os-cell-score {
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.9);
          flex-direction: column;
          gap: 0;
          line-height: 1.15;
          padding: 0.12rem 0;
        }

        .os-score-num {
          font-weight: 600;
        }

        .os-score-right {
          font-size: 0.56rem;
          color: rgba(150, 255, 170, 0.85);
        }

        .os-cell-best {
          box-shadow: inset 0 0 0 1px rgba(150, 200, 255, 0.8);
          font-weight: 700;
          color: white;
        }

        .os-cell-total {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: rgba(190, 215, 255, 1);
        }

        .os-cell-pct {
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(150, 255, 170, 0.95);
          font-weight: 600;
        }

        /* ---------- Ranked cards (mobile / tablet) ---------- */
        .os-cards {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .os-card-wrap {
          border-radius: 10px;
        }

        .os-card-wrap.os-row-me {
          outline: 1px solid rgba(255, 215, 0, 0.55);
          background: rgba(255, 215, 0, 0.07);
        }

        .os-card {
          width: 100%;
          display: grid;
          grid-template-columns: 34px 1fr 64px 56px 28px;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 0.5rem;
          background: rgba(255, 255, 255, 0.03);
          border: none;
          border-radius: 10px;
          color: white;
          font: inherit;
          font-size: 0.9rem;
          cursor: pointer;
          text-align: left;
        }

        .os-card-head {
          background: transparent;
          cursor: default;
          padding: 0.2rem 0.5rem;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(150, 200, 255, 0.9);
        }

        .os-card-head .os-cell-total,
        .os-card-head .os-cell-pct {
          justify-content: center;
        }

        .os-card .os-cell-name {
          font-weight: 600;
        }

        .os-card-chev {
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.45);
          transition: transform 0.15s ease;
        }

        .os-card-chev.open {
          transform: rotate(180deg);
        }

        .os-card-weeks {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
          gap: 5px;
          padding: 0.5rem 0.5rem 0.65rem;
        }

        .os-week-chip {
          display: flex;
          align-items: baseline;
          gap: 0.3rem;
          padding: 0.3rem 0.45rem;
          background: rgba(100, 150, 255, 0.1);
          border: 1px solid rgba(100, 150, 255, 0.2);
          border-radius: 8px;
          font-size: 0.75rem;
          font-variant-numeric: tabular-nums;
        }

        .os-week-chip-label {
          color: rgba(150, 200, 255, 0.85);
          font-weight: 700;
          font-size: 0.65rem;
        }

        .os-week-chip-score {
          font-weight: 700;
        }

        .os-week-chip-right {
          margin-left: auto;
          color: rgba(150, 255, 170, 0.8);
          font-size: 0.65rem;
        }

        .os-viewtoggle {
          display: none;
          align-items: center;
          gap: 0.4rem;
          margin: 0 auto 0.75rem;
          padding: 0.45rem 0.9rem;
          border-radius: 10px;
          background: rgba(100, 150, 255, 0.12);
          border: 1px solid rgba(100, 150, 255, 0.3);
          color: rgba(170, 205, 255, 1);
          font: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }

        @media (min-width: 1100px) {
          .os-matrix { display: flex; }
          .os-cards { display: none; }
        }

        @media (max-width: 1099px) {
          .os-viewtoggle { display: flex; }

          /* Forced grid on small screens: real column widths + side scroll */
          .os-grid-forced .os-matrix {
            display: flex;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 0.5rem;
          }

          .os-grid-forced .os-matrix-row {
            grid-template-columns:
              34px 110px
              repeat(var(--os-week-count), 48px)
              56px 52px;
            width: max-content;
            min-width: 100%;
          }

          .os-grid-forced .os-cards { display: none; }
        }

        @media (max-width: 768px) {
          .os-page {
            padding: 0 0.125rem 4rem;
          }

          .os-stats {
            gap: 1.25rem;
          }

          .os-header h1 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}

export default OverallStandings;
