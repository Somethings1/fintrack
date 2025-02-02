import React, { useState } from 'react';
import {
    Box,
    Text,
    VStack,
    HStack,
    SimpleGrid,
    Tabs,
} from '@chakra-ui/react';
import { Doughnut } from 'react-chartjs-2';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

// Mock data for accounts
const accounts = [
    { id: 1, name: 'Savings', balance: 1000, icon: '💰' },
    { id: 2, name: 'Credit Card', balance: -200, icon: '💳' },
    { id: 3, name: 'Wallet', balance: 500, icon: '👜' },
];

// Mock data for statistics and transactions
const mockLineChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
        {
            label: 'Money In',
            data: [300, 400, 200, 300, 500],
            borderColor: 'rgba(75,192,192,1)',
            fill: false,
        },
        {
            label: 'Money Out',
            data: [200, 300, 100, 250, 400],
            borderColor: 'rgba(255,99,132,1)',
            fill: false,
        },
    ],
};

const mockDoughnutData = {
    labels: ['Food', 'Transport', 'Entertainment'],
    datasets: [
        {
            data: [300, 150, 100],
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
        },
    ],
};

const Wallet = () => {
    const [selectedAccount, setSelectedAccount] = useState(null);

    const handleAccountSelect = (id) => {
        setSelectedAccount(selectedAccount === id ? null : id);
    };

    return (
        <VStack align="stretch" p={2} spacing={9} w="full">
            <Text fontSize="4xl" fontWeight="bold">Wallet</Text>

            {/* hehe section */}
            <HStack spacing={10} mb={3}>
                {/* Big Box */}
                <Box w="50%" h="200px" bg="gray.100" borderRadius="4xl" p={4} border="1px solid" borderColor="gray.200">
                    Big Box Content
                </Box>

                {/* VStack */}
                <VStack w="50%" align="stretch" spacing={4} ml={4}>
                    <Text fontSize="xl" fontWeight="bold" mb={4}>
                        Your Accounts
                    </Text>
                    <Box flex="1"></Box>
                    <SimpleGrid columns={3} columnGap={4} w="full">
                        {accounts.map((account) => (
                            <Box
                                key={account.id}
                                p={4}
                                bg={selectedAccount === account.id ? 'linear-gradient(135deg, #6b46c1, #b794f4)' : 'white'}
                                color={selectedAccount === account.id ? 'white' : 'black'}
                                border="1px solid"
                                borderColor="gray.200"
                                borderRadius="xl"
                                onClick={() => handleAccountSelect(account.id)}
                                cursor="pointer"
                                boxShadow={selectedAccount === account.id ? 'lg' : 'sm'}
                            >
                                <Text fontSize="2xl" fontWeight="bold">${account.balance}</Text>
                                <Text fontSize="lg">
                                    {account.name}
                                </Text>
                                <Text fontSize="2xl" textAlign="right">
                                    {account.icon}
                                </Text>
                            </Box>
                        ))}
                    </SimpleGrid>
                </VStack>
            </HStack>

            {/* hehehe section */}
            <Box>
                {selectedAccount === null ? (
                    <Text fontSize="lg" textAlign="center">Choose an account to see its activities here</Text>
                ) : (
                    <HStack spacing={9} w="full" align="start">
                        {/* VStack with Line Chart and Recent Transactions */}
                        <VStack w="full" spacing={4}>
                            <Box w="full" bg="white" borderRadius="4xl" p={4} boxShadow="sm" h="300px">
                                <Text fontSize="lg" mb={2} fontWeight="bold">
                                    Money Flow
                                </Text>
                                <Line data={mockLineChartData} />
                            </Box>
                            <Box bg="white" borderRadius="4xl" p={4} boxShadow="sm" h="300px" w="full">
                                <Text fontSize="lg" fontWeight="bold" >Recent Transactions</Text>
                            </Box>
                        </VStack>

                        {/* Box with Doughnut Chart */}
                        <Box bg="white" w="30%" borderRadius="4xl" p={4} boxShadow="sm" >
                            <Text fontSize="lg" mb={2}>
                                Statistics
                            </Text>
                            <Tabs.Root defaultValue="income">
                                <Tabs.List>
                                    <Tabs.Trigger value="income">Income</Tabs.Trigger>
                                    <Tabs.Trigger value="expense">Expense</Tabs.Trigger>
                                </Tabs.List>
                                <Tabs.Content value="income">
                                    <Doughnut data={mockDoughnutData} />
                                </Tabs.Content>
                                <Tabs.Content value="expense">
                                    <Doughnut data={mockDoughnutData} />
                                </Tabs.Content>
                            </Tabs.Root>
                        </Box>
                    </HStack>
                )}
            </Box>
        </VStack>
    );
};

export default Wallet;

