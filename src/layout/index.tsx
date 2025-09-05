import React from 'react';
import { useEffect } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import LocalModeBanner from '../components/LocalModeBanner';

interface Props {
    children: React.ReactNode;
}

const Layout: React.FC<Props> = ({ children }) => {
    // Theme initialization is now handled by ThemeToggle component
    useEffect(() => {
        // Initialize theme on mount to prevent flash
        const savedTheme = localStorage.getItem('theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const theme = savedTheme || systemTheme;
        
        // Apply theme immediately
        if (theme === 'dark') {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
    }, []);

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
