import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { statsAPI, authAPI, gameAPI } from '../services/api';
import { sanitizeString } from '../utils/sanitize';
import CustomDropdown from '../components/CustomDropdown';

/**
 * Weekly standings, redesigned.
 *
 * Desktop: the whole scoreboard as one matrix — a column per game, a row per
 * player, every pick chip color-coded, sized with fractional columns so a
 * 16-game week fits without horizontal scrolling.
 * Mobile/tablet: ranked cards; tap a player to see their week's picks.
 */
function WeeklyStandings() {
  const { user } = useAuth();
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [standings, setStandings] = useState([]);
  const [games, setGames] = useState([]);
  const [picksByPicker, setPicksByPicker] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState(0);
  const [availableTags, setAvailableTags] = useState([{ id: 0, name: 'All' }]);
  const [expandedId, setExpandedId] = useState(null);
  const [mobileGrid, setMobileGrid] = useState(false);

  useEffect(() => {
    authAPI.getUserTags()
      .then(r => { if (r.data.success) setAvailableTags(r.data.tags); })
      .catch(() => {});
    loadWeeks();
  }, []);

  useEffect(() => {
    if (selectedWeek) loadStandings();
  }, [selectedWeek, selectedTag]);

  // Live standings: silently refetch every minute (no page reload)
  useEffect(() => {
    if (!selectedWeek) return;
    const interval = setInterval(() => loadStandings(true), 60000);
    return () => clearInterval(interval);
  }, [selectedWeek, selectedTag]);

  const loadWeeks = async () => {
    try {
      const response = await gameAPI.getWeeks();
      if (response.data.success) {
        const w = response.data.weeks;
        setWeeks(w);
        // The week in progress, else the most recent finished week
        const completedWeeks = w.filter(wk => wk.completed);
        setSelectedWeek(w.find(wk => wk.current) || completedWeeks[completedWeeks.length - 1] || w[0]);
      }
    } catch (e) {
      console.error('Error loading weeks:', e);
    }
  };

  const loadStandings = async (background = false) => {
    try {
      if (!background) setLoading(true);
      const response = await statsAPI.getWeeklyStandingsClassic(selectedWeek.id, selectedTag);
      if (!response.data.success) throw new Error('Standings request failed');

      const clean = response.data.standings.map(p => ({
        ...p,
        nickname: sanitizeString(p.nickname || ''),
        potential_score: p.new_potential_score ?? p.score,
        potential_correct: p.new_potential_correct ?? p.numright,
      }));
      // Race for the week: highest potential first, then current score
      clean.sort((a, b) =>
        (b.potential_score - a.potential_score) || (b.score - a.score)
      );
      setStandings(clean);
      setGames(response.data.games || []);
      setPicksByPicker(response.data.picksByPicker || {});
    } catch (e) {
      console.error('Error loading standings:', e);
    } finally {
      if (!background) setLoading(false);
    }
  };

  const gameShort = (g) => {
    const final = g.winner != null;
    return {
      final,
      status: final ? 'Final' : (g.time || shortKick(g.date)),
      awayLine: `${g.away_abbr}${g.awayscore != null ? ' ' + g.awayscore : ''}`,
      homeLine: `${g.home_abbr}${g.homescore != null ? ' ' + g.homescore : ''}`,
      awayWon: final && g.winner === g.away_id,
      homeWon: final && g.winner === g.home_id,
    };
  };

  function shortKick(dateString) {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        timeZone: 'America/New_York', weekday: 'short', hour: 'numeric',
      });
    } catch { return ''; }
  }

  const abbrById = useMemo(() => {
    const m = {};
    for (const g of games) {
      m[g.home_id] = g.home_abbr;
      m[g.away_id] = g.away_abbr;
    }
    return m;
  }, [games]);

  // correct | wrong | pending for one player's pick on one game
  const pickState = (pick, game) => {
    if (!pick) return 'none';
    if (game.winner == null) return 'pending';
    return pick.guess === game.winner ? 'correct' : 'wrong';
  };

  const finalsCount = games.filter(g => g.winner != null).length;
  const leader = standings[0];
  const myIndex = standings.findIndex(p => p.id === user?.id);
  const myRow = myIndex >= 0 ? standings[myIndex] : null;

  const rankClass = (i) =>
    i === 0 ? 'ws-rank-gold' : i === 1 ? 'ws-rank-silver' : i === 2 ? 'ws-rank-bronze' : '';

  const renderChip = (playerId, game, withResult = false) => {
    const pick = picksByPicker[playerId]?.[game.id];
    const state = pickState(pick, game);
    if (state === 'none') {
      return <span className="ws-chip ws-chip-none">—</span>;
    }
    const abbr = abbrById[pick.guess] || '?';
    return (
      <span className={`ws-chip ws-chip-${state}`} title={`${abbr} for ${pick.weight}`}>
        <span className="ws-chip-abbr">{abbr}</span>
        <span className="ws-chip-weight">{pick.weight}</span>
        {withResult && (
          <span className="ws-chip-result">
            {game.winner != null ? `${gameShort(game).awayLine}-${gameShort(game).homeLine}` : gameShort(game).status}
          </span>
        )}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="ws-page">
      <div className="ws-header glass-container">
        <div className="ws-hero">
        <h1>Weekly Standings</h1>

        <div className="ws-stats">
          <div className="ws-stat">
            <span className="ws-stat-value ws-stat-leader">
              <Trophy size={17} /> {leader ? leader.nickname : '—'}
            </span>
            <span className="ws-stat-label">{leader ? `${leader.score} pts` : 'Week leader'}</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat-value">{finalsCount}/{games.length}</span>
            <span className="ws-stat-label">Games final</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat-value">{myRow ? `#${myIndex + 1}` : '—'}</span>
            <span className="ws-stat-label">Your rank</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat-value">{myRow ? myRow.score : '—'}</span>
            <span className="ws-stat-label">Your points</span>
          </div>
        </div>
        <div className="ws-controls">
          <div className="ws-control">
            <CustomDropdown
              options={(() => {
                const completedWeeks = weeks.filter(w => w.completed);
                const auto = weeks.find(w => w.current) || completedWeeks[completedWeeks.length - 1] || weeks[0];
                return weeks.map(w => ({
                  value: w.id,
                  label: w.id === auto?.id ? `Week ${w.number} (Current)` : `Week ${w.number}`,
                }));
              })()}
              value={selectedWeek?.id || ''}
              onChange={(v) => {
                setSelectedWeek(weeks.find(w => w.id === parseInt(v)));
                setExpandedId(null);
              }}
              placeholder="Select Week"
            />
          </div>
          {availableTags.length > 1 && (
            <div className="ws-control">
              <label>Filter</label>
              <CustomDropdown
                options={availableTags.map(t => ({ value: t.id, label: t.name }))}
                value={selectedTag}
                onChange={(v) => setSelectedTag(parseInt(v))}
                placeholder="All"
              />
            </div>
          )}
        </div>
        </div>
      </div>

      <div className="glass-container ws-board">
        <h2 className="ws-board-title">Week {selectedWeek?.number} Results</h2>

        {standings.length === 0 || games.length === 0 ? (
          <div className="ws-empty">No standings data available for this week.</div>
        ) : (
          <div className={mobileGrid ? 'ws-views ws-grid-forced' : 'ws-views'}>
            <button
              type="button"
              className="ws-viewtoggle"
              onClick={() => setMobileGrid(g => !g)}
            >
              {mobileGrid ? <><List size={14} /> Card view</> : <><LayoutGrid size={14} /> Full grid view</>}
            </button>

            {/* ---- Full pick matrix (desktop, or forced on mobile) ---- */}
            <div className="ws-matrix" style={{ '--ws-game-count': games.length }}>
              <div className="ws-matrix-row ws-matrix-head">
                <span className="ws-cell-rank">#</span>
                <span className="ws-cell-name">Player</span>
                {games.map(g => {
                  const s = gameShort(g);
                  return (
                    <span key={g.id} className="ws-cell-game">
                      <span className={`ws-game-team ${s.awayWon ? 'won' : ''}`}>{s.awayLine}</span>
                      <span className={`ws-game-team ${s.homeWon ? 'won' : ''}`}>{s.homeLine}</span>
                      <span className={`ws-game-status ${s.final ? 'final' : ''}`}>{s.status}</span>
                    </span>
                  );
                })}
                <span className="ws-cell-num">Pts</span>
                <span className="ws-cell-num">Max</span>
              </div>

              {standings.map((p, i) => (
                <div
                  key={p.id}
                  className={`ws-matrix-row ${p.id === user?.id ? 'ws-row-me' : ''}`}
                >
                  <span className={`ws-cell-rank ${rankClass(i)}`}>{i + 1}</span>
                  <span className="ws-cell-name" title={p.nickname}>{p.nickname}</span>
                  {games.map(g => (
                    <span key={g.id} className="ws-cell-pick">
                      {renderChip(p.id, g)}
                    </span>
                  ))}
                  <span className="ws-cell-num ws-cell-score">{p.score}</span>
                  <span className="ws-cell-num ws-cell-max">{p.potential_score}</span>
                </div>
              ))}
            </div>

            {/* ---- Mobile / tablet: ranked expandable cards ---- */}
            <div className="ws-cards">
              <div className="ws-card ws-card-head">
                <span className="ws-cell-rank">#</span>
                <span className="ws-cell-name">Player</span>
                <span className="ws-cell-num">Pts</span>
                <span className="ws-cell-num">Max</span>
                <span className="ws-card-chev" />
              </div>
              {standings.map((p, i) => {
                const open = expandedId === p.id;
                return (
                  <div key={p.id} className={`ws-card-wrap ${p.id === user?.id ? 'ws-row-me' : ''}`}>
                    <button
                      type="button"
                      className="ws-card"
                      onClick={() => setExpandedId(open ? null : p.id)}
                      aria-expanded={open}
                    >
                      <span className={`ws-cell-rank ${rankClass(i)}`}>{i + 1}</span>
                      <span className="ws-cell-name">{p.nickname}</span>
                      <span className="ws-cell-num ws-cell-score">{p.score}</span>
                      <span className="ws-cell-num ws-cell-max">{p.potential_score}</span>
                      <span className={`ws-card-chev ${open ? 'open' : ''}`}><ChevronDown size={16} /></span>
                    </button>
                    {open && (
                      <div className="ws-card-picks">
                        {games.map(g => (
                          <span key={g.id}>{renderChip(p.id, g, true)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="ws-legend">
              <span><i className="ws-dot ws-dot-correct" /> Correct</span>
              <span><i className="ws-dot ws-dot-wrong" /> Wrong</span>
              <span><i className="ws-dot ws-dot-pending" /> Not final</span>
              <span className="ws-legend-max">Max = points still possible</span>
            </div>
          </div>
        )}
      </div>

      <style jsx="true">{`
        .ws-page {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 1rem 4rem;
        }

        .ws-header {
          margin-bottom: 1.25rem;
          padding: 1.25rem 1.5rem;
        }

        .ws-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .ws-header h1 {
          font-size: 1.5rem;
          white-space: nowrap;
        }

        .ws-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .ws-control {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .ws-control .custom-dropdown {
          width: 190px;
        }

        .ws-control label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(150, 200, 255, 0.85);
        }

        .ws-stats {
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
        }

        .ws-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
        }

        .ws-stat-value {
          font-size: 1.45rem;
          font-weight: 700;
          color: rgba(190, 215, 255, 1);
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .ws-stat-leader svg {
          color: #ffd700;
        }

        .ws-stat-label {
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.55);
        }

        .ws-board {
          padding: 1rem;
        }

        .ws-board-title {
          text-align: center;
          font-size: 1.3rem;
          margin-bottom: 1rem;
        }

        .ws-empty {
          text-align: center;
          padding: 2rem;
          color: rgba(255, 255, 255, 0.6);
          font-style: italic;
        }

        /* ---------- Pick matrix (desktop) ---------- */
        .ws-matrix {
          display: none;
          flex-direction: column;
          gap: 2px;
          font-variant-numeric: tabular-nums;
        }

        .ws-matrix-row {
          display: grid;
          grid-template-columns:
            30px minmax(88px, 140px)
            repeat(var(--ws-game-count), minmax(0, 1fr))
            46px 46px;
          gap: 2px;
          align-items: stretch;
          border-radius: 8px;
        }

        .ws-matrix-head {
          position: sticky;
          top: 0;
          z-index: 2;
          background: rgba(25, 35, 55, 0.95);
          padding: 0.35rem 0;
          border-radius: 8px;
        }

        .ws-matrix-row:not(.ws-matrix-head) {
          background: rgba(255, 255, 255, 0.03);
          padding: 0.22rem 0;
        }

        .ws-matrix-row:not(.ws-matrix-head):hover {
          background: rgba(255, 255, 255, 0.07);
        }

        .ws-matrix .ws-row-me {
          outline: 1px solid rgba(255, 215, 0, 0.55);
          background: rgba(255, 215, 0, 0.07);
        }

        .ws-cell-rank {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.55);
        }

        .ws-rank-gold { color: #ffd700; }
        .ws-rank-silver { color: #c8d2e0; }
        .ws-rank-bronze { color: #cd9a62; }

        .ws-cell-name {
          display: flex;
          align-items: center;
          font-weight: 600;
          font-size: 0.78rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding-right: 0.3rem;
        }

        .ws-cell-game {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1px;
          min-width: 0;
          font-size: 0.62rem;
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.2;
        }

        .ws-game-team {
          white-space: nowrap;
          overflow: hidden;
          max-width: 100%;
        }

        .ws-game-team.won {
          color: rgba(150, 255, 170, 1);
          font-weight: 700;
        }

        .ws-game-status {
          font-size: 0.55rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.4);
        }

        .ws-game-status.final {
          color: rgba(150, 200, 255, 0.7);
        }

        .ws-cell-num {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.78rem;
        }

        .ws-matrix-head .ws-cell-num {
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: rgba(150, 200, 255, 0.9);
        }

        .ws-matrix-head .ws-cell-rank,
        .ws-matrix-head .ws-cell-name {
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: rgba(150, 200, 255, 0.9);
        }

        .ws-cell-score { color: rgba(190, 215, 255, 1); }
        .ws-cell-max { color: rgba(150, 255, 170, 0.9); }

        .ws-cell-pick {
          display: flex;
          align-items: stretch;
          justify-content: stretch;
          min-width: 0;
        }

        /* ---------- Pick chips ---------- */
        .ws-chip {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          border-radius: 4px;
          font-size: 0.62rem;
          padding: 0.18rem 0.1rem;
          overflow: hidden;
          white-space: nowrap;
        }

        .ws-chip-abbr {
          font-weight: 700;
          overflow: hidden;
          text-overflow: clip;
        }

        .ws-chip-weight {
          opacity: 0.85;
        }

        .ws-chip-correct {
          background: rgba(100, 255, 150, 0.16);
          color: rgba(170, 255, 190, 1);
        }

        .ws-chip-wrong {
          background: rgba(255, 100, 100, 0.14);
          color: rgba(255, 160, 160, 0.9);
        }

        .ws-chip-pending {
          background: rgba(255, 255, 255, 0.07);
          color: rgba(255, 255, 255, 0.75);
        }

        .ws-chip-none {
          background: transparent;
          color: rgba(255, 255, 255, 0.25);
        }

        /* ---------- Ranked cards (mobile / tablet) ---------- */
        .ws-cards {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ws-card-wrap {
          border-radius: 10px;
        }

        .ws-card-wrap.ws-row-me {
          outline: 1px solid rgba(255, 215, 0, 0.55);
          background: rgba(255, 215, 0, 0.07);
        }

        .ws-card {
          width: 100%;
          display: grid;
          grid-template-columns: 34px 1fr 52px 52px 28px;
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

        .ws-card .ws-cell-name,
        .ws-card .ws-cell-rank,
        .ws-card .ws-cell-num {
          font-size: 0.9rem;
        }

        .ws-card .ws-cell-name {
          font-weight: 600;
        }

        .ws-card-head {
          background: transparent;
          cursor: default;
          padding: 0.2rem 0.5rem;
        }

        .ws-card-head .ws-cell-rank,
        .ws-card-head .ws-cell-name,
        .ws-card-head .ws-cell-num {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(150, 200, 255, 0.9);
        }

        .ws-card-chev {
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.45);
          transition: transform 0.15s ease;
        }

        .ws-card-chev.open {
          transform: rotate(180deg);
        }

        .ws-card-picks {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
          gap: 5px;
          padding: 0.5rem 0.5rem 0.65rem;
        }

        .ws-card-picks .ws-chip {
          font-size: 0.72rem;
          padding: 0.35rem 0.4rem;
          flex-direction: column;
          gap: 1px;
        }

        .ws-card-picks .ws-chip-result {
          font-size: 0.6rem;
          opacity: 0.7;
        }

        /* ---------- Legend ---------- */
        .ws-legend {
          display: flex;
          justify-content: center;
          gap: 1.25rem;
          flex-wrap: wrap;
          margin-top: 0.9rem;
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .ws-legend span {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .ws-dot {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          display: inline-block;
        }

        .ws-dot-correct { background: rgba(100, 255, 150, 0.5); }
        .ws-dot-wrong { background: rgba(255, 100, 100, 0.45); }
        .ws-dot-pending { background: rgba(255, 255, 255, 0.2); }

        .ws-viewtoggle {
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
          .ws-matrix { display: flex; }
          .ws-cards { display: none; }
        }

        @media (max-width: 1099px) {
          .ws-viewtoggle { display: flex; }

          /* Forced grid on small screens: real column widths + side scroll */
          .ws-grid-forced .ws-matrix {
            display: flex;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 0.5rem;
          }

          .ws-grid-forced .ws-matrix-row {
            grid-template-columns:
              30px 110px
              repeat(var(--ws-game-count), 52px)
              46px 46px;
            width: max-content;
            min-width: 100%;
          }

          .ws-grid-forced .ws-cards { display: none; }
        }

        @media (max-width: 768px) {
          .ws-page {
            padding: 0 0.125rem 4rem;
          }

          .ws-header h1 {
            font-size: 1.5rem;
          }

          .ws-stats {
            gap: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}

export default WeeklyStandings;
