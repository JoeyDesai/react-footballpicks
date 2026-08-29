import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { gameAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import CustomDropdown from '../components/CustomDropdown';
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
  const [viewMode, setViewMode] = useState('tiles'); // 'tiles', 'classic', 'dragdrop'
  const [autoPickHighest, setAutoPickHighest] = useState(true);
  const [validationErrors, setValidationErrors] = useState([]);
  // Drag and drop state for reordering games
  const [draggedGameId, setDraggedGameId] = useState(null);
  const [dragOverGameId, setDragOverGameId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [headerScrollInterval, setHeaderScrollInterval] = useState(null);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  // Mobile animation state
  const [animatingGames, setAnimatingGames] = useState(new Set());
  const [animationDirection, setAnimationDirection] = useState({});

  // Helper function to map team names to image file names
  const getTeamImageName = (teamName) => {
    // Maps team names to their corresponding image files
    const teamMap = {
      '49ers': '49ers',
      'Bears': 'bears',
      'Bengals': 'bengals',
      'Bills': 'bills',
      'Broncos': 'broncos',
      'Browns': 'browns',
      'Buccaneers': 'buccaneers',
      'Cardinals': 'cardinals',
      'Chargers': 'chargers',
      'Chiefs': 'chiefs',
      'Colts': 'colts',
      'Commanders': 'commanders',
      'Cowboys': 'cowboys',
      'Dolphins': 'dolphins',
      'Eagles': 'eagles',
      'Falcons': 'falcons',
      'Giants': 'giants',
      'Jaguars': 'jaguars',
      'Jets': 'jets',
      'Lions': 'lions',
      'Packers': 'packers',
      'Panthers': 'panthers',
      'Patriots': 'patriots',
      'Raiders': 'raiders',
      'Rams': 'rams',
      'Ravens': 'ravens',
      'Saints': 'saints',
      'Seahawks': 'seahawks',
      'Steelers': 'steelers',
      'Texans': 'texans',
      'Titans': 'titans',
      'Vikings': 'vikings'
    };
    return teamMap[teamName] || teamName.toLowerCase();
  };

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

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                            window.innerWidth <= 768 || 
                            ('ontouchstart' in window);
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-assign point values when switching to drag-drop view
  useEffect(() => {
    if (viewMode === 'dragdrop' && games.length > 0) {
      const orderedGames = [...games].sort((a, b) => {
        const aValue = picks[`VAL${a.id}`] || 0;
        const bValue = picks[`VAL${b.id}`] || 0;
        return bValue - aValue;
      });

      const newPicks = { ...picks };
      let hasChanges = false;
      
      orderedGames.forEach((game, index) => {
        const expectedValue = games.length - index;
        if (!picks[`VAL${game.id}`] || picks[`VAL${game.id}`] === 0) {
          newPicks[`VAL${game.id}`] = expectedValue;
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        setPicks(newPicks);
      }
    }
  }, [viewMode, games.length]);

  // Cleanup header scroll on unmount
  useEffect(() => {
    return () => {
      if (headerScrollInterval) {
        clearInterval(headerScrollInterval);
      }
    };
  }, [headerScrollInterval]);


  // Load available weeks and auto-select the next one to pick
  const loadWeeks = async () => {
    try {
      const response = await gameAPI.getWeeks();
      if (response.data.success) {
        setWeeks(response.data.weeks);
        // Auto-select next week to make picks for (same strategy as weekly standings but +1)
        const completedWeeks = response.data.weeks.filter(w => w.completed);
        const currentWeek = completedWeeks[completedWeeks.length - 1];

        if (currentWeek) {
          // Find the next week after the last started week
          const currentIndex = response.data.weeks.findIndex(w => w.id === currentWeek.id);
          setSelectedWeek(response.data.weeks[currentIndex + 1] || currentWeek);
        } else {
          // No week has started yet (pre-season): pick the first week
          setSelectedWeek(response.data.weeks[0]);
        }
      }
    } catch (error) {
      setError('Failed to load weeks');
    } finally {
      setLoading(false);
    }
  };

  const loadGamesAndPicks = async () => {
    try {
      setLoading(true);
      const [gamesResponse, picksResponse] = await Promise.all([
        gameAPI.getGames(selectedWeek.id),
        gameAPI.getPicks(selectedWeek.id)
      ]);

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
      setError('Failed to load games and picks');
    } finally {
      setLoading(false);
    }
  };

  // Handle when user picks a team for a game
  const handlePickChange = (gameId, team) => {
    const newPicks = {
      ...picks,
      [`GAME${gameId}`]: team
    };

    // Auto-assign highest available point value if auto-pick is enabled
    if (autoPickHighest) {
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
    const errors = validatePicks();
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
    const errors = validatePicks();
    if (errors.length === 0) {
      setValidationErrors([]);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetPointValue) => {
    e.preventDefault();
    const gameId = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (!gameId) return;

    // Remove the game from its current point value
    const currentPicks = { ...picks };
    Object.keys(currentPicks).forEach(key => {
      if (key.startsWith('VAL') && currentPicks[key] === targetPointValue) {
        currentPicks[key] = 0;
      }
    });

    // Set the new point value
    currentPicks[`VAL${gameId}`] = targetPointValue;
    setPicks(currentPicks);
    setError('');
    setSuccess('');
    
    // Only clear validation errors if picks are now valid
    const errors = validatePicks();
    if (errors.length === 0) {
      setValidationErrors([]);
    }
  };

  // New drag and drop reorder handlers
  const handleDragStart = (e, gameId) => {
    setDraggedGameId(gameId);
    e.dataTransfer.setData('text/plain', gameId.toString());
    e.dataTransfer.effectAllowed = 'move';
    // Immediately set drag over to prevent timing issues
    setDragOverGameId(gameId);
  };

  const handleDragEnd = () => {
    setDraggedGameId(null);
    setDragOverGameId(null);
    // Clear header scroll when drag ends
    if (headerScrollInterval) {
      clearInterval(headerScrollInterval);
      setHeaderScrollInterval(null);
    }
  };

  const handleDragOverGame = (e, gameId, index) => {
    e.preventDefault();
    // Only update if the target has actually changed
    if (dragOverGameId !== gameId || dragOverIndex !== index) {
      setDragOverGameId(gameId);
      setDragOverIndex(index);
    }
    
    // Check for header auto-scroll
    handleHeaderScroll(e);
  };

  const handleDragLeaveGame = () => {
    // Don't clear immediately to prevent flickering
    // The drag over will handle setting the correct target
  };

  const handleHeaderScroll = (e) => {
    const headerThreshold = 50; // Distance from header to start scrolling
    const scrollSpeed = 2; // Pixels to scroll per interval
    const scrollInterval = 50; // Milliseconds between scrolls
    
    const mouseY = e.clientY;
    
    // Clear existing header scroll
    if (headerScrollInterval) {
      clearInterval(headerScrollInterval);
      setHeaderScrollInterval(null);
    }
    
    // Only scroll if mouse is within 50px of the top of the viewport
    if (mouseY < headerThreshold) {
      const scrollUp = setInterval(() => {
        window.scrollBy(0, -scrollSpeed);
      }, scrollInterval);
      setHeaderScrollInterval(scrollUp);
    }
  };



  const handleDragDropReorder = (draggedGameId, targetGameId) => {
    const draggedGameValue = picks[`VAL${draggedGameId}`] || 0;
    const targetGameValue = picks[`VAL${targetGameId}`] || 0;
    
    if (draggedGameValue === targetGameValue) return;
    
    const newPicks = { ...picks };
    
    // Find the dragged game's current position and target position
    const draggedIndex = orderedGames.findIndex(game => game.id === draggedGameId);
    const targetIndex = orderedGames.findIndex(game => game.id === targetGameId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Create new ordered array by moving the dragged game to target position
    const newOrderedGames = [...orderedGames];
    const [draggedGame] = newOrderedGames.splice(draggedIndex, 1);
    newOrderedGames.splice(targetIndex, 0, draggedGame);
    
    // Reassign point values based on new order
    newOrderedGames.forEach((game, index) => {
      const newPointValue = games.length - index;
      newPicks[`VAL${game.id}`] = newPointValue;
    });
    
    setPicks(newPicks);
    setError('');
    setSuccess('');
    
    // Only clear validation errors if picks are now valid
    const errors = validatePicks();
    if (errors.length === 0) {
      setValidationErrors([]);
    }
  };

  const validatePicks = () => {
    const usedValues = new Set();
    const errors = [];

    games.forEach(game => {
      const pick = picks[`GAME${game.id}`];
      const value = picks[`VAL${game.id}`];

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

  if (loading) {
    return (
      <div className="picks-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const renderTilesView = () => (
    <div className="games-container glass-container">
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
        {!readOnly && (
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
      
      <div className="games-grid">
        {games.map((game, index) => (
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
              {/* Away Team */}
              <div className="team-option">
                <div className="team-info">
                  <img 
                    src={`/images/${getTeamImageName(game.away_name)}.svg`}
                    alt={game.away_name}
                    className="team-logo"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                      <div className="team-details">
                        <div className="team-name">{game.away_city} {game.away_name}</div>
                        <div className="team-record">
                          ({game.away_wins}-{game.away_losses}
                          {game.away_ties > 0 && `-${game.away_ties}`}) Away
                        </div>
                      </div>
                </div>
                {!readOnly && (
                  <label className="custom-radio">
                    <input
                      type="radio"
                      name={`GAME${game.id}`}
                      value={game.away_id}
                      checked={picks[`GAME${game.id}`] == game.away_id}
                      onChange={() => handlePickChange(game.id, game.away_id)}
                    />
                    <span className="radio-mark"></span>
                  </label>
                )}
                {readOnly && picks[`GAME${game.id}`] == game.away_id && (
                  <div className="pick-indicator">✓</div>
                )}
              </div>

              <div className="vs-divider">@</div>

              {/* Home Team */}
              <div className="team-option">
                <div className="team-info">
                  <img 
                    src={`/images/${getTeamImageName(game.home_name)}.svg`}
                    alt={game.home_name}
                    className="team-logo"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                      <div className="team-details">
                        <div className="team-name">{game.home_city} {game.home_name}</div>
                        <div className="team-record">
                          ({game.home_wins}-{game.home_losses}
                          {game.home_ties > 0 && `-${game.home_ties}`}) Home
                        </div>
                      </div>
                </div>
                {!readOnly && (
                  <label className="custom-radio">
                    <input
                      type="radio"
                      name={`GAME${game.id}`}
                      value={game.home_id}
                      checked={picks[`GAME${game.id}`] == game.home_id}
                      onChange={() => handlePickChange(game.id, game.home_id)}
                    />
                    <span className="radio-mark"></span>
                  </label>
                )}
                {readOnly && picks[`GAME${game.id}`] == game.home_id && (
                  <div className="pick-indicator">✓</div>
                )}
              </div>
            </div>

            <div className="point-value">
              <label>Point Value:</label>
              {!readOnly ? (
                <CustomDropdown
                  options={[
                    { value: 0, label: 'Select Points' },
                    ...Array.from({ length: games.length }, (_, i) => ({
                      value: i + 1,
                      label: (i + 1).toString()
                    }))
                  ]}
                  value={picks[`VAL${game.id}`] || 0}
                  onChange={(value) => handleValueChange(game.id, value)}
                  placeholder="Select Points"
                />
              ) : (
                <div className={`point-display ${
                  game.winner && picks[`GAME${game.id}`] == game.winner ? 'correct' :
                  game.winner && picks[`GAME${game.id}`] != game.winner ? 'incorrect' : 'pending'
                }`}>
                  {picks[`VAL${game.id}`] || 0}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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

  const renderClassicView = () => (
    <div className="games-container glass-container">
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
        {!readOnly && (
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
      
      <div className="classic-games-list">
        {games.map((game, index) => (
          <div 
            key={game.id} 
            className={`classic-game-row ${
              validationErrors.length > 0 && hasGameValidationError(game.id) ? 'validation-error' :
              isGameIncomplete(game.id) ? 'incomplete' : ''
            }`}
          >
            <div className="game-row-main">
              {/* Away Team Info */}
              <div className="team-info-section away-team">
                <div className="team-logo-section mobile-logo">
                  <img 
                    src={`/images/${getTeamImageName(game.away_name)}.svg`}
                    alt={game.away_name}
                    className="team-logo-large"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
                <div className="team-name-small">{game.away_city} {game.away_name}</div>
                <div className="team-record-small">
                  ({game.away_wins}-{game.away_losses}
                  {game.away_ties > 0 && `-${game.away_ties}`}) Away
                </div>
              </div>

              {/* Away Team Logo */}
              <div className="team-logo-section">
                <img 
                  src={`/images/${getTeamImageName(game.away_name)}.svg`}
                  alt={game.away_name}
                  className="team-logo-large"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>

              {/* Away Team Radio Button */}
              <div className="radio-section">
                {!readOnly && (
                  <label className="custom-radio">
                    <input
                      type="radio"
                      name={`GAME${game.id}`}
                      value={game.away_id}
                      checked={picks[`GAME${game.id}`] == game.away_id}
                      onChange={() => handlePickChange(game.id, game.away_id)}
                    />
                    <span className="radio-mark"></span>
                  </label>
                )}
                {readOnly && picks[`GAME${game.id}`] == game.away_id && (
                  <div className="pick-indicator">✓</div>
                )}
              </div>

              {/* VS Divider */}
              <div className="vs-divider">@</div>

              {/* Home Team Radio Button */}
              <div className="radio-section">
                {!readOnly && (
                  <label className="custom-radio">
                    <input
                      type="radio"
                      name={`GAME${game.id}`}
                      value={game.home_id}
                      checked={picks[`GAME${game.id}`] == game.home_id}
                      onChange={() => handlePickChange(game.id, game.home_id)}
                    />
                    <span className="radio-mark"></span>
                  </label>
                )}
                {readOnly && picks[`GAME${game.id}`] == game.home_id && (
                  <div className="pick-indicator">✓</div>
                )}
              </div>

              {/* Home Team Logo */}
              <div className="team-logo-section">
                <img 
                  src={`/images/${getTeamImageName(game.home_name)}.svg`}
                  alt={game.home_name}
                  className="team-logo-large"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>

              {/* Home Team Info */}
              <div className="team-info-section home-team">
                <div className="team-logo-section mobile-logo">
                  <img 
                    src={`/images/${getTeamImageName(game.home_name)}.svg`}
                    alt={game.home_name}
                    className="team-logo-large"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
                <div className="team-name-small">{game.home_city} {game.home_name}</div>
                <div className="team-record-small">
                  ({game.home_wins}-{game.home_losses}
                  {game.home_ties > 0 && `-${game.home_ties}`}) Home
                </div>
              </div>
            </div>

            {/* Point Value Selector */}
            <div className="point-selector">
              {!readOnly ? (
                <CustomDropdown
                  options={[
                    { value: 0, label: 'Select Points' },
                    ...Array.from({ length: games.length }, (_, i) => ({
                      value: i + 1,
                      label: (i + 1).toString()
                    }))
                  ]}
                  value={picks[`VAL${game.id}`] || 0}
                  onChange={(value) => handleValueChange(game.id, value)}
                  placeholder="Points"
                />
              ) : (
                <div className={`point-display ${
                  game.winner && picks[`GAME${game.id}`] == game.winner ? 'correct' :
                  game.winner && picks[`GAME${game.id}`] != game.winner ? 'incorrect' : 'pending'
                }`}>
                  {picks[`VAL${game.id}`] || 0}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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

  const renderDragDropView = () => {
    // Create ordered games based on point values, auto-assign if not set
    const orderedGames = [...games].sort((a, b) => {
      const aValue = picks[`VAL${a.id}`] || 0;
      const bValue = picks[`VAL${b.id}`] || 0;
      return bValue - aValue; // Highest points first
    });

    // Updated drag drop reorder handler with access to orderedGames
    const handleDragDropReorderWithOrder = (draggedGameId, targetGameId) => {
      const draggedGameValue = picks[`VAL${draggedGameId}`] || 0;
      const targetGameValue = picks[`VAL${targetGameId}`] || 0;
      
      if (draggedGameValue === targetGameValue) return;
      
      const newPicks = { ...picks };
      
      // Find the dragged game's current position and target position
      const draggedIndex = orderedGames.findIndex(game => game.id === draggedGameId);
      const targetIndex = orderedGames.findIndex(game => game.id === targetGameId);
      
      if (draggedIndex === -1 || targetIndex === -1) return;
      
      // Create new ordered array by moving the dragged game to target position
      const newOrderedGames = [...orderedGames];
      const [draggedGame] = newOrderedGames.splice(draggedIndex, 1);
      newOrderedGames.splice(targetIndex, 0, draggedGame);
      
      // Reassign point values based on new order
      newOrderedGames.forEach((game, index) => {
        const newPointValue = games.length - index;
        newPicks[`VAL${game.id}`] = newPointValue;
      });
      
      setPicks(newPicks);
      setError('');
      setSuccess('');
      
      // Only clear validation errors if picks are now valid
      const errors = validatePicks();
      if (errors.length === 0) {
        setValidationErrors([]);
      }
    };

  // Mobile animation handler - both tiles disappear/reappear
  const handleMobileSwap = (draggedGameId, targetGameId) => {
    if (!isMobile) {
      handleDragDropReorderWithOrder(draggedGameId, targetGameId);
      return;
    }

    // Make both games disappear
    setAnimatingGames(new Set([draggedGameId, targetGameId]));
    
    // Execute swap after both fade out
    setTimeout(() => {
      handleDragDropReorderWithOrder(draggedGameId, targetGameId);
      
      // Both reappear in new positions
      setTimeout(() => {
        setAnimatingGames(new Set());
      }, 50);
    }, 200);
  };

    return (
      <div className="games-container glass-container">
        <div className="main-panel-header">
          <div className="header-row">
            <h2>Week {selectedWeek?.number}</h2>
          </div>
        </div>
        
        <div 
          className="drag-drop-games-list"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Allow dropping in the container
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const draggedGameId = parseInt(e.dataTransfer.getData('text/plain'));
            if (draggedGameId && dragOverGameId) {
              // Use the drag over target that was already calculated
              handleDragDropReorderWithOrder(draggedGameId, dragOverGameId);
            }
          }}
        >
          {orderedGames.map((game, index) => {
            const pointValue = games.length - index; // Auto-assigned based on position
            const isDragging = draggedGameId === game.id;
            const isDragOver = dragOverGameId === game.id;
            
            // Determine shift direction for smooth animation
            let shiftClass = '';
            if (draggedGameId && dragOverIndex !== null && !isDragging) {
              const draggedIndex = orderedGames.findIndex(g => g.id === draggedGameId);
              if (draggedIndex !== -1) {
                // If dragging down (to higher index), shift rows up
                if (draggedIndex < dragOverIndex) {
                  if (index > draggedIndex && index <= dragOverIndex) {
                    shiftClass = 'shift-up';
                  }
                }
                // If dragging up (to lower index), shift rows down  
                else if (draggedIndex > dragOverIndex) {
                  if (index < draggedIndex && index >= dragOverIndex) {
                    shiftClass = 'shift-down';
                  }
                }
              }
            }
            
            return (
              <div key={game.id} className="drag-drop-game-container">
                <div 
                  className={`drag-drop-game-row ${
                    validationErrors.length > 0 && hasGameValidationError(game.id) ? 'validation-error' :
                    isGameIncomplete(game.id) ? 'incomplete' : ''
                  } ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${shiftClass} ${
                    animatingGames.has(game.id) ? 'swapping-up' : ''
                  }`}
                  draggable={!readOnly && !isMobile}
                  onDragStart={(e) => handleDragStart(e, game.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDragOverGame(e, game.id, index);
                  }}
                  onDragLeave={handleDragLeaveGame}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const draggedGameId = parseInt(e.dataTransfer.getData('text/plain'));
                    if (draggedGameId && draggedGameId !== game.id) {
                      handleDragDropReorderWithOrder(draggedGameId, game.id);
                    }
                  }}
                >
                <div className="drag-drop-game-row-main">
                  {/* Away Team Info */}
                  <div className="team-info-section away-team">
                    <div className="team-logo-section mobile-logo">
                      <img 
                        src={`/images/${getTeamImageName(game.away_name)}.svg`}
                        alt={game.away_name}
                        className="team-logo-large"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    </div>
                    <div className="team-name-small">
                      <div className="team-record-small">
                        {game.away_wins}-{game.away_losses}
                        {game.away_ties > 0 && `-${game.away_ties}`}
                      </div>
                      <div className="team-location-small">Away</div>
                    </div>
                  </div>

                  {/* Away Team Logo */}
                  <div className="team-logo-section">
                    <img 
                      src={`/images/${getTeamImageName(game.away_name)}.svg`}
                      alt={game.away_name}
                      className="team-logo-large"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>

                  {/* Away Team Radio Button */}
                  <div className="radio-section">
                    {!readOnly && (
                      <label className="custom-radio">
                        <input
                          type="radio"
                          name={`GAME${game.id}`}
                          value={game.away_id}
                          checked={picks[`GAME${game.id}`] == game.away_id}
                          onChange={() => handlePickChange(game.id, game.away_id)}
                        />
                        <span className="radio-mark"></span>
                      </label>
                    )}
                    {readOnly && picks[`GAME${game.id}`] == game.away_id && (
                      <div className="pick-indicator">✓</div>
                    )}
                  </div>

                  {/* VS Divider */}
                  <div className="vs-divider">@</div>

                  {/* Home Team Radio Button */}
                  <div className="radio-section">
                    {!readOnly && (
                      <label className="custom-radio">
                        <input
                          type="radio"
                          name={`GAME${game.id}`}
                          value={game.home_id}
                          checked={picks[`GAME${game.id}`] == game.home_id}
                          onChange={() => handlePickChange(game.id, game.home_id)}
                        />
                        <span className="radio-mark"></span>
                      </label>
                    )}
                    {readOnly && picks[`GAME${game.id}`] == game.home_id && (
                      <div className="pick-indicator">✓</div>
                    )}
                  </div>

                  {/* Home Team Logo */}
                  <div className="team-logo-section">
                    <img 
                      src={`/images/${getTeamImageName(game.home_name)}.svg`}
                      alt={game.home_name}
                      className="team-logo-large"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>

                  {/* Home Team Info */}
                  <div className="team-info-section home-team">
                    <div className="team-logo-section mobile-logo">
                      <img 
                        src={`/images/${getTeamImageName(game.home_name)}.svg`}
                        alt={game.home_name}
                        className="team-logo-large"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    </div>
                    <div className="team-name-small">
                      <div className="team-record-small">
                        {game.home_wins}-{game.home_losses}
                        {game.home_ties > 0 && `-${game.home_ties}`}
                      </div>
                      <div className="team-location-small">Home</div>
                    </div>
                  </div>

                  {/* Drag Handle */}
                  {!readOnly && (
                    <div className={`drag-handle ${isMobile ? 'mobile-drag-handle' : ''}`}>
                      {isMobile ? (
                        <div className="mobile-controls">
                          <div className="mobile-arrows">
                            <button 
                              type="button"
                              className="mobile-arrow-btn up"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (index > 0) {
                                  const prevGame = orderedGames[index - 1];
                                  handleMobileSwap(game.id, prevGame.id);
                                }
                              }}
                              disabled={index === 0}
                            >
                              ↑
                            </button>
                            <button 
                              type="button"
                              className="mobile-arrow-btn down"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (index < orderedGames.length - 1) {
                                  const nextGame = orderedGames[index + 1];
                                  handleMobileSwap(game.id, nextGame.id);
                                }
                              }}
                              disabled={index === orderedGames.length - 1}
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="drag-dots">
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </div>
                
                {/* Point Value Label - Outside Glass Panel */}
                <div className="point-value-label-external">
                  {pointValue}
                </div>
              </div>
            );
          })}
        </div>

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
  };

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
                      <span className="desktop-text">Order</span>
                      <span className="mobile-text">Order</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="week-selector">
              <label htmlFor="week-select">Week</label>
              <CustomDropdown
                options={(() => {
                  // Calculate auto-selected week once outside the map
                  const completedWeeks = weeks.filter(w => w.completed);
                  const currentWeek = completedWeeks[completedWeeks.length - 1];
                  const currentIndex = currentWeek ? weeks.findIndex(w => w.id === currentWeek.id) : -1;
                  // Pre-season (no started week): index -1 + 1 = weeks[0]
                  const autoSelectedWeek = weeks[currentIndex + 1] || currentWeek;
                  
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
        {viewMode === 'dragdrop' && renderDragDropView()}
      </form>

      <style jsx="true">{`
        .picks-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem 4rem 1rem;
        }

        /* Mobile: Wider glass panel with less padding */
        @media (max-width: 768px) {
          .picks-container {
            max-width: 100%;
            padding: 0 0.5rem 4rem 0.5rem;
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

        /* Classic view point dropdowns - normal z-index for buttons, high for menus */
        .point-selector .custom-dropdown {
          position: relative !important;
        }

        .point-selector .custom-dropdown .dropdown-trigger {
          position: relative;
        }

        .point-selector .custom-dropdown .dropdown-menu {
          z-index: 999999 !important;
          position: fixed !important;
          overflow: auto !important;
          max-height: 200px !important;
          background: rgba(20, 20, 30, 0.6) !important;
        }

        .point-selector .custom-dropdown .dropdown-option {
          z-index: 10000 !important;
        }

        /* Override inline styles for classic view dropdown buttons (lower z-index) */
        .point-selector .custom-dropdown[style*="z-index"] {
          z-index: auto !important;
        }

        .point-selector .custom-dropdown .dropdown-trigger[style*="z-index"] {
          z-index: auto !important;
        }

        /* Override inline styles for classic view dropdown menus (higher z-index) */
        .point-selector .custom-dropdown .dropdown-menu[style*="z-index"] {
          z-index: 10000 !important;
        }

        .point-selector .custom-dropdown .dropdown-option[style*="z-index"] {
          z-index: 10000 !important;
        }

        /* Force classic view dropdown buttons to stay low, menus to appear above everything */
        .classic-games-list .point-selector .custom-dropdown {
          position: relative;
        }

        .classic-games-list .point-selector .custom-dropdown .dropdown-trigger {
          position: relative;
        }

        .classic-games-list .point-selector .custom-dropdown .dropdown-menu {
          z-index: 999999 !important;
          position: absolute !important;
        }

        .classic-games-list .point-selector .custom-dropdown .dropdown-option {
          z-index: 999999 !important;
        }

        /* Make dropdown options shorter - more specific selectors */
        .point-value .custom-dropdown .dropdown-menu .dropdown-option,
        .point-selector .custom-dropdown .dropdown-menu .dropdown-option {
          padding: 0.4rem 0.75rem !important;
          font-size: 0.9rem !important;
          min-height: auto !important;
          line-height: 1.2 !important;
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

        .custom-dropdown {
          width: 180px !important;
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
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          height: 40px;
          width: 100%;
          cursor: pointer;
          transition: all 0.2s ease;
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
          transition: all 0.3s ease;
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
          left: calc(33.333% - 2px);
        }

        .slider-thumb-right {
          left: calc(66.666% - 2px);
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
          transition: all 0.2s ease;
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
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.7);
          padding: 0.6rem 1rem;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
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
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .games-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .game-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1rem;
          transition: all 0.3s ease;
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

        .team-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .team-option:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .team-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
        }

        .team-logo {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }

        .team-details {
          flex: 1;
        }

        .team-name {
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .team-record {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.8rem;
        }

        .vs-divider {
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-weight: 600;
          padding: 0.5rem 0;
        }

        /* Custom Radio Buttons */
        .custom-radio {
          position: relative;
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .custom-radio input[type="radio"] {
          position: absolute;
          opacity: 0;
          cursor: pointer;
        }

        .radio-mark {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
          position: relative;
        }

        .custom-radio input[type="radio"]:checked + .radio-mark {
          border-color: rgba(100, 150, 255, 0.8);
          background: rgba(100, 150, 255, 0.2);
        }

        .custom-radio input[type="radio"]:checked + .radio-mark::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(100, 150, 255, 1);
        }

        .radio-label {
          margin-left: 0.5rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.9rem;
        }

        .pick-indicator {
          color: rgba(100, 150, 255, 1);
          font-size: 1.2rem;
          font-weight: bold;
        }

        .point-value {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .point-value label {
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

        /* Classic View */
        .classic-games-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          position: relative;
          z-index: auto;
        }

        .classic-game-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          transition: all 0.3s ease;
          min-height: 80px;
          position: relative;
        }

        @media (max-width: 768px) {
          .classic-game-row {
            padding: 0.75rem 0.5rem;
          }
        }

        .classic-game-row:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .classic-game-row.incomplete {
          box-shadow: 0 0 20px rgba(100, 150, 255, 0.3);
          border-color: rgba(100, 150, 255, 0.4);
        }

        .classic-game-row.validation-error {
          box-shadow: 0 0 20px rgba(255, 100, 100, 0.4);
          border-color: rgba(255, 100, 100, 0.6);
        }

        .team-info-section {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
          flex: 2;
          max-width: 200px;
        }

        .team-info-section.away-team {
          text-align: right;
          align-items: flex-end;
        }

        .team-info-section.home-team {
          text-align: left;
          align-items: flex-start;
        }

        .team-logo-section {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          flex-shrink: 0;
          width: 35px;
        }

        .team-logo-large {
          width: 30px;
          height: 30px;
          object-fit: contain;
        }

        .radio-section {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          flex-shrink: 0;
          width: 25px;
        }

        .team-name-small {
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
          line-height: 1.1;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          white-space: nowrap;
          flex-wrap: nowrap;
        }

        .team-record-small {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.8rem;
          line-height: 1.1;
          white-space: nowrap;
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

        .game-row-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 1;
        }

        .point-selector {
          min-width: 120px;
          flex-shrink: 0;
          position: relative;
        }

        .readonly-picks {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        /* Desktop: Keep logos separate from team info */
        @media (min-width: 769px) {
          .team-info-section {
            display: flex !important;
            flex-direction: column !important;
            gap: 0.25rem !important;
            flex: 2 !important;
            max-width: 200px !important;
            position: static !important;
          }

          .team-info-section.away-team {
            text-align: right !important;
            align-items: flex-end !important;
          }

          .team-info-section.home-team {
            text-align: left !important;
            align-items: flex-start !important;
          }

          .team-logo-section {
            width: 35px !important;
            padding: 0 !important;
            flex-shrink: 0 !important;
            margin-bottom: 0 !important;
            display: flex !important;
          }

          .team-logo-large {
            width: 30px !important;
            height: 30px !important;
          }

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

          .team-logo-section:not(.mobile-logo) {
            display: none !important;
          }

          .team-logo-large {
            width: 30px !important;
            height: 30px !important;
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

        .drag-drop-games-list {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          position: relative;
          z-index: auto;
          min-height: 200px; /* Ensure there's always a drop zone */
          padding: 0.5rem; /* Restore small padding */
        }

        .drag-drop-game-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          max-width: 100%;
          padding: 0.1rem 0; /* Small vertical padding */
        }

        .drag-drop-games-list .point-value-label-external {
          background: rgba(100, 150, 255, 0.2);
          border: 0.5px solid rgba(100, 150, 255, 0.4);
          border-radius: 3px;
          padding: 0.15rem 0.25rem !important;
          color: rgba(150, 200, 255, 1);
          font-weight: 700;
          font-size: 1rem;
          min-width: 45px !important;
          width: 45px !important;
          height: 45px !important;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 1px 4px rgba(100, 150, 255, 0.2);
          margin: 0; /* Remove any default margins */
        }

        .drag-drop-game-row {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          transition: all 0.3s ease;
          height: 50px;
          min-height: 50px;
          position: relative;
          cursor: grab;
          width: 100%;
          max-width: 100%;
          flex: 1;
        }

        .drag-drop-game-row-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.25rem;
          width: 100%;
        }

        /* Allow clicking anywhere to drag */
        .team-info-section,
        .team-logo-section,
        .vs-divider,
        .radio-section {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .drag-drop-game-row:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .drag-drop-game-row.dragging {
          opacity: 0.5;
          transform: rotate(2deg);
          cursor: grabbing;
        }

        .drag-drop-game-row.drag-over {
          background: rgba(100, 150, 255, 0.1);
          border-color: rgba(100, 150, 255, 0.4);
          transform: scale(1.02);
          transition: all 0.1s ease;
        }

        .drag-drop-game-row.shift-up {
          transform: translateY(-40px);
          transition: transform 0.1s ease;
        }

          .drag-drop-game-row.shift-down {
            transform: translateY(40px);
            transition: transform 0.1s ease;
          }

          /* Mobile swap animations - simple disappear/reappear */
          .drag-drop-game-row.swapping-up {
            opacity: 0;
            transition: opacity 0.2s ease;
          }

          .drag-drop-game-row.swapping-down {
            opacity: 0;
            transition: opacity 0.2s ease;
          }

        .drag-drop-game-row.incomplete {
          box-shadow: 0 0 20px rgba(100, 150, 255, 0.3);
          border-color: rgba(100, 150, 255, 0.4);
        }

        .drag-drop-game-row.validation-error {
          box-shadow: 0 0 20px rgba(255, 100, 100, 0.4);
          border-color: rgba(255, 100, 100, 0.6);
        }

        .mobile-drag-handle {
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem;
          min-width: 50px;
        }

        .mobile-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          width: 100%;
        }

        .mobile-arrows {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .mobile-arrow-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.8);
          font-size: 1.2rem;
          font-weight: bold;
          padding: 0.5rem;
          min-width: 40px;
          min-height: 40px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mobile-arrow-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.5);
          color: rgba(255, 255, 255, 1);
          transform: scale(1.05);
        }

        .mobile-arrow-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .mobile-arrow-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }


        .drag-handle {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          cursor: grab;
          border-radius: 6px;
          transition: all 0.2s ease;
          flex-shrink: 0;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .drag-handle:active {
          cursor: grabbing;
        }

        .drag-dots {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          width: 12px;
          height: 18px;
        }

        .dot {
          width: 2px;
          height: 2px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 50%;
        }

        .drag-handle:hover .dot {
          background: rgba(255, 255, 255, 0.8);
        }

        /* Mobile responsive for drag drop */
        @media (max-width: 768px) {
          .drag-drop-games-list * {
            -webkit-tap-highlight-color: transparent !important;
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            user-select: none !important;
          }

          .drag-drop-games-list *:active {
            background: inherit !important;
          }
          .drag-drop-game-container {
            flex-direction: row;
            gap: 0.15rem;
            align-items: center;
            padding: 0.1rem;
            background: none;
            border: none;
            border-radius: 0;
            margin-bottom: 0.5rem;
            height: 100px;
            min-height: 100px;
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }

          .drag-drop-game-container:active {
            background: none !important;
          }

          .drag-drop-game-row {
            padding: 0.15rem;
            width: 100%;
            background: rgba(255, 255, 255, 0.02) !important;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            box-shadow: none;
            min-height: 100px;
            height: 100%;
            display: flex;
            align-items: center;
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
            outline: none !important;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            transform: translateY(0);
          }

          .drag-drop-game-row:active,
          .drag-drop-game-row:focus,
          .drag-drop-game-row:focus-visible,
          .drag-drop-game-row:focus-within {
            background: rgba(255, 255, 255, 0.02) !important;
            outline: none !important;
          }

          .drag-drop-game-row-main {
            flex-direction: row;
            gap: 0.15rem;
            align-items: center;
            width: 100%;
            justify-content: space-between;
            height: 100%;
          }

          /* Mobile team info sections */
          .team-info-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.15rem;
            flex: 1;
            min-width: 0;
            padding: 0.15rem 0;
            height: 100%;
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }

          .team-info-section:active {
            background: none !important;
          }

          .team-logo-section.mobile-logo {
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 0.125rem;
          }

          .team-logo-section.mobile-logo img {
            width: 24px;
            height: 24px;
            object-fit: contain;
          }

          .team-name-small {
            font-size: 0.6rem;
            text-align: center;
            line-height: 1.1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 0.1rem;
          }

          .team-record-small {
            font-size: 0.6rem;
            text-align: center;
            font-weight: 600;
            margin-bottom: 0.125rem;
          }

          .team-location-small {
            font-size: 0.5rem;
            text-align: center;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 500;
          }

          .vs-divider {
            font-size: 0.8rem;
            padding: 0 0.25rem;
            flex-shrink: 0;
          }

          .drag-drop-games-list .point-value-label-external {
            align-self: center;
            margin: 0 0 0 0.5rem !important;
            height: auto !important;
            width: 30px !important;
            min-width: 30px !important;
            max-width: 30px !important;
            min-height: auto !important;
            font-size: 1.2rem;
            flex-shrink: 0;
            order: 1;
            padding: 0 !important;
            border: none !important;
            border-radius: 0;
            background: none !important;
            box-shadow: none !important;
            color: rgba(100, 150, 255, 1) !important;
            font-weight: 700;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .drag-handle {
            align-self: center;
            min-height: 50px;
            min-width: 50px;
          }

          .mobile-drag-handle {
            min-height: 50px;
            padding: 0.25rem;
            width: auto;
          }

          .mobile-controls {
            width: 100%;
            max-width: 45px;
          }

          .mobile-arrow-btn {
            min-width: 30px;
            min-height: 30px;
            font-size: 0.9rem;
            padding: 0.3rem;
          }

          /* Remove touch dragging styles */
          .drag-drop-game-row.touch-dragging {
            opacity: 1;
            transform: none;
            box-shadow: none;
            z-index: auto;
            position: static;
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
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.7);
          padding: 0.6rem 1rem;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
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
          background: rgba(100, 255, 100, 0.4);
          backdrop-filter: blur(20px);
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
            max-width: 180px;
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
          
          .classic-game-row {
            flex-direction: column;
            gap: 0.5rem;
            align-items: stretch;
            min-height: auto;
          }

          .game-row-main {
            flex-direction: row;
            gap: 0.25rem;
            align-items: center;
          }

          .team-info-section {
            max-width: 100px;
            text-align: center;
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.25rem;
            position: relative;
          }

          .team-info-section.away-team,
          .team-info-section.home-team {
            text-align: center;
            align-items: center;
          }

          .team-logo-section {
            display: none;
          }

          .team-logo-large {
            width: 30px;
            height: 30px;
          }

          .radio-section {
            width: 25px;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .vs-divider {
            padding: 0 0.1rem;
            font-size: 1rem;
          }

          .point-selector {
            align-self: center;
            margin-top: 0.5rem;
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

        /* FORCE dropdown background override with maximum specificity */
        .picks-container .classic-games-list .point-selector .custom-dropdown .dropdown-menu,
        .picks-container .games-container .custom-dropdown .dropdown-menu,
        .picks-container .custom-dropdown .dropdown-menu,
        .point-value .custom-dropdown .dropdown-menu,
        .point-selector .custom-dropdown .dropdown-menu {
          background: rgba(20, 20, 30, 0.6) !important;
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
      `}</style>
    </div>
  );
}

export default MakePicks;