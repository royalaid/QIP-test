import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './providers/ThemeProvider'
import { Web3Provider } from './providers/Web3Provider'
import { getBasePath } from './utils/routing'
import Layout from './layout'

// Pages
import HomePage from './pages/HomePage'
import AllProposals from './pages/AllProposals'
import CreateProposal from './pages/CreateProposal'
import QIPDetail from "./pages/QIPDetail";
import EditProposal from "./pages/EditProposal";
import Debug from "./pages/Debug";

function App() {
  // Get the base path for React Router
  const basePath = getBasePath();
  console.log("React Router basename:", basePath || "/");

  return (
    <ThemeProvider>
      <Web3Provider>
        <Router basename={basePath}>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/all-proposals" element={<AllProposals />} />
              <Route path="/qips/:qipNumber" element={<QIPDetail />} />
              <Route path="/create-proposal" element={<CreateProposal />} />
              <Route path="/edit-proposal" element={<EditProposal />} />
              <Route path="/debug" element={<Debug />} />
            </Routes>
          </Layout>
        </Router>
      </Web3Provider>
    </ThemeProvider>
  );
}

export default App