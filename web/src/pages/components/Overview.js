import React from "react";
import { Box, Flex, Text, Table, useBreakpointValue } from "@chakra-ui/react";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";
import ProgressBar from "@ramonak/react-progress-bar";

const Overview = () => {
    const currentMonth = new Date().toLocaleString("default", { month: "long" });
    const currentYear = new Date().getFullYear();

    const monthlyIncome = 5000;
    const monthlyExpense = 3500;
    const balance = monthlyIncome - monthlyExpense;
    const totalSavings = 2000;

    // Random percentage changes
    const incomeChange = Math.random() * 20 - 10; // between -10% to +10%
    const expenseChange = Math.random() * 20 - 10;

    // Bar chart data (random values)
    const moneyFlowData = {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [
            {
                label: "Income",
                data: Array.from({ length: 6 }, () => Math.random() * 1000),
                backgroundColor: "rgba(0, 255, 0, 0.5)",
            },
            {
                label: "Expense",
                data: Array.from({ length: 6 }, () => Math.random() * 1000),
                backgroundColor: "rgba(255, 0, 0, 0.5)",
            },
        ],
    };

    // Donut chart data (random category distribution)
    const categoryData = {
        labels: ["Food", "Housing", "Entertainment", "Others"],
        datasets: [
            {
                data: [30, 50, 10, 10],
                backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0"],
                hoverBackgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0"],
            },
        ],
    };

    // Recent transactions (randomized)
    const transactions = Array.from({ length: 10 }, (_, i) => ({
        date: `2024-12-${i + 1}`,
        category: ["Food", "Housing", "Entertainment", "Transport"][i % 4],
        note: `Transaction ${i + 1}`,
    }));

    // Saving goals (randomized)
    const savingGoals = [
        { name: "Vacation Fund", progress: Math.random() * 100, goal: 5000 },
        { name: "Emergency Fund", progress: Math.random() * 100, goal: 2000 },
        { name: "New Car Fund", progress: Math.random() * 100, goal: 10000 },
    ];

    // Responsive layout logic
    const layoutConfig = useBreakpointValue({
        base: "column",  // stack for mobile
        md: "row",      // row for larger screens (500px+)
    });

    return (
        <Box p={0} width="100%">
            {/* Row 1: Title */}
            <Flex mb={5}>
                <Text fontSize="4xl" fontWeight="bold">{`Overview for ${currentMonth} ${currentYear}`}</Text>
            </Flex>

            {/* Row 2: Stats Boxes */}
            <Flex direction={layoutConfig} wrap="wrap" justify="space-between" gap={5} mb={5}>
                {["Total income", "Total expense", "Balance", "Total savings"].map((title, index) => {
                    // Determine values and percentage change for each box
                    const value =
                        index === 0
                            ? monthlyIncome
                            : index === 1
                                ? monthlyExpense
                                : index === 2
                                    ? balance
                                    : totalSavings;

                    const change =
                        index === 0
                            ? incomeChange
                            : index === 1
                                ? expenseChange
                                : Math.random() * 20 - 10; // Randomized changes for balance & savings

                    // Arrow and color logic
                    const isExpense = index === 1;
                    const isPositive = change >= 0;
                    const arrowColor = isExpense
                        ? isPositive
                            ? "red"
                            : "green"
                        : isPositive
                            ? "green"
                            : "red";

                    const ArrowIcon = isPositive ? FaArrowUp : FaArrowDown;

                    return (
                        <Box
                            key={title}
                            flex="1"
                            minW="200px"
                            py={3}
                            px={5}
                            borderWidth={1}
                            borderRadius="4xl"
                            boxShadow="sm"
                        >
                            <Text fontSize="xl" fontWeight="bold" mb={4}>
                                {title}
                            </Text>
                            <Text fontSize="3xl" fontWeight="bold">
                                {`$${value.toFixed(2)}`}
                            </Text>
                            <Flex
                                align="center"
                                mt={3}
                                color={arrowColor + ".500"}>
                                <Flex
                                    px={2}
                                    py={.5}
                                    align="center"
                                    width="fit-content"
                                    borderRadius="4xl"
                                    bgColor={arrowColor + ".100"}>
                                    <ArrowIcon size="10px" />
                                    <Text ml={2} fontSize="sm" fontWeight="medium">
                                        {`${Math.abs(change).toFixed(1)}%`}
                                    </Text>
                                </Flex>
                                <Text color="gray.400" ml={2} fontSize="sm" fontWeight="medium">
                                    vs last month
                                </Text>
                            </Flex>
                        </Box>
                    );
                })}
            </Flex>

            {/* Row 3: Money Flow and Budget */}
            <Flex direction={layoutConfig} wrap="wrap" gap={5} mb={5}>
                <Box flex="2" minW="350px" p={5} borderWidth={1} borderRadius="lg" boxShadow="sm">
                    <Text fontSize="xl">Money Flow</Text>
                </Box>
                <Box flex="1" minW="350px" p={5} borderWidth={1} borderRadius="lg" boxShadow="sm">
                    <Text fontSize="xl">Budget</Text>
                </Box>
            </Flex>

            {/* Row 4: Recent Transactions and Saving Goals */}
            <Flex direction={layoutConfig} wrap="wrap" gap={5}>
                <Box flex="2" minW="350px" p={5} borderWidth={1} borderRadius="4xl" boxShadow="sm">
                    <Text fontSize="xl" mb={3} fontWeight="bold">Recent Transactions</Text>
                    <Table.Root interactive size="lg">
                        <Table.Header>
                            <Table.Row bgColor="teal.100">
                                <Table.ColumnHeader
                                    roundedLeft="4xl"
                                    borderBottomWidth={0}
                                    color="teal.700" >
                                    DATE
                                </Table.ColumnHeader>
                                <Table.ColumnHeader
                                    color="teal.700"
                                    borderBottomWidth={0} >
                                    CATEGORY
                                </Table.ColumnHeader>
                                <Table.ColumnHeader
                                    color="teal.700"
                                    borderBottomWidth={0} >
                                    AMOUNT
                                </Table.ColumnHeader>
                                <Table.ColumnHeader
                                    color="teal.700"
                                    borderBottomWidth={0} >
                                    ACCOUNT
                                </Table.ColumnHeader>
                                <Table.ColumnHeader
                                    roundedRight="4xl"
                                    borderBottomWidth={0}
                                    color="teal.700" >
                                    NOTE
                                </Table.ColumnHeader>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {transactions.map((transaction, index) => (
                                <Table.Row key={index}>
                                    <Table.Cell fontWeight="bold">{transaction.date}</Table.Cell>
                                    <Table.Cell fontWeight="bold">{transaction.category}</Table.Cell>
                                    <Table.Cell fontWeight="bold">{transaction.amount}</Table.Cell>
                                    <Table.Cell fontWeight="bold">{transaction.account}</Table.Cell>
                                    <Table.Cell fontWeight="bold">{transaction.note}</Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table.Root>
                </Box>
                <Box flex="1" minW="350px" p={5} borderWidth={1} borderRadius="4xl" boxShadow="sm">
                    <Text fontSize="xl" fontWeight="bold" mb={9}>Saving Goals</Text>
                    {savingGoals.map((goal, index) => (
                        <Box key={index} mb={5}>
                            <Box width="100%" display="flex">
                                <Text fontWeight="bold" display="inline">{goal.name}</Text>
                                <Text ml="auto" fontWeight="bold" display="inline">${goal.goal}</Text>
                            </Box>
                            <ProgressBar
                                completed={Math.round(goal.progress, 2)}
                                bgColor="teal"
                                height="30px"
                                labelAlignment="center" />
                        </Box>
                    ))}
                </Box>
            </Flex>
        </Box>
    );
};

export default Overview;

