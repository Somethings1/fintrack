import React, { useState } from "react";
import {
    Box,
    Flex,
    Heading,
    Text,
    Button,
    VStack,
    HStack,
    Icon,
} from "@chakra-ui/react";
import { FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { Doughnut } from "react-chartjs-2";
import "chart.js/auto";

const categoriesExpense = [
    { name: "Food", spent: 400, budget: 600 },
    { name: "Rent", spent: 800, budget: 800 },
    { name: "Entertainment", spent: 200, budget: 300 },
    { name: "Transportation", spent: 150, budget: 250 },
    { name: "Health", spent: 100, budget: 200 },
    { name: "Utilities", spent: 300, budget: 350 },
    { name: "Shopping", spent: 250, budget: 400 },
    { name: "Education", spent: 150, budget: 300 },
];

const categoriesIncome = [
    { name: "Salary", earned: 3000, target: 2500 },
    { name: "Investments", earned: 500, target: 400 },
    { name: "Freelance", earned: 800, target: 700 },
    { name: "Other", earned: 200, target: 300 },
];

const Analysis = () => {
    const [type, setType] = useState("expense");
    const categories = type === "expense" ? categoriesExpense : categoriesIncome;
    const currentMonth = new Date().toLocaleString("default", { month: "long" });
    const currentYear = new Date().getFullYear();

    const totalSpent = categories.reduce(
        (acc, category) => acc + (type === "expense" ? category.spent : category.earned),
        0
    );
    const totalBudget = categories.reduce(
        (acc, category) => acc + (type === "expense" ? category.budget : category.target),
        0
    );

    const isOnTrack = (spent, budget, daysInMonth, currentDay) => {
        const threshold = (budget / daysInMonth) * currentDay;
        return type === "expense" ? spent <= threshold : spent >= threshold;
    };

    const daysInMonth = new Date().getDate();
    const totalDays = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
    ).getDate();

    return (
        <VStack spacing={6} align="stretch">
            {/* Title */}
            <Text fontSize="4xl" fontWeight="bold">{`Analysis for ${currentMonth} ${currentYear}`}</Text>

            {/* Controls Row */}
            <HStack mb="4">
                <Button borderRadius="full" variant="outline">Change Month</Button>
                <Button borderRadius="full" variant="outline">Sort List</Button>
                <Button borderRadius="full" variant="outline">Filter List</Button>
                <Button borderRadius="full" variant="outline" onClick={() => setType(type === "expense" ? "income" : "expense")}>
                    Change to {type === "expense" ? "Income" : "Expense"}
                </Button>
            </HStack>

            {/* Content */}
            <Flex gap={4} wrap="wrap">
                {/* Categories */}
                <Flex flex="2" flexWrap="wrap" gap={4}>
                    {categories.map((category, index) => (
                        <Box
                            key={index}
                            borderWidth={1}
                            borderRadius="4xl"
                            px={6}
                            py={4}
                            flex="1 1 calc(50% - 1rem)"
                            boxShadow="xs"
                        >

                            <Text fontSize="xl" mb={4} fontWeight="bold">{category.name}</Text>
                            <HStack align="left">
                                <Box width="180px" height="180px">
                                    <Doughnut
                                        data={{
                                            labels: ["Spent", "Remaining"],
                                            datasets: [
                                                {
                                                    data: [
                                                        type === "expense" ? category.spent : category.earned,
                                                        type === "expense"
                                                            ? category.budget - category.spent
                                                            : category.target - category.earned,
                                                    ],
                                                    backgroundColor: ["#4299E1", "#E2E8F0"],
                                                    borderRadius: 100,
                                                },
                                            ],
                                        }}
                                        options={{
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: { display: false },
                                            },
                                            cutout: "80%",
                                        }}
                                    />
                                </Box>
                                <VStack align="start" ml={4}>
                                    <Text>
                                        Used: ${type === "expense" ? category.spent : category.earned}
                                    </Text>
                                    <Text>
                                        Left: $
                                        {type === "expense"
                                            ? category.budget - category.spent
                                            : category.target - category.earned}
                                    </Text>
                                    <HStack
                                        mt={4}
                                        bg={
                                            isOnTrack(
                                                type === "expense" ? category.spent : category.earned,
                                                type === "expense" ? category.budget : category.target,
                                                totalDays,
                                                daysInMonth
                                            )
                                                ? "green.100"
                                                : "orange.100"
                                        }
                                        color={
                                            isOnTrack(
                                                type === "expense" ? category.spent : category.earned,
                                                type === "expense" ? category.budget : category.target,
                                                totalDays,
                                                daysInMonth
                                            )
                                                ? "green.500"
                                                : "orange.500"
                                        }
                                        px={4}
                                        py={2}
                                        borderRadius="full"
                                        align="center"
                                    >
                                        {
                                            isOnTrack(
                                                type === "expense" ? category.spent : category.earned,
                                                type === "expense" ? category.budget : category.target,
                                                totalDays,
                                                daysInMonth
                                            )
                                                ? <FaCheckCircle />
                                                : <FaExclamationCircle />
                                        }
                                        <Text>
                                            {isOnTrack(
                                                type === "expense" ? category.spent : category.earned,
                                                type === "expense" ? category.budget : category.target,
                                                totalDays,
                                                daysInMonth
                                            )
                                                ? "On Track"
                                                : "Need Attention"}
                                        </Text>
                                    </HStack>
                                </VStack>
                            </HStack>
                        </Box>
                    ))}
                </Flex>

                {/* Summary Boxes */}
                <Flex flex="1" direction="column" gap={4}>
                    {/* Monthly Budget Box */}
                    <Box borderWidth={1} borderRadius="4xl" p={4} boxShadow="xs">
                        <Text fontSize="xl" mb={4} fontWeight="bold">Monthly Budget</Text>
                        <Text>Total: ${totalBudget}</Text>
                        <Text>Spent: ${totalSpent}</Text>
                    </Box>

                    {/* Most Expenses Box */}
                    <Box borderWidth={1} borderRadius="4xl" p={4} boxShadow="xs">
                        <Text fontSize="xl" mb={4} fontWeight="bold">Most Expenses</Text>
                        <VStack align="start" spacing={2}>
                            {[...categories]
                                .sort((a, b) =>
                                    type === "expense"
                                        ? b.spent - a.spent
                                        : b.earned - a.earned
                                )
                                .map((category, index) => (
                                    <HStack key={index} justify="space-between" w="full">
                                        <Text>{category.name}</Text>
                                        <Text>
                                            ${type === "expense" ? category.spent : category.earned}
                                        </Text>
                                    </HStack>
                                ))}
                        </VStack>
                    </Box>
                </Flex>
            </Flex>
        </VStack>
    );
};

export default Analysis;

