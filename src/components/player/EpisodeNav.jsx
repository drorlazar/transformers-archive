import { Link } from 'react-router-dom';
import './EpisodeNav.css';

export default function EpisodeNav({ seriesSlug, seasons, currentSeason, currentEpisode }) {
  if (!seasons || !seriesSlug) return null;

  const seasonData = seasons.find((s) => s.number === currentSeason);
  if (!seasonData || !seasonData.episodes) return null;

  const epIndex = seasonData.episodes.findIndex(
    (e) => e.number === currentEpisode
  );

  let prevLink = null;
  let nextLink = null;
  let prevLabel = null;
  let nextLabel = null;

  // Previous episode
  if (epIndex > 0) {
    const prev = seasonData.episodes[epIndex - 1];
    prevLink = `/series/${seriesSlug}/s/${currentSeason}/e/${prev.number}`;
    prevLabel = `S${currentSeason} E${prev.number}: ${prev.title}`;
  } else if (currentSeason > 1) {
    // Previous season last episode
    const prevSeason = seasons.find((s) => s.number === currentSeason - 1);
    if (prevSeason && prevSeason.episodes?.length) {
      const lastEp = prevSeason.episodes[prevSeason.episodes.length - 1];
      prevLink = `/series/${seriesSlug}/s/${prevSeason.number}/e/${lastEp.number}`;
      prevLabel = `S${prevSeason.number} E${lastEp.number}: ${lastEp.title}`;
    }
  }

  // Next episode
  if (epIndex < seasonData.episodes.length - 1) {
    const next = seasonData.episodes[epIndex + 1];
    nextLink = `/series/${seriesSlug}/s/${currentSeason}/e/${next.number}`;
    nextLabel = `S${currentSeason} E${next.number}: ${next.title}`;
  } else {
    // Next season first episode
    const nextSeason = seasons.find((s) => s.number === currentSeason + 1);
    if (nextSeason && nextSeason.episodes?.length) {
      const firstEp = nextSeason.episodes[0];
      nextLink = `/series/${seriesSlug}/s/${nextSeason.number}/e/${firstEp.number}`;
      nextLabel = `S${nextSeason.number} E${firstEp.number}: ${firstEp.title}`;
    }
  }

  if (!prevLink && !nextLink) return null;

  return (
    <nav className="episode-nav">
      <div className="episode-nav__inner">
        {prevLink ? (
          <Link to={prevLink} className="episode-nav__btn episode-nav__btn--prev">
            <span className="episode-nav__arrow">&larr;</span>
            <span className="episode-nav__label">
              <span className="episode-nav__dir">Previous</span>
              <span className="episode-nav__ep-title">{prevLabel}</span>
            </span>
          </Link>
        ) : (
          <div />
        )}
        {nextLink ? (
          <Link to={nextLink} className="episode-nav__btn episode-nav__btn--next">
            <span className="episode-nav__label">
              <span className="episode-nav__dir">Next</span>
              <span className="episode-nav__ep-title">{nextLabel}</span>
            </span>
            <span className="episode-nav__arrow">&rarr;</span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </nav>
  );
}
