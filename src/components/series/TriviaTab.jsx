import './TriviaTab.css';

const CATEGORY_COLORS = {
  production: 'var(--accent-red)',
  easter_egg: 'var(--accent-blue)',
  continuity: 'var(--accent-green)',
  voice_cast: '#e6a23c',
  fun_fact: '#9b59b6',
};

export default function TriviaTab({ series }) {
  const triviaItems = series?.trivia || [];

  if (triviaItems.length === 0) {
    return (
      <div className="trivia-tab">
        <p className="trivia-tab__empty">No trivia available yet.</p>
      </div>
    );
  }

  return (
    <div className="trivia-tab">
      <h3 className="trivia-tab__title">Trivia &amp; Fun Facts</h3>
      <div className="trivia-tab__list">
        {triviaItems.map((item, i) => {
          const cat = item.category?.toLowerCase().replace(/\s+/g, '_') || '';
          const borderColor = CATEGORY_COLORS[cat] || 'var(--text-tertiary)';

          return (
            <div
              key={i}
              className="trivia-tab__item"
              style={{ '--trivia-border': borderColor }}
            >
              {item.category && (
                <span className="trivia-tab__category">{item.category}</span>
              )}
              <p className="trivia-tab__text">{item.text}</p>
              {item.source && (
                <span className="trivia-tab__source">Source: {item.source}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
