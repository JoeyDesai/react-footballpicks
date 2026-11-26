#!/usr/bin/php
<?php
$debug = 0;

function dprint($msg, $level=3) {
  global $debug;
  if ($debug >= $level) {
    print "DEBUG: $msg\n";
  }
}

#  Scores come from the NFL Kickoff Feed (footballschedule.rovaweb.co), which
#  pulls ESPN every 5 minutes while games are on. Yahoo stopped embedding the
#  root.App.main JSON this script used to parse.
#  Fields per game: awayAbbr, homeAbbr, awayScore, homeScore, completed and
#  clockDisplay ('' pregame, 'Q3 4:12', 'Half', 'Final', 'F/OT', 'Postponed').
dprint ("Getting scores ...");
$url = "https://footballschedule.rovaweb.co/api/scores.json?week=current";
$ch = curl_init();
curl_setopt($ch,CURLOPT_URL,$url);
curl_setopt($ch,CURLOPT_RETURNTRANSFER,1);
curl_setopt($ch,CURLOPT_CONNECTTIMEOUT,5);
curl_setopt($ch,CURLOPT_TIMEOUT,20);
curl_setopt($ch,CURLOPT_USERAGENT,"footballpicks-scores/2.0");
$content = curl_exec($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($http != 200 or empty($content)) {
  die("Could not get data (HTTP $http)\n");
}
$data = json_decode($content);
if (!$data or !isset($data->games)) {
  die("Could not get data\n");
}
dprint("Feed week " . $data->week . ", scores checked " . $data->scoresCheckedAt);

$NoLogin = 1;
$NoHeader = 1;
require_once '../common.inc';

$DoUpdate = 0;

#  Get the week id
$Sql = "SELECT id FROM weeks WHERE year=$CurYear AND startdate < now() ORDER BY startdate desc";
$Result = dbquery($Sql);
if (count($Result)) {
  $WeekId = $Result[0]['id'];
} else {
  exit;
  die ("Error - cannot find week id in database for $CurYear\n");
}
dprint("WeekId = $WeekId");

foreach($data->games as $val) {

  $Time = isset($val->clockDisplay) ? $val->clockDisplay : "";

  #  These values come from the external API and are interpolated into SQL
  #  below, so constrain them: scores must be integers and $Time is limited
  #  to the characters the formats above can produce
  $Time = preg_replace('/[^A-Za-z0-9\/: .]/', '', $Time);

  dprint ("Time = $Time");
  $Home = $val->homeAbbr;
  $HomeScore = intval($val->homeScore);
  $Away = $val->awayAbbr;
  $AwayScore = intval($val->awayScore);

  if (!preg_match("/^[A-Z]{2,3}$/", $Home)) {
    print "Invalid Home team!";
    exit;
  }

  if (!preg_match("/^[A-Z]{2,3}$/", $Away)) {
    print "Invalid Away team!";
    exit;
  }

  #  Feed uses standard abbreviations; our teams table differs for a few
  if ($Away == "JAX") {
    $Away = "JAC";
  }
  if ($Home == "JAX") {
    $Home = "JAC";
  }
  if ($Away == "ARI") {
    $Away = "AZ";
  }
  if ($Home == "ARI") {
    $Home = "AZ";
  }
  if ($Away == "LA") {
    $Away = "LAR";
  }
  if ($Home == "LA") {
    $Home = "LAR";
  }


  #  Only update if the time is not pregame
  if (!preg_match('/^\s*$/', $Time) and !preg_match('/pregame/i', $Time)) {
    dprint("Looking at $Away @ $Home ...");
    #  Get the game id
    $Sql = "SELECT g.id, g.homescore, g.awayscore, g.time, g.home, g.away FROM games g, teams a, teams h WHERE g.week=$WeekId and g.away = a.id and g.home = h.id and a.abbr = '$Away' and h.abbr = '$Home'";
    dprint("Sql = $Sql",4);
    $Result = dbquery($Sql);
    if (count($Result)) {
      $GameId = $Result[0]['id'];
      $HomeId = $Result[0]['home'];
      $AwayId = $Result[0]['away'];
    } else {
      print "Error - cannot find game id in database for $CurYear and $Away @ $Home\n";
      continue;
    }
    dprint ("GameId = $GameId");

    #  Update the scores if needed
    if ($AwayScore != $Result[0]['awayscore'] or
        $HomeScore != $Result[0]['homescore']) {
      $DoUpdate=1;
      dprint('Need to update scores',4);
    }
    if ($AwayScore != $Result[0]['awayscore'] or
        $HomeScore != $Result[0]['homescore'] or
        $Time != $Result[0]['time']) {
      dprint('Updating game score and time');
      $Sql = "UPDATE games SET awayscore=" . $AwayScore . ", homescore=" . $HomeScore . ", time='$Time' where id=$GameId";
      $Result = dbquery($Sql);
      if (!empty($val->completed)) {
        dprint('Score is final - setting winners and losers');
        if ($AwayScore > $HomeScore) {
          $Winner = $AwayId;
          $Loser = $HomeId;
        } else if ($HomeScore > $AwayScore) {
          $Winner = $HomeId;
          $Loser = $AwayId;
        } else {
          $Winner = 0;
          $Loser = 0;
      	}
      	$Sql = "UPDATE games SET winner=$Winner, loser=$Loser WHERE id=$GameId";
        $Result = dbquery($Sql);
        $DoUpdate = 1;
      }
    }
  } else {
    dprint("Pregame - Not updating $Away @ $Home");
  }
}

if ($DoUpdate) {
  dprint('Updating results ...');
  include 'update_losers.inc';
  include 'update_teamrecords.inc';
  include 'update_individualrecords.inc';
}
