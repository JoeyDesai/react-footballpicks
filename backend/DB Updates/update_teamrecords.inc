<?php
# DEBUG: Script started
echo "DEBUG: Team Records script started at " . date('Y-m-d H:i:s') . "\n";

# Include database setup
$CurYear = 2026;
require_once '../sql.inc';

#  Loop through each team, updating records as needed
$Sql = "SELECT id FROM teams";
$result = dbquery($Sql);
foreach ($result as $row) {
   $Team = $row['id'];
   $Sql = "SELECT count(*) as count from games g, weeks w WHERE
g.winner=$Team and g.week = w.id and w.year=$CurYear";
   $tmp = dbquery($Sql);
   $Wins = $tmp[0]['count'];
   $Sql = "SELECT count(*) as count from games g, weeks w WHERE
g.loser=$Team and g.week = w.id and w.year=$CurYear";
   $tmp = dbquery($Sql);
   $Losses = $tmp[0]['count'];
   $Sql = "SELECT count(*) as count from games g, weeks w WHERE
g.winner=0 and (g.home=$Team or g.away=$Team) and g.week = w.id and
w.year=$CurYear";
   $tmp = dbquery($Sql);
   $Ties = $tmp[0]['count'];
   $Sql = "UPDATE teams SET wins=$Wins, losses=$Losses, ties=$Ties WHERE
id=$Team";
   dbquery($Sql);
}

# DEBUG: Script completed
echo "DEBUG: Team Records script completed at " . date('Y-m-d H:i:s') . "\n";
?>
