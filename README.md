# Football Picks Application

A modern web application for NFL football picks competition built with React and Node.js. Users can make weekly picks, view standings, and compete with friends in a beautiful, responsive interface.

## Features

- **User Authentication**: Secure login and account creation
- **Weekly Picks**: Make picks for NFL games with confidence values
- **Standings**: View weekly and overall standings with detailed statistics
- **Team Statistics**: Track team performance and pick accuracy
- **Admin Panel**: Manage users, run update scripts, and assign tags
- **Progressive Web App**: Installable on mobile devices
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-time Updates**: Live score updates and standings

## Technology Stack

### Frontend
- **React 19** - Modern UI framework
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **Lucide React** - Beautiful icons
- **CSS3** - Custom glass-morphism design

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **Express Session** - Session management
- **CORS** - Cross-origin resource sharing
- **PHP** - Legacy update scripts

## Requirements

### System Requirements
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **PostgreSQL** (v12 or higher)
- **PHP** (v7.4+ for update scripts)
- **Git**

### Development Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Code editor (VS Code recommended)
- Terminal/Command line access

## Project Structure & File Descriptions

### Frontend (`football-picks-app/`)

#### Core Application Files
- **`src/App.jsx`** - Main application component with routing and authentication logic
- **`src/main.jsx`** - Application entry point that renders the React app
- **`src/index.css`** - Global CSS styles and base styling
- **`src/App.css`** - Application-specific CSS styles and components

#### Configuration Files
- **`src/config.js`** - Centralized configuration for API endpoints, backend URLs, and admin settings
- **`package.json`** - Frontend dependencies and build scripts
- **`vite.config.js`** - Vite build configuration
- **`eslint.config.js`** - ESLint configuration for code quality
- **`index.html`** - Main HTML template
- **`public/manifest.json`** - PWA manifest for mobile installation

#### Components (`src/components/`)
- **`Header.jsx`** - Navigation header with mobile menu and user controls
- **`Footer.jsx`** - Application footer with navigation links
- **`CustomDropdown.jsx`** - Reusable dropdown component for form inputs

#### Pages (`src/pages/`)
- **`Home.jsx`** - Dashboard showing standings, countdown, and quick stats
- **`Login.jsx`** - User authentication login form
- **`CreateAccount.jsx`** - New user registration form
- **`MakePicks.jsx`** - Main picks interface with drag-and-drop functionality
- **`WeeklyStandings.jsx`** - Weekly standings display with filtering
- **`OverallStandings.jsx`** - Season-long standings and statistics
- **`TeamStats.jsx`** - Team performance statistics and analysis
- **`Admin.jsx`** - Administrative panel for user and system management

#### Services & Utilities
- **`src/services/api.js`** - API service layer for backend communication
- **`src/contexts/AuthContext.jsx`** - React context for authentication state management
- **`src/utils/sanitize.js`** - Input sanitization utilities for security

#### Static Assets (`public/images/`)
- **Team logos** - SVG files for all 32 NFL teams
- **`logo.png`** - Application logo
- **`background.jpg`** - Desktop background image
- **`background_mobile.jpg`** - Mobile background image
- **`app_icon.png`** - PWA application icon

### Backend (`backend/`)

#### Core Server Files
- **`server.js`** - Main Express server with all API routes and middleware
- **`package.json`** - Backend dependencies and scripts

#### Configuration Files
- **`config/app.js`** - Centralized configuration with hardcoded values for database, CORS, sessions, and application settings
- **`config/database.js`** - PostgreSQL database connection pool configuration
- **`config/database.php`** - PHP database configuration for legacy scripts

#### Security & Utilities
- **`utils/security.js`** - Input validation, sanitization, and security utilities
- **`utils/securityLogger.js`** - Security logging for suspicious activities and admin actions
- **`common.inc`** - Common PHP includes and utility functions
- **`sql.inc`** - SQL database connection and query functions

#### Database Update Scripts (`DB Updates/`)
- **`update_individualrecords.inc`** - Updates individual user records and scores
- **`update_losers.inc`** - Updates game losers based on winners
- **`update_teamrecords.inc`** - Updates team performance records
- **`update-nfl-scores.php`** - Updates NFL scores from external sources

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd React\ Football\ Picks
```

### 2. Database Setup

1. **Install PostgreSQL** on your system
2. **Create a database**:
   ```sql
   CREATE DATABASE football;
   CREATE USER footballusr WITH PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE football TO footballusr;
   ```

3. **Import the database schema** (if you have a SQL dump file):
   ```bash
   psql -U footballusr -d football -f database_schema.sql
   ```

### 3. Backend Setup

```bash
cd backend
npm install
```

**Database connection is pre-configured** in `backend/config/app.js` with these default values:
```javascript
database: {
  user: 'footballusr',
  host: 'localhost',
  database: 'football',
  password: 'password',
  port: 5432
}
```

**To modify database settings**, edit the values directly in `backend/config/app.js`.

**Start the backend server**:
```bash
npm start
# or for development
npm run dev
```

The backend will run on `http://localhost:3001`

### 4. Frontend Setup

```bash
cd football-picks-app
npm install
```

**Start the development server**:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

### 5. Access the Application

- Open your browser and navigate to `http://localhost:5173`
- The frontend will automatically connect to the backend API
- Create an account or login to start using the application

## Linux Server Deployment

### 1. Server Requirements

- **Ubuntu 20.04+** or **CentOS 7+**
- **Node.js 18+**
- **PostgreSQL 12+**
- **Nginx** (for reverse proxy)
- **PM2** (for process management)
- **PHP 7.4+** (for update scripts)
- **PHP PostgreSQL extension** (`php-pgsql`)

### 2. Install Dependencies

#### Ubuntu/Debian:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install PHP with PostgreSQL support
sudo apt install php php-cli php-fpm php-pgsql

# Install Nginx
sudo apt install nginx

# Install PM2 globally
sudo npm install -g pm2
```

#### CentOS/RHEL:
```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PostgreSQL
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Install PHP with PostgreSQL support
sudo yum install php php-cli php-fpm php-pgsql

# Install Nginx
sudo yum install nginx

# Install PM2 globally
sudo npm install -g pm2
```

### 3. Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE football;
CREATE USER footballusr WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE football TO footballusr;
\q
```

### 4. Deploy Application

```bash
# Clone repository
git clone <repository-url>
cd React\ Football\ Picks

# Install backend dependencies
cd backend
npm install --production

# Install frontend dependencies
cd ../football-picks-app
npm install
npm run build
```

### 5. Configuration Changes for Deployment

#### Backend Configuration (`backend/config/app.js`)
```javascript
// Update database configuration for production
database: {
  user: 'footballusr',
  host: 'localhost',
  database: 'football',
  password: 'your_secure_password', // Change this for production
  port: 5432,
  ssl: { rejectUnauthorized: false } // Enable for production
}

// Update CORS origins for your domain
cors: {
  origins: [
    'http://your-domain.com',
    'https://your-domain.com'
  ],
  credentials: true
}

// Update session configuration for production
session: {
  secret: 'your_very_secure_session_secret', // Change this for production
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}
```

**Important**: For production deployment, you must update these values directly in the `backend/config/app.js` file:
- Change the database password
- Update the session secret
- Enable SSL for the database connection
- Set secure cookies to true
- Update CORS origins to your domain

#### PHP Configuration (`backend/config/database.php`)
```php
// Update database configuration for PHP scripts
$dbuser = 'footballusr';
$dbpass = 'your_secure_password'; // Change this for production
$dbname = 'football';
$dbhost = 'localhost';
$dbport = '5432';

// Update current year if needed
$CurYear = 2026;
```

**Important**: For production deployment, you must update these values in the `backend/config/database.php` file:
- Change the database password to match your production database
- Update the current year if needed
- Ensure the database host matches your production setup

#### Frontend Configuration (`football-picks-app/src/config.js`)
```javascript
// Update backend server URL
backend: {
  localUrl: 'http://localhost:3001',
  serverUrl: 'http://your-domain.com:3001', // Update this
  port: 3001
}

// Update admin emails
admin: {
  adminEmails: ['your-admin@email.com', 'another-admin@email.com']
}
```

### 6. Configure Nginx

Create `/etc/nginx/sites-available/football-picks`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/React\ Football\ Picks/football-picks-app/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static images
    location /images {
        root /path/to/React\ Football\ Picks/football-picks-app/dist;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/football-picks /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Start Services with PM2

Create `ecosystem.config.js` in the project root:
```javascript
module.exports = {
  apps: [{
    name: 'football-picks-backend',
    script: 'backend/server.js',
    cwd: '/path/to/React Football Picks',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

Start the application:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8. PHP Script Configuration

The application includes PHP scripts for database updates that need proper configuration:

#### Set PHP Script Permissions
```bash
# Make PHP scripts executable
chmod +x backend/DB\ Updates/update-nfl-scores.php

# Set proper ownership
chown -R www-data:www-data backend/DB\ Updates/
```

#### Test PHP PostgreSQL Connection
```bash
# Test PHP can connect to PostgreSQL
php -r "
require_once 'backend/config/database.php';
\$conn = getDbConnection();
if (\$conn) {
    echo 'PHP PostgreSQL connection successful\n';
} else {
    echo 'PHP PostgreSQL connection failed\n';
}
"
```

#### PHP Script Requirements
- **PHP PostgreSQL extension** must be installed (`php-pgsql`)
- **Database credentials** must match between Node.js and PHP configurations
- **Script permissions** must allow execution by the web server
- **Current year** must be updated in both `app.js` and `database.php` if needed

### 9. SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
````

## Admin Features

The application includes an admin panel accessible to users with admin privileges:

- **User Management**: View and manage all users
- **Picks Management**: View and edit user picks
- **Update Scripts**: Run database update scripts
- **Tag Management**: Assign tags to users for filtering

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `POST /api/create-account` - Create new account
- `GET /api/check-session` - Check authentication status

### Games & Picks
- `GET /api/weeks` - Get available weeks
- `GET /api/games/:weekId` - Get games for a week
- `GET /api/picks/:weekId` - Get user picks for a week
- `POST /api/picks/:weekId` - Submit picks for a week

### Standings
- `GET /api/overall-standings` - Get overall standings
- `GET /api/weekly-standings/:weekId` - Get weekly standings
- `GET /api/team-stats` - Get team statistics

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/picks-status/:weekId` - Get picks status
- `POST /api/admin/run-script` - Run update scripts

## Troubleshooting

### Common Issues

1. **Database Connection Error**:
   - Check PostgreSQL is running: `sudo systemctl status postgresql`
   - Verify database credentials in `backend/config/app.js` (all settings are hardcoded)
   - Ensure database exists and user has proper permissions
   - Make sure the database user 'footballusr' exists with password 'password'

2. **Frontend Not Loading**:
   - Check if backend is running on port 3001
   - Verify CORS settings in backend configuration
   - Check browser console for errors

3. **Build Errors**:
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility
   - Verify all dependencies are installed

4. **Permission Issues**:
   - Ensure proper file permissions: `chmod -R 755 /path/to/app`
   - Check PM2 process ownership: `pm2 logs`


## Author

**Joe M.** - Full Stack Developer
- Created the modern React frontend
- Developed the Node.js backend API
- Implemented responsive design and PWA features
- Built the admin panel and user management system
