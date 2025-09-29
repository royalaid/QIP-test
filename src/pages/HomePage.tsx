import React from 'react'
import { Link } from 'react-router-dom'

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-16">
            <h1 className="text-5xl font-bold mb-8 text-foreground">QiDao Governance Hub</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Welcome to the QiDao Governance Hub. A space to propose and refine QiDao Community Ideas (QCI) before they graduate into
              formal QiDao Improvement Proposals (QIPs) which are decided through Snapshot voting.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Link
              to="/all-proposals"
              className="block p-8 bg-card rounded-xl border hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
            >
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Browse ideas and proposals</h2>
              <p className="text-muted-foreground text-left">
                Explore all the governance ideas organized by status. See what's being drafted and discussed (QCIs) and what gathered enough
                support to be voted on and implemented (QIPs).
              </p>
            </Link>

            <Link
              to="/create-proposal"
              className="block p-8 bg-card rounded-xl border hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
            >
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Start a QCI</h2>
              <p className="text-muted-foreground text-left">
                Have an idea to improve QiDao? Contribute to the DAO by starting your own QCI for community review.
              </p>
            </Link>
          </div>

          {/* How It Works */}
          <div className="bg-muted/50 rounded-xl p-8 mb-16">
            <h3 className="text-2xl font-semibold mb-4 text-foreground">How It Works</h3>
            <p className="text-muted-foreground mb-8 italic">
              This process ensures every idea can have a clear decentralized path from community draft to on-chain execution.
            </p>
            <div className="flex flex-col lg:flex-row items-start justify-center gap-6 text-left">
              <div className="space-y-2 flex-1">
                <div className="text-primary font-bold text-lg">1.</div>
                <p className="text-sm">Start a new QCI draft from scratch or using the templates.</p>
              </div>

              <div className="flex items-center h-full">
                <div className="text-primary text-2xl font-bold hidden lg:block">→</div>
                <div className="text-primary text-2xl font-bold lg:hidden rotate-90">→</div>
              </div>

              <div className="space-y-2 flex-1">
                <div className="text-primary font-bold text-lg">2.</div>
                <p className="text-sm">Share it for community review, get feedback and gather support.</p>
              </div>

              <div className="flex items-center h-full">
                <div className="text-primary text-2xl font-bold hidden lg:block">→</div>
                <div className="text-primary text-2xl font-bold lg:hidden rotate-90">→</div>
              </div>

              <div className="space-y-2 flex-1">
                <div className="text-primary font-bold text-lg">3.</div>
                <p className="text-sm">Any DAO member holding ≥150K aveQI can promote a QCI to QIP and trigger a Snapshot vote.</p>
              </div>

              <div className="flex items-center h-full">
                <div className="text-primary text-2xl font-bold hidden lg:block">→</div>
                <div className="text-primary text-2xl font-bold lg:hidden rotate-90">→</div>
              </div>

              <div className="space-y-2 flex-1">
                <div className="text-primary font-bold text-lg">4.</div>
                <p className="text-sm">Approved proposals are set to be implemented as ratified by the vote.</p>
              </div>
            </div>
          </div>

          {/* Learn More Section */}
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-6 text-foreground decoration-primary/30">
              Learn more in the
              <a
                href="https://docs.mai.finance/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-foreground hover:text-primary"
              >
                docs
              </a>
            </h3>
          </div>

          {/* DAO Glossary */}
          <div className="bg-card rounded-xl border p-8 text-left">
            <h4 className="text-xl font-semibold mb-4 text-foreground">DAO Glossary - QCIs</h4>
            <p className="text-muted-foreground leading-relaxed">
              QiDao Community Ideas (QCI) describe suggestions for improvement to the QiDao protocol, including core protocol parameters,
              platform updates, client APIs, and contract standards. Once a QCI gains support, it can graduate into a QiDao Improvement
              Proposal (QIP) for Snapshot voting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage