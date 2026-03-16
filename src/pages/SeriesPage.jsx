import { useParams, useLocation } from 'react-router-dom';
import { useSeriesData } from '../hooks/useSeriesData';
import SeriesHero from '../components/series/SeriesHero';
import TabBar from '../components/series/TabBar';
import EpisodesTab from '../components/series/EpisodesTab';
import CharactersTab from '../components/series/CharactersTab';
import MediaHubTab from '../components/series/MediaHubTab';
import TriviaTab from '../components/series/TriviaTab';
import NotFoundPage from './NotFoundPage';
import './SeriesPage.css';

function getActiveTab(pathname, slug) {
  if (pathname.endsWith('/characters')) return 'characters';
  if (pathname.endsWith('/media')) return 'media';
  if (pathname.endsWith('/trivia')) return 'trivia';
  return 'episodes';
}

export default function SeriesPage() {
  const { slug } = useParams();
  const location = useLocation();
  const { series, loading, error } = useSeriesData(slug);

  const activeTab = getActiveTab(location.pathname, slug);

  if (loading) {
    return (
      <div className="series-page series-page--loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || !series) {
    return <NotFoundPage />;
  }

  return (
    <div className="series-page">
      <SeriesHero series={series} />
      <TabBar slug={slug} />
      <div className="series-page__content">
        {activeTab === 'episodes' && <EpisodesTab series={series} />}
        {activeTab === 'characters' && <CharactersTab series={series} />}
        {activeTab === 'media' && <MediaHubTab series={series} />}
        {activeTab === 'trivia' && <TriviaTab series={series} />}
      </div>
    </div>
  );
}
