import type { Transaction } from '@/models/Transaction';
import { message } from 'antd';
import { useState } from 'react';
export type ExportFileType = 'xlsx' | 'csv';
type ExportCell = string | number;
export const useTransactionExport = (availableColumns: { key: string; title: string }[]) => {
    const [isExportModalVisible, setVisible] = useState(false);
    const [selectedColumns, setSelectedColumns] = useState<string[]>(availableColumns.filter(c => !['actions', 'reminder'].includes(c.key)).map(c => c.key));
    const [selectedFileType, setSelectedFileType] = useState<ExportFileType>('xlsx');
    const exportData = async (rows: Transaction[]) => {
        if (!selectedColumns.length) { void message.error('Choose at least one export column.'); return; }
        if (!rows.length) { void message.warning('No transactions match these filters.'); return; }
        const columns = availableColumns.filter(c => selectedColumns.includes(c.key));
        const data = rows.map(item => {
            const record: Record<string, unknown> = { ...item };
            const output: Record<string, ExportCell> = {};
            for (const col of columns) {
                const value = record[col.key];
                output[col.title] = col.key === 'dateTime' ? new Date(item.dateTime).toISOString()
                    : typeof value === 'number' || typeof value === 'string' ? value : '';
            }
            return output;
        });
        try {
            // Export libraries are large: load them only after the user requests an export.
            if (selectedFileType === 'xlsx') {
                const XLSX = await import('xlsx');
                const book = XLSX.utils.book_new();
                const sheet = XLSX.utils.json_to_sheet(data); // String cells are never formulas.
                XLSX.utils.book_append_sheet(book, sheet, 'Transactions');
                XLSX.writeFile(book, 'transactions_export.xlsx');
            } else {
                const [{ default: Papa }, { saveAs }] = await Promise.all([import('papaparse'), import('file-saver')]);
                const csv = Papa.unparse(data, { escapeFormulae: true });
                saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'transactions_export.csv');
            }
            setVisible(false);
            void message.success('Export complete.');
        } catch { void message.error('Export failed. Your records have not been changed.'); }
    };
    return { isExportModalVisible, showExportModal: () => setVisible(true), hideExportModal: () => setVisible(false),
        selectedColumns, selectedFileType, handleColumnChange: setSelectedColumns, handleFileTypeChange: setSelectedFileType, exportData };
};
