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

  const videoData = episode.video || {};
  const youtubeUrl = videoData.youtube;
  const youtubeId = extractYouTubeId(youtubeUrl);

  const searchQuery = encodeURIComponent(`${episode.title} Transformers full episode`);

  if (youtubeId) {
    return (
      <div className="episode-player">
        <div className="episode-player__iframe-wrap">
          <iframe
            className="episode-player__iframe"
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`}
            title={episode.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="episode-player__search-link">
          Video not working?{' '}
          <a
            href={`https://www.youtube.com/results?search_query=${searchQuery}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Search on YouTube
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="episode-player">
      <div className="episode-player__fallback">
        <div className="episode-player__fallback-content">
          <span className="episode-player__fallback-icon">&#9654;</span>
          {videoData.dailymotion ? (
            <>
              <p>This episode is available on Dailymotion</p>
              <a
                href={videoData.dailymotion}
                target="_blank"
                rel="noopener noreferrer"
                className="episode-player__link"
              >
                Watch on Dailymotion
              </a>
            </>
          ) : videoData.other ? (
            <>
              <p>This episode is available externally</p>
              <a
                href={videoData.other}
                target="_blank"
                rel="noopener noreferrer"
                className="episode-player__link"
              >
                Watch Episode
              </a>
            </>
          ) : (
            <>
              <p>No video embed available for this episode.</p>
              <a
                href={`https://www.youtube.com/results?search_query=${searchQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="episode-player__link"
              >
                Search on YouTube
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
