import './CharacterCard.css';

const FACTION_COLORS = {
  autobot: 'var(--accent-red)',
  maximal: 'var(--accent-red)',
  decepticon: '#9b59b6',
  predacon: '#9b59b6',
  neutral: 'var(--text-tertiary)',
};

export default function CharacterCard({ character }) {
  const faction = character.faction?.toLowerCase() || 'neutral';
  const factionColor = FACTION_COLORS[faction] || FACTION_COLORS.neutral;
  const image = character.image || '';

  return (
    <div className="character-card" style={{ '--faction-color': factionColor }}>
      <div className="character-card__image">
        {image ? (
          <img src={image} alt={character.name} loading="lazy" />
        ) : (
          <div className="character-card__placeholder">
            <span>{character.name?.[0] || '?'}</span>
          </div>
        )}
      </div>
      <div className="character-card__info">
        <h4 className="character-card__name">{character.name}</h4>
        {character.faction && (
          <span className="character-card__faction">{character.faction}</span>
        )}
        {(character.alt_mode || character.beast_mode) && (
          <span className="character-card__alt-mode">{character.alt_mode || character.beast_mode}</span>
        )}
        {character.voice_actor && (
          <span className="character-card__voice">
            Voice: {character.voice_actor}
          </span>
        )}
      </div>
    </div>
  );
}
