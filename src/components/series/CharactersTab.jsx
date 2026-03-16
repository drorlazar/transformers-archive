import CharacterCard from './CharacterCard';
import './CharactersTab.css';

export default function CharactersTab({ series }) {
  const characters = series?.characters || [];

  if (characters.length === 0) {
    return (
      <div className="characters-tab">
        <p className="characters-tab__empty">No character data available yet.</p>
      </div>
    );
  }

  return (
    <div className="characters-tab">
      <h3 className="characters-tab__title">Characters</h3>
      <div className="characters-tab__grid">
        {characters.map((char, i) => (
          <CharacterCard key={char.name || i} character={char} />
        ))}
      </div>
    </div>
  );
}
