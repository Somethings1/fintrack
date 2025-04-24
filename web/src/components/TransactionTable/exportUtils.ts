import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import { jsPDF } from 'jspdf';
    export const exportToXLSX = (data) => {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        const fileName = 'exported_data.xlsx';
        XLSX.writeFile(wb, fileName);
    };

    export const exportToCSV = (data) => {
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'exported_data.csv');
    };

    export const exportToPDF = (data) => {
        const doc = new jsPDF();
        let yPosition = 10;

        // Add headers
        doc.text("Exported Data", 10, yPosition);
        yPosition += 10;

        columns.forEach((col, index) => {
            doc.text(col.title, 10 + index * 40, yPosition);
        });

        yPosition += 10;

        // Add rows
        data.forEach(row => {
            columns.forEach((col, index) => {
                doc.text(String(row[col.key]), 10 + index * 40, yPosition);
            });
            yPosition += 10;
        });

        doc.save('exported_data.pdf');
    };

