import { Link } from 'react-router-dom';
import './NotFoundPage.css';

export default function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-page__content">
        <h1 className="not-found-page__code">404</h1>
        <h2 className="not-found-page__title">Lost in the Space Bridge</h2>
        <p className="not-found-page__text">
          This page seems to have been warped through the Space Bridge to
          another dimension. Even Shockwave could not calculate its location.
        </p>
        <Link to="/" className="not-found-page__btn">
          Return to Base
        </Link>
      </div>
    </div>
  );
}
