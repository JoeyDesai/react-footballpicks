import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart3 } from 'lucide-react';
import { statsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeString } from '../utils/sanitize';

function TeamStats() {
  const { user } = useAuth();
  // State for team statistics and sorting
  const [teamStats, setTeamStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('pointswon');
  const [sortOrder, setSortOrder] = useState('desc');

  // Guard against the header and body scroll handlers re-triggering each other
  const isSyncingScroll = useRef(false);

  const handleBodyScroll = (e) => {
    if (isSyncingScroll.current) {
      isSyncingScroll.current = false;
      return;
    }
    const headerContainer = document.querySelector('.table-header-container');
    if (headerContainer && headerContainer.scrollLeft !== e.target.scrollLeft) {
      isSyncingScroll.current = true;
      headerContainer.scrollLeft = e.target.scrollLeft;
    }
  };

  const handleHeaderScroll = (e) => {
    if (isSyncingScroll.current) {
      isSyncingScroll.current = false;
      return;
    }
    const tableBody = document.querySelector('.table-body');
    if (tableBody && tableBody.scrollLeft !== e.target.scrollLeft) {
      isSyncingScroll.current = true;
      tableBody.scrollLeft = e.target.scrollLeft;
    }
  };


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

  useEffect(() => {
    loadTeamStats();
  }, []);

  // Load team statistics from the API
  const loadTeamStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await statsAPI.getTeamStats();
      if (response.data.success) {
        console.log('Team stats data:', response.data.stats);
        if (response.data.stats.length > 0) {
          console.log('First team data:', response.data.stats[0]);
        }
        setTeamStats(response.data.stats);
      } else {
        setError('API returned success: false');
      }
    } catch (error) {
      console.error('Error loading team stats:', error);
      setError(`API Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle sorting when user clicks column headers
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const sortedStats = useMemo(() => [...teamStats].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle string vs number sorting
    if (sortBy === 'name') {
      // String sorting for team names
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    } else {
      // Number sorting for all numeric columns
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    }

    let result;
    if (sortOrder === 'asc') {
      result = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      result = aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }

    return result;
  }), [teamStats, sortBy, sortOrder]);

  const getSortIcon = (column) => {
    return null; // We'll use CSS pseudo-element instead
  };

  if (loading) {
    return (
      <div className="team-stats-container">
        <div className="loading-spinner"></div>
        <p>Loading team statistics...</p>
      </div>
    );
  }

  return (
    <div className="team-stats-container">
      <div className="team-stats-header glass-container">
        <div className="title-section">
          <BarChart3 className="header-icon" />
          <h1>Team Statistics</h1>
        </div>
        <p>Interesting team pick statistics based on player selections and actual results</p>
      </div>
      
      

      <div className="stats-table-container glass-container">
        {teamStats.length > 0 ? (
          <div className="table-container">
            <div className="table-header-container" onScroll={handleHeaderScroll}>
              <div className="table-header">
                <div className="header-cell team-header">Team</div>
                <div 
                  className={`header-cell data-header sortable-header ${sortBy === 'pointswon' ? 'active-sort' : ''}`}
                  onClick={() => handleSort('pointswon')}
                >
                  Points Won
                </div>
                <div 
                  className={`header-cell data-header sortable-header ${sortBy === 'correctpicks' ? 'active-sort' : ''}`}
                  onClick={() => handleSort('correctpicks')}
                >
                  Correctly Picked
                </div>
                <div 
                  className={`header-cell data-header sortable-header ${sortBy === 'pointslost' ? 'active-sort' : ''}`}
                  onClick={() => handleSort('pointslost')}
                >
                  Points Lost
                </div>
                <div 
                  className={`header-cell data-header sortable-header ${sortBy === 'wrongpicks' ? 'active-sort' : ''}`}
                  onClick={() => handleSort('wrongpicks')}
                >
                  Wrongly Picked
                </div>
                <div 
                  className={`header-cell data-header sortable-header ${sortBy === 'totalpoints' ? 'active-sort' : ''}`}
                  onClick={() => handleSort('totalpoints')}
                >
                  Total Points
                </div>
                <div 
                  className={`header-cell data-header sortable-header ${sortBy === 'totalpicks' ? 'active-sort' : ''}`}
                  onClick={() => handleSort('totalpicks')}
                >
                  Total Times Picked
                </div>
              </div>
            </div>
            <div className="table-body-wrapper">
              <div className="table-body" onScroll={handleBodyScroll}>
                {sortedStats.map((team, index) => (
                <div key={team.name} className="table-row">
                  <div className="table-cell team-cell">
                      <div className="team-info">
                        <img 
                          src={`/images/${getTeamImageName(team.name)}.svg`}
                          alt={team.name}
                          className="team-logo"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      <span className="team-name">{team.name}</span>
                    </div>
                  </div>
                  <div className="table-cell points-won">{team.pointswon || 0}</div>
                  <div className="table-cell correct-picks">{team.correctpicks || 0}</div>
                  <div className="table-cell points-lost">{team.pointslost || 0}</div>
                  <div className="table-cell wrong-picks">{team.wrongpicks || 0}</div>
                  <div className="table-cell total-points">{team.totalpoints || 0}</div>
                  <div className="table-cell total-picks">{team.totalpicks || 0}</div>
                      </div>
              ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="no-data">
            <BarChart3 className="no-data-icon" />
            <p>No team statistics available yet.</p>
            <p>Stats will appear after games are completed and scored.</p>
          </div>
        )}
      </div>

      {teamStats.length > 0 && (
        <div className="insights-container">
          <div className="insight-card glass-container">
            <h3>Most Picked</h3>
            <div className="insight-content">
              {(() => {
                console.log('=== MOST PICKED CALCULATION DEBUG ===');
                console.log('All team stats:', teamStats);
                
                const mostPicked = teamStats.length > 0 ? teamStats.reduce((max, team, index) => {
                  const teamTotalPicks = parseFloat(team.totalpicks) || 0;
                  const maxTotalPicks = parseFloat(max.totalpicks) || 0;
                  
                  console.log(`Team ${index + 1}: ${team.name}`);
                  console.log(`  - totalpicks: ${teamTotalPicks} (type: ${typeof teamTotalPicks})`);
                  console.log(`  - current max team: ${max.name} with ${maxTotalPicks} picks (type: ${typeof maxTotalPicks})`);
                  console.log(`  - comparison: ${teamTotalPicks} > ${maxTotalPicks} = ${teamTotalPicks > maxTotalPicks}`);
                  
                  const result = teamTotalPicks > maxTotalPicks ? team : max;
                  console.log(`  - selected: ${result.name} with ${result.totalpicks} picks`);
                  console.log('---');
                  
                  return result;
                }) : null;
                
                console.log('Final most picked team:', mostPicked);
                console.log('=== END DEBUG ===');
                
                if (!mostPicked) {
                  return <div className="no-data-small">No data available</div>;
                }
                
                const totalPicks = mostPicked.totalpicks || 0;
                
                return (
                  <div className="team-highlight">
                    <img 
                      src={`/images/${getTeamImageName(mostPicked.name)}.svg`}
                      alt={mostPicked.name}
                      className="highlight-logo"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                    <div>
                      <div className="highlight-name">{mostPicked.name}</div>
                      <div className="highlight-stat">{totalPicks} total picks</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="insight-card glass-container">
            <h3>Biggest Heart Breaker</h3>
            <div className="insight-content">
              {(() => {
                const biggestHeartBreaker = teamStats.length > 0 ? teamStats.reduce((max, team) => {
                  const teamPointsLost = parseFloat(team.pointslost) || 0;
                  const maxPointsLost = parseFloat(max.pointslost) || 0;
                  return teamPointsLost > maxPointsLost ? team : max;
                }) : null;
                if (!biggestHeartBreaker) {
                  return <div className="no-data-small">No data available</div>;
                }
                
                return (
                  <div className="team-highlight">
                    <img 
                      src={`/images/${getTeamImageName(biggestHeartBreaker.name)}.svg`}
                      alt={biggestHeartBreaker.name}
                      className="highlight-logo"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                    <div>
                      <div className="highlight-name">{biggestHeartBreaker.name}</div>
                      <div className="highlight-stat">{biggestHeartBreaker.pointslost} points lost</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="insight-card glass-container">
            <h3>Most Dependable (When Picked)</h3>
            <div className="insight-content">
              {(() => {
                const filteredTeams = teamStats.filter(team => {
                  const totalPicks = (team.correctpicks || 0) + (team.wrongpicks || 0);
                  return totalPicks >= 3;
                });
                const mostDependable = filteredTeams.length > 0 ? filteredTeams.reduce((max, team) => {
                    const maxTotalPicks = (max.correctpicks || 0) + (max.wrongpicks || 0);
                    const teamTotalPicks = (team.correctpicks || 0) + (team.wrongpicks || 0);
                    const maxRate = maxTotalPicks > 0 ? (max.correctpicks || 0) / maxTotalPicks : 0;
                    const teamRate = teamTotalPicks > 0 ? (team.correctpicks || 0) / teamTotalPicks : 0;
                    return teamRate > maxRate ? team : max;
                  }) : null;
                
                if (!mostDependable || !mostDependable.name) {
                  return <div className="no-data-small">Not enough data</div>;
                }
                
                const correctPicks = mostDependable.correctpicks || 0;
                const wrongPicks = mostDependable.wrongpicks || 0;
                const totalPicks = correctPicks + wrongPicks;
                const correctRate = totalPicks > 0 ? correctPicks / totalPicks : 0;
                
                return (
                  <div className="team-highlight">
                    <img 
                      src={`/images/${getTeamImageName(mostDependable.name)}.svg`}
                      alt={mostDependable.name}
                      className="highlight-logo"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                    <div>
                      <div className="highlight-name">{mostDependable.name}</div>
                      <div className="highlight-stat">
                        <span style={{color: 'rgba(150, 255, 150, 1)'}}>{correctPicks}</span> : <span style={{color: 'rgba(255, 150, 150, 1)'}}>{wrongPicks}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <style jsx="true">{`
        .team-stats-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 1rem;
        }

        .team-stats-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .title-section {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .header-icon {
          color: rgba(100, 150, 255, 1);
          width: 32px;
          height: 32px;
        }

        .title-section h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: white;
          margin: 0;
        }

        .team-stats-header p {
          color: rgba(255, 255, 255, 0.7);
          font-size: 1.1rem;
        }

        .stats-table-container {
          margin-bottom: 2rem;
        }

        .table-container {
          background: rgba(255, 255, 255, 0.05);
          -webkit-backdrop-filter: blur(15px);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          overflow: hidden;
          width: 100%;
        }

        .table-header-container {
          background: rgba(255, 255, 255, 0.1);
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          overflow-x: auto;
          width: 100%;
          padding-right: 6px;
          border-radius: 16px 16px 0 0;
          margin-right: -6px;
          box-sizing: border-box;
        }

        .table-header-container::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }

        .table-header-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .table-header-container::-webkit-scrollbar-thumb {
          background: transparent;
        }

        .table-header-container::-webkit-scrollbar-thumb:hover {
          background: transparent;
        }

        .table-header {
          display: grid;
          grid-template-columns: minmax(300px, 2fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) 6px;
          min-width: 100%;
          width: 100%;
        }

        .header-cell {
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.4rem 0.2rem;
          font-weight: 600;
          color: rgba(150, 200, 255, 1);
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          white-space: normal;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }

        .sortable-header {
          cursor: pointer;
          user-select: none;
          transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, opacity 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .sortable-header:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .sortable-header.active-sort {
          text-decoration: underline;
          text-decoration-color: rgba(150, 200, 255, 1);
          text-decoration-thickness: 2px;
        }

        .header-cell:last-child {
          border-right: none;
        }

        .team-header {
          text-align: left !important;
          justify-content: flex-start !important;
          padding: 0.4rem 0.2rem 0.4rem 0.8rem !important;
        }

        .table-body-wrapper {
          max-height: 70vh;
          overflow: hidden;
          border-radius: 0 0 16px 16px;
        }

        .table-body {
          max-height: 70vh;
          overflow-y: auto;
          overflow-x: auto;
          width: 100%;
          border-radius: 0 0 16px 16px;
          margin-right: -6px;
          padding-right: 6px;
          box-sizing: border-box;
        }

        .table-body::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .table-body::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
          margin: 0 0 0 0;
        }

        .table-body::-webkit-scrollbar-track:horizontal {
          margin: 0 0 0 0;
        }

        .table-body::-webkit-scrollbar-thumb {
          background: rgba(200, 200, 200, 0.4);
          border-radius: 3px;
          transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, opacity 0.3s ease;
        }

        .table-body::-webkit-scrollbar-thumb:hover {
          background: rgba(200, 200, 200, 0.6);
        }

        .table-body::-webkit-scrollbar-corner {
          background: transparent;
          border-radius: 0 0 16px 0;
          margin: 0 6px 0 0;
        }

        .table-row {
          display: grid;
          grid-template-columns: minmax(300px, 2fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background-color 0.2s ease;
          cursor: default;
          min-width: 100%;
          width: 100%;
        }

        .table-row:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-cell {
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.3rem 0.1rem;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          cursor: default;
        }

        .table-cell * {
          font-size: 1rem !important;
          font-weight: 600 !important;
        }

        .table-cell {
          font-size: 1rem !important;
          font-weight: 600 !important;
        }

        .table-cell:last-child {
          border-right: none;
        }

        .team-cell {
          text-align: left !important;
          justify-content: flex-start !important;
          padding-left: 0.8rem;
        }

        .team-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .team-logo {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }

        .team-name {
          font-weight: 600;
          color: white;
        }

        .points-won {
          color: rgba(150, 255, 150, 1);
          font-weight: 600;
        }

        .correct-picks {
          color: rgba(150, 255, 150, 1);
          font-weight: 600;
        }

        .points-lost {
          color: rgba(255, 150, 150, 1);
          font-weight: 600;
        }

        .wrong-picks {
          color: rgba(255, 150, 150, 1);
          font-weight: 600;
        }

        .total-points {
          color: rgba(100, 150, 255, 1);
          font-weight: 600;
          font-size: 1rem !important;
        }

        .total-picks {
          color: rgba(100, 150, 255, 1);
          font-weight: 600;
        }

        .no-data {
          text-align: center;
          padding: 3rem 2rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .no-data-icon {
          color: rgba(100, 150, 255, 0.5);
          width: 64px;
          height: 64px;
          margin-bottom: 1rem;
        }

        .no-data p {
          margin-bottom: 0.5rem;
        }

        .insights-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        @media (min-width: 768px) {
          .insights-container {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .insight-card {
          text-align: center;
        }

        .insight-card h3 {
          color: white;
          font-size: 1.2rem;
          margin-bottom: 1rem;
        }

        .team-highlight {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
        }

        .highlight-logo {
          width: 48px;
          height: 48px;
          object-fit: contain;
        }

        .highlight-name {
          color: white;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .highlight-stat {
          color: rgba(100, 150, 255, 1);
          font-weight: 600;
          font-size: 1.2rem;
        }

        .no-data-small {
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
        }

        @media (max-width: 768px) {
          .title-section h1 {
            font-size: 2rem;
          }
          
          .team-highlight {
            flex-direction: column;
            gap: 0.5rem;
          }

          .table-header {
            grid-template-columns: minmax(200px, 1.5fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr);
          }

          .table-row {
            grid-template-columns: minmax(200px, 1.5fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr);
          }

          .header-cell,
          .table-cell {
            font-size: 0.9rem;
            padding: 0.75rem 0.25rem;
          }

          .header-cell {
            font-size: 0.9rem;
          }

          .team-cell {
            padding-left: 0.8rem;
          }
        }

        @media (max-width: 480px) {
          .table-header {
            grid-template-columns: minmax(150px, 1.2fr) minmax(60px, 0.7fr) minmax(60px, 0.7fr) minmax(60px, 0.7fr) minmax(60px, 0.7fr) minmax(60px, 0.7fr) minmax(60px, 0.7fr);
          }

          .table-row {
            grid-template-columns: minmax(150px, 1.2fr) minmax(60px, 0.7fr) minmax(60px, 0.7fr) minmax(60px, 0.7fr) minmax(60px, 0.7fr) minmax(60px, 0.7fr) minmax(60px, 0.7fr);
          }

          .header-cell,
          .table-cell {
            font-size: 0.8rem;
            padding: 0.5rem 0.2rem;
          }

          .header-cell {
            font-size: 0.8rem;
          }

          .team-cell {
            padding-left: 0.8rem;
          }

          .team-logo {
            width: 24px;
            height: 24px;
          }
        }
      `}</style>
    </div>
  );
}

export default TeamStats;