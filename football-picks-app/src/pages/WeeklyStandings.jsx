import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { statsAPI, gameAPI, authAPI } from '../services/api';
import CustomDropdown from '../components/CustomDropdown';
import { sanitizeString, sanitizeUserData } from '../utils/sanitize';

// Utility function to format numbers - remove .0 but keep other decimals
const formatNumber = (num) => {
  if (num == null || num === '') return num;
  const numValue = Number(num);
  if (isNaN(numValue)) return num;
  return numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(1);
};

function WeeklyStandings() {
  const { user } = useAuth();
  // Main state for weekly standings and UI controls
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [standings, setStandings] = useState([]);
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState(0);
  const [viewMode, setViewMode] = useState(() => {
    // Default to quick view on mobile devices, full view on desktop
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobile ? 'quick' : 'full';
  }); // 'quick' or 'full'
  const [selectedRows, setSelectedRows] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [availableTags, setAvailableTags] = useState([
    { id: 0, name: 'All' }
  ]);
  const [screenSize, setScreenSize] = useState(() => {
    const width = window.innerWidth;
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  });

  // Single scroll handler for unified container
  const handleBodyScroll = (e) => {
    // No need for synchronization since header and body are in the same container
  };


  useEffect(() => {
    loadWeeks();
    loadUserTags();
    
    // Check for auto refresh on page load
    if (window.location.hash === '#autoreload') {
      setAutoRefresh(true);
    }

    // Handle window resize to adjust screen size and view mode
    const handleResize = () => {
      const width = window.innerWidth;
      let newScreenSize;
      if (width <= 768) {
        newScreenSize = 'mobile';
      } else if (width <= 1024) {
        newScreenSize = 'tablet';
      } else {
        newScreenSize = 'desktop';
      }
      setScreenSize(newScreenSize);

      // Update view mode based on screen size
      const isMobile = width <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const newViewMode = isMobile ? 'quick' : 'full';
      setViewMode(newViewMode);
    };

    // Debounce resize events so we don't thrash state (and refetches) mid-drag
    let resizeTimer;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadStandings();
    }
  }, [selectedWeek, selectedTag, viewMode]);

  // Auto refresh effect - refetch standings in place instead of reloading the page
  useEffect(() => {
    let interval;

    if (autoRefresh && selectedWeek) {
      interval = setInterval(() => {
        loadStandings(true);
      }, 60000); // 60 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh, selectedWeek, selectedTag, viewMode]);

  const loadUserTags = async () => {
    try {
      const response = await authAPI.getUserTags();
      if (response.data.success) {
        setAvailableTags(response.data.tags);
      }
    } catch (error) {
      console.error('Error loading user tags:', error);
    }
  };

  // Load available weeks and auto-select the most recent completed one
  const loadWeeks = async () => {
    try {
      const response = await gameAPI.getWeeks();
      if (response.data.success) {
        setWeeks(response.data.weeks);
        // Auto-select most recent completed week
        const completedWeeks = response.data.weeks.filter(w => w.completed);
        const currentWeek = completedWeeks[completedWeeks.length - 1] || response.data.weeks[0];
        setSelectedWeek(currentWeek);
      }
    } catch (error) {
      console.error('Error loading weeks:', error);
    }
  };

  // Load standings data based on selected week and view mode.
  // Pass background=true to refresh data without showing the loading spinner.
  const loadStandings = async (background = false) => {
    try {
      if (!background) {
        setLoading(true);
      }
      try {
        // Both views use the classic endpoint so potential scores are correct
        const response = await statsAPI.getWeeklyStandingsClassic(selectedWeek.id, selectedTag);
        if (!response.data.success) {
          throw new Error('Classic standings request failed');
        }
        // Use the new potential score calculation from backend
        const standingsWithPotential = response.data.standings.map(player => ({
          ...player,
          potential_score: player.new_potential_score || player.score,
          potential_correct: player.new_potential_correct || player.numright
        }));

        // Sort by potential score instead of current score
        const sortedStandings = standingsWithPotential.sort((a, b) => {
          const aPotential = a.potential_score || a.score;
          const bPotential = b.potential_score || b.score;
          if (bPotential !== aPotential) {
            return bPotential - aPotential;
          }
          // If potential scores are equal, sort by current score
          return b.score - a.score;
        });
        setStandings(sortedStandings);
        setFullData(response.data);
      } catch (classicError) {
        // Fall back to the summary endpoint for quick view if classic fails
        if (viewMode === 'quick') {
          const response = await statsAPI.getWeeklyStandings(selectedWeek.id, selectedTag);
          if (response.data.success) {
            setStandings(response.data.standings);
            setFullData(null);
          }
        } else {
          throw classicError;
        }
      }
    } catch (error) {
      console.error('Error loading standings:', error);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  };

  const handleRowClick = (playerId) => {
    setSelectedRows(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
  };

  // Toggle auto refresh feature for live updates
  const toggleAutoRefresh = () => {
    const newAutoRefresh = !autoRefresh;
    setAutoRefresh(newAutoRefresh);
    
    if (newAutoRefresh) {
      window.location.replace('#autoreload');
    } else {
      window.location.replace('#');
    }
  };

  // Desktop layout - full view with all games
  const renderDesktopLayout = () => {
    if (!fullData) return null;

    const { games, picksByPicker } = fullData;
    const gameColumns = games.map(() => '60px').join(' ');
    const playerColumnMinWidth = 180;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 300 - (games.length * 60));
    const gridTemplateColumns = `50px ${playerColumnWidth}px ${gameColumns} 70px 70px`;
    
    // Calculate total width for full-width highlighting
    const totalWidth = 50 + playerColumnWidth + (games.length * 60) + 70 + 70;

    return (
      <div className="desktop-table-container">
        <div className="div-scroll-container" onScroll={handleBodyScroll}>
          <div 
            className="desktop-header-container"
            style={{ width: `${totalWidth}px` }}
          >
            <div 
              className="div-header-row desktop-header"
              style={{ gridTemplateColumns }}
            >
              <div className="div-header-cell rank-header">#</div>
              <div className="div-header-cell player-header">Player</div>
              {games.map(game => (
                <div key={game.id} className="div-header-cell game-header">
                  <div className="scoreboard-info">
                    <div className="scoreboard-teams">
                      <div className="scoreboard-team">{game.away_abbr}-</div>
                      <div className="scoreboard-score">{game.awayscore ?? '-'}</div>
                    </div>
                    <div className="scoreboard-teams">
                      <div className="scoreboard-team">{game.home_abbr}-</div>
                      <div className="scoreboard-score">{game.homescore ?? '-'}</div>
                    </div>
                    <div className="scoreboard-status">
                      {game.winner != null ? 'Final' : (game.time || 'TBD')}
                    </div>
                  </div>
                </div>
              ))}
              <div className="div-header-cell total-header">Total</div>
              <div className="div-header-cell potential-header">Potential</div>
            </div>
          </div>
          {standings.map((player, index) => (
            <div 
              key={player.id} 
              className={`desktop-row-container ${player.id === user?.id ? 'current-user' : ''} ${selectedRows.includes(player.id) ? 'selected' : ''}`}
              onClick={() => handleRowClick(player.id)}
              style={{ width: `${totalWidth}px` }}
            >
              <div 
                className="div-body-row desktop-row"
                style={{ gridTemplateColumns }}
              >
              <div className="div-body-cell rank">
                <div className="rank-display">
                  {index + 1}
                </div>
              </div>
              <div className="div-body-cell player-name">
                <div className="player-info">
                  <span className="name">{player.nickname}</span>
                </div>
              </div>
              {games.map(game => {
                const playerPicks = picksByPicker[player.id];
                const gamePick = playerPicks ? playerPicks[game.id] : null;
                
                if (!gamePick) {
                  return (
                    <div key={game.id} className="div-body-cell game-data">
                      <div className="pick-display">-</div>
                    </div>
                  );
                }

                const isAwayPick = gamePick.guess === gamePick.away;
                const isHomePick = gamePick.guess === gamePick.home;
                // winner is null while pending; 0 means the game ended in a tie
                const isTie = gamePick.winner === 0;
                const isCorrect = gamePick.winner != null && !isTie && gamePick.guess === gamePick.winner;
                const isWrong = gamePick.winner != null && !isTie && gamePick.guess !== gamePick.winner;
                const isPending = gamePick.winner == null;
                
                const pickedTeam = isAwayPick ? game.away_abbr : game.home_abbr;
                const pickWeight = gamePick.weight;
                
                return (
                  <div key={game.id} className="div-body-cell game-data">
                    <div className={`pick-display ${isCorrect ? 'correct' : isWrong ? 'wrong' : isPending ? 'pending' : ''}`}>
                      {pickedTeam} {pickWeight}
                    </div>
                  </div>
                );
              })}
              <div className="div-body-cell total-column">
                <div className="total-score">{formatNumber(player.score)}</div>
              </div>
              <div className="div-body-cell potential-column">
                <div className="potential-score">{formatNumber(player.potential_score || player.score)}</div>
              </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Desktop quick layout - summary view with full-width highlighting
  const renderDesktopQuickLayout = () => {
    // Calculate total width for desktop quick layout with flexible player column
    const playerColumnMinWidth = 180;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 1000);
    const totalWidth = 50 + playerColumnWidth + 100 + 100 + 100;
    
    return (
      <div className="desktop-table-container">
        <div className="div-scroll-container" onScroll={handleBodyScroll}>
          <div 
            className="desktop-header-container"
            style={{ width: `${totalWidth}px` }}
          >
            <div 
              className="div-header-row desktop-header"
              style={{ gridTemplateColumns: `50px ${playerColumnWidth}px 100px 100px 100px` }}
            >
              <div className="div-header-cell rank-header">#</div>
              <div className="div-header-cell player-header">Player</div>
              <div className="div-header-cell data-header">Correct</div>
              <div className="div-header-cell data-header">Score</div>
              <div className="div-header-cell data-header">Potential</div>
            </div>
          </div>
          {standings.map((player, index) => (
            <div 
              key={player.id} 
              className={`desktop-row-container ${player.id === user?.id ? 'current-user' : ''} ${selectedRows.includes(player.id) ? 'selected' : ''}`}
              onClick={() => handleRowClick(player.id)}
              style={{ width: `${totalWidth}px` }}
            >
              <div 
                className="div-body-row desktop-row"
                style={{ gridTemplateColumns: `50px ${playerColumnWidth}px 100px 100px 100px` }}
              >
                <div className="div-body-cell rank">{index + 1}</div>
                <div className="div-body-cell player-name">
                  <div className="player-info">
                    <span className="name">{player.nickname}</span>
                  </div>
                </div>
                <div className="div-body-cell correct">{formatNumber(player.numright)}</div>
                <div className="div-body-cell score">{formatNumber(player.score)}</div>
                <div className="div-body-cell potential">{formatNumber(player.potential_score || player.score)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Tablet layout - quick view with fixed columns
  const renderTabletLayout = () => {
    // Calculate total width for tablet layout with flexible player column
    const playerColumnMinWidth = 150;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 450);
    const totalWidth = 40 + playerColumnWidth + 60 + 60 + 60;
    
    return (
      <div className="tablet-table-container">
        <div className="div-scroll-container" onScroll={handleBodyScroll}>
          <div 
            className="tablet-header-container"
            style={{ width: `${totalWidth}px` }}
          >
            <div 
              className="div-header-row tablet-header"
              style={{ gridTemplateColumns: `40px ${playerColumnWidth}px 60px 60px 60px` }}
            >
              <div className="div-header-cell rank-header">#</div>
              <div className="div-header-cell player-header">Player</div>
              <div className="div-header-cell data-header">Correct</div>
              <div className="div-header-cell data-header">Score</div>
              <div className="div-header-cell data-header">Pot</div>
            </div>
          </div>
          {standings.map((player, index) => (
            <div 
              key={player.id} 
              className={`tablet-row-container ${player.id === user?.id ? 'current-user' : ''} ${selectedRows.includes(player.id) ? 'selected' : ''}`}
              onClick={() => handleRowClick(player.id)}
              style={{ width: `${totalWidth}px` }}
            >
              <div 
                className="div-body-row tablet-row"
                style={{ gridTemplateColumns: `40px ${playerColumnWidth}px 60px 60px 60px` }}
              >
                <div className="div-body-cell rank">{index + 1}</div>
                <div className="div-body-cell player-name">
                  <div className="player-info">
                    <span className="name">{player.nickname}</span>
                  </div>
                </div>
                <div className="div-body-cell correct">{formatNumber(player.numright)}</div>
                <div className="div-body-cell score">{formatNumber(player.score)}</div>
                <div className="div-body-cell potential">{formatNumber(player.potential_score || player.score)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Tablet full layout - full view with all games
  const renderTabletFullLayout = () => {
    if (!fullData) return null;

    const { games, picksByPicker } = fullData;
    const gameColumns = games.map(() => '45px').join(' ');
    const playerColumnMinWidth = 160;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 250 - (games.length * 45));
    const gridTemplateColumns = `40px ${playerColumnWidth}px ${gameColumns} 60px 70px`;
    
    // Calculate total width for tablet full layout - must match grid template exactly
    const totalWidth = 40 + playerColumnWidth + (games.length * 45) + 60 + 70;

    return (
      <div className="tablet-table-container">
        <div className="div-scroll-container" onScroll={handleBodyScroll}>
          <div 
            className="tablet-header-container"
            style={{ width: `${totalWidth}px` }}
          >
            <div 
              className="div-header-row tablet-header"
              style={{ gridTemplateColumns }}
            >
              <div className="div-header-cell rank-header">#</div>
              <div className="div-header-cell player-header">Player</div>
              {games.map(game => (
                <div key={game.id} className="div-header-cell game-header">
                  <div className="scoreboard-info">
                    <div className="scoreboard-teams">
                      <div className="scoreboard-team">{game.away_abbr}-</div>
                      <div className="scoreboard-score">{game.awayscore ?? '-'}</div>
                    </div>
                    <div className="scoreboard-teams">
                      <div className="scoreboard-team">{game.home_abbr}-</div>
                      <div className="scoreboard-score">{game.homescore ?? '-'}</div>
                    </div>
                    <div className="scoreboard-status">
                      {game.winner != null ? 'Final' : (game.time || 'TBD')}
                    </div>
                  </div>
                </div>
              ))}
              <div className="div-header-cell total-header">Total</div>
              <div className="div-header-cell potential-header">Pot</div>
            </div>
          </div>
          {standings.map((player, index) => (
            <div 
              key={player.id} 
              className={`tablet-row-container ${player.id === user?.id ? 'current-user' : ''} ${selectedRows.includes(player.id) ? 'selected' : ''}`}
              onClick={() => handleRowClick(player.id)}
              style={{ width: `${totalWidth}px` }}
            >
              <div 
                className="div-body-row tablet-row"
                style={{ gridTemplateColumns }}
              >
                <div className="div-body-cell rank">
                  <div className="rank-display">
                    {index + 1}
                  </div>
                </div>
                <div className="div-body-cell player-name">
                  <div className="player-info">
                    <span className="name">{player.nickname}</span>
                  </div>
                </div>
                {games.map(game => {
                  const playerPicks = picksByPicker[player.id];
                  const gamePick = playerPicks ? playerPicks[game.id] : null;
                  
                  if (!gamePick) {
                    return (
                      <div key={game.id} className="div-body-cell game-data">
                        <div className="pick-display">-</div>
                      </div>
                    );
                  }

                  const isAwayPick = gamePick.guess === gamePick.away;
                  const isHomePick = gamePick.guess === gamePick.home;
                  // winner is null while pending; 0 means the game ended in a tie
                  const isTie = gamePick.winner === 0;
                  const isCorrect = gamePick.winner != null && !isTie && gamePick.guess === gamePick.winner;
                  const isWrong = gamePick.winner != null && !isTie && gamePick.guess !== gamePick.winner;
                  const isPending = gamePick.winner == null;
                  
                  const pickedTeam = isAwayPick ? game.away_abbr : game.home_abbr;
                  const pickWeight = gamePick.weight;
                  
                  return (
                    <div key={game.id} className="div-body-cell game-data">
                      <div className={`pick-display ${isCorrect ? 'correct' : isWrong ? 'wrong' : isPending ? 'pending' : ''}`}>
                        {pickedTeam} {pickWeight}
                      </div>
                    </div>
                  );
                })}
                <div className="div-body-cell total-column">
                  <div className="total-score">{formatNumber(player.score)}</div>
                </div>
                <div className="div-body-cell potential-column">
                  <div className="potential-score">{formatNumber(player.potential_score || player.score)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Mobile layout - compact quick view
  const renderMobileLayout = () => {
    // Calculate total width for mobile layout with flexible player column
    const playerColumnMinWidth = 80;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 120);
    const totalWidth = 30 + playerColumnWidth + 45 + 45 + 45;
    
    return (
      <div className="mobile-table-container">
        <div className="div-scroll-container" onScroll={handleBodyScroll}>
          <div 
            className="mobile-header-container"
            style={{ width: `${totalWidth}px` }}
          >
            <div 
              className="div-header-row mobile-header"
              style={{ gridTemplateColumns: `30px ${playerColumnWidth}px 45px 45px 45px` }}
            >
              <div className="div-header-cell rank-header">#</div>
              <div className="div-header-cell player-header">Player</div>
              <div className="div-header-cell data-header">Correct</div>
              <div className="div-header-cell data-header">Score</div>
              <div className="div-header-cell data-header">Pot.</div>
            </div>
          </div>
          {standings.map((player, index) => (
            <div 
              key={player.id} 
              className={`mobile-row-container ${player.id === user?.id ? 'current-user' : ''} ${selectedRows.includes(player.id) ? 'selected' : ''}`}
              onClick={() => handleRowClick(player.id)}
              style={{ width: `${totalWidth}px` }}
            >
              <div 
                className="div-body-row mobile-row"
                style={{ gridTemplateColumns: `30px ${playerColumnWidth}px 45px 45px 45px` }}
              >
                <div className="div-body-cell rank">{index + 1}</div>
                <div className="div-body-cell player-name">
                  <div className="player-info">
                    <span className="name">{player.nickname}</span>
                  </div>
                </div>
                <div className="div-body-cell correct">{formatNumber(player.numright)}</div>
                <div className="div-body-cell score">{formatNumber(player.score)}</div>
                <div className="div-body-cell potential">{formatNumber(player.potential_score || player.score)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Mobile full layout - full view with all games
  const renderMobileFullLayout = () => {
    if (!fullData) return null;

    const { games, picksByPicker } = fullData;
    const gameColumns = games.map(() => '35px').join(' ');
    const playerColumnMinWidth = 90;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 150 - (games.length * 35));
    const gridTemplateColumns = `25px ${playerColumnWidth}px ${gameColumns} 40px 40px`;
    
    // Calculate total width for mobile full layout
    const totalWidth = 25 + playerColumnWidth + (games.length * 35) + 40 + 40;

    return (
      <div className="mobile-table-container">
        <div className="div-scroll-container" onScroll={handleBodyScroll}>
          <div 
            className="mobile-header-container"
            style={{ width: `${totalWidth}px` }}
          >
            <div 
              className="div-header-row mobile-header"
              style={{ gridTemplateColumns }}
            >
              <div className="div-header-cell rank-header">#</div>
              <div className="div-header-cell player-header">Player</div>
              {games.map(game => (
                <div key={game.id} className="div-header-cell game-header">
                  <div className="scoreboard-info">
                    <div className="scoreboard-teams">
                      <div className="scoreboard-team">{game.away_abbr}-</div>
                      <div className="scoreboard-score">{game.awayscore ?? '-'}</div>
                    </div>
                    <div className="scoreboard-teams">
                      <div className="scoreboard-team">{game.home_abbr}-</div>
                      <div className="scoreboard-score">{game.homescore ?? '-'}</div>
                    </div>
                    <div className="scoreboard-status">
                      {game.winner != null ? 'Final' : (game.time || 'TBD')}
                    </div>
                  </div>
                </div>
              ))}
              <div className="div-header-cell total-header">Total</div>
              <div className="div-header-cell potential-header">Pot.</div>
            </div>
          </div>
          {standings.map((player, index) => (
            <div 
              key={player.id} 
              className={`mobile-row-container ${player.id === user?.id ? 'current-user' : ''} ${selectedRows.includes(player.id) ? 'selected' : ''}`}
              onClick={() => handleRowClick(player.id)}
              style={{ width: `${totalWidth}px` }}
            >
              <div 
                className="div-body-row mobile-row"
                style={{ gridTemplateColumns }}
              >
                <div className="div-body-cell rank">
                  <div className="rank-display">
                    {index + 1}
                  </div>
                </div>
                <div className="div-body-cell player-name">
                  <div className="player-info">
                    <span className="name">{player.nickname}</span>
                  </div>
                </div>
                {games.map(game => {
                  const playerPicks = picksByPicker[player.id];
                  const gamePick = playerPicks ? playerPicks[game.id] : null;
                  
                  if (!gamePick) {
                    return (
                      <div key={game.id} className="div-body-cell game-data">
                        <div className="pick-display">-</div>
                      </div>
                    );
                  }

                  const isAwayPick = gamePick.guess === gamePick.away;
                  const isHomePick = gamePick.guess === gamePick.home;
                  // winner is null while pending; 0 means the game ended in a tie
                  const isTie = gamePick.winner === 0;
                  const isCorrect = gamePick.winner != null && !isTie && gamePick.guess === gamePick.winner;
                  const isWrong = gamePick.winner != null && !isTie && gamePick.guess !== gamePick.winner;
                  const isPending = gamePick.winner == null;
                  
                  const pickedTeam = isAwayPick ? game.away_abbr : game.home_abbr;
                  const pickWeight = gamePick.weight;
                  
                  return (
                    <div key={game.id} className="div-body-cell game-data">
                      <div className={`pick-display ${isCorrect ? 'correct' : isWrong ? 'wrong' : isPending ? 'pending' : ''}`}>
                        {pickedTeam} {pickWeight}
                      </div>
                    </div>
                  );
                })}
                <div className="div-body-cell total-column">
                  <div className="total-score">{formatNumber(player.score)}</div>
                </div>
                <div className="div-body-cell potential-column">
                  <div className="potential-score">{formatNumber(player.potential_score || player.score)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading && !selectedWeek) {
    return (
      <div className="standings-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="standings-container">
      <div className="standings-header glass-container">
        <div className="header-content">
          <div className="title-section">
            <h1>Weekly Standings</h1>
          </div>
          
          <div className="controls">
            <div className="auto-refresh-control">
              <label htmlFor="auto-refresh">Auto Refresh:</label>
              <button
                id="auto-refresh"
                className={`auto-refresh-button ${autoRefresh ? 'active' : ''}`}
                onClick={toggleAutoRefresh}
              >
                {autoRefresh ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="view-toggle">
              <label htmlFor="view-toggle">View</label>
              <div className="slider-container">
                <div className="slider-track" onClick={() => setViewMode(viewMode === 'quick' ? 'full' : 'quick')}>
                  <div className={`slider-thumb ${viewMode === 'full' ? 'slider-thumb-right' : 'slider-thumb-left'}`}>
                  </div>
                  <div className="slider-track-labels">
                    <span className={`track-label ${viewMode === 'quick' ? 'track-label-active' : 'track-label-inactive'}`}>
                      <span className="desktop-text">Quick View</span>
                      <span className="mobile-text">Quick</span>
                    </span>
                    <span className={`track-label ${viewMode === 'full' ? 'track-label-active' : 'track-label-inactive'}`}>
                      <span className="desktop-text">Full View</span>
                      <span className="mobile-text">Full</span>
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
                  const autoSelectedWeek = completedWeeks[completedWeeks.length - 1] || weeks[0];
                  
                  return weeks.map(week => {
                    const isAutoSelected = week.id === autoSelectedWeek?.id;
                    return {
                      value: week.id,
                      label: isAutoSelected ? `Week ${week.number} (Current)` : `Week ${week.number}`
                    };
                  });
                })()}
                value={selectedWeek?.id || ''}
                onChange={(value) => {
                  const week = weeks.find(w => w.id === parseInt(value));
                  setSelectedWeek(week);
                }}
                placeholder="Select Week"
              />
            </div>

            <div className="tag-selector">
              <label htmlFor="tag-select">Filter</label>
              <CustomDropdown
                options={availableTags.map(tag => ({
                  value: tag.id,
                  label: tag.name
                }))}
                value={selectedTag}
                onChange={(value) => setSelectedTag(parseInt(value))}
                placeholder="All Tags"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="standings-table-container glass-container">
        {selectedWeek && (
          <div className="week-info">
            <h2>Week {selectedWeek.number} Results</h2>
            {selectedWeek.factor !== 1 && (
              <p className="multiplier-notice">
                Scores multiplied by {selectedWeek.factor}
              </p>
            )}
          </div>
        )}
        {loading ? (
          <div className="loading-spinner"></div>
        ) : standings.length > 0 ? (
          <>
            {/* Desktop Layouts */}
            <div className={`desktop-layout ${screenSize === 'desktop' ? 'active' : 'hidden'}`}>
              {viewMode === 'full' ? renderDesktopLayout() : renderDesktopQuickLayout()}
            </div>
            
            {/* Tablet Layouts */}
            <div className={`tablet-layout ${screenSize === 'tablet' ? 'active' : 'hidden'}`}>
              {viewMode === 'full' ? renderTabletFullLayout() : renderTabletLayout()}
            </div>
            
            {/* Mobile Layouts */}
            <div className={`mobile-layout ${screenSize === 'mobile' ? 'active' : 'hidden'}`}>
              {viewMode === 'full' ? renderMobileFullLayout() : renderMobileLayout()}
            </div>
          </>
        ) : (
          <div className="no-data">
            <p>No standings data available for this week.</p>
          </div>
        )}
      </div>

      <style jsx="true">{`
        .standings-container {
          max-width: 2000px;
          margin: 0 auto;
          padding: 0 1rem;
          width: 100%;
        }

        /* Override main-content max-width for this page */
        :global(.main-content) {
          max-width: 2000px !important;
        }

        .standings-header {
          margin-bottom: 1.5rem;
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
            grid-template-columns: repeat(4, 1fr);
            gap: 1.5rem;
            width: 100%;
          }
        }

        @media (min-width: 1024px) {
          .controls {
            grid-template-columns: repeat(4, auto);
            gap: 1.5rem;
            width: auto;
          }
        }

        .view-toggle,
        .week-selector,
        .tag-selector,
        .auto-refresh-control {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        /* Z-index stacking for dropdowns */
        .view-toggle .custom-dropdown {
          z-index: 300 !important;
        }

        .view-toggle .custom-dropdown .dropdown-menu {
          z-index: 300 !important;
        }

        .week-selector .custom-dropdown {
          z-index: 330 !important;
        }

        .week-selector .custom-dropdown .dropdown-menu {
          z-index: 330 !important;
        }

        .tag-selector .custom-dropdown {
          z-index: 320 !important;
        }

        .tag-selector .custom-dropdown .dropdown-menu {
          z-index: 320 !important;
        }

        .auto-refresh-control {
          z-index: 310 !important;
        }

        .custom-dropdown {
          width: 180px !important;
        }

        .view-toggle label,
        .week-selector label,
        .tag-selector label,
        .auto-refresh-control label {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 600;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .slider-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 180px;
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
          width: calc(50% - 2px);
          height: calc(100% - 4px);
          background: rgba(100, 150, 255, 0.15);
          border: 1px solid rgba(100, 150, 255, 0.4);
          border-radius: 10px;
          cursor: pointer;
          transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, opacity 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 0 0 3px rgba(100, 150, 255, 0.1),
            0 6px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
          z-index: 2;
        }

        .slider-thumb-right {
          left: calc(50% - 2px);
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

        .week-info {
          margin-bottom: 1rem;
          text-align: center;
          padding: 0.5rem 0;
        }

        .week-info h2 {
          color: white;
          font-size: 1.5rem;
          margin: 0;
          font-weight: 600;
        }

        .auto-refresh-button {
          background: rgba(255, 255, 255, 0.08);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.7);
          padding: 0.6rem 0.875rem;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease, opacity 0.2s ease;
          font-size: 0.9rem;
          font-weight: 500;
          width: 180px;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          box-shadow: 
            0 4px 16px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .auto-refresh-button:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
          color: white;
          box-shadow: 
            0 6px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .auto-refresh-button.active {
          background: rgba(100, 150, 255, 0.15);
          border-color: rgba(100, 150, 255, 0.4);
          color: rgba(150, 200, 255, 1);
          box-shadow: 
            0 0 0 3px rgba(100, 150, 255, 0.1),
            0 6px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .multiplier-notice {
          color: rgba(255, 200, 100, 1);
          font-weight: 500;
          font-size: 0.9rem;
        }

        .standings-table-container {
          overflow: visible !important;
          width: 100%;
          position: relative;
          z-index: 1;
          margin: 0 auto;
        }

        /* Layout visibility controls */
        .desktop-layout,
        .tablet-layout,
        .mobile-layout {
          display: none;
        }

        .desktop-layout.active,
        .tablet-layout.active,
        .mobile-layout.active {
          display: block;
        }

        /* Desktop Layout Styles */
        .desktop-table-container {
          background: rgba(255, 255, 255, 0.05);
          -webkit-backdrop-filter: blur(15px);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          overflow: hidden;
          width: fit-content;
          max-width: 100%;
          margin: 0 auto;
        }

        .desktop-header {
          display: grid;
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(20, 22, 36, 0.75);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
        }

        .desktop-row {
          display: grid;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background-color 0.2s ease;
          cursor: pointer;
        }

        /* Full-width container styles for consistent highlighting */
        .desktop-header-container,
        .tablet-header-container,
        .mobile-header-container {
          width: 100%;
          background: rgba(20, 22, 36, 0.75);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .desktop-row-container,
        .tablet-row-container,
        .mobile-row-container {
          width: 100%;
          transition: background-color 0.2s ease;
          cursor: pointer;
          position: relative;
        }


        .desktop-row-container:hover,
        .tablet-row-container:hover,
        .mobile-row-container:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .desktop-row-container.selected,
        .tablet-row-container.selected,
        .mobile-row-container.selected {
          background: rgba(100, 150, 255, 0.1);
          box-shadow: inset 0 0 0 1px rgba(100, 150, 255, 0.3);
        }

        .desktop-row-container.current-user,
        .tablet-row-container.current-user,
        .mobile-row-container.current-user {
          background: rgba(255, 215, 0, 0.1);
          box-shadow: inset 0 0 0 1px rgba(255, 215, 0, 0.3);
        }

        .desktop-row-container.current-user:hover,
        .tablet-row-container.current-user:hover,
        .mobile-row-container.current-user:hover {
          background: rgba(255, 215, 0, 0.15);
        }

        .desktop-row-container.current-user.selected,
        .tablet-row-container.current-user.selected,
        .mobile-row-container.current-user.selected {
          background: rgba(255, 215, 0, 0.2);
          box-shadow: inset 0 0 0 1px rgba(255, 215, 0, 0.5);
        }

        /* Tablet Layout Styles */
        .tablet-table-container {
          background: rgba(255, 255, 255, 0.05);
          -webkit-backdrop-filter: blur(15px);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          overflow: hidden;
          width: fit-content;
          max-width: 100%;
          margin: 0 auto;
        }

        .tablet-table-container .div-scroll-container {
          width: fit-content;
          max-width: 100%;
        }

        /* Tablet pick display boxes - smaller */
        @media (max-width: 1024px) and (min-width: 769px) {
          .tablet-layout .pick-display {
            padding: 0.05rem 0.1rem;
            min-height: 0.8rem;
            font-size: 0.5rem;
          }
        }

        .tablet-header {
          display: grid;
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(20, 22, 36, 0.75);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
        }

        .tablet-row {
          display: grid;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background-color 0.2s ease;
          cursor: pointer;
        }

        /* Mobile Layout Styles */
        .mobile-table-container {
          background: rgba(255, 255, 255, 0.05);
          -webkit-backdrop-filter: blur(15px);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          overflow: hidden;
          width: fit-content;
          max-width: 100%;
          margin: 0 auto;
        }

        .mobile-header {
          display: grid;
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(20, 22, 36, 0.75);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
        }

        .mobile-row {
          display: grid;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background-color 0.2s ease;
          cursor: pointer;
        }

        /* Common table styles */
        .div-scroll-container {
          height: auto;
          max-height: none;
          overflow-y: visible;
          overflow-x: auto;
          width: fit-content;
          max-width: 100%;
          border-radius: 16px;
        }

        .div-scroll-container::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .div-scroll-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }

        .div-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(200, 200, 200, 0.4);
          border-radius: 3px;
          transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, opacity 0.3s ease;
        }

        .div-scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(200, 200, 200, 0.6);
        }

        .div-scroll-container::-webkit-scrollbar-corner {
          background: transparent;
          border-radius: 0 0 16px 0;
        }

        .div-header-row {
          display: grid;
          min-width: 0;
          width: 100%;
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(20, 22, 36, 0.75);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
        }

        .div-header-cell {
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.25rem 0.2rem;
          font-weight: 600;
          color: rgba(150, 200, 255, 1);
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          min-height: 32px;
        }

        .div-header-cell:last-child {
          border-right: none;
        }

        .div-header-cell.player-header {
          text-align: left !important;
          justify-content: flex-start !important;
          padding-left: 5px;
        }

        .div-body-row {
          display: grid;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background-color 0.2s ease;
          cursor: pointer;
          min-width: 0;
          width: 100%;
          position: relative;
        }

        .div-body-cell {
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding: 0.2rem 0.1rem;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          cursor: default;
          min-height: 32px;
        }

        .div-body-cell:last-child {
          padding-right: 0px;
          border-right: none;
        }

        .div-body-cell.player-name {
          text-align: left !important;
          justify-content: flex-start !important;
          padding-left: 5px;
          min-width: 0;
          overflow: hidden;
        }

        .div-body-cell.player-name .name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          display: block;
          width: 100%;
        }

        /* Game-specific styles */
        .game-header {
          min-width: 60px;
          text-align: center;
        }

        /* Tablet game columns */
        .tablet-layout .game-header {
          min-width: 45px;
        }

        .tablet-layout .game-data {
          min-width: 45px;
        }

        /* Mobile game columns */
        .mobile-layout .game-header {
          min-width: 35px;
        }

        .mobile-layout .game-data {
          min-width: 35px;
        }

        /* Scoreboard cells - namespaced to avoid colliding with App.css .game-info */
        .scoreboard-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .scoreboard-teams {
          display: flex;
          align-items: center;
          gap: 0.05rem;
          font-weight: 600;
          color: rgba(150, 200, 255, 1);
          font-size: 0.6rem;
        }

        .scoreboard-team {
          color: rgba(150, 200, 255, 1);
        }

        .scoreboard-score {
          color: rgba(150, 200, 255, 1);
          font-weight: 700;
        }

        .scoreboard-status {
          font-size: 0.5rem;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }

        .game-data {
          min-width: 60px;
          text-align: center;
        }

        .pick-display {
          padding: 0.1rem 0.15rem;
          border-radius: 2px;
          font-weight: 600;
          min-height: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6rem;
          width: 80%;
          min-width: 30px;
          margin: 0 auto;
        }

        .pick-display.correct {
          background: rgba(150, 255, 150, 0.3);
          color: rgba(150, 255, 150, 1);
          border: 1px solid rgba(150, 255, 150, 0.5);
        }

        .pick-display.wrong {
          background: rgba(255, 150, 150, 0.3);
          color: rgba(255, 150, 150, 1);
          border: 1px solid rgba(255, 150, 150, 0.5);
        }

        .pick-display.pending {
          background: rgba(255, 200, 100, 0.3);
          color: rgba(255, 200, 100, 1);
          border: 1px solid rgba(255, 200, 100, 0.5);
        }

        .rank {
          font-weight: 600;
          color: rgba(150, 200, 255, 1);
        }

        .player-name {
          font-weight: 600;
          text-align: left !important;
        }

        .player-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .name {
          color: white;
        }

        .score {
          font-weight: 700;
          color: rgba(150, 200, 255, 1);
        }

        .correct {
          color: rgba(150, 255, 150, 1);
          font-weight: 600;
        }

        .potential {
          color: rgba(255, 200, 100, 1);
          font-weight: 600;
        }

        .total-score {
          font-size: 0.9rem;
          font-weight: 700;
          color: rgba(150, 200, 255, 1);
        }

        .potential-score {
          font-size: 0.9rem;
          font-weight: 700;
          color: rgba(255, 200, 100, 1);
        }

        .no-data {
          text-align: center;
          padding: 3rem 2rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .no-data p {
          margin-bottom: 0.5rem;
        }

        /* Responsive adjustments */
        @media (max-width: 1024px) {
          .desktop-layout {
            display: none !important;
          }
        }

        @media (max-width: 768px) {
          .tablet-layout {
            display: none !important;
          }
        }

        @media (min-width: 769px) {
          .mobile-layout {
            display: none !important;
          }
        }

        @media (min-width: 1025px) {
          .tablet-layout {
            display: none !important;
          }
        }

        @media (max-width: 889px) {
          .title-section h1 {
            font-size: 2rem;
          }
          
          .controls {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }

          .slider-container {
            width: 100%;
            max-width: 180px;
          }

          .custom-dropdown {
            width: 100% !important;
            max-width: 180px;
          }

          .auto-refresh-button {
            width: 100%;
            max-width: 180px;
            padding: 0.5rem 0.75rem;
            font-size: 0.85rem;
            height: 36px;
          }

          .desktop-text {
            display: none;
          }

          .mobile-text {
            display: inline;
          }
        }

        @media (max-width: 480px) {
          .standings-header {
            padding: 1rem;
          }
          
          .title-section h1 {
            font-size: 1.5rem;
          }
          
          .auto-refresh-button {
            padding: 0.45rem 0.6rem;
            font-size: 0.8rem;
            height: 32px;
          }

          .slider-track {
            height: 32px;
          }
        }

        /* Mobile-specific text sizing */
        @media (max-width: 768px) {
          .mobile-layout .div-header-cell,
          .mobile-layout .div-header-row .div-header-cell {
            font-size: 0.75rem;
            padding: 0.15rem 0.1rem;
            min-height: 24px !important;
          }

          .mobile-layout .div-body-cell,
          .mobile-layout .div-body-row .div-body-cell {
            font-size: 0.75rem;
            padding: 0.15rem 0.05rem;
            min-height: 24px !important;
          }

          .mobile-layout .scoreboard-teams {
            font-size: 0.5rem;
          }

          .mobile-layout .scoreboard-status {
            font-size: 0.4rem;
          }

          /* Mobile pick display boxes - smaller */
          .mobile-layout .pick-display {
            padding: 0.03rem 0.05rem;
            min-height: 0.8rem;
            font-size: 0.4rem;
          }

          .mobile-layout .total-score,
          .mobile-layout .potential-score {
            font-size: 0.75rem;
          }

          /* Mobile full view specific styling */
          .mobile-layout .div-header-cell.rank-header,
          .mobile-layout .div-header-cell.total-header,
          .mobile-layout .div-header-cell.potential-header {
            font-size: 0.65rem;
          }

          .mobile-layout .div-body-cell.rank,
          .mobile-layout .div-body-cell.total-column,
          .mobile-layout .div-body-cell.potential-column {
            font-size: 0.65rem;
          }

          .mobile-layout .div-body-cell.player-name .name {
            font-size: 0.7rem;
          }

          .mobile-layout .div-header-cell.player-header {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  );
}

export default WeeklyStandings;