import React from 'react';
import { Button, Box, Grid, GridItem, Heading, Text, Flex } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

const WelcomePage = () => {
    return (
        <Box>
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
            <Box p={10} bg="gray.100">
                <Heading textAlign="center" mb={10}>
                    About Fintrack
                </Heading>
                <Grid templateColumns="repeat(3, 1fr)" gap={6}>
                    <GridItem>
                        <Heading size="md">Banking level security</Heading>
                        <Text>All your data is encrypted. No one can access your information, even us.</Text>
                    </GridItem>
                    <GridItem>
                        <Heading size="md">Smart tracking</Heading>
                        <Text>Automatically track your finances with fine-tuning AI per user.</Text>
                    </GridItem>
                    <GridItem>
                        <Heading size="md">Cross-platform</Heading>
                        <Text>Fintrack is available on Web, Desktop and Mobile. Access your finance records from anywhere.Power your applications with a global networkPower your applications with a global network</Text>
                    </GridItem>
                </Grid>
            </Box>
            <Box bg="gray.800" color="white" p={4}>
                <Flex justify="space-between">
                    <Text>&copy; {new Date().getFullYear()} Fintrack</Text>
                </Flex>
            </Box>
        </Box>
    );
};

export default WelcomePage;

