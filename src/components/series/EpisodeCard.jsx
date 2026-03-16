import './EpisodeCard.css';

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

export default function EpisodeCard({ episode, onClick }) {
  const youtubeId = extractYouTubeId(episode.video?.youtube);
  const thumb =
    episode.thumbnail ||
    (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : '');

  return (
    <div
      className="episode-card"
      onClick={() => onClick && onClick(episode)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick && onClick(episode);
        }
      }}
    >
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
    </div>
  );
}
