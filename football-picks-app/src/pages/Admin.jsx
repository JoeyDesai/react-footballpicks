import React, { useState, useEffect } from 'react';
import { Settings, Users, Database, CheckCircle, XCircle, Search, Play, Save, Tag, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { gameAPI, statsAPI, adminAPI } from '../services/api';
import CustomDropdown from '../components/CustomDropdown';

function Admin() {
  const { isAdmin } = useAuth();
  
  // Main state for different admin panels
  const [activePanel, setActivePanel] = useState('picks-status');
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [picksStatus, setPicksStatus] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [games, setGames] = useState([]);
  const [userPicks, setUserPicks] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [autoPickHighest, setAutoPickHighest] = useState(true);
  
  // State for tag assignment feature
  const [allTags, setAllTags] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  // Load initial data when admin access is confirmed
  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    loadWeeks();
    loadUsers();
    loadAllTags();
  }, [isAdmin]);

  // Load picks status when week changes
  useEffect(() => {
    if (selectedWeek && activePanel === 'picks-status') {
      loadPicksStatus();
    }
  }, [selectedWeek, activePanel]);

  // Load user games when entering picks for a user
  useEffect(() => {
    if (selectedUser && selectedWeek && activePanel === 'enter-picks') {
      loadUserGames();
    }
  }, [selectedUser, selectedWeek, activePanel]);

  // Load available weeks and auto-select current week
  const loadWeeks = async () => {
    try {
      const response = await gameAPI.getWeeks();
      setWeeks(response.data.weeks || []);
      if (response.data.weeks && response.data.weeks.length > 0) {
        // Find the current week (not future, not completed)
        const currentWeek = response.data.weeks.find(week => !week.future && !week.completed);
        if (currentWeek) {
          setSelectedWeek(currentWeek.id);
        } else {
          // Fallback to first week if no current week found
          setSelectedWeek(response.data.weeks[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading weeks:', error);
      setError('Failed to load weeks');
    }
  };

  // Load all users and sort them alphabetically
  const loadUsers = async () => {
    try {
      const response = await adminAPI.getUsers();
      const sortedUsers = response.data.users.sort((a, b) => {
        // Sort by nickname first, then realname, then email
        const aName = (a.nickname || a.realname || a.email || '').toLowerCase();
        const bName = (b.nickname || b.realname || b.email || '').toLowerCase();
        return aName.localeCompare(bName);
      });
      setUsers(sortedUsers);
      setFilteredUsers(sortedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load users');
    }
  };

  // Load all available tags for assignment
  const loadAllTags = async () => {
    try {
      const response = await adminAPI.getAllTags();
      setAllTags(response.data.tags || []);
    } catch (error) {
      console.error('Error loading tags:', error);
      setError('Failed to load tags');
    }
  };

  // Load tags assigned to a specific user
  const loadUserTags = async (userId) => {
    try {
      const response = await adminAPI.getUserTags(userId);
      const userTagIds = response.data.tags.map(tag => tag.id);
      setUserTags(response.data.tags);
      setSelectedTags(userTagIds);
    } catch (error) {
      console.error('Error loading user tags:', error);
      setError('Failed to load user tags');
    }
  };

  // Load picks status for all users in selected week
  const loadPicksStatus = async () => {
    if (!selectedWeek) return;
    
    setLoading(true);
    try {
      const response = await adminAPI.getPicksStatus(selectedWeek);
      setPicksStatus(response.data.picksStatus || []);
    } catch (error) {
      console.error('Error loading picks status:', error);
      setError('Failed to load picks status');
    } finally {
      setLoading(false);
    }
  };

  // Load games and existing picks for a specific user
  const loadUserGames = async () => {
    if (!selectedUser || !selectedWeek) return;
    
    setLoading(true);
    try {
      const response = await gameAPI.getGames(selectedWeek);
      setGames(response.data.games || []);
      
      // Load user's existing picks
      const picksResponse = await adminAPI.getUserPicks(selectedUser.id, selectedWeek);
      const picksData = {};
      if (picksResponse.data.picks) {
        picksResponse.data.picks.forEach(pick => {
          picksData[`GAME${pick.game}`] = pick.guess;
          picksData[`VAL${pick.game}`] = pick.weight;
        });
      }
      setUserPicks(picksData);
    } catch (error) {
      console.error('Error loading user games:', error);
      setError('Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  // Handle user search and filtering
  const handleUserSearch = (searchTerm) => {
    setUserSearch(searchTerm);
    setShowUserDropdown(true);
    
    if (!users || !Array.isArray(users)) {
      setFilteredUsers([]);
      return;
    }
    
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }
    
    const filtered = users.filter(user => 
      (user.nickname && user.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.realname && user.realname.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    setFilteredUsers(filtered);
  };

  // Handle user selection from dropdown
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setUserSearch(user.nickname || user.realname || user.email || '');
    setShowUserDropdown(false);
    
    // Load user tags when user is selected in assign tags mode
    if (activePanel === 'assign-tags') {
      loadUserTags(user.id);
    }
  };

  // Show dropdown when search input is focused
  const handleUserSearchFocus = () => {
    setShowUserDropdown(true);
  };

  // Hide dropdown with delay to allow click events
  const handleUserSearchBlur = () => {
    // Delay hiding dropdown to allow for click events
    setTimeout(() => setShowUserDropdown(false), 200);
  };

  // Handle team pick selection with auto-point assignment
  const handlePickChange = (gameId, team) => {
    const newPicks = {
      ...userPicks,
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

    setUserPicks(newPicks);
  };

  // Handle point value changes for picks
  const handleValueChange = (gameId, value) => {
    setUserPicks(prev => ({
      ...prev,
      [`VAL${gameId}`]: parseInt(value)
    }));
  };

  // Toggle auto-pick highest points feature
  const handleAutoPickToggle = () => {
    setAutoPickHighest(!autoPickHighest);
  };

  // Save user picks to database
  const saveUserPicks = async () => {
    if (!selectedUser || !selectedWeek) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await adminAPI.submitUserPicks(selectedUser.id, selectedWeek, userPicks);
      if (response.data.success) {
        setSuccess('Picks saved successfully');
      } else {
        setError(response.data.error || 'Failed to save picks');
      }
    } catch (error) {
      console.error('Error saving picks:', error);
      setError('Failed to save picks');
    } finally {
      setLoading(false);
    }
  };

  // Run individual update script
  const runUpdateScript = async (scriptType) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await adminAPI.runScript(scriptType);
      if (response.data.success) {
        setSuccess(response.data.message || `${scriptType} script executed successfully`);
      } else {
        setError(response.data.error || `Failed to run ${scriptType} script`);
      }
    } catch (error) {
      console.error(`Error running ${scriptType} script:`, error);
      setError(`Failed to run ${scriptType} script`);
    } finally {
      setLoading(false);
    }
  };

  // Run all update scripts in sequence
  const runAllUpdateScripts = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const scripts = ['individualRecords', 'losers', 'teamRecords'];
      let allSuccess = true;
      let errorMessage = '';

      for (const script of scripts) {
        try {
          const response = await adminAPI.runScript(script);
          if (response.data.success) {
            console.log(`${script} script completed:`, response.data.message);
          } else {
            console.error(`Error running ${script} script:`, response.data.error);
            allSuccess = false;
            errorMessage += `${script} failed; `;
          }
        } catch (error) {
          console.error(`Error running ${script} script:`, error);
          allSuccess = false;
          errorMessage += `${script} failed; `;
        }
      }

      if (allSuccess) {
        setSuccess('All update scripts executed successfully');
      } else {
        setError(`Some scripts failed: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error running update scripts:', error);
      setError('Failed to run update scripts');
    } finally {
      setLoading(false);
    }
  };

  // Toggle tag selection for user
  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  // Save user tag assignments
  const saveUserTags = async () => {
    if (!selectedUser) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await adminAPI.updateUserTags(selectedUser.id, selectedTags);
      if (response.data.success) {
        setSuccess('User tags updated successfully');
        // Reload user tags to reflect changes
        loadUserTags(selectedUser.id);
      } else {
        setError(response.data.error || 'Failed to save user tags');
      }
    } catch (error) {
      console.error('Error saving user tags:', error);
      setError('Failed to save user tags');
    } finally {
      setLoading(false);
    }
  };

  // Week dropdown options with the current week annotated, matching WeeklyStandings
  const weekOptions = (Array.isArray(weeks) ? weeks : []).map(week => ({
    value: week.id,
    label: !week.future && !week.completed ? `Week ${week.number} (Current)` : `Week ${week.number}`
  }));

  // Render picks status panel
  const renderPicksStatus = () => (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>Picks Status</h2>
        <div className="week-selector">
          <label htmlFor="week-select">Week</label>
          <CustomDropdown
            options={weekOptions}
            value={selectedWeek}
            onChange={setSelectedWeek}
            placeholder="Select Week"
          />
        </div>
      </div>
      
      <div className="picks-status-content">
        {loading ? (
          <div className="loading-spinner"></div>
        ) : (
          <div className="picks-status-list">
            {picksStatus && picksStatus.length > 0 ? (
              picksStatus.map((user, index) => (
                <div key={index} className="picks-status-item">
                  <span className="user-name">{user.name}</span>
                  <div className="status-indicator">
                    {user.hasPicks ? (
                      <CheckCircle className="status-icon success" size={16} />
                    ) : (
                      <XCircle className="status-icon error" size={16} />
                    )}
                    <span className="status-text">
                      {user.hasPicks ? 'Picks Entered' : 'No Picks'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data">
                <p>No picks status data available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render enter picks panel
  const renderEnterPicks = () => (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>Enter Picks for User</h2>
        <div className="user-search-container">
          <div className="user-dropdown-wrapper">
            <div className="search-input">
              <Search className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => handleUserSearch(e.target.value)}
                onFocus={handleUserSearchFocus}
                onBlur={handleUserSearchBlur}
              />
            </div>
            {showUserDropdown && (
              <div className="user-dropdown">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="user-dropdown-item"
                      onClick={() => handleUserSelect(user)}
                    >
                      <div className="user-info">
                        <div className="user-name">
                          {user.nickname || user.realname || 'No Name'}
                        </div>
                        {user.realname && user.nickname && (
                          <div className="user-realname">{user.realname}</div>
                        )}
                        <div className="user-email">{user.email}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="user-dropdown-item no-users">
                    <div className="user-info">
                      <div className="user-name">No users found</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {selectedUser ? (
        <div className="user-picks-interface">
          <div className="selected-user-info">
            <h3>Making picks for: {selectedUser.nickname || selectedUser.realname || selectedUser.email}</h3>
            <div className="week-selector">
              <label htmlFor="week-select">Week</label>
              <CustomDropdown
                options={weekOptions}
                value={selectedWeek}
                onChange={setSelectedWeek}
                placeholder="Select Week"
              />
            </div>
          </div>
          
          <div className="games-container glass-container">
            <div className="main-panel-header">
              <div className="header-row">
                <h2>Week {selectedWeek ? weeks.find(w => w.id === selectedWeek)?.number : ''}</h2>
                <button
                  type="button"
                  className={`auto-pick-button ${autoPickHighest ? 'active' : ''}`}
                  onClick={handleAutoPickToggle}
                >
                  <Zap size={16} />
                  Auto Pick Highest Points
                </button>
              </div>
            </div>
            
            <div className="games-spacing"></div>
            
            {loading ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="classic-games-list">
                {games && games.length > 0 ? games.map((game) => (
                  <div key={game.id} className="classic-game-row">
                    <div className="game-row-main">
                      {/* Away Team Info */}
                      <div className="team-info-section away-team">
                        <div className="team-logo-section mobile-logo">
                          <img 
                            src={`/images/${game.away_name.toLowerCase()}.svg`}
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
                          src={`/images/${game.away_name.toLowerCase()}.svg`}
                          alt={game.away_name}
                          className="team-logo-large"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      </div>

                      {/* Away Team Radio Button */}
                      <div className="radio-section">
                        <label className="custom-radio">
                          <input
                            type="radio"
                            name={`GAME${game.id}`}
                            value={game.away_id}
                            checked={userPicks[`GAME${game.id}`] == game.away_id}
                            onChange={() => handlePickChange(game.id, game.away_id)}
                          />
                          <span className="radio-mark"></span>
                        </label>
                      </div>

                      {/* VS Divider */}
                      <div className="vs-divider">@</div>

                      {/* Home Team Radio Button */}
                      <div className="radio-section">
                        <label className="custom-radio">
                          <input
                            type="radio"
                            name={`GAME${game.id}`}
                            value={game.home_id}
                            checked={userPicks[`GAME${game.id}`] == game.home_id}
                            onChange={() => handlePickChange(game.id, game.home_id)}
                          />
                          <span className="radio-mark"></span>
                        </label>
                      </div>

                      {/* Home Team Logo */}
                      <div className="team-logo-section">
                        <img 
                          src={`/images/${game.home_name.toLowerCase()}.svg`}
                          alt={game.home_name}
                          className="team-logo-large"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      </div>

                      {/* Home Team Info */}
                      <div className="team-info-section home-team">
                        <div className="team-logo-section mobile-logo">
                          <img 
                            src={`/images/${game.home_name.toLowerCase()}.svg`}
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
                      <CustomDropdown
                        options={[
                          { value: 0, label: 'Select Points' },
                          ...Array.from({ length: games.length }, (_, i) => ({
                            value: i + 1,
                            label: (i + 1).toString()
                          }))
                        ]}
                        value={userPicks[`VAL${game.id}`] || 0}
                        onChange={(value) => handleValueChange(game.id, value)}
                        placeholder="Points"
                      />
                    </div>
                  </div>
                )) : (
                  <div className="no-data">
                    <p>No games available for this week</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="submit-section">
              <button 
                className="glass-button primary"
                onClick={saveUserPicks}
                disabled={loading}
              >
                <Save size={20} />
                {loading ? 'Saving...' : 'Save Picks'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-user-selected">
          <p>Search and select a user to make picks for them</p>
        </div>
      )}
    </div>
  );

  // Render update scripts panel
  const renderUpdateScripts = () => (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>Update Scripts</h2>
        <p>Run database update scripts</p>
      </div>
      
      <div className="update-scripts-content">
        <div className="script-buttons">
          <button 
            className="script-button"
            onClick={() => runUpdateScript('nflScores')}
            disabled={loading}
          >
            <Database className="script-icon" size={20} />
            Update NFL Scores
          </button>
          
          <button 
            className="script-button"
            onClick={runAllUpdateScripts}
            disabled={loading}
          >
            <Database className="script-icon" size={20} />
            Run All Update Scripts
          </button>
        </div>
      </div>
    </div>
  );

  // Render assign tags panel
  const renderAssignTags = () => (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>Assign Tags to User</h2>
        <div className="user-search-container">
          <div className="user-dropdown-wrapper">
            <div className="search-input">
              <Search className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => handleUserSearch(e.target.value)}
                onFocus={handleUserSearchFocus}
                onBlur={handleUserSearchBlur}
              />
            </div>
            {showUserDropdown && (
              <div className="user-dropdown">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="user-dropdown-item"
                      onClick={() => handleUserSelect(user)}
                    >
                      <div className="user-info">
                        <div className="user-name">
                          {user.nickname || user.realname || 'No Name'}
                        </div>
                        {user.realname && user.nickname && (
                          <div className="user-realname">{user.realname}</div>
                        )}
                        <div className="user-email">{user.email}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="user-dropdown-item no-users">
                    <div className="user-info">
                      <div className="user-name">No users found</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {selectedUser ? (
        <div className="assign-tags-interface">
          <div className="selected-user-info">
            <h3>Assigning tags to: {selectedUser.nickname || selectedUser.realname || selectedUser.email}</h3>
          </div>
          
          <div className="tags-container glass-container">
            <div className="tags-header">
              <h4>Available Tags</h4>
              <p>Select the tags you want to assign to this user</p>
            </div>
            
            {loading ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="tags-list">
                {allTags.length > 0 ? (
                  allTags.map((tag) => (
                    <div key={tag.id} className="tag-item">
                      <label className="tag-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag.id)}
                          onChange={() => handleTagToggle(tag.id)}
                        />
                        <span className="checkbox-mark"></span>
                        <span className="tag-name">{tag.name}</span>
                      </label>
                    </div>
                  ))
                ) : (
                  <div className="no-data">
                    <p>No tags available</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="submit-section">
              <button 
                className="glass-button primary"
                onClick={saveUserTags}
                disabled={loading}
              >
                <Save size={20} />
                {loading ? 'Saving...' : 'Save Tags'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-user-selected">
          <p>Search and select a user to assign tags to them</p>
        </div>
      )}
    </div>
  );

  // Check admin access
  if (!isAdmin) {
    return (
      <div className="admin-container">
        <div className="admin-access-denied">
          <h1>Access Denied</h1>
          <p>You do not have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  // Main admin panel layout
  return (
    <div className="admin-container">
      <div className="admin-navigation glass-container">
        <div className="admin-header">
          <h1>Admin Panel</h1>
          <p>Manage picks and run system updates</p>
        </div>
        
        <div className="admin-nav-buttons">
          <button 
            className={`admin-nav-button ${activePanel === 'picks-status' ? 'active' : ''}`}
            onClick={() => {
              setActivePanel('picks-status');
              setSuccess('');
              setError('');
            }}
          >
            <CheckCircle size={20} />
            Picks Status
          </button>
          
          <button 
            className={`admin-nav-button ${activePanel === 'enter-picks' ? 'active' : ''}`}
            onClick={() => {
              setActivePanel('enter-picks');
              setSuccess('');
              setError('');
            }}
          >
            <Users size={20} />
            Enter Picks
          </button>
          
          <button 
            className={`admin-nav-button ${activePanel === 'update-scripts' ? 'active' : ''}`}
            onClick={() => {
              setActivePanel('update-scripts');
              setSuccess('');
              setError('');
            }}
          >
            <Database size={20} />
            Update Scripts
          </button>
          
          <button 
            className={`admin-nav-button ${activePanel === 'assign-tags' ? 'active' : ''}`}
            onClick={() => {
              setActivePanel('assign-tags');
              setSuccess('');
              setError('');
            }}
          >
            <Tag size={20} />
            Assign Tags
          </button>
        </div>
      </div>

      <div className="admin-content glass-container">
        {/* Display error and success messages */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        {/* Render active panel based on selection */}
        {activePanel === 'picks-status' && renderPicksStatus()}
        {activePanel === 'enter-picks' && renderEnterPicks()}
        {activePanel === 'update-scripts' && renderUpdateScripts()}
        {activePanel === 'assign-tags' && renderAssignTags()}
      </div>
      
      <style jsx="true">{`
        /* Custom Radio Button Styling */
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
          transition: transform 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, opacity 0.3s ease;
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
        
        /* Week Selector (matches WeeklyStandings/MakePicks) */
        .week-selector {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .week-selector label {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 600;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .week-selector .custom-dropdown {
          width: 180px;
        }

        /* Spacing between week title and games */
        .games-spacing {
          height: 2rem;
        }

        /* Header Row Layout */
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

        /* Auto Pick Button */
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
      `}</style>
    </div>
  );
}

export default Admin;