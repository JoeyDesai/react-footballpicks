<?php
// PHP Database Configuration
// This file contains database connection settings for PHP scripts
// Modify these values to change database settings for PHP scripts

// Database connection settings
$dbuser = 'footballusr';
$dbpass = 'password';
$dbname = 'football';
$dbhost = 'localhost';
$dbport = '5432';

// Current year setting
$CurYear = 2026;

// Database connection string
$dbConnectionString = "host=$dbhost port=$dbport dbname=$dbname user=$dbuser password=$dbpass";

// Function to get database connection
function getDbConnection() {
    global $dbConnectionString;
    $conn = pg_pconnect($dbConnectionString) or die('Could not connect: ' . pg_last_error());
    return $conn;
}

// Function to execute database queries
function dbquery($Sql, $debug = 0) {
    global $conn;
    if (!isset($conn)) {
        $conn = getDbConnection();
    }
    if ($debug) {
        print "\n<!-- $Sql -->\n";
    }
    $ret = array();
    $result = pg_query($Sql) or die('Query failed: ' . pg_last_error());
    while ($tmp = pg_fetch_assoc($result)) {
        $ret[] = $tmp;
    }
    return $ret;
}
?>
