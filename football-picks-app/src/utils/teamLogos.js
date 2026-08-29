// Maps a team nickname to its logo filename in /public/images.
// All logo files are the lowercased nickname (e.g. "Bears" -> bears.svg).
export function getTeamImageName(teamName) {
  return (teamName || '').toLowerCase();
}

export function teamLogoSrc(teamName) {
  return `/images/${getTeamImageName(teamName)}.svg`;
}
