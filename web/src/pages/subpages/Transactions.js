import { Flex, Text, Box, Button, Table } from "@chakra-ui/react";
import { LuFilter, LuCalendar, LuPlus } from "react-icons/lu";

const Transactions = () => {
    return (
        <Box w="full">
            <Flex mb={5}>
                <Text fontSize="4xl" fontWeight="bold" color="neutral.900">{`Your transactions`}</Text>
            </Flex>
            <Flex mb={5}>
                <Button p={4} variant="outline" borderRadius="full">
                    <LuCalendar/>
                    This month
                </Button>
                <Button p={4} ml={3} variant="outline" borderRadius="full">
                    <LuFilter/>
                </Button>
                <Button
                    p={4}
                    ml="auto"
                    variant="solid"
                    borderRadius="full"
                    _hover={{bg: "primary.600"}}
                    bgColor="primary.700" >
                    <LuPlus/>
                    Add new
                </Button>
            </Flex>
            <Table.Root size="md">
                <Table.Header>
                    <Table.Row bgColor="primary.100">
                        <Table.ColumnHeader color="primary.800" roundedLeft="4xl" borderBottom="none">ID</Table.ColumnHeader>
                        <Table.ColumnHeader color="primary.800" borderBottom="none">TYPE</Table.ColumnHeader>
                        <Table.ColumnHeader color="primary.800" borderBottom="none">DATE</Table.ColumnHeader>
                        <Table.ColumnHeader color="primary.800" textAlign="end" borderBottom="none">AMOUNT ($)</Table.ColumnHeader>
                        <Table.ColumnHeader color="primary.800" borderBottom="none">SOURCE</Table.ColumnHeader>
                        <Table.ColumnHeader color="primary.800" borderBottom="none">DESTINATION</Table.ColumnHeader>
                        <Table.ColumnHeader color="primary.800" borderBottom="none">CATEGORY</Table.ColumnHeader>
                        <Table.ColumnHeader color="primary.800" roundedRight="4xl" borderBottom="none">NOTE</Table.ColumnHeader>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {mockTransactions.map((tx, index) => (
                        <Table.Row key={tx.id}>
                            <Table.Cell
                                borderBottom={index == mockTransactions.length - 1 ? "none" : "sm"}
                                borderColor="neutral.200"
                                roundedTopLeft={index === 0 ? "2xl" : "none"}
                                roundedBottomLeft={index === mockTransactions.length - 1 ? "2xl" : "none"}>
                                {tx.id}
                            </Table.Cell>
                            <Table.Cell
                                borderBottom={index == mockTransactions.length - 1 ? "none" : "sm"}
                                borderColor="neutral.200">
                                {tx.type}
                            </Table.Cell>
                            <Table.Cell
                                borderBottom={index == mockTransactions.length - 1 ? "none" : "sm"}
                                borderColor="neutral.200">
                                {tx.dateTime.toLocaleDateString()}
                            </Table.Cell>
                            <Table.Cell
                                textAlign="end"
                                borderBottom={index == mockTransactions.length - 1 ? "none" : "sm"}
                                borderColor="neutral.200">
                                {tx.amount.toFixed(2)}
                            </Table.Cell>
                            <Table.Cell
                                borderBottom={index == mockTransactions.length - 1 ? "none" : "sm"}
                                borderColor="neutral.200">
                                {tx.sourceAccount}
                            </Table.Cell>
                            <Table.Cell
                                borderBottom={index == mockTransactions.length - 1 ? "none" : "sm"}
                                borderColor="neutral.200">
                                {tx.destinationAccount}
                            </Table.Cell>
                            <Table.Cell
                                borderBottom={index == mockTransactions.length - 1 ? "none" : "sm"}
                                borderColor="neutral.200">
                                {tx.category}
                            </Table.Cell>
                            <Table.Cell
                                borderBottom={index == mockTransactions.length - 1 ? "none" : "sm"}
                                borderColor="neutral.200"
                                roundedTopRight={index === 0 ? "2xl" : "none"}
                                roundedBottomRight={index === mockTransactions.length - 1 ? "2xl" : "none"}>
                                {tx.note}
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
        </Box>
    );
};

const mockTransactions = [
    { id: 1, type: "Expense", dateTime: new Date(), amount: 50.0, sourceAccount: 1, destinationAccount: 1, category: "Groceries", note: "Grocery shopping" },
    { id: 2, type: "Income", dateTime: new Date(), amount: 200.0, sourceAccount: 2, destinationAccount: 0, category: "Salary", note: "Monthly salary" },
    { id: 3, type: "Expense", dateTime: new Date(), amount: 30.0, sourceAccount: 1, destinationAccount: 1, category: "Transport", note: "Bus fare" },
    { id: 4, type: "Transfer", dateTime: new Date(), amount: 100.0, sourceAccount: 1, destinationAccount: 2, category: "Savings", note: "Transfer to savings" },
];

export default Transactions;

