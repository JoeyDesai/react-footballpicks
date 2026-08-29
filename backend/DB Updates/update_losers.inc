<?php
# DEBUG: Script started
echo "DEBUG: Losers script started at " . date('Y-m-d H:i:s') . "\n";

# Include database setup
$CurYear = 2026;
require_once '../sql.inc';

#  Loop through each game, setting the losers as needed
$Sql = "SELECT id, home, away, winner, loser FROM games WHERE winner is
not null and winner = COALESCE(loser, winner)";
$result = dbquery($Sql);
foreach ($result as $row) {
   $home = $row['home'];
   $away = $row['away'];
   $winner = $row['winner'];
   #$dbloser = $row['loser'];
   $id = $row['id'];
   if ($winner == 0) {
     $loser = $winner;
   } else if ($winner == $home) {
     $loser = $away;
   } else {
     $loser = $home;
   }
   #if ($dbloser != $loser) {
     $Sql = "UPDATE games SET winner=$winner, loser=$loser WHERE id=$id";
     dbquery($Sql);
   #}
}

# DEBUG: Script completed
echo "DEBUG: Losers script completed at " . date('Y-m-d H:i:s') . "\n";
?>
