// Configuration file for Football Picks App

const config = {
  // Backend server configuration
  backend: {
    // Local development URL
    localUrl: 'http://localhost:3001',
    // Production/server URL - UPDATE THIS FOR DEPLOYMENT
    serverUrl: 'https://fpapi.jasetheace.com',
    // Port number for error messages
    port: 443
  },

  // Admin user configuration
  admin: {
    // Admin email addresses
    adminEmails: ['jase@jasetheace.com', 'joe']
  },

  // API endpoints
  api: {
    // Authentication endpoints
    auth: {
      login: '/api/login',
      logout: '/api/logout',
      createAccount: '/api/create-account',
      checkSession: '/api/check-session',
      getUserTags: '/api/user-tags'
    },
    
    // Game endpoints
    game: {
      getWeeks: '/api/weeks',
      getGames: (weekId) => `/api/games/${weekId}`,
      getPicks: (weekId) => `/api/picks/${weekId}`,
      submitPicks: (weekId) => `/api/picks/${weekId}`
    },
    
    // Statistics endpoints
    stats: {
      getWeeklyStandings: (weekId, tag = 0) => `/api/weekly-standings/${weekId}?tag=${tag}`,
      getWeeklyStandingsDetailed: (weekId, tag = 0) => `/api/weekly-standings-detailed/${weekId}?tag=${tag}`,
      getWeeklyStandingsClassic: (weekId, tag = 0) => `/api/weekly-standings-classic/${weekId}?tag=${tag}`,
      getOverallStandings: (tag = 0) => `/api/overall-standings?tag=${tag}`,
      getOverallStandingsDetailed: (tag = 0) => `/api/overall-standings-detailed?tag=${tag}`,
      getTeamStats: '/api/team-stats',
      getHomeStats: '/api/home-stats',
      getWeeks: '/api/weeks'
    },
    
    // Admin endpoints
    admin: {
      getUsers: '/api/admin/users',
      getPicksStatus: (weekId) => `/api/admin/picks-status/${weekId}`,
      getUserPicks: (userId, weekId) => `/api/admin/user-picks/${userId}/${weekId}`,
      submitUserPicks: (userId, weekId) => `/api/admin/user-picks/${userId}/${weekId}`,
      runScript: '/api/admin/run-script',
      getAllTags: '/api/admin/tags',
      getUserTags: (userId) => `/api/admin/user-tags/${userId}`,
      updateUserTags: (userId) => `/api/admin/user-tags/${userId}`
    }
  },

  // Error messages
  errors: {
    networkError: 'Network error - make sure the backend server is running on port',
    invalidCredentials: 'Invalid email or password',
    accountCreationFailed: 'Account creation failed'
  }
};

// Helper function to get the appropriate backend URL based on environment
export const getBackendUrl = () => {
  return window.location.hostname === 'localhost' 
    ? config.backend.localUrl 
    : config.backend.serverUrl;
};

// Helper function to check if user is admin
export const isAdminUser = (userEmail) => {
  return config.admin.adminEmails.includes(userEmail);
};

// Helper function to get network error message with port
export const getNetworkErrorMessage = () => {
  return `${config.errors.networkError} ${config.backend.port}`;
};

export default config;
