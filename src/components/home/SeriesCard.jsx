import { Link } from 'react-router-dom';
import LiveBadge from './LiveBadge';
import './SeriesCard.css';

export default function SeriesCard({ series }) {
  const poster = series.poster || '';

  return (
    <Link to={`/series/${series.slug}`} className="series-card" title={series.title}>
      <div className="series-card__poster">
        {poster ? (
          <img src={poster} alt={series.title} loading="lazy" />
        ) : (
          <div className="series-card__placeholder">
            <span>{series.title?.[0] || '?'}</span>
          </div>
        )}
        {series.status === 'airing' && (
          <div className="series-card__live">
            <LiveBadge />
          </div>
        )}
        <div className="series-card__overlay">
          <span className="series-card__play-icon">&#9654;</span>
        </div>
      </div>
      <div className="series-card__info">
        <h3 className="series-card__title">{series.title}</h3>
        <div className="series-card__meta">
          <span className="series-card__year">
            {series.year_start}
            {series.year_end ? `\u2013${series.year_end}` : ''}
          </span>
          {series.episode_count && (
            <span className="series-card__episodes">
              {series.episode_count} ep
            </span>
          )}
        </div>
        {series.synopsis && (
          <p className="series-card__synopsis">{series.synopsis}</p>
        )}
      </div>
    </Link>
  );
}
