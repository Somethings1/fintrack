import React from "react";
import {
    Box,
    Text,
    VStack,
    SimpleGrid,
    HStack,
    Heading,
} from "@chakra-ui/react";
import ProgressBar from "@ramonak/react-progress-bar";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

// Mock Savings Data
const savings = [
    { id: 1, name: "Vacation", balance: 800, goal: 1000, icon: "🌴", createdDate: "2024-01-10", goalDate: "2024-06-01" },
    { id: 2, name: "New Car", balance: 3000, goal: 10000, icon: "🚗", createdDate: "2023-12-05", goalDate: "2025-01-01" },
    { id: 3, name: "Emergency Fund", balance: 5000, goal: 5000, icon: "🏥", createdDate: "2024-02-15", goalDate: "2024-12-01" },
    { id: 4, name: "Home Renovation", balance: 2500, goal: 7000, icon: "🏡", createdDate: "2023-11-20", goalDate: "2025-06-30" },
    { id: 5, name: "Gaming PC", balance: 1500, goal: 2000, icon: "🖥️", createdDate: "2024-01-25", goalDate: "2024-08-15" },
    { id: 6, name: "Wedding", balance: 7000, goal: 20000, icon: "💍", createdDate: "2023-10-10", goalDate: "2025-10-10" },
    { id: 7, name: "Education", balance: 4000, goal: 10000, icon: "📚", createdDate: "2023-09-05", goalDate: "2026-09-01" },
    { id: 8, name: "Fitness", balance: 800, goal: 1500, icon: "🏋️", createdDate: "2024-03-01", goalDate: "2024-12-31" },
];

// Categorizing savings
const completed = savings.filter((s) => s.balance >= s.goal).length;
const inProgress = savings.filter((s) => s.balance > 0 && s.balance < s.goal).length;
const notStarted = savings.filter((s) => s.balance === 0).length;

// Line Chart Data (Mocked for last 6 months)
const lineChartData = {
    labels: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"],
    datasets: [
        {
            label: "Total Savings",
            data: [2000, 4000, 6000, 8000, 10000, 12000],
            borderColor: "#3182CE",
            backgroundColor: "#3182CE",
            fill: false,
        },
    ],
};

const Savings = () => {
    return (
        <VStack w="full" align="stretch" spacing={8}>
            <Text fontSize="4xl" fontWeight="bold">{`Your savings`}</Text>

            {/* Summary & Chart Section */}
            <HStack spacing={6} w="full" marginBottom="4">
                <Box p={2} px={4} border="1px solid lightgrey" borderRadius="4xl">
                    <Text>Total: {savings.length}</Text>
                </Box>
                <Box p={2} px={4} border="1px solid lightgrey" borderRadius="4xl" color="green.600">
                    <Text>Completed: {completed}</Text>
                </Box>
                <Box p={2} px={4} border="1px solid lightgrey" borderRadius="4xl" color="yellow.500">
                    <Text>In Progress: {inProgress}</Text>
                </Box>
                <Box p={2} px={4} border="1px solid lightgrey" borderRadius="4xl" color="red.500">
                    <Text>Not Started: {notStarted}</Text>
                </Box>
            </HStack>
            {/* Grid of Savings */}
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} gap={18} w="full">
                {savings.map((saving) => {
                    const progress = Math.round((saving.balance / saving.goal) * 100 * 100) / 100;
                    return (
                        <Box key={saving.id} p={4} borderRadius="4xl" border=".5px solid lightgrey">
                            <VStack align="left" justify="space-between">
                                <Text fontSize="xl" fontWeight="bold">{saving.icon} {saving.name}</Text>
                                <Text fontSize="sm" color="gray.500">Due date: {saving.goalDate}</Text>
                            </VStack>
                            <Text fontSize="2xl" fontWeight="bold" my="6">${saving.balance} / ${saving.goal}</Text>
                            <ProgressBar completed={progress} labelAlignment="center" bgColor="#3182CE" height="30px" borderRadius="100px" />
                            <Text fontSize="sm" color="gray.600">Left to complete the goal ${saving.goal - saving.balance}</Text>
                        </Box>
                    );
                })}
            </SimpleGrid>

        </VStack>
    );
};

export default Savings;
