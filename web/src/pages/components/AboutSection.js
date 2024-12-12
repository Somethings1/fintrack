import { Box, Grid, GridItem, Heading, Text } from '@chakra-ui/react';

const AboutSection = () => {
  return (
    <Box p={10} bg="gray.100">
      <Heading textAlign="center" mb={10}>
        About Ethereum
      </Heading>
      <Grid templateColumns="repeat(3, 1fr)" gap={6}>
        <GridItem>
          <Heading size="md">Decentralized</Heading>
          <Text>Build on a blockchain that no single entity controls.</Text>
        </GridItem>
        <GridItem>
          <Heading size="md">Secure</Heading>
          <Text>Smart contracts ensure trust and safety.</Text>
        </GridItem>
        <GridItem>
          <Heading size="md">Scalable</Heading>
          <Text>Power your applications with a global network.</Text>
        </GridItem>
      </Grid>
    </Box>
  );
};

export default AboutSection;

