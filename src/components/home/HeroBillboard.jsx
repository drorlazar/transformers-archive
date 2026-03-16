import { Link } from 'react-router-dom';
import { getEpisodeCount, getSeasonCount } from '../../hooks/useSeriesData';
import './HeroBillboard.css';

export default function HeroBillboard({ series }) {
  if (!series) return null;

  const bgImage = series.banner || series.poster || '';

  return (
    <section
      className="hero-billboard"
      style={{
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
      }}
    >
      <div className="hero-billboard__vignette" />
      <div className="hero-billboard__content">
        <h1 className="hero-billboard__title">{series.title}</h1>
        <div className="hero-billboard__meta">
          <span className="hero-billboard__year">
            {series.year_start}
            {series.year_end ? `\u2013${series.year_end}` : '\u2013Present'}
          </span>
          {series.seasons_count && (
            <span className="hero-billboard__seasons">
              {series.seasons_count} Season{series.seasons_count !== 1 ? 's' : ''}
            </span>
          )}
          {series.episode_count && (
            <span className="hero-billboard__episodes">
              {series.episode_count} Episode{series.episode_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="hero-billboard__synopsis">{series.synopsis}</p>
        <div className="hero-billboard__actions">
          <Link to={`/series/${series.slug}`} className="hero-billboard__btn hero-billboard__btn--play">
            <span className="hero-billboard__btn-icon">&#9654;</span>
            Explore
          </Link>
          <Link to={`/series/${series.slug}`} className="hero-billboard__btn hero-billboard__btn--info">
            <span className="hero-billboard__btn-icon">&#9432;</span>
            More Info
          </Link>
        </div>
      </div>
    </section>
  );
}
