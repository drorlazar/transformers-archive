import { useHomeData } from '../hooks/useSeriesData';
import HeroBillboard from '../components/home/HeroBillboard';
import SeriesRow from '../components/home/SeriesRow';
import './HomePage.css';

export default function HomePage() {
  const { index, eras, loading, error, getSeriesByEra, getFeatured, getLiveNow } =
    useHomeData();

  if (loading) {
    return (
      <div className="home-page home-page--loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-page home-page--error">
        <h2>Something went wrong</h2>
        <p>{error}</p>
      </div>
    );
  }

  const featured = getFeatured();
  const liveNow = getLiveNow();

  return (
    <div className="home-page">
      <HeroBillboard series={featured} />

      <div className="home-page__rows">
        {liveNow.length > 0 && (
          <SeriesRow title="Airing Now" items={liveNow} />
        )}

        {eras &&
          eras.map((era) => {
            const eraSeries = getSeriesByEra(era.id);
            if (eraSeries.length === 0) return null;
            return (
              <SeriesRow
                key={era.id}
                title={era.label}
                items={eraSeries}
              />
            );
          })}

        {/* If no eras loaded but we have an index, show all series */}
        {!eras && index && index.length > 0 && (
          <SeriesRow title="All Series" items={index} />
        )}
      </div>
    </div>
  );
}
