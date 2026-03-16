import { useParams, Link } from 'react-router-dom';
import { useSeriesData } from '../hooks/useSeriesData';
import Breadcrumbs from '../components/layout/Breadcrumbs';
import EpisodePlayer from '../components/player/EpisodePlayer';
import EpisodeNav from '../components/player/EpisodeNav';
import './EpisodePage.css';

export default function EpisodePage() {
  const { slug, season, episode: episodeNum } = useParams();
  const { series, loading, error } = useSeriesData(slug);

  const seasonNumber = Number(season);
  const episodeNumber = Number(episodeNum);

  if (loading) {
    return (
      <div className="episode-page episode-page--loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="episode-page episode-page--error">
        <h2>Episode Not Found</h2>
        <p>{error || 'Could not load this episode.'}</p>
        <Link to="/" className="episode-page__back">Back to Home</Link>
      </div>
    );
  }

  const seasonData = series.seasons?.find((s) => s.number === seasonNumber);
  const episode = seasonData?.episodes?.find(
    (e) => e.number === episodeNumber
  );

  if (!episode) {
    return (
      <div className="episode-page episode-page--error">
        <h2>Episode Not Found</h2>
        <p>
          Season {seasonNumber}, Episode {episodeNumber} does not exist in{' '}
          {series.title}.
        </p>
        <Link to={`/series/${slug}`} className="episode-page__back">
          Back to {series.title}
        </Link>
      </div>
    );
  }

  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: series.title, to: `/series/${slug}` },
    {
      label: `S${seasonNumber} E${episodeNumber}`,
    },
  ];

  return (
    <div className="episode-page">
      <Breadcrumbs items={breadcrumbs} />

      <div className="episode-page__player-section">
        <EpisodePlayer episode={episode} />
      </div>

      <div className="episode-page__info">
        <h1 className="episode-page__title">{episode.title}</h1>
        <div className="episode-page__meta">
          <span className="episode-page__season">
            Season {seasonNumber}, Episode {episodeNumber}
          </span>
          {episode.air_date && (
            <span className="episode-page__date">{episode.air_date}</span>
          )}
          {episode.duration && (
            <span className="episode-page__duration">{episode.duration}</span>
          )}
        </div>
        {episode.synopsis && (
          <p className="episode-page__synopsis">{episode.synopsis}</p>
        )}
        {episode.writers && episode.writers.length > 0 && (
          <p className="episode-page__credits">
            <strong>Written by:</strong> {episode.writers.join(', ')}
          </p>
        )}
        {episode.director && (
          <p className="episode-page__credits">
            <strong>Directed by:</strong> {episode.director}
          </p>
        )}
      </div>

      <div className="episode-page__nav-section">
        <EpisodeNav
          seriesSlug={slug}
          seasons={series.seasons}
          currentSeason={seasonNumber}
          currentEpisode={episodeNumber}
        />
      </div>
    </div>
  );
}
