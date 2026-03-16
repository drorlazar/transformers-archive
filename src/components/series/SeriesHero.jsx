import './SeriesHero.css';

export default function SeriesHero({ series }) {
  if (!series) return null;

  const bgImage = series.banner || series.poster || '';

  return (
    <section
      className="series-hero"
      style={{
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
      }}
    >
      <div className="series-hero__vignette" />
      <div className="series-hero__content">
        <h1 className="series-hero__title">{series.title}</h1>
        <div className="series-hero__meta">
          <span className="series-hero__year">
            {series.year_start}
            {series.year_end ? `\u2013${series.year_end}` : '\u2013Present'}
          </span>
          {series.seasons && (
            <span>{series.seasons.length} Season{series.seasons.length !== 1 ? 's' : ''}</span>
          )}
          {series.network && <span>{series.network}</span>}
        </div>
        <p className="series-hero__synopsis">{series.synopsis}</p>
        {series.tags && series.tags.length > 0 && (
          <div className="series-hero__tags">
            {series.tags.map((tag) => (
              <span key={tag} className="series-hero__tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
