import React from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import LocalModeBanner from '../components/LocalModeBanner';

interface Props {
    children: React.ReactNode;
}

const Layout: React.FC<Props> = ({ children }) => {
    // Theme is now managed by the ThemeProvider context

    return (
        <main className="min-h-screen">
            <LocalModeBanner />
            
            <header className="site-header h-20" role="banner">
                <Navigation />
            </header>

            <main className="page-content">
                <div className="wrapper">{children}</div>
            </main>

            <Footer />

        </main>
    );
};

export default Layout;
