import React, { useState, useEffect } from 'react';
import { Trophy, Filter, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { statsAPI, authAPI } from '../services/api';
import CustomDropdown from '../components/CustomDropdown';
import { sanitizeString, sanitizeUserData } from '../utils/sanitize';

// NFL seasons are labeled by the calendar year they start in; games in
// January/February belong to the previous season's year.
const getSeasonYear = () => {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
};

// Utility function to format numbers - remove .0 but keep other decimals
const formatNumber = (num) => {
  if (num == null || num === '') return num;
  const numValue = Number(num);
  if (isNaN(numValue)) return num;
  return numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(1);
};

function OverallStandings() {
  const { user } = useAuth();
  // Main state for standings data and UI controls
  const [standings, setStandings] = useState([]);
  const [detailedData, setDetailedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState(0);
  const [viewMode, setViewMode] = useState(() => {
    // Default to quick view on mobile devices, full view on desktop
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobile ? 'quick' : 'full';
  }); // 'quick' or 'full'
  const [selectedRows, setSelectedRows] = useState([]);
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
    loadUserTags();

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
    loadStandings();
  }, [selectedTag, viewMode]);

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

  // Load standings data based on current view mode
  const loadStandings = async () => {
    try {
      setLoading(true);
      if (viewMode === 'quick') {
        const response = await statsAPI.getOverallStandings(selectedTag);
        if (response.data.success) {
          setStandings(response.data.standings);
          setDetailedData(null);
        }
      } else {
        const response = await statsAPI.getOverallStandingsDetailed(selectedTag);
        if (response.data.success) {
          setStandings(response.data.standings);
          setDetailedData(response.data);
        }
      }
    } catch (error) {
      console.error('Error loading overall standings:', error);
    } finally {
      setLoading(false);
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

  // Desktop layout - quick view with flexible player column
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
              <div className="div-header-cell data-header">Total Correct</div>
              <div className="div-header-cell data-header">Total Score</div>
              <div className="div-header-cell data-header">Average Week</div>
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
                <div className="div-body-cell correct">{formatNumber(player.numright || player.total_correct)}</div>
                <div className="div-body-cell score">{formatNumber(player.score || player.total_score)}</div>
                <div className="div-body-cell average">
                  {(player.weeks_played || 0) > 0 
                    ? formatNumber((player.score || player.total_score) / (player.weeks_played || 1))
                    : '0'
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Desktop layout - full view with all weeks
  const renderDesktopFullLayout = () => {
    if (!detailedData) return null;

    const allWeeks = detailedData.weeks || [];
    const weeklyScores = detailedData.weeklyScores || {};

    // Filter weeks to only show those that have started and sort from latest to earliest
    const weeks = allWeeks.sort((a, b) => b.number - a.number);
    
    const weekColumns = weeks.map(() => '100px').join(' ');
    const playerColumnMinWidth = 180;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 1100 - (weeks.length * 100));
    const gridTemplateColumns = `50px ${playerColumnWidth}px 120px ${weekColumns}`;
    
    // Calculate total width for full-width highlighting
    const totalWidth = 50 + playerColumnWidth + 120 + (weeks.length * 100) + 10;

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
              <div className="div-header-cell total-header">
                <div className="total-column-header">
                  <div className="total-label">Total (# Correct)</div>
                </div>
              </div>
              {weeks.map(week => (
                <div key={week.id} className="div-header-cell week-header">
                  <div className="week-column">
                    <div className="week-number">Week {week.number}</div>
                  </div>
                </div>
              ))}
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
                <div className="div-body-cell total-column">
                  <div className="total-score-display">
                    <div className="total-score">{formatNumber(player.total_score || player.score)}</div>
                    <div className="total-correct">({formatNumber(player.total_correct || player.numright)})</div>
                  </div>
                </div>
                {weeks.map(week => {
                  const weekData = weeklyScores[player.id]?.[week.number] || { score: 0, correct: 0 };
                  return (
                    <div key={week.id} className="div-body-cell week-data">
                      <div className="week-score-display">
                        <div className="week-score">{formatNumber(weekData.score)}</div>
                        <div className="week-correct">({formatNumber(weekData.correct)})</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Tablet layout - quick view with fixed columns
  const renderTabletQuickLayout = () => {
    // Calculate total width for tablet layout with flexible player column
    const playerColumnMinWidth = 150;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 450);
    const totalWidth = 40 + playerColumnWidth + 60 + 60 + 65;
    
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
              <div className="div-header-cell data-header">Total Correct</div>
              <div className="div-header-cell data-header">Total Score</div>
              <div className="div-header-cell data-header">Average</div>
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
                <div className="div-body-cell correct">{formatNumber(player.numright || player.total_correct)}</div>
                <div className="div-body-cell score">{formatNumber(player.score || player.total_score)}</div>
                <div className="div-body-cell average">
                  {(player.weeks_played || 0) > 0 
                    ? formatNumber((player.score || player.total_score) / (player.weeks_played || 1))
                    : '0'
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Tablet full layout - full view with all weeks
  const renderTabletFullLayout = () => {
    if (!detailedData) return null;

    const allWeeks = detailedData.weeks || [];
    const weeklyScores = detailedData.weeklyScores || {};

    const weeks = allWeeks.sort((a, b) => b.number - a.number);
    const weekColumns = weeks.map(() => '80px').join(' ');
    const playerColumnMinWidth = 160;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 250 - (weeks.length * 80));
    const gridTemplateColumns = `40px ${playerColumnWidth}px 150px ${weekColumns}`;
    
    // Calculate total width for tablet full layout
    const totalWidth = 40 + playerColumnWidth + 150 + (weeks.length * 80) + 10;

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
              <div className="div-header-cell total-header">
                <div className="total-column-header">
                  <div className="total-label">Total (# Correct)</div>
                </div>
              </div>
              {weeks.map(week => (
                <div key={week.id} className="div-header-cell week-header">
                  <div className="week-column">
                    <div className="week-number">Week {week.number}</div>
                  </div>
                </div>
              ))}
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
                <div className="div-body-cell total-column">
                  <div className="total-score-display">
                    <div className="total-score">{formatNumber(player.total_score || player.score)}</div>
                    <div className="total-correct">({formatNumber(player.total_correct || player.numright)})</div>
                  </div>
                </div>
                {weeks.map(week => {
                  const weekData = weeklyScores[player.id]?.[week.number] || { score: 0, correct: 0 };
                  return (
                    <div key={week.id} className="div-body-cell week-data">
                      <div className="week-score-display">
                        <div className="week-score">{formatNumber(weekData.score)}</div>
                        <div className="week-correct">({formatNumber(weekData.correct)})</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Mobile layout - compact quick view
  const renderMobileQuickLayout = () => {
    // Calculate total width for mobile layout with flexible player column
    const playerColumnMinWidth = 80;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 120);
    const totalWidth = 30 + playerColumnWidth + 45 + 45 + 50;
    
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
              <div className="div-header-cell data-header">Avg.</div>
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
                <div className="div-body-cell correct">{formatNumber(player.numright || player.total_correct)}</div>
                <div className="div-body-cell score">{formatNumber(player.score || player.total_score)}</div>
                <div className="div-body-cell average">
                  {(player.weeks_played || 0) > 0 
                    ? formatNumber((player.score || player.total_score) / (player.weeks_played || 1))
                    : '0'
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Mobile full layout - full view with all weeks
  const renderMobileFullLayout = () => {
    if (!detailedData) return null;

    const allWeeks = detailedData.weeks || [];
    const weeklyScores = detailedData.weeklyScores || {};

    const weeks = allWeeks.sort((a, b) => b.number - a.number);
    const weekColumns = weeks.map(() => '80px').join(' ');
    const playerColumnMinWidth = 130;
    const playerColumnWidth = Math.max(playerColumnMinWidth, 150 - (weeks.length * 80));
    const gridTemplateColumns = `25px ${playerColumnWidth}px 110px ${weekColumns}`;
    
    // Calculate total width for mobile full layout
    const totalWidth = 25 + playerColumnWidth + 110 + (weeks.length * 80) + 10;

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
              <div className="div-header-cell total-header">
                <div className="total-column-header">
                  <div className="total-label">Total (# Correct)</div>
                </div>
              </div>
              {weeks.map(week => (
                <div key={week.id} className="div-header-cell week-header">
                  <div className="week-column">
                    <div className="week-number">Week {week.number}</div>
                  </div>
                </div>
              ))}
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
                <div className="div-body-cell total-column">
                  <div className="total-score-display">
                    <div className="total-score">{formatNumber(player.total_score || player.score)}</div>
                    <div className="total-correct">({formatNumber(player.total_correct || player.numright)})</div>
                  </div>
                </div>
                {weeks.map(week => {
                  const weekData = weeklyScores[player.id]?.[week.number] || { score: 0, correct: 0 };
                  return (
                    <div key={week.id} className="div-body-cell week-data">
                      <div className="week-score-display">
                        <div className="week-score">{formatNumber(weekData.score)}</div>
                        <div className="week-correct">({formatNumber(weekData.correct)})</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="standings-container">
      <div className="standings-header glass-container">
        <div className="header-content">
          <div className="title-section">
            <h1>Overall Standings</h1>
          </div>
          
          <div className="controls">
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
        <div className="season-info">
          <h2>{getSeasonYear()} Season Totals</h2>
          <p>Combined scores from all completed weeks</p>
        </div>
        {loading ? (
          <div className="loading-spinner"></div>
        ) : standings.length > 0 ? (
          <>
            {/* Desktop Layouts */}
            <div className={`desktop-layout ${screenSize === 'desktop' ? 'active' : 'hidden'}`}>
              {viewMode === 'full' ? renderDesktopFullLayout() : renderDesktopQuickLayout()}
            </div>
            
            {/* Tablet Layouts */}
            <div className={`tablet-layout ${screenSize === 'tablet' ? 'active' : 'hidden'}`}>
              {viewMode === 'full' ? renderTabletFullLayout() : renderTabletQuickLayout()}
            </div>
            
            {/* Mobile Layouts */}
            <div className={`mobile-layout ${screenSize === 'mobile' ? 'active' : 'hidden'}`}>
              {viewMode === 'full' ? renderMobileFullLayout() : renderMobileQuickLayout()}
            </div>
          </>
        ) : (
          <div className="no-data">
            <Trophy className="no-data-icon" />
            <p>No standings data available yet.</p>
            <p>Check back after the first week of games!</p>
          </div>
        )}
      </div>

      {standings.length > 0 && (
        <div className="stats-summary glass-container">
          <h3>Season Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{standings.length}</div>
              <div className="stat-label">Total Players</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {formatNumber(Math.max(...standings.map(p => Number(p.score || p.total_score || 0))))}
              </div>
              <div className="stat-label">Highest Score</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {formatNumber(Math.min(...standings.map(p => Number(p.score || p.total_score || 0))))}
              </div>
              <div className="stat-label">Lowest Score</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {formatNumber(standings.reduce((sum, p) => sum + Number(p.score || p.total_score || 0), 0) / standings.length)}
              </div>
              <div className="stat-label">Average Score</div>
            </div>
          </div>
        </div>
      )}

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

        .view-toggle,
        .tag-selector {
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

        .tag-selector .custom-dropdown {
          z-index: 320 !important;
        }

        .tag-selector .custom-dropdown .dropdown-menu {
          z-index: 320 !important;
        }

        .custom-dropdown {
          width: 180px !important;
        }

        .view-toggle label,
        .tag-selector label {
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

        .season-info {
          margin-bottom: 1rem;
          text-align: center;
          padding: 0.5rem 0;
        }

        .season-info h2 {
          color: white;
          font-size: 1.5rem;
          margin: 0;
          font-weight: 600;
        }

        .season-info p {
          color: rgba(255, 255, 255, 0.7);
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

        /* Common table styles */
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

        .average {
          color: rgba(255, 200, 100, 1);
          font-weight: 600;
        }

        .no-data {
          text-align: center;
          padding: 3rem 2rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .no-data-icon {
          color: rgba(255, 215, 0, 0.5);
          width: 64px;
          height: 64px;
          margin-bottom: 1rem;
        }

        .no-data p {
          margin-bottom: 0.5rem;
        }

        .div-body-cell.player-name .name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          display: block;
          width: 100%;
        }

        /* Total column header styling */
        .total-column-header {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .total-label {
          font-weight: 700;
          color: rgba(150, 200, 255, 1);
        }

        /* Total column data styling */
        .total-score-display {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }

        .total-score {
          font-weight: 700;
          color: rgba(150, 200, 255, 1);
          font-size: 0.9rem;
          line-height: 1;
        }

        .total-correct {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
          line-height: 1;
        }

        /* Week column styling */
        .week-header {
          min-width: 80px;
          text-align: center;
        }

        .week-column {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .week-number {
          font-weight: 700;
          color: rgba(150, 200, 255, 1);
        }

        .week-data {
          min-width: 80px;
          text-align: center;
        }

        .week-score-display {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }

        .week-score {
          font-weight: 700;
          color: rgba(150, 200, 255, 1);
          font-size: 0.9rem;
          line-height: 1;
        }

        .week-correct {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
          line-height: 1;
        }

        .rank-display {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: rgba(150, 200, 255, 1);
          font-weight: 600;
        }

        .stats-summary {
          text-align: center;
          margin-top: 1.5rem;
        }

        .stats-summary h3 {
          color: white;
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }

        @media (min-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: rgba(150, 200, 255, 1);
          margin-bottom: 0.5rem;
        }

        .stat-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
          font-weight: 500;
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

          .mobile-layout .div-body-cell.player-name .name {
            font-size: 0.75rem;
          }

          .mobile-layout .div-header-cell.player-header {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}

export default OverallStandings;