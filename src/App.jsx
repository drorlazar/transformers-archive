import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import HomePage from './pages/HomePage';
import SeriesPage from './pages/SeriesPage';
import AboutPage from './pages/AboutPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter basename="/transformers-archive">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/series/:slug" element={<SeriesPage />} />
        <Route path="/series/:slug/characters" element={<SeriesPage />} />
        <Route path="/series/:slug/media" element={<SeriesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
