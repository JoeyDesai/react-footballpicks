import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Calendar, TrendingUp, BarChart3, HelpCircle, QrCode, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { statsAPI, gameAPI } from '../services/api';
import { sanitizeString, sanitizeUserData, getSafeDisplayName } from '../utils/sanitize';

function Home() {
  const { user } = useAuth();
  
  // State for standings and week data
  const [weeklyStandings, setWeeklyStandings] = useState([]);
  const [overallStandings, setOverallStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [nextWeek, setNextWeek] = useState(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showInstallApp, setShowInstallApp] = useState(false);

  // Load initial data on component mount
  useEffect(() => {
    loadHomeData();
  }, []);

  // Countdown timer to first game of next week
  useEffect(() => {
    const updateCountdown = async () => {
      try {
        // Get the next week's games to find the first game time
        if (nextWeek) {
          const gamesResponse = await gameAPI.getGames(nextWeek.id);
          
          if (gamesResponse.data.success && gamesResponse.data.games.length > 0) {
            // Find the earliest game time
            const games = gamesResponse.data.games;
            const now = new Date();
            let earliestGameTime = null;
            
            // Find the first game that hasn't started yet
            for (const game of games) {
              if (game.date) {
                const gameTime = new Date(game.date);
                if (gameTime > now && (!earliestGameTime || gameTime < earliestGameTime)) {
                  earliestGameTime = gameTime;
                }
              }
            }
            
            if (earliestGameTime) {
              const timeDiff = earliestGameTime.getTime() - now.getTime();
              
              console.log('Countdown update:', { now, earliestGameTime, timeDiff });
              
              if (timeDiff > 0) {
                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                
                console.log('Setting countdown:', { days, hours, minutes });
                setCountdown({ days, hours, minutes });
              } else {
                setCountdown({ days: 0, hours: 0, minutes: 0 });
              }
            } else {
              // No upcoming games found, fallback to next Thursday at 8pm
              const nextThursday = new Date();
              const daysUntilThursday = (4 - now.getDay() + 7) % 7;
              nextThursday.setDate(now.getDate() + (daysUntilThursday === 0 ? 7 : daysUntilThursday));
              nextThursday.setHours(20, 0, 0, 0);
              
              const timeDiff = nextThursday.getTime() - now.getTime();
              if (timeDiff > 0) {
                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                setCountdown({ days, hours, minutes });
              } else {
                setCountdown({ days: 0, hours: 0, minutes: 0 });
              }
            }
          } else {
            // No games available, fallback to next Thursday at 8pm
            const now = new Date();
            const nextThursday = new Date();
            const daysUntilThursday = (4 - now.getDay() + 7) % 7;
            nextThursday.setDate(now.getDate() + (daysUntilThursday === 0 ? 7 : daysUntilThursday));
            nextThursday.setHours(20, 0, 0, 0);
            
            const timeDiff = nextThursday.getTime() - now.getTime();
            if (timeDiff > 0) {
              const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
              const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
              setCountdown({ days, hours, minutes });
            } else {
              setCountdown({ days: 0, hours: 0, minutes: 0 });
            }
          }
        }
      } catch (error) {
        console.error('Error updating countdown:', error);
        // Fallback to next Thursday at 8pm on error
        const now = new Date();
        const nextThursday = new Date();
        const daysUntilThursday = (4 - now.getDay() + 7) % 7;
        nextThursday.setDate(now.getDate() + (daysUntilThursday === 0 ? 7 : daysUntilThursday));
        nextThursday.setHours(20, 0, 0, 0);
        
        const timeDiff = nextThursday.getTime() - now.getTime();
        if (timeDiff > 0) {
          const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          setCountdown({ days, hours, minutes });
        } else {
          setCountdown({ days: 0, hours: 0, minutes: 0 });
        }
      }
    };

    // Update immediately
    updateCountdown();
    
    // Update every minute
    const interval = setInterval(updateCountdown, 60000);
    
    return () => clearInterval(interval);
  }, [nextWeek]); // Add nextWeek as dependency

  // Fix mobile scroll position on mount
  useEffect(() => {
    // Ensure page starts at top on mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     window.innerWidth <= 768 || 
                     ('ontouchstart' in window);
    
    if (isMobile) {
      // Force scroll to top immediately
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
      // Also set on window load to handle any delayed rendering
      const handleLoad = () => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };
      
      window.addEventListener('load', handleLoad);
      
      // Cleanup
      return () => {
        window.removeEventListener('load', handleLoad);
      };
    }
  }, []);

  // Format numbers for display (remove decimals if whole number)
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    const numValue = parseFloat(num);
    return numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(1);
  };

  // Load all home page data
  const loadHomeData = async () => {
    try {
      setLoading(true);
      
      // Load weekly standings, overall standings, and weeks data
      const [weeklyResponse, overallResponse, weeksResponse] = await Promise.all([
        statsAPI.getHomeStats(), // This will get current week standings
        statsAPI.getOverallStandings(),
        statsAPI.getWeeks()
      ]);

      if (weeklyResponse.data.success) {
        // Sanitize weekly standings data
        const sanitizedWeekly = weeklyResponse.data.weeklyStandings.slice(0, 5).map(player => ({
          ...player,
          nickname: sanitizeString(player.nickname || ''),
          realName: sanitizeString(player.realName || ''),
          name: sanitizeString(player.name || '')
        }));
        setWeeklyStandings(sanitizedWeekly);
        setCurrentWeek(weeklyResponse.data.currentWeek);
      }

      if (overallResponse.data.success) {
        // Sanitize overall standings data
        const sanitizedOverall = overallResponse.data.standings.slice(0, 5).map(player => ({
          ...player,
          nickname: sanitizeString(player.nickname || ''),
          realName: sanitizeString(player.realName || ''),
          name: sanitizeString(player.name || '')
        }));
        setOverallStandings(sanitizedOverall);
      }

      if (weeksResponse.data.success) {
        // Find the next week for making picks
        const weeks = weeksResponse.data.weeks;
        const completedWeeks = weeks.filter(w => w.completed);
        const currentWeek = completedWeeks[completedWeeks.length - 1];

        // Week after the last started week; pre-season (index -1 + 1) gives weeks[0]
        const currentIndex = currentWeek ? weeks.findIndex(w => w.id === currentWeek.id) : -1;
        setNextWeek(weeks[currentIndex + 1] || currentWeek);
      }
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while data loads
  if (loading) {
    return (
      <div className="home-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Main home page layout
  return (
    <div className="home-container">
      <div className="welcome-section glass-container">
        <h1>Welcome back, {getSafeDisplayName(user)}!</h1>
        <p>
          You have <strong>{countdown.days}</strong> <strong>{countdown.days === 1 ? 'day' : 'days'}</strong><strong>,</strong> <strong>{countdown.hours}</strong> <strong>{countdown.hours === 1 ? 'hour' : 'hours'}</strong><strong>,</strong> and{' '}
          <strong>{countdown.minutes}</strong> <strong>{countdown.minutes === 1 ? 'minute' : 'minutes'}</strong> to do your picks.
        </p>
        <Link to="/make-picks" className="auto-pick-button">
          Enter Week {nextWeek?.number || 'X'} Picks
        </Link>
      </div>

      <div className="stats-grid">
        {/* Weekly standings preview */}
        <div className="stats-card glass-container">
          <div className="stats-header">
            <Calendar className="stats-icon" />
            <h2>
              <Link to="/weekly-standings" className="stats-title-link">
                Week {currentWeek?.number || 'Current'} Standings
              </Link>
            </h2>
          </div>
          
          {weeklyStandings.length > 0 ? (
            <div className="stats-table-container">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyStandings.map((player, index) => (
                    <tr 
                      key={player.id} 
                      className={player.id === user?.id ? 'current-user' : ''}
                    >
                      <td>{index + 1}</td>
                      <td>{sanitizeString(player.nickname)}</td>
                      <td>{formatNumber(player.score)} ({formatNumber(player.numright)})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="view-all-link">
                <Link to="/weekly-standings" className="glass-button secondary">
                  View Weekly Standings
                </Link>
              </div>
            </div>
          ) : (
            <p className="no-data">No weekly data available yet.</p>
          )}
        </div>

        {/* Overall standings preview */}
        <div className="stats-card glass-container">
          <div className="stats-header">
            <Trophy className="stats-icon" />
            <h2>
              <Link to="/overall-standings" className="stats-title-link">
                Overall Standings
              </Link>
            </h2>
          </div>
          
          {overallStandings.length > 0 ? (
            <div className="stats-table-container">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Total Score</th>
                  </tr>
                </thead>
                <tbody>
                  {overallStandings.map((player, index) => (
                    <tr 
                      key={player.id} 
                      className={player.id === user?.id ? 'current-user' : ''}
                    >
                      <td>{index + 1}</td>
                      <td>{sanitizeString(player.nickname)}</td>
                      <td>{formatNumber(player.score)} ({formatNumber(player.numright)})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="view-all-link">
                <Link to="/overall-standings" className="glass-button secondary">
                  View Overall Standings
                </Link>
              </div>
            </div>
          ) : (
            <p className="no-data">No overall data available yet.</p>
          )}
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="quick-actions glass-container">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
          <Link to="/make-picks" className="auto-pick-button">
            <TrendingUp size={20} />
            Make Picks
          </Link>
          <Link to="/team-stats" className="glass-button secondary">
            <BarChart3 size={20} />
            Team Stats
          </Link>
          <button 
            className="glass-button secondary" 
            onClick={() => setShowHowToPlay(true)}
          >
            <HelpCircle size={20} />
            How to Play
          </button>
          <button 
            className="glass-button secondary" 
            onClick={() => setShowInstallApp(true)}
          >
            <QrCode size={20} />
            Install App
          </button>
        </div>
      </div>

      {/* How to play popup modal */}
      {showHowToPlay && (
        <div className="popup-overlay" onClick={() => setShowHowToPlay(false)}>
          <div className="popup-content glass-container" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h2>How to Play</h2>
              <button 
                className="popup-close" 
                onClick={() => setShowHowToPlay(false)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="popup-body">
              <div className="instruction-section">
                <h3 className="checkbox-heading">
                  <span className="checkbox-icon">☑</span>
                  <span className="checkbox-text">Making Your Picks</span>
                </h3>
                <p>Each week, you'll pick the winners of NFL games and assign point values to each pick.</p>
                <ul>
                  <li><strong>Higher point values</strong> = More confidence in your pick</li>
                  <li><strong>Lower point values</strong> = Less confidence</li>
                  <li>You can only use each point value once per week</li>
                  <li>Use the "Auto Pick Highest Points" feature to automatically assign the highest available points</li>
                  <li><strong>Deadline:</strong> Picks are due before the first game of the week, which is typically Thursday night</li>
                </ul>
              </div>
              
              <div className="instruction-section">
                <h3>🏅 Scoring System</h3>
                <p>Your score is calculated based on your correct picks and their point values:</p>
                <ul>
                  <li><strong>Correct pick</strong> = You earn the points you assigned</li>
                  <li><strong>Wrong pick</strong> = You lose the points you assigned</li>
                  <li>Your total score is the sum of all your point values for correct picks</li>
                </ul>
              </div>

              <div className="instruction-section">
                <h3>🏆 Competition</h3>
                <p>Compete with other players to see who can make the best predictions:</p>
                <ul>
                  <li>Check <strong>Weekly Standings</strong> to see how you rank this week</li>
                  <li>Check <strong>Overall Standings</strong> to see your season-long performance</li>
                  <li>View <strong>Team Stats</strong> to see which teams are most/least picked</li>
                </ul>
              </div>

              <div className="instruction-section">
                <h3>💡 Pro Tips</h3>
                <ul>
                  <li>Pick early - don't wait until the last minute</li>
                  <li>Consider the point spread when making your picks</li>
                  <li>Check the standings regularly to see how you're doing</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Install app popup modal */}
      {showInstallApp && (
        <div className="popup-overlay" onClick={() => setShowInstallApp(false)}>
          <div className="popup-content glass-container" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h2>Install Football Picks App</h2>
              <button 
                className="popup-close" 
                onClick={() => setShowInstallApp(false)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="popup-body">
              <div className="instruction-section">
                <h3 className="platform-heading">
                  <img src="/images/apple.svg" alt="Apple" className="platform-icon" />
                  <span>For iPhone (iOS)</span>
                </h3>
                <ol>
                  <li>Open this website in <strong>Safari</strong> (not Chrome)</li>
                  <li>Tap the <strong>three dots menu</strong> in the bottom right</li>
                  <li>Tap the <strong>Share</strong> button</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                  <li>Tap <strong>"Add"</strong> to confirm</li>
                  <li>The app icon will appear on your home screen!</li>
                </ol>
              </div>
              
              <div className="instruction-section">
                <h3 className="platform-heading">
                  <img src="/images/android.svg" alt="Android" className="platform-icon" />
                  <span>For Android</span>
                </h3>
                <ol>
                  <li>Open this website in <strong>Chrome</strong></li>
                  <li>Tap the <strong>three dots menu</strong> in the top right</li>
                  <li>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></li>
                  <li>Tap <strong>"Add"</strong> or <strong>"Install"</strong> to confirm</li>
                  <li>The app icon will appear on your home screen!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx="true">{`
        .home-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem;
        }

        .welcome-section {
          text-align: center;
          margin-bottom: 2rem;
        }

        .welcome-section h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #ffffff, #a0c4ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .welcome-section p {
          font-size: 1.2rem;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 2rem;
        }

        .welcome-section p strong {
          color: rgba(150, 200, 255, 1);
          font-weight: 700;
          font-size: 1.3rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        @media (min-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .stats-card {
          height: fit-content;
        }

        .stats-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .stats-icon {
          color: rgba(100, 150, 255, 1);
          width: 24px;
          height: 24px;
        }

        .stats-title-link {
          color: white;
          text-decoration: none;
          font-size: 1.5rem;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .stats-title-link:hover {
          color: rgba(150, 200, 255, 1);
        }

        .stats-table-container {
          overflow-x: auto;
        }

        .glass-table {
          font-size: 0.9rem;
        }

        .glass-table th {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .glass-table th:first-child {
          border-top-left-radius: 16px;
        }

        .glass-table th:last-child {
          border-top-right-radius: 16px;
        }

        .glass-table th,
        .glass-table td {
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }

        .glass-table th:last-child,
        .glass-table td:last-child {
          border-right: none;
        }

        .view-all-link {
          margin-top: 1rem;
          text-align: center;
        }

        .no-data {
          color: rgba(255, 255, 255, 0.6);
          text-align: center;
          padding: 2rem;
          font-style: italic;
        }

        .quick-actions {
          text-align: center;
        }

        .quick-actions h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          color: white;
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .action-buttons .glass-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 200px;
          width: 200px;
          justify-content: center;
        }

        .auto-pick-button {
          background: linear-gradient(135deg, rgba(100, 150, 255, 0.3), rgba(150, 200, 255, 0.2));
          backdrop-filter: blur(20px);
          border: 1px solid rgba(100, 150, 255, 0.4);
          border-radius: 12px;
          padding: 1rem 2rem;
          color: white;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          text-align: center;
          box-shadow: 
            0 4px 16px rgba(100, 150, 255, 0.2),
            0 0 20px rgba(100, 150, 255, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .auto-pick-button:hover {
          background: linear-gradient(135deg, rgba(100, 150, 255, 0.4), rgba(150, 200, 255, 0.3));
          border-color: rgba(100, 150, 255, 0.6);
          color: white;
          transform: translateY(-2px);
          box-shadow: 
            0 8px 25px rgba(100, 150, 255, 0.4),
            0 0 30px rgba(100, 150, 255, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        .action-buttons .auto-pick-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 200px;
          width: 200px;
          justify-content: center;
          margin: 0;
          padding: 1rem 2rem; /* Match the base auto-pick-button padding */
        }

        /* Popup Styles */
        .popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .popup-content {
          max-width: 600px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }

        .popup-content:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        /* Custom scrollbar for popup */
        .popup-content::-webkit-scrollbar {
          width: 8px;
        }

        .popup-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          margin: 20px 0;
        }

        .popup-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          transition: all 0.2s ease;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .popup-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .popup-content::-webkit-scrollbar-corner {
          background: transparent;
        }

        .popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .popup-header h2 {
          margin: 0;
          color: white;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .popup-close {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 12px;
          transition: all 0.3s ease;
          box-shadow: 
            0 4px 16px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
        }

        .popup-close:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
          color: white;
          box-shadow: 
            0 6px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .popup-body {
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.6;
        }

        .instruction-section {
          margin-bottom: 2rem;
        }

        .instruction-section h3 {
          color: white;
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .instruction-section h3 {
          filter: grayscale(100%) brightness(0) invert(1);
        }

        .instruction-section h3:has-text("🏅") {
          filter: none;
        }

        .checkbox-heading {
          filter: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .checkbox-icon {
          font-size: 1.8rem !important;
        }

        .checkbox-text {
          font-size: 1.2rem;
          font-weight: 600;
        }

        .platform-heading {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .platform-icon {
          width: 24px;
          height: 24px;
          filter: brightness(0) invert(1);
        }

        .instruction-section p {
          margin-bottom: 1rem;
          color: rgba(255, 255, 255, 0.8);
        }

        .instruction-section ul,
        .instruction-section ol {
          margin-left: 1.5rem;
          margin-bottom: 1rem;
        }

        .instruction-section li {
          margin-bottom: 0.5rem;
          color: rgba(255, 255, 255, 0.8);
        }

        .instruction-section strong {
          color: rgba(150, 200, 255, 1);
          font-weight: 600;
        }


        @media (max-width: 768px) {
          .welcome-section h1 {
            font-size: 2rem;
          }
          
          .stats-grid {
            gap: 1rem;
          }
          
          .action-buttons {
            flex-direction: column;
            align-items: center;
          }

          /* Ensure buttons are visible and properly sized on mobile */
          .auto-pick-button {
            display: inline-block !important;
            width: 100%;
            max-width: 300px;
            margin: 0.5rem 0;
            padding: 1rem 1.5rem;
            font-size: 1.1rem;
          }

          .action-buttons .auto-pick-button {
            display: flex !important;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            min-width: 200px;
            width: 200px;
            margin: 0 !important;
            padding: 1rem 1.5rem !important; /* Match the mobile auto-pick-button padding */
          }
        }
      `}</style>
    </div>
  );
}

export default Home;