import { useState } from 'react';
import EpisodeCard from './EpisodeCard';
import TransformPlayer from '../player/TransformPlayer';
import './EpisodesTab.css';

export default function EpisodesTab({ series }) {
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [playingEpisode, setPlayingEpisode] = useState(null);
  const [playingSeasonNum, setPlayingSeasonNum] = useState(null);

  if (!series?.seasons || series.seasons.length === 0) {
    return (
      <div className="episodes-tab">
        <p className="episodes-tab__empty">No episodes available yet.</p>
      </div>
    );
  }

  const season = series.seasons.find((s) => s.number === selectedSeason) || series.seasons[0];

  function handleEpisodeClick(episode) {
    setPlayingEpisode(episode);
    setPlayingSeasonNum(season.number);
  }

  function handleClosePlayer() {
    setPlayingEpisode(null);
    setPlayingSeasonNum(null);
  }

  return (
    <div className="episodes-tab">
      <div className="episodes-tab__header">
        <h3 className="episodes-tab__section-title">Episodes</h3>
        {series.seasons.length > 1 && (
          <div className="episodes-tab__dropdown-wrap">
            <select
              className="episodes-tab__dropdown"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
            >
              {series.seasons.map((s) => (
                <option key={s.number} value={s.number}>
                  Season {s.number}
                  {s.title ? `: ${s.title}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="episodes-tab__list">
        {season.episodes && season.episodes.length > 0 ? (
          season.episodes.map((ep) => (
            <EpisodeCard
              key={ep.number}
              episode={ep}
              onClick={handleEpisodeClick}
            />
          ))
        ) : (
          <p className="episodes-tab__empty">No episodes in this season.</p>
        )}
      </div>

      {playingEpisode && (
        <TransformPlayer
          episode={playingEpisode}
          seasonNum={playingSeasonNum}
          seriesTitle={series.title}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  );
}
