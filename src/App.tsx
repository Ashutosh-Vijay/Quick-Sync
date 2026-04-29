import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BackgroundCanvas } from './components/BackgroundCanvas';

const HomePage = lazy(() => import('./pages/HomePage'));
const RoomPage = lazy(() => import('./pages/RoomPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function App() {
  return (
    <ErrorBoundary>
      <BackgroundCanvas />
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/room/XX13XX" element={<AdminPage />} />
            <Route path="/room/:roomCode" element={<RoomPage />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
