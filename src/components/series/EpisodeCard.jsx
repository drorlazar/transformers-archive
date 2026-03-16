import { Link } from 'react-router-dom';
import './EpisodeCard.css';

export default function EpisodeCard({ episode, seriesSlug, seasonNum }) {
  const thumb = episode.thumbnail || '';
  const epLink = `/series/${seriesSlug}/s/${seasonNum}/e/${episode.number}`;

  return (
    <Link to={epLink} className="episode-card">
      <div className="episode-card__thumb">
        {thumb ? (
          <img src={thumb} alt={episode.title} loading="lazy" />
        ) : (
          <div className="episode-card__thumb-placeholder">
            <span>E{episode.number}</span>
          </div>
        )}
        <div className="episode-card__play-overlay">
          <span className="episode-card__play-icon">&#9654;</span>
        </div>
        {episode.duration && (
          <span className="episode-card__duration">{episode.duration}</span>
        )}
      </div>
      <div className="episode-card__info">
        <div className="episode-card__header">
          <span className="episode-card__number">{episode.number}.</span>
          <h4 className="episode-card__title">{episode.title}</h4>
        </div>
        {episode.synopsis && (
          <p className="episode-card__synopsis">{episode.synopsis}</p>
        )}
        {episode.air_date && (
          <span className="episode-card__date">{episode.air_date}</span>
        )}
      </div>
    </Link>
  );
}
