const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const pool = require('./config/database');
const config = require('./config/app');
const { 
  sanitizeString, 
  sanitizeEmail, 
  validateLoginCredentials, 
  validateUserRegistration, 
  validatePicksData,
  sanitizeUserData,
  rateLimit 
} = require('./utils/security');

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors({
  origin: config.cors.origins,
  credentials: config.cors.credentials
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimit(1500, 15 * 60 * 1000)); // 1500 requests per 15 minutes

// Security headers
app.use((req, res, next) => {
  // Prevent XSS attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});

app.set('trust proxy', 1);

app.use(session({
  secret: config.session.secret,
  resave: config.session.resave,
  saveUninitialized: config.session.saveUninitialized,
  cookie: config.session.cookie
}));

// Serve static files (team images)
app.use(config.static.servePath, express.static(path.join(__dirname, config.static.imagesPath)));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  next();
};

// Routes

// Check session
app.get('/api/check-session', async (req, res) => {
  try {
    if (req.session.userId) {
      const result = await pool.query(
        'SELECT id, email, nickname, realname FROM pickers WHERE id = $1',
        [req.session.userId]
      );
      
      if (result.rows.length === 0) {
        return res.json({ authenticated: false });
      }
      
      const user = result.rows[0];
      res.json({
        authenticated: true,
        user: sanitizeUserData({
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          realName: user.realname
        })
      });
    } else {
      res.json({ authenticated: false });
    }
  } catch (error) {
    console.error('Session check error:', error);
    res.json({ authenticated: false });
  }
});

// Get user tags
app.get('/api/user-tags', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const result = await pool.query(`
      SELECT t.id, t.name 
      FROM tags t, pickertags p 
      WHERE p.pickerid = $1 AND p.tagid = t.id 
      ORDER BY t.name
    `, [userId]);
    
    const tags = result.rows.map(tag => ({
      id: tag.id,
      name: sanitizeString(tag.name)
    }));
    
    // Always include "All" option
    tags.unshift({ id: 0, name: 'All' });
    
    res.json({ success: true, tags });
  } catch (error) {
    console.error('Get user tags error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const currentYear = new Date().getFullYear();
    
    // Validate and sanitize input
    const validation = validateLoginCredentials(email, password);
    if (!validation.valid) {
      return res.json({ success: false, error: validation.error });
    }

    const { email: sanitizedEmail, password: sanitizedPassword } = validation.data;

    const result = await pool.query(
      'SELECT * FROM pickers WHERE email = $1 AND year = $2',
      [sanitizedEmail, currentYear]
    );
    
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    // Use plain text password comparison
    const validPassword = sanitizedPassword === user.password;
    
    if (!validPassword) {
      return res.json({ success: false, error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    res.json({
      success: true,
      user: sanitizeUserData({
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        realName: user.realname
      })
    });
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({ success: false, error: 'Could not log out' });
    }
    res.json({ success: true });
  });
});

// Create account
app.post('/api/create-account', async (req, res) => {
  try {
    const { email, realName, nickName, password, sitePassword } = req.body;
    
    // Validate and sanitize input
    const validation = validateUserRegistration({ email, realName, nickName, password, sitePassword });
    if (!validation.valid) {
      return res.json({ success: false, error: validation.error });
    }

    const { email: sanitizedEmail, realName: sanitizedRealName, nickName: sanitizedNickName, password: sanitizedPassword, sitePassword: sanitizedSitePassword } = validation.data;
    
    // Simple site password check
    if (sanitizedSitePassword !== 'cowboys') {
      return res.json({ success: false, error: 'Invalid site password' });
    }

    // Check if email already exists for current year
    const currentYear = new Date().getFullYear();
    const existingUser = await pool.query(
      'SELECT id FROM pickers WHERE email = $1 AND year = $2',
      [sanitizedEmail, currentYear]
    );
    
    if (existingUser.rows.length > 0) {
      return res.json({ success: false, error: 'Email already exists' });
    }

    await pool.query(
      'INSERT INTO pickers (email, password, nickname, realname, year) VALUES ($1, $2, $3, $4, $5)',
      [sanitizedEmail, sanitizedPassword, sanitizedNickName, sanitizedRealName, currentYear]
    );
    
    res.json({ success: true, message: 'Account created successfully' });
  } catch (error) {
    console.error('Create account error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint
    });
    res.json({ success: false, error: `Could not create account: ${error.message}` });
  }
});

// Get weeks
app.get('/api/weeks', requireAuth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    const result = await pool.query(`
      SELECT id, number, startdate, 
             startdate > NOW() as future,
             startdate < NOW() as completed,
             factor
      FROM weeks 
      WHERE year = $1 
      ORDER BY startdate
    `, [currentYear]);
    
    const formattedWeeks = result.rows.map(week => ({
      id: week.id,
      number: week.number,
      startDate: week.startdate,
      future: week.future,
      completed: week.completed,
      current: !week.future && !week.completed,
      factor: week.factor || 1
    }));
    
    res.json({ success: true, weeks: formattedWeeks });
  } catch (error) {
    console.error('Get weeks error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get games for a week
app.get('/api/games/:weekId', requireAuth, async (req, res) => {
  try {
    const { weekId } = req.params;
    
    const result = await pool.query(`
      SELECT g.id, g.date, g.winner,
             h.id as home_id, h.city as home_city, h.name as home_name, 
             h.wins as home_wins, h.losses as home_losses, h.ties as home_ties,
             a.id as away_id, a.city as away_city, a.name as away_name,
             a.wins as away_wins, a.losses as away_losses, a.ties as away_ties
      FROM games g
      JOIN teams h ON g.home = h.id
      JOIN teams a ON g.away = a.id
      WHERE g.week = $1
      ORDER BY g.date, a.city
    `, [weekId]);
    
    // Check if week has started (read-only)
    const weekResult = await pool.query(
      'SELECT startdate < NOW() as started FROM weeks WHERE id = $1',
      [weekId]
    );
    
    res.json({ 
      success: true, 
      games: result.rows,
      readOnly: weekResult.rows.length > 0 ? weekResult.rows[0].started : false
    });
  } catch (error) {
    console.error('Get games error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get picks for a week
app.get('/api/picks/:weekId', requireAuth, async (req, res) => {
  try {
    const { weekId } = req.params;
    const userId = req.session.userId;
    
    const result = await pool.query(`
      SELECT p.game, p.guess, p.weight
      FROM picks p
      JOIN games g ON p.game = g.id
      WHERE g.week = $1 AND p.picker = $2
    `, [weekId, userId]);
    
    res.json({ success: true, picks: result.rows });
  } catch (error) {
    console.error('Get picks error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Submit picks for a week
app.post('/api/picks/:weekId', requireAuth, async (req, res) => {
  try {
    const { weekId } = req.params;
    const userId = req.session.userId;
    const picks = req.body;
    
    // Validate weekId parameter
    const sanitizedWeekId = parseInt(weekId, 10);
    if (isNaN(sanitizedWeekId) || sanitizedWeekId <= 0) {
      return res.json({ success: false, error: 'Invalid week ID' });
    }
    
    // Check if week has started
    const weekResult = await pool.query(
      'SELECT startdate < NOW() as started FROM weeks WHERE id = $1',
      [sanitizedWeekId]
    );
    
    if (weekResult.rows.length > 0 && weekResult.rows[0].started) {
      return res.json({ success: false, error: 'Week has already started' });
    }
    
    // Get games for this week
    const gamesResult = await pool.query('SELECT id FROM games WHERE week = $1', [sanitizedWeekId]);
    
    // Validate picks using security utility
    const gameIds = gamesResult.rows.map(g => g.id);
    const validation = validatePicksData(picks, gameIds);
    
    if (!validation.valid) {
      return res.json({ success: false, error: validation.error });
    }
    
    // Delete existing picks for this week
    await pool.query(`
      DELETE FROM picks 
      WHERE picker = $1 AND game IN (SELECT id FROM games WHERE week = $2)
    `, [userId, sanitizedWeekId]);
    
    // Insert new picks
    for (const gameId of gameIds) {
      const pick = picks[`GAME${gameId}`];
      const value = picks[`VAL${gameId}`];
      await pool.query(
        'INSERT INTO picks (picker, game, guess, weight) VALUES ($1, $2, $3, $4)',
        [userId, gameId, pick, value]
      );
    }
    
    res.json({ success: true, message: 'Picks saved successfully' });
  } catch (error) {
    console.error('Submit picks error:', error);
    res.json({ success: false, error: 'Could not save picks' });
  }
});

// Get overall standings
app.get('/api/overall-standings', requireAuth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const tag = req.query.tag || 0;
    
    let tagFilter = '';
    if (tag != 0) {
      tagFilter = ' AND u.id IN (SELECT pickerid FROM pickertags WHERE tagid = $2)';
    }
    
    const result = await pool.query(`
      SELECT u.id, u.nickname, 
             COALESCE(SUM(s.score), 0) as score,
             COALESCE(SUM(s.numright), 0) as numright,
             COUNT(DISTINCT s.week) as weeks_played
      FROM pickers u
      LEFT JOIN scores s ON u.id = s.picker
      LEFT JOIN weeks w ON s.week = w.id
      WHERE u.active = 'y' AND (w.year = $1 OR w.year IS NULL)${tagFilter}
      GROUP BY u.id, u.nickname
      ORDER BY score DESC, numright DESC
    `, tag != 0 ? [currentYear, tag] : [currentYear]);
    
    res.json({ success: true, standings: result.rows });
  } catch (error) {
    console.error('Get overall standings error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get overall standings with weekly breakdown
app.get('/api/overall-standings-detailed', requireAuth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const tag = req.query.tag || 0;
    
    // Get all weeks for the current year that have started
    const weeksResult = await pool.query(`
      SELECT id, number 
      FROM weeks 
      WHERE year = $1 AND startdate < NOW()
      ORDER BY number DESC
    `, [currentYear]);
    
    let tagFilter = '';
    if (tag != 0) {
      tagFilter = ' AND u.id IN (SELECT pickerid FROM pickertags WHERE tagid = $2)';
    }
    
    // Get all users with their weekly scores (only from current year)
    const standingsResult = await pool.query(`
      SELECT u.id, u.nickname, 
             COALESCE(SUM(s.score), 0) as total_score,
             COALESCE(SUM(s.numright), 0) as total_correct,
             COUNT(DISTINCT s.week) as weeks_played
      FROM pickers u
      LEFT JOIN scores s ON u.id = s.picker
      LEFT JOIN weeks w ON s.week = w.id
      WHERE u.active = 'y' AND (w.year = $1 OR w.year IS NULL)${tagFilter}
      GROUP BY u.id, u.nickname
      ORDER BY total_score DESC, total_correct DESC
    `, tag != 0 ? [currentYear, tag] : [currentYear]);
    
    // Get weekly scores for each user (only from current year)
    const weeklyScores = {};
    for (const user of standingsResult.rows) {
      const weeklyResult = await pool.query(`
        SELECT s.week, s.score, s.numright, w.number as week_number
        FROM scores s
        JOIN weeks w ON s.week = w.id
        WHERE s.picker = $1 AND w.year = $2
        ORDER BY w.number DESC
      `, [user.id, currentYear]);
      
      weeklyScores[user.id] = {};
      weeklyResult.rows.forEach(row => {
        weeklyScores[user.id][row.week_number] = {
          score: row.score,
          correct: row.numright
        };
      });
    }
    
    res.json({ 
      success: true, 
      standings: standingsResult.rows,
      weeks: weeksResult.rows,
      weeklyScores: weeklyScores
    });
  } catch (error) {
    console.error('Get detailed overall standings error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get weekly standings
app.get('/api/weekly-standings/:weekId', requireAuth, async (req, res) => {
  try {
    const { weekId } = req.params;
    const tag = req.query.tag || 0;
    
    let tagFilter = '';
    if (tag != 0) {
      tagFilter = ' AND u.id IN (SELECT pickerid FROM pickertags WHERE tagid = $2)';
    }
    
    const result = await pool.query(`
      SELECT u.id, u.nickname, s.score, s.numright
      FROM pickers u
      JOIN scores s ON u.id = s.picker
      WHERE s.week = $1 AND u.active = 'y'${tagFilter}
      ORDER BY s.score DESC, s.numright DESC
    `, tag != 0 ? [weekId, tag] : [weekId]);
    
    res.json({ success: true, standings: result.rows });
  } catch (error) {
    console.error('Get weekly standings error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get weekly standings with detailed breakdown
app.get('/api/weekly-standings-detailed/:weekId', requireAuth, async (req, res) => {
  try {
    const { weekId } = req.params;
    const tag = req.query.tag || 0;
    
    // Get the week info
    const weekResult = await pool.query(`
      SELECT id, number, startdate, factor
      FROM weeks 
      WHERE id = $1
    `, [weekId]);
    
    if (weekResult.rows.length === 0) {
      return res.json({ success: false, error: 'Week not found' });
    }
    
    const week = weekResult.rows[0];
    
    let tagFilter = '';
    if (tag != 0) {
      tagFilter = ' AND u.id IN (SELECT pickerid FROM pickertags WHERE tagid = $2)';
    }
    
    // Get standings for this week with potential scores
    const standingsResult = await pool.query(`
      SELECT u.id, u.nickname, s.score, s.numright, 
             s.score + COALESCE(s.potscore, 0) as potential_score,
             s.numright + COALESCE(s.potright, 0) as potential_correct
      FROM pickers u
      JOIN scores s ON u.id = s.picker
      WHERE s.week = $1 AND u.active = 'y'${tagFilter}
      ORDER BY potential_score DESC, potential_correct DESC
    `, tag != 0 ? [weekId, tag] : [weekId]);
    
    // Get all picks for this week to calculate incorrect
    const picksResult = await pool.query(`
      SELECT p.picker, COUNT(*) as total_picks
      FROM picks p
      JOIN games g ON p.game = g.id
      WHERE g.week = $1
      GROUP BY p.picker
    `, [weekId]);
    
    const totalPicks = {};
    picksResult.rows.forEach(row => {
      totalPicks[row.picker] = row.total_picks;
    });
    
    // Add incorrect picks calculation
    const standingsWithIncorrect = standingsResult.rows.map(player => ({
      ...player,
      incorrect: (totalPicks[player.id] || 0) - player.numright
    }));
    
    res.json({ 
      success: true, 
      standings: standingsWithIncorrect,
      week: week
    });
  } catch (error) {
    console.error('Get detailed weekly standings error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get weekly standings with individual games and picks (classic view)
app.get('/api/weekly-standings-classic/:weekId', requireAuth, async (req, res) => {
  try {
    const { weekId } = req.params;
    const tag = req.query.tag || 0;
    
    // Get the week info
    const weekResult = await pool.query(`
      SELECT id, number, startdate, factor
      FROM weeks 
      WHERE id = $1
    `, [weekId]);
    
    if (weekResult.rows.length === 0) {
      return res.json({ success: false, error: 'Week not found' });
    }
    
    const week = weekResult.rows[0];
    
    // Get all games for this week with team info and scores
    const gamesResult = await pool.query(`
      SELECT g.id, g.date, g.winner, g.homescore, g.awayscore, g.time, g.info,
             h.id as home_id, h.city as home_city, h.name as home_name, h.abbr as home_abbr,
             a.id as away_id, a.city as away_city, a.name as away_name, a.abbr as away_abbr
      FROM games g
      JOIN teams h ON g.home = h.id
      JOIN teams a ON g.away = a.id
      WHERE g.week = $1
      ORDER BY g.date, a.abbr
    `, [weekId]);
    
    let tagFilter = '';
    if (tag != 0) {
      tagFilter = ' AND u.id IN (SELECT pickerid FROM pickertags WHERE tagid = $2)';
    }
    
    // Get all standings for this week
    const standingsResult = await pool.query(`
      SELECT u.id, u.nickname, s.score, s.numright
      FROM pickers u
      JOIN scores s ON u.id = s.picker
      WHERE s.week = $1 AND u.active = 'y'${tagFilter}
      ORDER BY s.score DESC, s.numright DESC
    `, tag != 0 ? [weekId, tag] : [weekId]);
    
    // Get all picks for this week
    const picksResult = await pool.query(`
      SELECT p.picker, p.game, p.guess, p.weight, g.home, g.away, g.winner
      FROM picks p
      JOIN games g ON p.game = g.id
      WHERE g.week = $1
    `, [weekId]);
    
    // Organize picks by picker and game
    const picksByPicker = {};
    picksResult.rows.forEach(pick => {
      if (!picksByPicker[pick.picker]) {
        picksByPicker[pick.picker] = {};
      }
      picksByPicker[pick.picker][pick.game] = {
        guess: pick.guess,
        weight: pick.weight,
        home: pick.home,
        away: pick.away,
        winner: pick.winner
      };
    });

    // Calculate new potential score (X) for each player
    const standingsWithNewPotential = standingsResult.rows.map(player => {
      let newPotentialScore = 0;
      let newPotentialCorrect = 0;
      
      if (picksByPicker[player.id]) {
        const weekFactor = week.factor || 1;
        
        gamesResult.rows.forEach(game => {
          const playerPick = picksByPicker[player.id][game.id];
          if (playerPick) {
            const points = playerPick.weight * weekFactor;
            
            if (game.winner !== null && game.winner !== undefined) {
              // Game is completed
              if (playerPick.guess === game.winner) {
                // Correct pick
                newPotentialScore += points;
                newPotentialCorrect += 1;
              } else if (game.winner === 0) {
                // Game ended in a tie - give half points
                newPotentialScore += points * 0.5;
                newPotentialCorrect += 0.5;
              }
              // If wrong pick, no points
            } else {
              // Game not completed yet
              if (game.homescore !== null && game.awayscore !== null) {
                // Game is in progress - determine winner based on current score
                let currentWinner = null;
                if (game.homescore > game.awayscore) {
                  currentWinner = game.home_id;
                } else if (game.awayscore > game.homescore) {
                  currentWinner = game.away_id;
                } else {
                  // Game is tied - give full points as per user requirement
                  newPotentialScore += points;
                  newPotentialCorrect += 1;
                }
                
                if (currentWinner && playerPick.guess === currentWinner) {
                  newPotentialScore += points;
                  newPotentialCorrect += 1;
                }
              } else {
                // Game hasn't started - assume correct pick
                newPotentialScore += points;
                newPotentialCorrect += 1;
              }
            }
          }
        });
      }
      
      return {
        ...player,
        new_potential_score: newPotentialScore,
        new_potential_correct: newPotentialCorrect
      };
    });
    
    res.json({ 
      success: true, 
      standings: standingsWithNewPotential,
      games: gamesResult.rows,
      picksByPicker: picksByPicker,
      week: week
    });
  } catch (error) {
    console.error('Get classic weekly standings error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get home stats
app.get('/api/home-stats', requireAuth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get current week
    const currentWeekResult = await pool.query(`
      SELECT id, number 
      FROM weeks 
      WHERE year = $1 AND startdate < NOW() 
      ORDER BY startdate DESC 
      LIMIT 1
    `, [currentYear]);
    
    if (currentWeekResult.rows.length === 0) {
      return res.json({ 
        success: true, 
        currentWeek: null, 
        weeklyStandings: [],
        overallStandings: []
      });
    }
    
    const currentWeek = currentWeekResult.rows[0];
    
    // Get weekly standings for current week
    const weeklyResult = await pool.query(`
      SELECT u.id, u.nickname, s.score, s.numright
      FROM pickers u
      JOIN scores s ON u.id = s.picker
      WHERE s.week = $1 AND u.active = 'y'
      ORDER BY s.score DESC, s.numright DESC
      LIMIT 5
    `, [currentWeek.id]);
    
    res.json({
      success: true,
      currentWeek,
      weeklyStandings: weeklyResult.rows
    });
  } catch (error) {
    console.error('Get home stats error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get team stats
app.get('/api/team-stats', requireAuth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const result = await pool.query(`
      SELECT t.name,
             COALESCE(won.totalweight, 0) as pointsWon,
             COALESCE(won.totalcount, 0) as correctPicks,
             COALESCE(lost.totalweight, 0) as pointsLost,
             COALESCE(lost.totalcount, 0) as wrongPicks,
             COALESCE(won.totalweight, 0) + COALESCE(lost.totalweight, 0) as totalPoints,
             COALESCE(won.totalcount, 0) + COALESCE(lost.totalcount, 0) as totalPicks
      FROM teams t
      LEFT JOIN (
        SELECT g.winner as team_id, SUM(p.weight) as totalweight, COUNT(*) as totalcount
        FROM games g
        JOIN picks p ON g.id = p.game
        JOIN weeks w ON g.week = w.id
        WHERE g.winner = p.guess AND g.winner IS NOT NULL AND w.year = $1
        GROUP BY g.winner
      ) won ON t.id = won.team_id
      LEFT JOIN (
        SELECT CASE WHEN g.winner = g.home THEN g.away ELSE g.home END as team_id,
               SUM(p.weight) as totalweight, COUNT(*) as totalcount
        FROM games g
        JOIN picks p ON g.id = p.game
        JOIN weeks w ON g.week = w.id
        WHERE g.winner IS NOT NULL AND p.guess != g.winner
          AND (p.guess = g.home OR p.guess = g.away) AND w.year = $1
        GROUP BY team_id
      ) lost ON t.id = lost.team_id
      WHERE COALESCE(won.totalcount, 0) + COALESCE(lost.totalcount, 0) > 0
      ORDER BY totalPoints DESC
    `, [currentYear]);
    
    res.json({ success: true, stats: result.rows });
  } catch (error) {
    console.error('Get team stats error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Admin middleware - check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    console.log('Admin check - session userId:', req.session.userId);
    
    if (!req.session.userId) {
      console.log('Admin check failed: No session userId');
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const result = await pool.query(
      'SELECT email FROM pickers WHERE id = $1',
      [req.session.userId]
    );
    
    if (result.rows.length === 0) {
      console.log('Admin check failed: User not found in database');
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    
    const userEmail = result.rows[0].email;
    console.log('Admin check - user email:', userEmail);
    
    if (userEmail !== 'jase@jasetheace.com' && userEmail !== 'joe' && userEmail !== 'your-email@example.com') {
      console.log('Admin check failed: User is not admin');
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    console.log('Admin check passed');
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
};

// Admin routes

// Get all users for admin
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    const result = await pool.query(`
      SELECT id, email, nickname, realname, active
      FROM pickers 
      WHERE year = $1
      ORDER BY nickname
    `, [currentYear]);
    
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Get admin users error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get picks status for all users for a specific week
app.get('/api/admin/picks-status/:weekId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { weekId } = req.params;
    const currentYear = new Date().getFullYear();
    
    // Get all users
    const usersResult = await pool.query(`
      SELECT id, nickname, realname
      FROM pickers 
      WHERE year = $1 AND active = 'y'
      ORDER BY nickname
    `, [currentYear]);
    
    // Get picks for this week
    const picksResult = await pool.query(`
      SELECT DISTINCT p.picker
      FROM picks p
      JOIN games g ON p.game = g.id
      WHERE g.week = $1
    `, [weekId]);
    
    const usersWithPicks = new Set(picksResult.rows.map(row => row.picker));
    
    const picksStatus = usersResult.rows.map(user => ({
      id: user.id,
      name: user.nickname || user.realname,
      hasPicks: usersWithPicks.has(user.id)
    }));
    
    res.json({ success: true, picksStatus });
  } catch (error) {
    console.error('Get picks status error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get user's picks for a specific week (for admin to view/edit)
app.get('/api/admin/user-picks/:userId/:weekId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, weekId } = req.params;
    
    const result = await pool.query(`
      SELECT p.game, p.guess, p.weight
      FROM picks p
      JOIN games g ON p.game = g.id
      WHERE g.week = $1 AND p.picker = $2
    `, [weekId, userId]);
    
    res.json({ success: true, picks: result.rows });
  } catch (error) {
    console.error('Get user picks error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Submit picks for a user (admin override - can submit even after week started)
app.post('/api/admin/user-picks/:userId/:weekId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, weekId } = req.params;
    const picks = req.body;
    
    // Get games for this week
    const gamesResult = await pool.query('SELECT id FROM games WHERE week = $1', [weekId]);
    
    // Validate picks
    const gameIds = gamesResult.rows.map(g => g.id);
    const usedValues = new Set();
    const errors = [];
    
    gameIds.forEach(gameId => {
      const pick = picks[`GAME${gameId}`];
      const value = picks[`VAL${gameId}`];
      
      if (!pick) {
        errors.push(`Missing pick for game ${gameId}`);
      }
      
      if (!value || value === 0) {
        errors.push(`Missing value for game ${gameId}`);
      } else if (usedValues.has(value)) {
        errors.push(`Value ${value} used multiple times`);
      } else {
        usedValues.add(value);
      }
    });
    
    if (errors.length > 0) {
      return res.json({ success: false, error: errors.join('. ') });
    }
    
    // Delete existing picks for this week
    await pool.query(`
      DELETE FROM picks 
      WHERE picker = $1 AND game IN (SELECT id FROM games WHERE week = $2)
    `, [userId, weekId]);
    
    // Insert new picks
    for (const gameId of gameIds) {
      const pick = picks[`GAME${gameId}`];
      const value = picks[`VAL${gameId}`];
      await pool.query(
        'INSERT INTO picks (picker, game, guess, weight) VALUES ($1, $2, $3, $4)',
        [userId, gameId, pick, value]
      );
    }
    
    res.json({ success: true, message: 'Picks saved successfully' });
  } catch (error) {
    console.error('Submit admin picks error:', error);
    res.json({ success: false, error: 'Could not save picks' });
  }
});

// Run update scripts
app.post('/api/admin/run-script', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { scriptType } = req.body;
    const { exec } = require('child_process');
    
    // Get script path from config
    const scriptPath = config.getScriptPath(scriptType);
    console.log('Script path:', scriptPath);
    
    // Check if file exists
    const fs = require('fs');
    const absoluteScriptPath = path.resolve(__dirname, scriptPath);
    if (!fs.existsSync(absoluteScriptPath)) {
      console.error('Script file does not exist:', absoluteScriptPath);
      return res.json({ success: false, error: `Script file not found: ${absoluteScriptPath}` });
    }
    
    // Execute the PHP script (original files use $CurYear variable)
    // Quote the path to handle spaces in directory names
    // Execute from DB Updates directory so relative paths work correctly
    const dbUpdatesDir = path.join(__dirname, 'DB Updates');
    exec(`php "${absoluteScriptPath}"`, { cwd: dbUpdatesDir }, (error, stdout, stderr) => {
      console.log('Script stdout:', stdout);
      console.log('Script stderr:', stderr);
      
      if (error) {
        console.error('Script execution error:', error);
        return res.json({ 
          success: false, 
          error: `Script execution failed: ${error.message}`,
          stdout: stdout,
          stderr: stderr
        });
      }
      
      if (stderr) {
        console.error('Script stderr:', stderr);
        return res.json({ 
          success: false, 
          error: `Script error: ${stderr}`,
          stdout: stdout
        });
      }
      
      res.json({ 
        success: true, 
        message: `${scriptType} script executed successfully`,
        output: stdout
      });
    });
    
  } catch (error) {
    console.error('Run script error:', error);
    res.json({ success: false, error: `Could not run script: ${error.message}` });
  }
});

// Get all available tags (for admin)
app.get('/api/admin/tags', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name 
      FROM tags 
      ORDER BY name
    `);
    
    res.json({ success: true, tags: result.rows });
  } catch (error) {
    console.error('Get all tags error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Get user's tags (for admin)
app.get('/api/admin/user-tags/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(`
      SELECT t.id, t.name 
      FROM tags t, pickertags p 
      WHERE p.pickerid = $1 AND p.tagid = t.id 
      ORDER BY t.name
    `, [userId]);
    
    res.json({ success: true, tags: result.rows });
  } catch (error) {
    console.error('Get user tags error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Update user's tags (for admin)
app.post('/api/admin/user-tags/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { tagIds } = req.body;
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Remove all existing tags for this user
      await pool.query('DELETE FROM pickertags WHERE pickerid = $1', [userId]);
      
      // Add new tags
      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await pool.query(
            'INSERT INTO pickertags (pickerid, tagid) VALUES ($1, $2)',
            [userId, tagId]
          );
        }
      }
      
      // Commit transaction
      await pool.query('COMMIT');
      
      res.json({ success: true, message: 'User tags updated successfully' });
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update user tags error:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend should connect to: http://localhost:${PORT}`);
});