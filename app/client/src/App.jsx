import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SelectAccount from './pages/SelectAccount';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

function App() {
  // Get base path from Vite env (will be '/monitor/')
  const basename = (import.meta.env.BASE_URL || '/monitor/').replace(/\/$/, '');
  
  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/select-account" 
          element={
            <ProtectedRoute>
              <SelectAccount />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/select-account" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
