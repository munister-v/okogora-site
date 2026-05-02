import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import AdminPage from './pages/AdminPage.tsx';
import PostPage from './pages/PostPage.tsx';
import InvestigationPage from './pages/InvestigationPage.tsx';
import TargetsPage from './pages/TargetsPage.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/post/:id" element={<PostPage />} />
        <Route path="/investigation/:id" element={<InvestigationPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/targets" element={<TargetsPage />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
