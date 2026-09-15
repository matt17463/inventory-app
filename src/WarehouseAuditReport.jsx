import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getWarehouseInventoryAuditReport } from './lib/inventoryApi';

const PDF_SORT_OPTIONS = [
  ['quantity-asc', 'Quantity — increasing'],
  ['quantity-desc', 'Quantity — decreasing'],
  ['name', 'Product name'],
  ['style', 'Style'],
  ['color', 'Color'],
];

function text(value) {
  return String(value ?? '').trim();
}

function compareText(a, b) {
  return text(a).localeCompare(text(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function compareRows(a, b, sortMode) {
  let result = 0;

  if (sortMode === 'quantity-asc') {
    result = Number(a.system_quantity || 0) - Number(b.system_quantity || 0);
  } else if (sortMode === 'quantity-desc') {
    result = Number(b.system_quantity || 0) - Number(a.system_quantity || 0);
  } else if (sortMode === 'style') {
    result = compareText(a.style, b.style);
  } else if (sortMode === 'color') {
    result = compareText(a.color, b.color);
  } else {
    result = compareText(a.name, b.name);
  }

  if (result) return result;

  return (
    compareText(a.name, b.name) ||
    compareText(a.style, b.style) ||
    compareText(a.color, b.color) ||
    compareText(a.size, b.size) ||
    compareText(a.sku_base, b.sku_base)
  );
}

function groupByBin(rows) {
  const groups = [];
  const map = new Map();

  rows.forEach((row) => {
    const key = String(row.bin_id);

    if (!map.has(key)) {
      const group = {
        bin_id: row.bin_id,
        bin_code: row.bin_code,
        label: row.bin_label,
        location: row.bin_location,
        rows: [],
      };

      map.set(key, group);
      groups.push(group);
    }

    map.get(key).rows.push(row);
  });

  return groups;
}

function binName(group) {
  return (
    [group.bin_code, group.label]
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(' - ') ||
    `Bin ${group.bin_id}`
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function xmlEscape(value) {
  return text(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function excelCell(value, type = 'String', style = '') {
  return `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;
}

function buildExcelXml(groups) {
  const rows = [];

  groups.forEach((group) => {
    rows.push(
      `<Row>${excelCell(binName(group), 'String', 'BinHeader')}${excelCell(group.location || '')}</Row>`,
    );

    rows.push(
      `<Row>${[
        'SKU Base',
        'Product Name',
        'Brand',
        'Style',
        'Color',
        'Size',
        'System Qty',
        'Actual Count',
        'Notes',
      ].map((value) => excelCell(value, 'String', 'Header')).join('')}</Row>`,
    );

    group.rows.forEach((row) => {
      rows.push(
        `<Row>` +
          excelCell(row.sku_base) +
          excelCell(row.name) +
          excelCell(row.brand) +
          excelCell(row.style) +
          excelCell(row.color) +
          excelCell(row.size) +
          excelCell(Number(row.system_quantity || 0), 'Number') +
          excelCell('') +
          excelCell('') +
        `</Row>`,
      );
    });

    rows.push('<Row></Row>');
  });

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
 xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
  </Style>
  <Style ss:ID="BinHeader">
   <Font ss:Bold="1" ss:Size="14"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Warehouse Audit">
  <Table>
   <Column ss:Width="110"/>
   <Column ss:Width="160"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="70"/>
   <Column ss:Width="75"/>
   <Column ss:Width="90"/>
   <Column ss:Width="160"/>
   ${rows.join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;
}

export default function WarehouseAuditReport() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [pdfSort, setPdfSort] = useState('name');

  const groups = useMemo(() => groupByBin(rows), [rows]);

  const sortedGroups = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) => compareRows(a, b, pdfSort)),
      })),
    [groups, pdfSort],
  );

  async function load() {
    try {
      const data = await getWarehouseInventoryAuditReport();
      setRows(data);
      setMessage(
        `Loaded ${data.length} inventory line(s) across ${groupByBin(data).length} bin(s).`,
      );
    } catch (err) {
      setMessage(err.message || 'Failed to load warehouse audit report.');
    }
  }

  function downloadExcel() {
    if (!groups.length) {
      setMessage('There is no warehouse inventory to export.');
      return;
    }

    const xml = buildExcelXml(groups);

    downloadBlob(
      new Blob([xml], {
        type: 'application/vnd.ms-excel;charset=utf-8',
      }),
      `warehouse-audit-${new Date().toISOString().slice(0, 10)}.xls`,
    );

    setMessage(`Downloaded Excel warehouse audit for ${groups.length} bin(s).`);
  }

  function downloadPdf() {
    if (!sortedGroups.length) {
      setMessage('There is no warehouse inventory to export.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'letter',
    });

    sortedGroups.forEach((group, index) => {
      if (index > 0) doc.addPage('letter', 'landscape');

      const title = binName(group);
      const sortLabel =
        PDF_SORT_OPTIONS.find(([value]) => value === pdfSort)?.[1] ||
        'Product name';

      doc.setFontSize(16);
      doc.text('Warehouse Inventory Audit', 36, 34);

      doc.setFontSize(13);
      doc.text(title, 36, 56);

      doc.setFontSize(9);
      if (group.location) {
        doc.text(`Location: ${group.location}`, 36, 72);
      }

      doc.text(
        `Date: ____________________    Counted By: ____________________    Sort: ${sortLabel}`,
        36,
        group.location ? 88 : 74,
      );

      autoTable(doc, {
        startY: group.location ? 100 : 86,
        head: [[
          'SKU Base',
          'Product Name',
          'Brand',
          'Style',
          'Color',
          'Size',
          'System Qty',
          'Actual Count',
          'Notes',
        ]],
        body: group.rows.map((row) => [
          row.sku_base || '',
          row.name || '',
          row.brand || '',
          row.style || '',
          row.color || '',
          row.size || '',
          String(Number(row.system_quantity || 0)),
          '',
          '',
        ]),
        theme: 'grid',
        styles: {
          fontSize: 6.5,
          cellPadding: 3,
          valign: 'middle',
          overflow: 'linebreak',
        },
        headStyles: {
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 78 },
          1: { cellWidth: 116 },
          2: { cellWidth: 62 },
          3: { cellWidth: 74 },
          4: { cellWidth: 74 },
          5: { cellWidth: 45 },
          6: { cellWidth: 54, halign: 'right' },
          7: { cellWidth: 66 },
          8: { cellWidth: 110 },
        },
        margin: {
          left: 36,
          right: 36,
          bottom: 30,
        },
      });
    });

    doc.save(
      `warehouse-audit-${new Date().toISOString().slice(0, 10)}.pdf`,
    );

    setMessage(
      `Downloaded PDF warehouse audit for ${sortedGroups.length} bin(s), one bin per page.`,
    );
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="page warehouse-audit-page">
      <section className="page-header no-print">
        <div>
          <p className="eyebrow">Audit</p>
          <h1>Warehouse Inventory Audit</h1>
          <p>
            Download a count sheet for the warehouse. PDF reports place every
            bin on a separate page.
          </p>
        </div>

        <div className="warehouse-audit-actions">
          <label className="warehouse-audit-sort">
            <span>PDF sort within each bin</span>
            <select
              value={pdfSort}
              onChange={(event) => setPdfSort(event.target.value)}
            >
              {PDF_SORT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={downloadExcel}
            disabled={!groups.length}
          >
            Download XLS
          </button>

          <button
            type="button"
            onClick={downloadPdf}
            disabled={!groups.length}
          >
            Download PDF
          </button>
        </div>
      </section>

      {message && <p className="message no-print">{message}</p>}

      <section className="print-header print-only">
        <h1>Warehouse Inventory Audit</h1>
        <p>Date: ____________________ &nbsp;&nbsp; Counted By: ____________________</p>
      </section>

      {sortedGroups.map((group) => (
        <section key={group.bin_id} className="audit-bin-section">
          <div className="audit-bin-heading">
            <h2>{binName(group)}</h2>
            <p>{group.location || ''}</p>
          </div>

          <table className="audit-table">
            <thead>
              <tr>
                <th>SKU Base</th>
                <th>Product Name</th>
                <th>Brand</th>
                <th>Style</th>
                <th>Color</th>
                <th>Size</th>
                <th className="numeric">System Qty</th>
                <th>Actual Count</th>
                <th>Notes</th>
              </tr>
            </thead>

            <tbody>
              {group.rows.map((row) => (
                <tr key={`${row.bin_id}-${row.blank_product_id}`}>
                  <td>{row.sku_base}</td>
                  <td>{row.name}</td>
                  <td>{row.brand}</td>
                  <td>{row.style}</td>
                  <td>{row.color}</td>
                  <td>{row.size}</td>
                  <td className="numeric">{row.system_quantity}</td>
                  <td><span className="write-box"></span></td>
                  <td><span className="notes-line"></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  );
}
