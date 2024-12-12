import { Box, Text, Link, Flex } from '@chakra-ui/react';

const Footer = () => {
  return (
    <Box bg="gray.800" color="white" p={4}>
      <Flex justify="space-between">
        <Text>&copy; {new Date().getFullYear()} Ethereum Clone</Text>
        <Link href="https://ethereum.org" isExternal>
          Ethereum.org
        </Link>
      </Flex>
    </Box>
  );
};

export default Footer;

