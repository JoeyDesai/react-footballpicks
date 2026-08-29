import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Save, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { gameAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import CustomDropdown from '../components/CustomDropdown';
import OrderPicksView from '../components/OrderPicksView';
import { getTeamImageName } from '../utils/teamLogos';
import { sanitizeString, sanitizeFormData, getSafeDisplayName, sanitizeInteger } from '../utils/sanitize';

function MakePicks() {
  const { user } = useAuth();
  // Main state for managing picks and games
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [games, setGames] = useState([]);
  const [picks, setPicks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [viewMode, setViewMode] = useState('dragdrop'); // 'tiles', 'classic', 'dragdrop'
  const [autoPickHighest, setAutoPickHighest] = useState(true);
  const [validationErrors, setValidationErrors] = useState([]);
  // Tracks the latest games/picks request so stale responses are discarded
  const loadRequestRef = useRef(0);

  // Helper function to format date/time to Eastern time
  const formatDateTime = (dateString) => {
    if (!dateString) return 'TBD';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'TBD';
    }
  };

  useEffect(() => {
    loadWeeks();
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadGamesAndPicks();
    }
  }, [selectedWeek]);

  // Auto-assign point values when switching to drag-drop view
  useEffect(() => {
    if (viewMode === 'dragdrop' && games.length > 0 && !readOnly) {
      const orderedGames = [...games].sort((a, b) => {
        const aValue = picks[`VAL${a.id}`] || 0;
        const bValue = picks[`VAL${b.id}`] || 0;
        return bValue - aValue;
      });

      const newPicks = { ...picks };
      let hasChanges = false;

      // Reassign all values positionally (like the drop handler does) so the
      // stored values always match the displayed order and can't duplicate
      orderedGames.forEach((game, index) => {
        const expectedValue = games.length - index;
        if (newPicks[`VAL${game.id}`] !== expectedValue) {
          newPicks[`VAL${game.id}`] = expectedValue;
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        setPicks(newPicks);
      }
    }
  }, [viewMode, games.length]);


  // Load available weeks and auto-select the next one to pick
  const loadWeeks = async () => {
    try {
      const response = await gameAPI.getWeeks();
      if (response.data.success) {
        setWeeks(response.data.weeks);
        // Auto-select the week to pick: the first one that hasn't started
        // (pre-season: week 1; end of season: fall back to the last week)
        const w = response.data.weeks;
        setSelectedWeek(w.find(wk => wk.future) || w[w.length - 1]);
      }
    } catch (error) {
      setError('Failed to load weeks');
    } finally {
      setLoading(false);
    }
  };

  const loadGamesAndPicks = async () => {
    const requestId = ++loadRequestRef.current;
    try {
      setLoading(true);
      const [gamesResponse, picksResponse] = await Promise.all([
        gameAPI.getGames(selectedWeek.id),
        gameAPI.getPicks(selectedWeek.id)
      ]);

      // Ignore stale responses from a previously selected week
      if (requestId !== loadRequestRef.current) return;

      if (gamesResponse.data.success) {
        // Sanitize game data
        const sanitizedGames = gamesResponse.data.games.map(game => ({
          ...game,
          away_city: sanitizeString(game.away_city || ''),
          away_name: sanitizeString(game.away_name || ''),
          home_city: sanitizeString(game.home_city || ''),
          home_name: sanitizeString(game.home_name || '')
        }));
        setGames(sanitizedGames);
        setReadOnly(gamesResponse.data.readOnly || false);
      }

      if (picksResponse.data.success) {
        const existingPicks = {};
        picksResponse.data.picks.forEach(pick => {
          existingPicks[`GAME${pick.game}`] = pick.guess;
          existingPicks[`VAL${pick.game}`] = pick.weight;
        });
        setPicks(existingPicks);
      }
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setError('Failed to load games and picks');
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  };

  // Handle when user picks a team for a game
  const handlePickChange = (gameId, team) => {
    const newPicks = {
      ...picks,
      [`GAME${gameId}`]: team
    };

    // Auto-assign highest available point value if auto-pick is enabled
    // and this game doesn't already have a point value assigned
    const existingValue = picks[`VAL${gameId}`];
    if (autoPickHighest && (!existingValue || existingValue === 0)) {
      const usedValues = new Set();
      games.forEach(game => {
        const value = newPicks[`VAL${game.id}`];
        if (value && value !== 0) {
          usedValues.add(value);
        }
      });

      // Find the highest unused value
      let highestUnused = 0;
      for (let i = games.length; i >= 1; i--) {
        if (!usedValues.has(i)) {
          highestUnused = i;
          break;
        }
      }

      if (highestUnused > 0) {
        newPicks[`VAL${gameId}`] = highestUnused;
      }
    }

    setPicks(newPicks);
    setError('');
    setSuccess('');

    // Only clear validation errors if picks are now valid
    const errors = validatePicks(newPicks);
    if (errors.length === 0) {
      setValidationErrors([]);
    }
  };

  const handleAutoPickToggle = () => {
    setAutoPickHighest(!autoPickHighest);
    // Clear validation errors when toggling auto pick to prevent red glow
    setValidationErrors([]);
    setError('');
    setSuccess('');
  };

  const handleValueChange = (gameId, value) => {
    const newPicks = {
      ...picks,
      [`VAL${gameId}`]: parseInt(value)
    };
    
    setPicks(newPicks);
    setError('');
    setSuccess('');

    // Only clear validation errors if picks are now valid
    const errors = validatePicks(newPicks);
    if (errors.length === 0) {
      setValidationErrors([]);
    }
  };

  // Commit a reorder from the Order view: move one game to a new position
  // and reassign every point value from the resulting order (top = most points)
  const handleMove = (gameId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const newOrder = [...orderedGames];
    const [moved] = newOrder.splice(fromIndex, 1);
    if (!moved || moved.id !== gameId) return;
    newOrder.splice(toIndex, 0, moved);

    const newPicks = { ...picks };
    newOrder.forEach((game, index) => {
      newPicks[`VAL${game.id}`] = games.length - index;
    });

    setPicks(newPicks);
    setError('');
    setSuccess('');
    if (validatePicks(newPicks).length === 0) {
      setValidationErrors([]);
    }
  };

  // Validates the given picks object (defaults to current state); pass the
  // freshly-built picks when calling right after setPicks to avoid stale state
  const validatePicks = (currentPicks = picks) => {
    const usedValues = new Set();
    const errors = [];

    games.forEach(game => {
      const pick = currentPicks[`GAME${game.id}`];
      const value = currentPicks[`VAL${game.id}`];

      if (!pick) {
        errors.push(`Please select a winner for ${game.away_city} ${game.away_name} @ ${game.home_city} ${game.home_name}`);
      }

      if (!value || value === 0) {
        errors.push(`Please assign a point value for ${game.away_city} ${game.away_name} @ ${game.home_city} ${game.home_name}`);
      } else if (usedValues.has(value)) {
        errors.push(`Point value ${value} is used more than once`);
      } else {
        usedValues.add(value);
      }
    });

    return errors;
  };

  // Check if a game tile needs attention (blue glow)
  const isGameIncomplete = (gameId) => {
    const pick = picks[`GAME${gameId}`];
    const value = picks[`VAL${gameId}`];
    
    // Must have both team selection and point value
    if (!pick || !value || value === 0) return true;
    
    // Check for duplicate point values
    const usedValues = new Set();
    games.forEach(game => {
      if (game.id !== gameId) {
        const gameValue = picks[`VAL${game.id}`];
        if (gameValue && gameValue !== 0) {
          usedValues.add(gameValue);
        }
      }
    });
    
    // Stay blue if point value is duplicated
    return usedValues.has(value);
  };

  // Check if a game has validation errors (red glow) - only when submit is attempted
  const hasGameValidationError = (gameId) => {
    // Only show red glow if validation has been attempted (submit clicked)
    if (validationErrors.length === 0) return false;
    
    const pick = picks[`GAME${gameId}`];
    const value = picks[`VAL${gameId}`];
    
    if (!pick || !value || value === 0) return true;
    
    // Check for duplicate point values
    const usedValues = new Set();
    games.forEach(game => {
      if (game.id !== gameId) {
        const gameValue = picks[`VAL${game.id}`];
        if (gameValue && gameValue !== 0) {
          usedValues.add(gameValue);
        }
      }
    });
    
    return usedValues.has(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validatePicks();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setError(errors.join('. '));
      return;
    }

    // Clear validation errors and error messages when submitting successfully
    setValidationErrors([]);
    setError('');
    setSaving(true);

    try {
      // Sanitize picks data before submission
      const sanitizedPicks = {};
      Object.keys(picks).forEach(key => {
        if (key.startsWith('GAME')) {
          sanitizedPicks[key] = sanitizeInteger(picks[key], 0);
        } else if (key.startsWith('VAL')) {
          sanitizedPicks[key] = sanitizeInteger(picks[key], 0);
        }
      });

      const response = await gameAPI.submitPicks(selectedWeek.id, sanitizedPicks);
      if (response.data.success) {
        setSuccess('Picks saved successfully!');
        // Clear success message after animation
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(sanitizeString(response.data.error || 'Failed to save picks'));
      }
    } catch (error) {
      setError('Network error while saving picks');
    } finally {
      setSaving(false);
    }
  };

  const getUnusedValues = () => {
    const usedValues = new Set();
    games.forEach(game => {
      const value = picks[`VAL${game.id}`];
      if (value && value !== 0) {
        usedValues.add(value);
      }
    });

    const unused = [];
    for (let i = 1; i <= games.length; i++) {
      if (!usedValues.has(i)) {
        unused.push(i);
      }
    }
    return unused;
  };

  // Games ordered by point value (highest first) for the Order view;
  // memoized so drag-over re-renders don't re-sort every time
  const orderedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const aValue = picks[`VAL${a.id}`] || 0;
      const bValue = picks[`VAL${b.id}`] || 0;
      return bValue - aValue; // Highest points first
    });
  }, [games, picks]);

  // Stable options array so CustomDropdown's effect doesn't re-run on every render
  const pointValueOptions = useMemo(() => [
    { value: 0, label: 'Select Points' },
    ...Array.from({ length: games.length }, (_, i) => ({
      value: i + 1,
      label: (i + 1).toString()
    }))
  ], [games.length]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Shared clickable team button used by the Tiles and Classic views.
  // The whole surface (logo, name, record, check) selects the team.
  const renderTeamButton = (game, side, variant) => {
    const teamId = game[`${side}_id`];
    const name = game[`${side}_name`];
    const city = game[`${side}_city`];
    const selected = picks[`GAME${game.id}`] == teamId;
    // Classic labels its Away/Home columns, so only Tiles spells out the side
    const record = `${game[`${side}_wins`]}-${game[`${side}_losses`]}${
      game[`${side}_ties`] > 0 ? `-${game[`${side}_ties`]}` : ''
    }${variant === 'tile' ? ` · ${side === 'home' ? 'Home' : 'Away'}` : ''}`;

    if (readOnly) {
      return (
        <div className={`team-choice team-choice-${variant} ${variant === 'classic' && side === 'home' ? 'team-choice-mirror' : ''} readonly ${selected ? 'selected' : ''}`}>
          <img
            src={`/images/${getTeamImageName(name)}.svg`}
            alt=""
            className="team-choice-logo"
            draggable={false}
            onError={(e) => { e.target.style.visibility = 'hidden'; }}
          />
          <span className="team-choice-text">
            <span className="team-choice-name">
              <span className="team-choice-city">{city} </span>{name}
            </span>
            <span className="team-choice-record">{record}</span>
          </span>
          {selected && <span className="team-choice-check">✓</span>}
        </div>
      );
    }

    return (
      <button
        type="button"
        className={`team-choice team-choice-${variant} ${variant === 'classic' && side === 'home' ? 'team-choice-mirror' : ''} ${selected ? 'selected' : ''}`}
        onClick={() => handlePickChange(game.id, teamId)}
        aria-pressed={selected}
      >
        <img
          src={`/images/${getTeamImageName(name)}.svg`}
          alt=""
          className="team-choice-logo"
          draggable={false}
          onError={(e) => { e.target.style.visibility = 'hidden'; }}
        />
        <span className="team-choice-text">
          <span className="team-choice-name">
            <span className="team-choice-city">{city} </span>{name}
          </span>
          <span className="team-choice-record">{record}</span>
        </span>
        <span className={`team-choice-mark ${selected ? 'checked' : ''}`} aria-hidden="true">
          {selected ? '✓' : ''}
        </span>
      </button>
    );
  };

  const renderPanelHeader = (showUnused = true) => (
    <div className="main-panel-header">
      <div className="header-row">
        <h2>Week {selectedWeek?.number}</h2>
        {!readOnly && (
          <button
            type="button"
            className={`auto-pick-button ${autoPickHighest ? 'active' : ''}`}
            onClick={handleAutoPickToggle}
          >
            <Zap size={16} />
            Auto Pick Highest Points
          </button>
        )}
      </div>
      {!readOnly && showUnused && (
        <div className="unused-values-inline">
          <h3>Unused Point Values:</h3>
          <div className="values-list">
            {getUnusedValues().map(value => (
              <span key={value} className="unused-value">{value}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderSubmitSection = () => (
    !readOnly && (
      <div className="submit-section">
        <button
          type="submit"
          className="glass-button primary"
          disabled={saving}
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Picks'}
        </button>
        {validationErrors.length > 0 && (
          <div className="validation-message">
            <AlertCircle size={16} />
            <span>Please complete all highlighted games</span>
          </div>
        )}
      </div>
    )
  );

  const renderTilesView = () => (
    <div className="games-container glass-container">
      {renderPanelHeader()}

      <div className="games-grid">
        {games.map((game) => (
          <div
            key={game.id}
            className={`game-card ${
              validationErrors.length > 0 && hasGameValidationError(game.id) ? 'validation-error' :
              isGameIncomplete(game.id) ? 'incomplete' : ''
            }`}
          >
            <div className="game-header">
              <span className="game-date">{formatDateTime(game.date)}</span>
            </div>

            <div className="teams-container">
              {renderTeamButton(game, 'away', 'tile')}
              <div className="vs-divider">@</div>
              {renderTeamButton(game, 'home', 'tile')}
            </div>

            <div className="point-value">
              <label>Point Value:</label>
              {!readOnly ? (
                <CustomDropdown
                  options={pointValueOptions}
                  value={picks[`VAL${game.id}`] || 0}
                  onChange={(value) => handleValueChange(game.id, value)}
                  placeholder="Select Points"
                />
              ) : (
                <div className={`point-display ${
                  game.winner != null && picks[`GAME${game.id}`] == game.winner ? 'correct' :
                  game.winner != null && picks[`GAME${game.id}`] != game.winner ? 'incorrect' : 'pending'
                }`}>
                  {picks[`VAL${game.id}`] || 0}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {renderSubmitSection()}
    </div>
  );

  // Classic view: one compact row per game so a full week fits on screen
  const renderClassicView = () => (
    <div className="games-container glass-container">
      {renderPanelHeader()}

      <div className="classic-list">
        <div className="classic-head" aria-hidden="true">
          <span className="classic-head-date">Game</span>
          <span className="classic-head-team">Away</span>
          <span className="classic-at">@</span>
          <span className="classic-head-team">Home</span>
          <span className="classic-head-pts">Pts</span>
        </div>
        {games.map((game) => (
          <div
            key={game.id}
            className={`classic-row ${
              validationErrors.length > 0 && hasGameValidationError(game.id) ? 'validation-error' :
              isGameIncomplete(game.id) ? 'incomplete' : ''
            }`}
          >
            <span className="classic-date">{formatDateTime(game.date)}</span>
            {renderTeamButton(game, 'away', 'classic')}
            <span className="classic-at">@</span>
            {renderTeamButton(game, 'home', 'classic')}
            <div className="classic-points">
              <span className="classic-pts-label" aria-hidden="true">Pts</span>
              {!readOnly ? (
                <CustomDropdown
                  options={pointValueOptions}
                  value={picks[`VAL${game.id}`] || 0}
                  onChange={(value) => handleValueChange(game.id, value)}
                  placeholder="Pts"
                />
              ) : (
                <div className={`point-display ${
                  game.winner != null && picks[`GAME${game.id}`] == game.winner ? 'correct' :
                  game.winner != null && picks[`GAME${game.id}`] != game.winner ? 'incorrect' : 'pending'
                }`}>
                  {picks[`VAL${game.id}`] || 0}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {renderSubmitSection()}
    </div>
  );

  const renderOrderView = () => (
    <div className="games-container glass-container">
      <div className="main-panel-header">
        <div className="header-row">
          <h2>Week {selectedWeek?.number}</h2>
        </div>
        {!readOnly && (
          <p className="order-hint">
            Rank the games by confidence: the top game is worth the most points.
            Pick a winner on each row, then press and hold a row to drag it into place.
          </p>
        )}
      </div>

      <OrderPicksView
        orderedGames={orderedGames}
        totalGames={games.length}
        picks={picks}
        readOnly={readOnly}
        onPick={handlePickChange}
        onMove={handleMove}
        hasError={hasGameValidationError}
        isIncomplete={isGameIncomplete}
      />

      {!readOnly && (
        <div className="submit-section">
          <button
            type="submit"
            className="glass-button primary"
            disabled={saving}
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Picks'}
          </button>
          {validationErrors.length > 0 && (
            <div className="validation-message">
              <AlertCircle size={16} />
              <span>Please complete all highlighted games</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="picks-container">
      {/* Controls Section */}
      <div className="picks-header glass-container">
        <div className="header-content">
          <div className="title-section">
            <h1>Make Your Picks {getSafeDisplayName(user)}</h1>
          </div>
          
          <div className="controls">
            <div className="view-toggle">
              <label htmlFor="view-toggle">View</label>
              <div className="slider-container">
                <div className="slider-track">
                  <div className={`slider-thumb ${viewMode === 'tiles' ? 'slider-thumb-left' : viewMode === 'classic' ? 'slider-thumb-center' : 'slider-thumb-right'}`}>
                  </div>
                  <div className="slider-track-labels">
                    <span 
                      className={`track-label ${viewMode === 'tiles' ? 'track-label-active' : 'track-label-inactive'}`}
                      onClick={() => setViewMode('tiles')}
                    >
                      <span className="desktop-text">Tiles</span>
                      <span className="mobile-text">Tiles</span>
                    </span>
                    <span 
                      className={`track-label ${viewMode === 'classic' ? 'track-label-active' : 'track-label-inactive'}`}
                      onClick={() => setViewMode('classic')}
                    >
                      <span className="desktop-text">Classic</span>
                      <span className="mobile-text">Classic</span>
                    </span>
                    <span 
                      className={`track-label ${viewMode === 'dragdrop' ? 'track-label-active' : 'track-label-inactive'}`}
                      onClick={() => setViewMode('dragdrop')}
                    >
                      <span className="desktop-text">Drag &amp; Drop</span>
                      <span className="mobile-text">Drag &amp; Drop</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="week-selector">
              <label htmlFor="week-select">Week</label>
              <CustomDropdown
                options={(() => {
                  // The pickable week is the first one that hasn't started
                  const autoSelectedWeek = weeks.find(w => w.future) || weeks[weeks.length - 1];
                  
                  return weeks.map(week => {
                    const isAutoSelected = week.id === autoSelectedWeek?.id;
                    return {
                      value: week.id,
                      label: isAutoSelected ? `Week ${week.number} (Due Next)` : `Week ${week.number}`
                    };
                  });
                })()}
                value={selectedWeek?.id || ''}
                onChange={(value) => {
                  const week = weeks.find(w => w.id === parseInt(value));
                  setSelectedWeek(week);
                  // Clear validation errors when switching weeks
                  setValidationErrors([]);
                  setError('');
                }}
                placeholder="Select Week"
              />
            </div>
          </div>
        </div>

        {selectedWeek && (
          <div className="week-info">
            {selectedWeek.factor !== 1 && (
              <p className="multiplier-notice">
                <AlertCircle size={16} />
                All scores will be multiplied by {selectedWeek.factor} this week!
              </p>
            )}
            {readOnly && (
              <p className="readonly-notice">
                <Clock size={16} />
                This week has already started. Picks cannot be changed.
              </p>
            )}
          </div>
        )}
      </div>

      {success && (
        <div className="floating-success-notification">
          <div className="success-content">
            <CheckCircle size={20} />
            <span>Picks submitted successfully!</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="picks-form">
        {viewMode === 'tiles' && renderTilesView()}
        {viewMode === 'classic' && renderClassicView()}
        {viewMode === 'dragdrop' && renderOrderView()}
      </form>

      <style jsx="true">{`
        .picks-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem 4rem 1rem;
        }

        /* Mobile: use nearly the full screen width */
        @media (max-width: 768px) {
          .picks-container {
            max-width: 100%;
            padding: 0 0.125rem 4rem 0.125rem;
          }

          .picks-container .glass-container {
            padding: 1.25rem 0.5rem;
            border-radius: 14px;
          }
        }

        /* Header Controls */
        .picks-header {
          margin-bottom: 1.5rem;
          position: relative;
          z-index: 999 !important;
        }

        .header-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          align-items: center;
        }

        .title-section {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }

        .title-section h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: white;
          margin: 0;
          text-align: center;
        }

        .controls {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          width: 100%;
        }

        @media (min-width: 890px) {
          .controls {
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem;
            width: 100%;
          }
        }

        @media (min-width: 1024px) {
          .controls {
            grid-template-columns: repeat(2, auto);
            gap: 1.5rem;
            width: auto;
          }
        }

        .week-selector,
        .view-toggle {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .week-selector label,
        .view-toggle label {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 600;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Z-index stacking for dropdowns */
        .week-selector .custom-dropdown {
          z-index: 1001 !important;
        }

        .week-selector .custom-dropdown .dropdown-menu {
          z-index: 1001 !important;
        }

        .view-toggle .custom-dropdown {
          z-index: 950 !important;
        }

        .view-toggle .custom-dropdown .dropdown-menu {
          z-index: 950 !important;
        }

        /* Point value dropdowns in game cards - normal z-index for buttons, high for menus */
        .point-value .custom-dropdown {
          position: relative;
        }

        .point-value .custom-dropdown .dropdown-trigger {
          position: relative;
        }

        .point-value .custom-dropdown .dropdown-menu {
          z-index: 10000 !important;
          position: fixed !important;
          overflow: auto !important;
          max-height: 200px !important;
          background: rgba(20, 20, 30, 0.6) !important;
        }

        .point-value .custom-dropdown .dropdown-option {
          z-index: 10000 !important;
        }

        /* Override inline z-index styles for tiles view */
        .point-value .custom-dropdown[style*="z-index"] {
          z-index: auto !important;
        }

        .point-value .custom-dropdown .dropdown-trigger[style*="z-index"] {
          z-index: auto !important;
        }

        .point-value .custom-dropdown .dropdown-menu[style*="z-index"] {
          z-index: 10000 !important;
        }

        .point-value .custom-dropdown .dropdown-option[style*="z-index"] {
          z-index: 10000 !important;
        }

        /* Header selectors need room for "Week 10 (Due Next)" on one line */
        .week-selector .custom-dropdown {
          width: 210px;
        }

        /* Prevent scroll interference with dropdowns */
        .custom-dropdown .dropdown-menu {
          overscroll-behavior: contain !important;
          touch-action: pan-y !important;
        }

        .custom-dropdown .dropdown-option {
          overscroll-behavior: contain !important;
        }

        /* Global dropdown styling overrides */
        .games-container .custom-dropdown {
          position: relative !important;
        }

        .games-container .custom-dropdown .dropdown-menu {
          position: absolute !important;
          top: 100% !important;
          left: 0 !important;
          right: 0 !important;
          background: rgba(20, 20, 30, 0.6) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 8px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
          max-height: 200px !important;
          overflow-y: auto !important;
          padding-right: 2px !important;
          z-index: 999999 !important;
        }

        /* Custom scrollbar for dropdown menus */
        .games-container .custom-dropdown .dropdown-menu::-webkit-scrollbar {
          width: 4px !important;
        }

        .games-container .custom-dropdown .dropdown-menu::-webkit-scrollbar-track {
          background: transparent !important;
          border-radius: 0 8px 8px 0 !important;
        }

        .games-container .custom-dropdown .dropdown-menu::-webkit-scrollbar-thumb {
          background: rgba(200, 200, 200, 0.4) !important;
          border-radius: 0 4px 4px 0 !important;
          transition: all 0.3s ease !important;
        }

        .games-container .custom-dropdown .dropdown-menu::-webkit-scrollbar-thumb:hover {
          background: rgba(200, 200, 200, 0.6) !important;
        }

        .games-container .custom-dropdown .dropdown-menu::-webkit-scrollbar-corner {
          background: transparent !important;
        }

        .games-container .custom-dropdown .dropdown-option {
          padding: 0.4rem 0.75rem !important;
          font-size: 0.9rem !important;
          color: rgba(255, 255, 255, 0.9) !important;
          cursor: pointer !important;
          transition: background-color 0.2s ease !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        .games-container .custom-dropdown .dropdown-option:last-child {
          border-bottom: none !important;
        }

        .games-container .custom-dropdown .dropdown-option:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }

        .games-container .custom-dropdown .dropdown-option.selected {
          background: rgba(100, 150, 255, 0.2) !important;
          color: rgba(150, 200, 255, 1) !important;
        }

        /* View Toggle Slider */
        .slider-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 450px;
        }

        .slider-track {
          position: relative;
          background: rgba(255, 255, 255, 0.08);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          height: 40px;
          width: 100%;
          cursor: pointer;
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease, opacity 0.2s ease;
          box-shadow: 
            0 4px 16px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .slider-track:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
          box-shadow: 
            0 6px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .slider-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: calc(33.333% - 2px);
          height: calc(100% - 4px);
          background: rgba(100, 150, 255, 0.15);
          border: 1px solid rgba(100, 150, 255, 0.4);
          border-radius: 10px;
          cursor: pointer;
          /* Slide between positions */
          transition: transform 0.3s cubic-bezier(0.3, 0.9, 0.3, 1), background 0.3s ease, border-color 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 0 0 3px rgba(100, 150, 255, 0.1),
            0 6px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
          z-index: 2;
        }

        .slider-thumb-center {
          transform: translateX(100%);
        }

        .slider-thumb-right {
          transform: translateX(200%);
        }

        .slider-track-labels {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-around;
          pointer-events: none;
          z-index: 1;
        }

        .track-label {
          font-size: 0.8rem;
          font-weight: 500;
          text-align: center;
          flex: 1;
          cursor: pointer;
          pointer-events: auto;
          padding: 0.5rem;
          border-radius: 8px;
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease, opacity 0.2s ease;
        }

        .track-label:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .track-label-active {
          color: rgba(150, 200, 255, 1);
        }

        .track-label-inactive {
          color: rgba(255, 255, 255, 0.4);
        }

        .desktop-text {
          display: inline;
        }

        .mobile-text {
          display: none;
        }

        @media (max-width: 889px) {
          .desktop-text {
            display: none;
          }

          .mobile-text {
            display: inline;
          }
        }

        /* Week Info */
        .week-info {
          margin-top: 1rem;
          text-align: center;
        }

        .multiplier-notice,
        .readonly-notice {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: rgba(255, 200, 100, 1);
          font-weight: 500;
          margin: 0.5rem 0;
        }

        /* Error/Success Messages */
        .error-message,
        .success-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .error-message {
          background: rgba(255, 100, 100, 0.2);
          border: 1px solid rgba(255, 100, 100, 0.3);
          color: rgba(255, 150, 150, 1);
        }

        .success-message {
          background: rgba(100, 255, 100, 0.2);
          border: 1px solid rgba(100, 255, 100, 0.3);
          color: rgba(150, 255, 150, 1);
        }

        /* Main Panel Header */
        .main-panel-header {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .main-panel-header h2 {
          color: white;
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0;
        }

        .auto-pick-button {
          background: rgba(255, 255, 255, 0.08);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.7);
          padding: 0.6rem 1rem;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease, opacity 0.2s ease;
          font-size: 0.9rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 
            0 4px 16px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .auto-pick-button:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
          color: white;
          box-shadow: 
            0 6px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .auto-pick-button.active {
          background: rgba(100, 150, 255, 0.15);
          border-color: rgba(100, 150, 255, 0.4);
          color: rgba(150, 200, 255, 1);
          box-shadow: 
            0 0 0 3px rgba(100, 150, 255, 0.1),
            0 6px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .unused-values-inline {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .unused-values-inline h3 {
          color: white;
          font-size: 1rem;
          font-weight: 500;
          margin: 0;
        }

        .values-list {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .unused-value {
          background: rgba(100, 150, 255, 0.3);
          border: 1px solid rgba(100, 150, 255, 0.5);
          border-radius: 8px;
          padding: 0.5rem 1rem;
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
        }

        /* Tiles View */
        .games-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
          contain: layout style;
        }

        @media (min-width: 768px) {
          .games-grid {
            /* minmax(0, 1fr) so long nowrap team names can't stretch tracks unevenly */
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          .games-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .game-card {
          min-width: 0;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1rem;
          transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, opacity 0.3s ease;
        }

        .game-card:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .game-card.incomplete {
          box-shadow: 0 0 20px rgba(100, 150, 255, 0.3);
          border-color: rgba(100, 150, 255, 0.4);
        }

        .game-card.validation-error {
          box-shadow: 0 0 20px rgba(255, 100, 100, 0.4);
          border-color: rgba(255, 100, 100, 0.6);
        }

        .game-header {
          text-align: center;
          margin-bottom: 1rem;
        }

        .game-date {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
        }

        .teams-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .team-logo {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }

        .vs-divider {
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-weight: 600;
          padding: 0.5rem 0;
        }

        .radio-label {
          margin-left: 0.5rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.9rem;
        }

        .point-value {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .point-value label {
          white-space: nowrap;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        .point-display {
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-weight: 600;
          min-width: 60px;
          text-align: center;
        }

        .point-display.correct {
          background: rgba(100, 255, 100, 0.2);
          color: rgba(150, 255, 150, 1);
        }

        .point-display.incorrect {
          background: rgba(255, 100, 100, 0.2);
          color: rgba(255, 150, 150, 1);
        }

        .point-display.pending {
          background: rgba(255, 200, 100, 0.2);
          color: rgba(255, 220, 150, 1);
        }

        .vs-divider {
          color: rgba(255, 255, 255, 0.5);
          font-weight: 600;
          font-size: 1.2rem;
          padding: 0 0.1rem;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .readonly-picks {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        /* Desktop: Keep logos separate from team info */
        @media (min-width: 769px) {

          /* Hide mobile logos on desktop */
          .mobile-logo {
            display: none !important;
          }
        }

        /* Mobile: Show mobile logos, hide desktop logos */
        @media (max-width: 768px) {
          .mobile-logo {
            display: flex !important;
            justify-content: center;
            margin-bottom: 0.25rem;
          }
        }

        /* Drag and Drop View */
        .drag-instructions {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
          margin: 0;
        }

        .drag-instructions p {
          margin: 0;
          text-align: center;
          font-style: italic;
        }

        /* Mobile responsive for drag drop */
        @media (max-width: 768px) {

          .vs-divider {
            font-size: 0.8rem;
            padding: 0 0.25rem;
            flex-shrink: 0;
          }
        }

        /* Submit Section */
        .submit-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .submit-section .glass-button {
          background: rgba(255, 255, 255, 0.08);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.7);
          padding: 0.6rem 1rem;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease, opacity 0.2s ease;
          font-size: 0.9rem;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 200px;
          justify-content: center;
          box-shadow: 
            0 4px 16px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .submit-section .glass-button:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
          color: white;
          box-shadow: 
            0 6px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .submit-section .glass-button:disabled {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.4);
          cursor: not-allowed;
          box-shadow: 
            0 2px 8px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .validation-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: rgba(255, 150, 150, 1);
          font-size: 0.9rem;
          font-weight: 500;
        }

        /* Floating Success Notification */
        .floating-success-notification {
          position: fixed;
          top: 100px;
          right: 0;
          z-index: 1000;
          animation: slideInOut 3s ease-in-out forwards;
        }

        .success-content {
          /* No backdrop-filter on a sliding element: re-sampling the blur
             every frame of the slide is what makes the toast stutter.
             A near-opaque background keeps the glass look while it moves. */
          background: rgba(30, 75, 40, 0.95);
          border: 1px solid rgba(100, 255, 100, 0.6);
          border-radius: 16px;
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: rgba(150, 255, 150, 1);
          font-weight: 600;
          font-size: 1rem;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(100, 255, 100, 0.2);
        }

        @keyframes slideInOut {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          15% {
            transform: translateX(0);
            opacity: 1;
          }
          85% {
            transform: translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateX(100%);
            opacity: 0;
          }
        }

        /* Responsive Design */
        @media (max-width: 889px) {
          .title-section h1 {
            font-size: 2rem;
          }
          
          .controls {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .slider-container {
            width: 100%;
            max-width: 450px;
          }

          .custom-dropdown {
            width: 100% !important;
            max-width: 220px;
          }
        }

        @media (max-width: 768px) {
          .title-section h1 {
            font-size: 1.75rem;
          }
          
          /* Center header elements on mobile */
          .title-section {
            text-align: center;
          }
          
          .controls {
            align-items: center;
          }
          
          .view-toggle,
          .week-selector {
            align-items: center;
          }
          
          .slider-container {
            align-items: center;
          }
          
          .header-row {
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            text-align: center;
          }

          .auto-pick-button {
            width: 100%;
            justify-content: center;
          }
          
          /* Center main panel elements on mobile */
          .main-panel-header {
            align-items: center;
            text-align: center;
          }
          
          .unused-values-inline {
            align-items: center;
            text-align: center;
          }
          
          .values-list {
            justify-content: center;
          }

          .vs-divider {
            padding: 0 0.1rem;
            font-size: 1rem;
          }
        }

        @media (max-width: 480px) {
          .title-section h1 {
            font-size: 1.5rem;
          }
          
          .games-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Ensure week dropdown appears above main glass panel but below header */
        .picks-header .week-selector .custom-dropdown {
          z-index: 999 !important;
        }

        .picks-header .week-selector .custom-dropdown .dropdown-menu {
          z-index: 999 !important;
        }

        /* Ensure games-container has lower z-index than picks-header */
        .picks-container .games-container.glass-container {
          position: relative;
          z-index: 1 !important;
        }
      
        /* --- Clickable team buttons (Tiles + Classic) --- */
        .team-choice {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          min-width: 0;
          padding: 0.5rem 0.65rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: white;
          cursor: pointer;
          text-align: left;
          font: inherit;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .team-choice:hover:not(.readonly) {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.28);
        }

        /* Selected stays blue even while hovered (hover has higher
           specificity than .selected alone) */
        .team-choice.selected,
        .team-choice.selected:hover:not(.readonly) {
          background: rgba(100, 150, 255, 0.22);
          border-color: rgba(100, 150, 255, 0.65);
          box-shadow: 0 0 14px rgba(100, 150, 255, 0.25);
        }

        .team-choice.readonly {
          cursor: default;
        }

        .team-choice-logo {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          pointer-events: none;
        }

        .team-choice-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }

        .team-choice-name {
          font-weight: 600;
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .team-choice-record {
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.55);
        }

        .team-choice-mark {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.35);
          font-size: 0.8rem;
          font-weight: 700;
          color: transparent;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }

        .team-choice-mark.checked {
          border-color: rgba(100, 150, 255, 0.9);
          background: rgba(100, 150, 255, 0.85);
          color: white;
        }

        .team-choice-check {
          color: rgba(150, 200, 255, 1);
          font-weight: 700;
          flex-shrink: 0;
        }

        /* Tiles view: team buttons stack vertically inside the card */
        .team-choice-tile {
          width: 100%;
        }

        /* Home buttons mirror so the pick mark sits on the inner side */
        .team-choice-mirror {
          flex-direction: row-reverse;
          text-align: right;
        }

        /* --- Condensed Classic view --- */
        .classic-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .classic-row {
          display: grid;
          grid-template-columns: 130px 1fr 18px 1fr 108px;
          align-items: center;
          gap: 0.5rem;
          padding: 0.2rem 0.45rem;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .classic-row.incomplete {
          box-shadow: 0 0 16px rgba(100, 150, 255, 0.25);
          border-color: rgba(100, 150, 255, 0.4);
        }

        .classic-row.validation-error {
          box-shadow: 0 0 16px rgba(255, 100, 100, 0.35);
          border-color: rgba(255, 100, 100, 0.6);
        }

        .classic-row .team-choice {
          padding: 0.22rem 0.5rem;
          gap: 0.5rem;
        }

        .classic-row .team-choice-logo {
          width: 24px;
          height: 24px;
        }

        .classic-row .team-choice-mark {
          width: 20px;
          height: 20px;
          font-size: 0.72rem;
        }

        .classic-row .team-choice-name {
          font-size: 0.88rem;
        }

        .classic-row .team-choice-record {
          font-size: 0.68rem;
        }

        .classic-head {
          display: grid;
          grid-template-columns: 130px 1fr 18px 1fr 108px;
          gap: 0.5rem;
          padding: 0 0.5rem;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(150, 200, 255, 0.85);
        }

        .classic-head-team {
          padding-left: 0.5rem;
        }

        .classic-head-pts {
          text-align: left;
        }

        .classic-date {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.55);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .classic-at {
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 600;
        }

        .classic-points {
          min-width: 0;
        }

        .classic-pts-label {
          display: none;
        }

        /* CustomDropdown has a 140px min-width; the compact points column is narrower */
        .classic-points .custom-dropdown {
          min-width: 0;
          width: 100%;
        }

        /* Match the dropdown to the flat team boxes in the same row */
        .classic-points .dropdown-trigger {
          background: rgba(255, 255, 255, 0.05);
          -webkit-backdrop-filter: none;
          backdrop-filter: none;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          padding: 0.45rem 0.6rem;
          font-size: 0.88rem;
        }

        .classic-points .dropdown-trigger:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.25);
        }

        @media (max-width: 768px) {
          /* Two-line rows: date + points on top, the matchup below */
          .classic-head {
            grid-template-columns: 1fr 18px 1fr;
          }

          .classic-head-date,
          .classic-head-pts {
            display: none;
          }

          .classic-head-team {
            padding-left: 0.4rem;
          }

          .classic-head-team + .classic-at + .classic-head-team {
            text-align: right;
            padding-left: 0;
            padding-right: 0.4rem;
          }

          .classic-row {
            grid-template-columns: 1fr 18px 1fr;
            grid-template-areas:
              "date date points"
              "away at  home";
            row-gap: 0.3rem;
          }

          .classic-row .classic-date { grid-area: date; align-self: center; }
          .classic-row .classic-at { grid-area: at; align-self: center; text-align: center; }
          .classic-head .classic-at { visibility: hidden; }
          .classic-row .classic-points {
            grid-area: points;
            justify-self: end;
            display: flex;
            align-items: center;
            gap: 0.35rem;
          }
          .classic-row .team-choice:first-of-type { grid-area: away; }
          .classic-row .team-choice:last-of-type { grid-area: home; }

          .classic-pts-label {
            display: inline;
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(150, 200, 255, 0.85);
          }

          .classic-points .custom-dropdown {
            width: 88px;
          }

          .classic-row .team-choice-city {
            display: none;
          }

          .classic-row .team-choice {
            padding: 0.3rem 0.4rem;
            gap: 0.3rem;
          }

          .classic-row .team-choice-logo {
            width: 24px;
            height: 24px;
          }

          .classic-row .team-choice-name {
            font-size: 0.8rem;
          }

          .classic-row .team-choice-record {
            font-size: 0.62rem;
            white-space: nowrap;
          }

          .classic-row .team-choice-mark {
            width: 16px;
            height: 16px;
            font-size: 0.6rem;
          }
        }

        /* --- Order view hint --- */
        .order-hint {
          margin-top: 0.5rem;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.6);
        }

      `}</style>
    </div>
  );
}

export default MakePicks;