import './MediaCard.css';

const SOURCE_STYLES = {
  youtube: { bg: '#cc0000', label: 'YouTube' },
  telegram: { bg: '#0088cc', label: 'Telegram' },
};

export default function MediaCard({ media }) {
  const source = media.source?.toLowerCase() || '';
  const sourceStyle = SOURCE_STYLES[source] || { bg: 'var(--text-tertiary)', label: media.source || 'Link' };
  const thumb = media.thumbnail || '';

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className="media-card"
    >
      <div className="media-card__thumb">
        {thumb ? (
          <img src={thumb} alt={media.title} loading="lazy" />
        ) : (
          <div className="media-card__thumb-placeholder">
            <span>&#9654;</span>
          </div>
        )}
        <span
          className="media-card__source-badge"
          style={{ background: sourceStyle.bg }}
        >
          {sourceStyle.label}
        </span>
      </div>
      <div className="media-card__info">
        <h4 className="media-card__title">{media.title}</h4>
        {media.description && (
          <p className="media-card__desc">{media.description}</p>
        )}
        {media.type && (
          <span className="media-card__type">{media.type}</span>
        )}
      </div>
    </a>
  );
}
