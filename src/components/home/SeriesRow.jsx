import { useRef, useState, useCallback } from 'react';
import SeriesCard from './SeriesCard';
import './SeriesRow.css';

export default function SeriesRow({ title, items }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="series-row">
      <h2 className="series-row__title">{title}</h2>
      <div className="series-row__container">
        {canScrollLeft && (
          <button
            className="series-row__arrow series-row__arrow--left"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            &#8249;
          </button>
        )}
        <div
          className="series-row__scroller"
          ref={scrollRef}
          onScroll={checkScroll}
        >
          {items.map((series) => (
            <SeriesCard key={series.slug} series={series} />
          ))}
        </div>
        {canScrollRight && items.length > 3 && (
          <button
            className="series-row__arrow series-row__arrow--right"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            &#8250;
          </button>
        )}
      </div>
    </div>
  );
}
