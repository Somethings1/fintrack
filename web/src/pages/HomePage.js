import React, { useState } from "react";
import {
    Box,
    Flex,
    Input,
    VStack,
    Text,
    Center,
} from "@chakra-ui/react";
import { InputGroup } from "../components/ui/input-group";
import {
    LuMenu,
    LuSearch,
    LuBell,
    LuX,
    LuHouse,
    LuChartArea,
    LuPiggyBank,
    LuWalletMinimal,
    LuSettings,
    LuLogOut
} from "react-icons/lu";
import { Button } from "../components/ui/button";
import { Avatar } from "../components/ui/avatar";
import {
    DrawerBackdrop,
    DrawerBody,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerRoot,
    DrawerTrigger,
} from "../components/ui/drawer"
import {
    PopoverBody,
    PopoverContent,
    PopoverRoot,
    PopoverTitle,
    PopoverTrigger,
    PopoverArrow,
} from "../components/ui/popover"

import { dropDatabase } from "../util/db";
import  Overview  from "./components/Overview";
import  Analysis  from "./components/Analysis";
import  Accounts  from "./components/Accounts";
import  Savings   from "./components/Savings";
import  Settings  from "./components/Settings";

const HomePage = () => {
    const [isDrawerOpen, setDrawerOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState("Overview");
    const [openingPage, setOpeningPage] = useState(<Overview />);
    const options = [
        { name: 'Overview', icon: <LuHouse />, action: () => setOpeningPage(<Overview />)},
        { name: 'Analysis', icon: <LuChartArea />, action: () => setOpeningPage(<Analysis />) },
        { name: 'Accounts', icon: <LuWalletMinimal />, action: () => setOpeningPage(<Accounts />)},
        { name: 'Savings', icon: <LuPiggyBank />, action: () => setOpeningPage(<Savings />)},
        { name: 'Settings', icon: <LuSettings />, action: () => setOpeningPage(<Settings />)},
    ];

    const handleLogout = () => {
        dropDatabase();
        fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include',
        })
            .then(() => {
                window.location.href = '/'; // Redirect to the login page
            })
            .catch((error) => {
                console.error('Error logging out:', error);
            });
    }

    return (
        <Box minH="100vh" bg="gray.50">
            {/* Floating Header */}
            <Flex
                as="header"
                position="fixed"
                top="0"
                w="full"
                h="60px"
                bg="white"
                boxShadow="sm"
                zIndex="1000"
                alignItems="center"

                px={4}
            >
                <DrawerRoot placement="start" open={isDrawerOpen} onOpenChange={e => setDrawerOpen(e.open)}>
                    <DrawerBackdrop />
                    <DrawerTrigger asChild>
                        <Button
                            variant="ghost"
                            aria-label="Open Menu"
                        >
                            <LuMenu />
                        </Button>
                    </DrawerTrigger>
                    <DrawerContent>
                        <DrawerHeader>
                            <Flex justifyContent="space-between" width="100%" alignItems="center">
                                <Text fontSize="lg" fontWeight="bold" ml={4}>
                                    Fintrack
                                </Text>
                                <Box
                                    onClick={() => setDrawerOpen(false)}
                                    ml="auto"
                                    as="button"
                                    p={2}
                                    borderRadius="md"
                                    _hover={{ bg: "gray.100" }}
                                    fontSize="xl"
                                >
                                    <LuX />
                                </Box>
                            </Flex>
                        </DrawerHeader>
                        <DrawerBody>
                            <VStack align="stretch" spacing={4}>
                                {options.map((option) => (
                                    <Box
                                        key={option.name}
                                        as="button"
                                        onClick={() => { setSelectedOption(option.name); setDrawerOpen(false); option.action(); }}
                                        py={3}
                                        px={2}
                                        borderRadius="md"
                                        _hover={{ bg: "gray.100" }}
                                        fontSize="md"
                                        fontWeight={selectedOption === option.name ? "bold" : "normal"}
                                        color={selectedOption === option.name ? "teal.500" : "inherit"}
                                        textAlign="left"
                                        cursor="pointer"
                                        transition="background-color 0.2s ease-in-out"
                                        bg={selectedOption === option.name ? "teal.50" : "transparent"}
                                        display="flex"
                                        alignItems="center" // Ensures the icon and text are aligned properly
                                    >
                                        <Box mr={3} fontSize="xl">{option.icon}</Box> {/* Add icon before the text */}
                                        {option.name}
                                    </Box>
                                ))}
                            </VStack>
                        </DrawerBody>
                        <DrawerFooter></DrawerFooter>
                    </DrawerContent>
                </DrawerRoot>

                {/* Title */}
                <Text fontSize="lg" fontWeight="bold" ml={4}>
                    Fintrack
                </Text>

                {/* Spacer */}
                <Box flex="1" />

                {/* Search Bar */}
                <InputGroup maxW="400px" mx={4} endElement={<LuSearch />}>
                    <Input placeholder="Search" />
                </InputGroup>

                <PopoverRoot>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            aria-label="Notifications"
                            mr={2}
                        >
                            <LuBell />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                        <PopoverArrow />
                        <PopoverTitle>
                            <Text fontSize="md" px={5} py={3} fontWeight="bold">
                                Notifications
                            </Text>
                        </PopoverTitle>
                        <PopoverBody>
                            <Text>No notifications</Text>
                        </PopoverBody>
                    </PopoverContent>
                </PopoverRoot>

                {/* Avatar */}
                <PopoverRoot size="xs">
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            aria-label="User"
                            p={0}
                            borderRadius="full"
                        >
                            <Avatar name="User" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                        <PopoverArrow />
                        <PopoverTitle>
                            <Text fontSize="md" px={5} py={3} fontWeight="bold">
                                Full name
                            </Text>
                            <Text fontSize="sm" px={5} py={3} color="gray.500">
                                Username
                            </Text>
                        </PopoverTitle>
                        <PopoverBody>
                            <Box
                                px={5}
                                py={3}
                                cursor="pointer"
                                _hover={{ bg: "gray.100" }}
                                width="100%"
                                display="flex"
                                alignItems="center"
                                onClick={handleLogout}>
                                <LuLogOut />
                                <Text fontSize="md" ml={2}>
                                    Logout
                                </Text>
                            </Box>
                        </PopoverBody>
                    </PopoverContent>
                </PopoverRoot>
            </Flex>


            {/* Main Content */}
            <Box p={10} pt="80px">
                <Center>
                    {openingPage}
                </Center>
            </Box>
        </Box>
    );
};

export default HomePage;

