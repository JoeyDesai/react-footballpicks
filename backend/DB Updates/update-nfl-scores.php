#!/usr/bin/php
<?php 
$debug = 0;

function dprint($msg, $level=3) {
  global $debug;
  if ($debug >= $level) {
    print "DEBUG: $msg\n";
  }
}

dprint ("Getting scores ...");
$url = "https://sports.yahoo.com/nfl/scoreboard/";
$ch = curl_init();
curl_setopt($ch,CURLOPT_URL,$url);
curl_setopt($ch,CURLOPT_RETURNTRANSFER,1);
curl_setopt($ch,CURLOPT_CONNECTTIMEOUT,5);
$content = curl_exec($ch);
curl_close($ch);
if (preg_match("/root.App.main = (.*);/",$content,$Regs)) {
  $data_txt = $Regs[1];
} else {
  die("Could not get data\n");
}
$data = json_decode($data_txt);

#$tmp = var_export($data,true);
#dprint("Got the following:\n$tmp", 4);
#exit;

#  Figure out the teams
$teams = array();

foreach ($data->context->dispatcher->stores->TeamsStore->teams as $key => $val) {
  if (!preg_match('/nfl/',$key)) {
    continue;
  }
  if (!empty($data->context->dispatcher->stores->TeamsStore->teams->$key->abbr)) {
    $abbr = $data->context->dispatcher->stores->TeamsStore->teams->$key->abbr;
    #print "\n<br />$key -> $abbr ";
    $teams[$key] = $abbr;
    $teams[$abbr] = $key;
  }
}


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
#exit;
  
foreach($data->context->dispatcher->stores->GamesStore->games as $game => $val) {
  #print_r($val);
  #exit;

  #  Make sure this is an nfl game
  if (!preg_match('/nfl/',$val->home_team_id)) {
    continue;
  }

  if ($val->status_description == "Final") {
    $Time = "Final";
  } else if (preg_match('/final.*overtime/i', $val->status_description)) {
    $Time = "F/OT";
  } else if (!empty($val->is_halftime) and $val->is_halftime == 'true') {
    $Time = 'Half';
  } else if (!empty($val->last_play->period) and !empty($val->last_play->clock)) {
    $Time = 'Q' . $val->last_play->period . " " . $val->last_play->clock;
  } else {
    $Time = "";
  }
  
  #  These values come from the external API and are interpolated into SQL
  #  below, so constrain them: scores must be integers and $Time is limited
  #  to the characters the formats above can produce
  $Time = preg_replace('/[^A-Za-z0-9\/: .]/', '', $Time);

  dprint ("Time = $Time");
  $Home = $teams[$val->home_team_id];
  $HomeScore = intval($val->total_home_points);
  $Away = $teams[$val->away_team_id];
  $AwayScore = intval($val->total_away_points);

  if (!preg_match("/^[A-Z]{2,3}$/", $Home)) {
    print "Invalid Home team!";
    exit;
  }

  if (!preg_match("/^[A-Z]{2,3}$/", $Away)) {
    print "Invalid Away team!";
    exit;
  }

  #print "$Away:$AwayScore $Home:$HomeScore $Time\n";
  #continue;
  #exit;

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
    }
    dprint ("GameId = $GameId");

    ##  Update game info
    #$info = json_encode($game);
    #$info = pg_escape_string($info);
    #dprint('Updating game info');
    #dprint("info = $info", 4);
    #$Sql = "update games set info='$info' where id=$GameId";
    ##print "Sql = $Sql\n";
    #$Result2 = dbquery($Sql);

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
      #print "$Sql\n";
      $Result = dbquery($Sql);
      if (preg_match('/final/i', $val->status_description)) {
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
#print "\nFix Me!\n"; exit;

#  Force an update every time
#$DoUpdate=1;
if ($DoUpdate) {
  dprint('Updating results ...');
  #print "Games have completed - updating ...\n";
  include 'update_losers.inc';
  include 'update_teamrecords.inc';
  include 'update_individualrecords.inc';
}
