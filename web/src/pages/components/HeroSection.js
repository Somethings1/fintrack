import { Box, Heading, Text, Button} from '@chakra-ui/react';
import { Link } from 'react-router-dom';

const HeroSection = () => {
  return (
    <Box
      textAlign="center"
      py={20}
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      bgImage="url('/bg.jpg')"
      bgSize="cover"
      bgPosition="center"
    >
      <Heading fontSize="5xl">Welcome to Fintrack</Heading>
      <Text fontSize="lg" mt={4}>
        Track your personal finance with top-level AI
      </Text>
      <Link to="/auth">
      <Button colorScheme="teal" size="lg" mt={6}>
        Get Started
      </Button>
      </Link>
    </Box>
  );
};

export default HeroSection;

