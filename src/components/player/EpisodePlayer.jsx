import './EpisodePlayer.css';

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : null;
}

export default function EpisodePlayer({ episode }) {
  if (!episode) return null;

  // Try YouTube links from watch_links
  let youtubeId = null;
  if (episode.watch_links) {
    for (const link of episode.watch_links) {
      const id = extractYouTubeId(link.url);
      if (id) {
        youtubeId = id;
        break;
      }
    }
  }

  // Fallback: direct youtube_url field
  if (!youtubeId && episode.youtube_url) {
    youtubeId = extractYouTubeId(episode.youtube_url);
  }

  return (
    <div className="episode-player">
      {youtubeId ? (
        <div className="episode-player__iframe-wrap">
          <iframe
            className="episode-player__iframe"
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`}
            title={episode.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="episode-player__fallback">
          <div className="episode-player__fallback-content">
            <span className="episode-player__fallback-icon">&#9654;</span>
            <p>No video embed available for this episode.</p>
            {episode.watch_links && episode.watch_links.length > 0 && (
              <div className="episode-player__links">
                <p>Watch on:</p>
                {episode.watch_links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="episode-player__link"
                  >
                    {link.source || link.label || 'Watch'}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
