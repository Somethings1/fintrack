// src/hooks/useTransactionExport.ts
import { useState } from 'react';
import { message } from 'antd';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import { jsPDF } from 'jspdf';

export type ExportFileType = 'xlsx' | 'csv' | 'pdf';

export const useTransactionExport = (availableColumns: { key: string; title: string }[]) => {
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    // Default to all available columns initially
    const [selectedColumns, setSelectedColumns] = useState<string[]>(availableColumns.map(c => c.key));
    const [selectedFileType, setSelectedFileType] = useState<ExportFileType>('xlsx');

    const showExportModal = () => setIsExportModalVisible(true);
    const hideExportModal = () => setIsExportModalVisible(false);

    const handleColumnChange = (value: string[]) => setSelectedColumns(value);
    const handleFileTypeChange = (value: ExportFileType) => setSelectedFileType(value);

    const exportData = (dataToExport: any[]) => {
        if (!selectedColumns.length) {
            message.error("Please select at least one column to export.");
            return;
        }
         if (dataToExport.length === 0) {
            message.warn("No data available to export with the current filters.");
            return;
        }


        const columnsToExport = availableColumns.filter(col => selectedColumns.includes(col.key));

        // Prepare data with only selected columns and correct headers
        const preparedData = dataToExport.map((item) => {
            const newItem: Record<string, any> = {};
            columnsToExport.forEach(col => {
                 // Handle different data types for export clarity if needed
                 if (col.key === 'dateTime' && item[col.key]) {
                    newItem[col.title] = new Date(item[col.key]).toLocaleDateString("en-GB");
                } else if (col.key === 'amount' && typeof item[col.key] === 'number') {
                    newItem[col.title] = item[col.key]; // Keep as number for Excel/CSV, format for PDF later
                }
                 else {
                     newItem[col.title] = item[col.key] ?? ''; // Use header title as key
                 }
            });
            return newItem;
        });

        try {
            switch (selectedFileType) {
                case 'xlsx':
                    exportToXLSX(preparedData);
                    break;
                case 'csv':
                    exportToCSV(preparedData);
                    break;
                case 'pdf':
                    exportToPDF(preparedData, columnsToExport.map(c => c.title));
                    break;
                default:
                    message.error('Invalid file type selected.');
                    break;
            }
            hideExportModal();
            message.success(`Data exported as ${selectedFileType.toUpperCase()}`);
        } catch (error) {
             console.error("Export failed:", error);
             message.error("An error occurred during export.");
        }
    };

    const exportToXLSX = (data: any[]) => {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        XLSX.writeFile(wb, 'transactions_export.xlsx');
    };

    const exportToCSV = (data: any[]) => {
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'transactions_export.csv');
    };

    const exportToPDF = (data: any[], headers: string[]) => {
        const doc = new jsPDF();
        (doc as any).autoTable({ // Use autoTable for better formatting
            head: [headers],
            body: data.map(row => headers.map(header => {
                 // Format amount specifically for PDF if needed
                 if (header === 'Amount' && typeof row[header] === 'number') {
                     return `${row[header].toLocaleString()} đ`;
                 }
                 return String(row[header] ?? '');
            })),
            startY: 10, // Adjust start position if needed
        });
        doc.save('transactions_export.pdf');
    };


    return {
        isExportModalVisible,
        showExportModal,
        hideExportModal,
        selectedColumns,
        selectedFileType,
        handleColumnChange,
        handleFileTypeChange,
        exportData, // The function to trigger the export process
    };
};
