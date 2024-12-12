import React from 'react';
import { Box } from '@chakra-ui/react';
import HeroSection from './components/HeroSection';
import AboutSection from './components/AboutSection';
import Footer from './components/Footer';

const WelcomePage = () => {
    return (
        <Box>
            <HeroSection />
            <AboutSection />
            <Footer />
        </Box>
    );
};

export default WelcomePage;

