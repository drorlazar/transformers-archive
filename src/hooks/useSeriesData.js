import { useState, useEffect, useCallback } from 'react';

const seriesCache = {};
let indexCache = null;
let erasCache = null;

export function getEpisodeCount(series) {
  if (!series?.seasons) return 0;
  return series.seasons.reduce((sum, s) => sum + (s.episodes?.length || 0), 0);
}

export function getSeasonCount(series) {
  return series?.seasons?.length || 0;
}

export function useSeriesIndex() {
  const [index, setIndex] = useState(indexCache);
  const [loading, setLoading] = useState(!indexCache);

  useEffect(() => {
    if (indexCache) return;
    import('../data/series-index.json').then((mod) => {
      indexCache = mod.default;
      setIndex(mod.default);
      setLoading(false);
    });
  }, []);

  return { index, loading };
}

export function useEras() {
  const [eras, setEras] = useState(erasCache);
  const [loading, setLoading] = useState(!erasCache);

  useEffect(() => {
    if (erasCache) return;
    import('../data/eras.json').then((mod) => {
      erasCache = mod.default;
      setEras(mod.default);
      setLoading(false);
    });
  }, []);

  return { eras, loading };
}

export function useSeriesData(slug) {
  const [series, setSeries] = useState(seriesCache[slug] || null);
  const [loading, setLoading] = useState(!seriesCache[slug]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    if (seriesCache[slug]) {
      setSeries(seriesCache[slug]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    import(`../data/series/${slug}.json`)
      .then((mod) => {
        seriesCache[slug] = mod.default;
        setSeries(mod.default);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load series');
        setLoading(false);
      });
  }, [slug]);

  return { series, loading, error };
}

export function useHomeData() {
  const { index, loading: indexLoading } = useSeriesIndex();
  const { eras, loading: erasLoading } = useEras();

  const loading = indexLoading || erasLoading;
  const error = null;

  const getSeriesByEra = useCallback(
    (eraId) => {
      if (!index) return [];
      return index
        .filter((s) => s.era === eraId)
        .sort((a, b) => a.year_start - b.year_start);
    },
    [index]
  );

  const getFeatured = useCallback(() => {
    if (!index || index.length === 0) return null;
    // Pick a random featured series each load
    return index[Math.floor(Math.random() * index.length)];
  }, [index]);

  const getLiveNow = useCallback(() => {
    if (!index) return [];
    return index.filter((s) => s.has_live_streams);
  }, [index]);

  return { index, eras, loading, error, getSeriesByEra, getFeatured, getLiveNow };
}
