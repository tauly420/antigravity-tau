import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// @ts-ignore - plotly.js-dist-min has no types
import Plotly from 'plotly.js-dist-min';
import { roundWithUncertainty, smartFormat, formatPValue } from './format';

interface FitResult {
    parameter_names: string[];
    parameters: number[];
    uncertainties: number[];
    model_name?: string;
    chi_squared?: number | null;
    reduced_chi_squared?: number | null;
    p_value?: number | null;
    r_squared?: number | null;
    dof?: number;
    n_data?: number;
    n_params?: number;
}

interface FormulaResult {
    value: number;
    uncertainty: number;
    formatted: string;
    expression: string;
}

interface NsigmaResult {
    n_sigma: number;
    verdict: string;
    theoretical_value: number;
    theoretical_uncertainty: number;
}

interface ExportData {
    summary?: string;
    fitResult?: FitResult;
    fitModel?: string;
    fitFormula?: string;
    formulaResult?: FormulaResult;
    nsigmaResult?: NsigmaResult;
    xLabel?: string;
    yLabel?: string;
    fitPlotEl?: HTMLElement | null;
    residualsPlotEl?: HTMLElement | null;
}

async function plotToImage(el: HTMLElement, width = 700, height = 400): Promise<string> {
    const gd = el as any;
    const img = await Plotly.toImage(gd, { format: 'png', width, height, scale: 2 });
    return img;
}

export async function exportAutolabPdf(data: ExportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let y = margin;

    // --- Title ---
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('AutoLab Analysis Report', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 4;

    // Horizontal line
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // --- Summary ---
    if (data.summary) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', margin, y);
        y += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        // Strip markdown formatting for PDF
        const cleanSummary = data.summary
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/#{1,3}\s/g, '');
        const lines = doc.splitTextToSize(cleanSummary, contentWidth);
        doc.text(lines, margin, y);
        y += lines.length * 4.5 + 6;
    }

    // --- Fit Parameters Table ---
    if (data.fitResult) {
        const fit = data.fitResult;

        if (y > 250) { doc.addPage(); y = margin; }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        let header = 'Fit Parameters';
        if (data.fitModel) header += ` — ${data.fitModel}`;
        if (data.fitFormula) header += ` (${data.fitFormula})`;
        const headerLines = doc.splitTextToSize(header, contentWidth);
        doc.text(headerLines, margin, y);
        y += headerLines.length * 5.5 + 3;

        // Parameter table
        const tableBody = fit.parameter_names.map((name, i) => {
            const fmt = roundWithUncertainty(Number(fit.parameters[i]), Number(fit.uncertainties[i]));
            return [name, fmt.rounded, fmt.unrounded];
        });

        autoTable(doc, {
            startY: y,
            head: [['Parameter', 'Rounded', 'Full Precision']],
            body: tableBody,
            margin: { left: margin, right: margin },
            styles: { fontSize: 9, cellPadding: 2.5 },
            headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 247, 250] },
        });
        y = (doc as any).lastAutoTable.finalY + 5;

        // Goodness of fit stats
        const stats: string[] = [];
        if (fit.reduced_chi_squared != null) stats.push(`χ²/dof = ${smartFormat(fit.reduced_chi_squared)}`);
        if (fit.dof != null) stats.push(`dof = ${fit.dof}`);
        if (fit.p_value != null) stats.push(`P-value = ${formatPValue(fit.p_value)}`);
        if (fit.r_squared != null) stats.push(`R² = ${smartFormat(fit.r_squared)}`);

        if (stats.length > 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(80);
            doc.text(stats.join('    |    '), margin, y);
            doc.setTextColor(0);
            y += 8;
        }
    }

    // --- Formula Calculation ---
    if (data.formulaResult) {
        if (y > 250) { doc.addPage(); y = margin; }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Formula Calculation', margin, y);
        y += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Expression: ${data.formulaResult.expression}`, margin, y);
        y += 5;

        const fmt = roundWithUncertainty(data.formulaResult.value, data.formulaResult.uncertainty);
        doc.text(`Result: ${fmt.rounded}`, margin, y);
        y += 5;
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Full precision: ${fmt.unrounded}`, margin, y);
        doc.setTextColor(0);
        y += 8;
    }

    // --- N-sigma Comparison ---
    if (data.nsigmaResult) {
        if (y > 250) { doc.addPage(); y = margin; }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('N-sigma Comparison', margin, y);
        y += 6;

        const ns = data.nsigmaResult;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const nSigFmt = smartFormat(ns.n_sigma);
        doc.text(`N-sigma: ${nSigFmt}σ — ${ns.verdict}`, margin, y);
        y += 5;

        const theoFmt = roundWithUncertainty(ns.theoretical_value, ns.theoretical_uncertainty);
        doc.text(`Theoretical value: ${theoFmt.rounded}`, margin, y);
        y += 8;
    }

    // --- Fit Plot ---
    if (data.fitPlotEl) {
        if (y > 160) { doc.addPage(); y = margin; }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Fit Plot', margin, y);
        y += 5;

        try {
            const img = await plotToImage(data.fitPlotEl, 700, 420);
            const imgWidth = contentWidth;
            const imgHeight = imgWidth * (420 / 700);
            doc.addImage(img, 'PNG', margin, y, imgWidth, imgHeight);
            y += imgHeight + 5;
        } catch {
            doc.setFontSize(9);
            doc.text('[Plot could not be exported]', margin, y);
            y += 6;
        }
    }

    // --- Residuals Plot ---
    if (data.residualsPlotEl) {
        if (y > 200) { doc.addPage(); y = margin; }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Residuals', margin, y);
        y += 5;

        try {
            const img = await plotToImage(data.residualsPlotEl, 700, 300);
            const imgWidth = contentWidth;
            const imgHeight = imgWidth * (300 / 700);
            doc.addImage(img, 'PNG', margin, y, imgWidth, imgHeight);
            y += imgHeight + 5;
        } catch {
            doc.setFontSize(9);
            doc.text('[Plot could not be exported]', margin, y);
            y += 6;
        }
    }

    // --- Footer on each page ---
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
            `Tau-LY AutoLab Report — Page ${i} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 8,
            { align: 'center' }
        );
    }

    doc.save('autolab-report.pdf');
}
