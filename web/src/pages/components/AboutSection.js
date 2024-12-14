import { Box, Grid, GridItem, Heading, Text } from '@chakra-ui/react';

const AboutSection = () => {
  return (
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
  );
};

export default AboutSection;

