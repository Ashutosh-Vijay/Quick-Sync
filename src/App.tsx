import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import AdminPage from './pages/AdminPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BackgroundCanvas } from './components/BackgroundCanvas';

function App() {
  return (
    <ErrorBoundary>
      <BackgroundCanvas />
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/XX13XX" element={<AdminPage />} />
          <Route path="/room/:roomCode" element={<RoomPage />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
