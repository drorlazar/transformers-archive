import MediaCard from './MediaCard';
import './MediaHubTab.css';

export default function MediaHubTab({ series }) {
  const mediaItems = series?.media || [];

  if (mediaItems.length === 0) {
    return (
      <div className="media-hub-tab">
        <p className="media-hub-tab__empty">No media links available yet.</p>
      </div>
    );
  }

  return (
    <div className="media-hub-tab">
      <h3 className="media-hub-tab__title">Media Hub</h3>
      <div className="media-hub-tab__grid">
        {mediaItems.map((item, i) => (
          <MediaCard key={item.url || i} media={item} />
        ))}
      </div>
    </div>
  );
}
