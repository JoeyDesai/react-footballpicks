
<?php
# DEBUG: Script started
echo "DEBUG: Individual Records script started at " . date('Y-m-d H:i:s') . "\n";

# Include database setup
$CurYear = 2026;
require_once '../sql.inc';

#  Delete any existing data for this year
$Sql = "DELETE from scores WHERE week in (select id FROM weeks WHERE year=$CurYear)";
dbquery($Sql);

#  Get all current weeks
$Sql = "SELECT id FROM weeks WHERE year=$CurYear AND startdate < now()";
$result2 = dbquery($Sql);

#  Loop through each person
$Sql = "SELECT id FROM pickers where year=$CurYear";
$result = dbquery($Sql);
foreach ($result as $person) {
  $Pid = $person['id'];
  $TotalScore = 0;
  $TotalRight = 0;

  #  Loop through each week
  foreach ($result2 as $week) {
    $Wid = $week['id'];

    #  Get totals
    $Sql = "SELECT count(*) as num, sum(p.weight * w.factor) as value FROM picks p, pickers pr, weeks w, games g WHERE p.picker = pr.id AND p.game = g.id AND p.guess = g.winner AND g.week = w.id AND w.id = $Wid AND pr.id=$Pid";
    $result3 = dbquery($Sql);
    $Num = $result3[0]['num'];
    $Score = $result3[0]['value'];
    if ($Num == 0) {
      $Score = 0;
    }
    $TotalScore += $Score;
    $TotalRight += $Num;
    ##  Get ties
    $Sql = "SELECT count(*) as num, sum(p.weight * w.factor) as value FROM picks p, pickers pr, weeks w, games g WHERE p.picker = pr.id AND p.game = g.id AND g.winner = 0 AND g.week = w.id AND w.id = $Wid AND pr.id=$Pid";
    $result3 = dbquery($Sql);
    $Num2 = $result3[0]['num'];
    $Score2 = $result3[0]['value'];
    if ($Num2 == 0) {
      $Score2 = 0;
    }
    $Score += $Score2/2.0;
    $Num += $Num2/2.0;
    $TotalScore += $Score2/2.0;
    $TotalRight += $Num2/2.0;
    #print "$Pid - $Wid - $Num - $Score<br>";
    #$Sql = "SELECT count(*) as num, sum(p.weight * w.factor) as value FROM picks p, pickers pr, weeks w, games g WHERE p.picker = pr.id AND p.game = g.id AND g.winner is NULL AND g.week = w.id AND w.id = $Wid AND pr.id=$Pid";
    $Sql = "SELECT count(*) as num, sum(p.weight * w.factor) as value FROM picks p, pickers pr, weeks w, games g WHERE p.picker = pr.id AND p.game = g.id AND g.winner is NULL AND g.week = w.id AND w.id = $Wid AND pr.id=$Pid and ((g.homescore is null) or (g.homescore = g.awayscore) or (p.guess = g.home and g.homescore > g.awayscore) or (p.guess = g.away and g.awayscore > g.homescore))";
    $result3 = dbquery($Sql);
    $PotNum = $result3[0]['num'];
    $PotScore = empty($result3[0]['value'])?0:$result3[0]['value'];
    if ($PotNum == 0) {
      $PotScore = 0;
    }
    $Sql = "DELETE FROM scores WHERE picker=$Pid AND week=$Wid";
    dbquery($Sql);
    $Sql = "INSERT INTO scores (picker, week, score, numright, potscore, potright) VALUES ($Pid, $Wid, $Score, $Num, $PotScore, $PotNum)";
    dbquery($Sql);
  }
  # Insert the totals
  $Sql = "DELETE FROM totalscore WHERE picker=$Pid AND year=$CurYear";
  dbquery($Sql);
  $Sql = "INSERT INTO totalscore (picker, year, score, numright) VALUES ($Pid, $CurYear, $TotalScore, $TotalRight)";
  dbquery($Sql);
}

# DEBUG: Script completed
echo "DEBUG: Individual Records script completed at " . date('Y-m-d H:i:s') . "\n";
?>

