import { useSeriesIndex } from '../hooks/useSeriesData';
import './AboutPage.css';

export default function AboutPage() {
  const { index } = useSeriesIndex();

  const totalEpisodes = index ? index.reduce((sum, s) => sum + (s.episode_count || 0), 0) : 844;
  const totalSeries = index ? index.length : 23;

  return (
    <div className="about-page">
      <div className="about-hero">
        <h1 className="about-title">The Definitive Transformers<br />TV Series Archive</h1>
        <p className="about-tagline">More than meets the eye.</p>
      </div>

      <div className="about-content">
        <section className="about-section">
          <p className="about-intro">
            This is the most comprehensive archive of Transformers animated television
            ever assembled in one place. Every series. Every episode. Every character.
            From the original 1984 cartoon that started it all, through four decades of
            animated storytelling, to the modern era — all curated, organized, and playable.
          </p>
        </section>

        <section className="about-stats">
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-number">{totalSeries}</span>
              <span className="stat-label">Animated Series</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{totalEpisodes}</span>
              <span className="stat-label">Episodes</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">100%</span>
              <span className="stat-label">Playable on YouTube</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">282</span>
              <span className="stat-label">Characters Cataloged</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">40+</span>
              <span className="stat-label">Years of Transformers</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">7</span>
              <span className="stat-label">Eras Covered</span>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h2>What's Inside</h2>
          <div className="about-features">
            <div className="about-feature">
              <h3>Generation One Era (1984-1992)</h3>
              <p>
                The original series, the iconic 1986 movie, Scramble City, and the complete
                Japanese G1 continuity — Headmasters, Super-God Masterforce, Victory, and Zone.
              </p>
            </div>
            <div className="about-feature">
              <h3>Beast Era (1996-2001)</h3>
              <p>
                Beast Wars, Beast Wars II, Beast Wars Neo, and Beast Machines — the
                groundbreaking CGI series that redefined what Transformers could be.
              </p>
            </div>
            <div className="about-feature">
              <h3>Unicron Trilogy (2001-2007)</h3>
              <p>
                Robots in Disguise, Armada, Energon, and Cybertron — the anime-influenced
                era that introduced Mini-Cons and spanned the galaxy.
              </p>
            </div>
            <div className="about-feature">
              <h3>Modern Era (2007-Present)</h3>
              <p>
                From the critically acclaimed Animated and Emmy-winning Prime, through
                Cyberverse and the Prime Wars Trilogy — every modern animated series.
              </p>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h2>Built for Fans, by Fans</h2>
          <p>
            Every episode has a direct YouTube link — click and watch instantly. Character
            profiles with artwork from TFWiki. Media hubs linking to YouTube playlists,
            Dailymotion, Internet Archive, and Telegram communities. Episode data sourced
            from TFWiki.net, the definitive Transformers encyclopedia.
          </p>
          <p>
            No movies. No live-action. Pure animated television, the way it was meant to be watched.
          </p>
        </section>

        <section className="about-section about-footer">
          <p className="about-disclaimer">
            This is a fan project. Transformers is a trademark of Hasbro, Inc.
            All series artwork belongs to their respective rights holders.
            Episode links are sourced from publicly available YouTube uploads.
          </p>
        </section>
      </div>
    </div>
  );
}
