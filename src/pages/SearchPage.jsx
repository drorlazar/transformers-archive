import { useSearchParams, Link } from 'react-router-dom';
import { useSeriesIndex } from '../hooks/useSeriesData';
import { assetUrl } from '../utils/assetUrl';
import './SearchPage.css';

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') || '').toLowerCase().trim();
  const { index, loading } = useSeriesIndex();

  if (loading) {
    return (
      <div className="search-page search-page--loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!query) {
    return (
      <div className="search-page">
        <div className="search-page__header">
          <h1>Search</h1>
          <p>Enter a search term to find series, characters, or episodes.</p>
        </div>
      </div>
    );
  }

  // Search through series index
  const seriesResults = (index || []).filter(s => {
    const searchable = [
      s.title, s.slug, s.synopsis, s.era,
      ...(s.tags || []),
    ].join(' ').toLowerCase();
    return searchable.includes(query);
  });

  const totalResults = seriesResults.length;

  return (
    <div className="search-page">
      <div className="search-page__header">
        <h1>Search Results</h1>
        <p>
          {totalResults} result{totalResults !== 1 ? 's' : ''} for "<strong>{params.get('q')}</strong>"
        </p>
      </div>

      {seriesResults.length > 0 && (
        <section className="search-section">
          <h2 className="search-section__title">Series</h2>
          <div className="search-results">
            {seriesResults.map(s => (
              <Link to={`/series/${s.slug}`} key={s.slug} className="search-result">
                <div className="search-result__poster">
                  <img
                    src={assetUrl(s.poster)}
                    alt={s.title}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
                <div className="search-result__info">
                  <h3 className="search-result__title">{s.title}</h3>
                  <div className="search-result__meta">
                    <span>{s.year_start}{s.year_end && s.year_end !== s.year_start ? `–${s.year_end}` : ''}</span>
                    <span>{s.episode_count} episode{s.episode_count !== 1 ? 's' : ''}</span>
                    {s.tags && s.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="search-result__tag">{tag}</span>
                    ))}
                  </div>
                  <p className="search-result__synopsis">{s.synopsis}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {totalResults === 0 && (
        <div className="search-empty">
          <p>No results found. Try searching for a series name, character, or tag.</p>
        </div>
      )}
    </div>
  );
}
