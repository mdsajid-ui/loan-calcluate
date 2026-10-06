/* ============================================
   AUXILO EMI CALCULATOR – JAVASCRIPT
   script.js
   ============================================ */

/* ------------------------------------
   FIXED INTEREST RATE (% p.a.)
   Change this one number to change the rate.
   ------------------------------------ */
const FIXED_RATE = 17.29;

/* ------------------------------------
   HELPER FUNCTIONS
   ------------------------------------ */

// Format number as Indian currency: e.g. 76000 → "76,000"
function formatINR(number) {
  return Math.round(number).toLocaleString('en-IN');
}

// Format a Date object as "05-03-2026"
function formatDate(dateObj) {
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Add N months to a date
function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// Calculate days between two dates using DAYS360 method (like Excel)
function days360(date1, date2) {
  let y1 = date1.getFullYear(), m1 = date1.getMonth() + 1, d1 = date1.getDate();
  let y2 = date2.getFullYear(), m2 = date2.getMonth() + 1, d2 = date2.getDate();
  if (d1 === 31) d1 = 30;
  if (d2 === 31) d2 = 30;
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

/* ------------------------------------
   STORE SCHEDULE DATA (for CSV export)
   ------------------------------------ */
let scheduleData = [];
let reportMeta = {};

/* ------------------------------------
   MAIN CALCULATE FUNCTION
   ------------------------------------ */
function calculate() {

  // --- Step 1: Read inputs from the form ---
  const P = parseFloat(document.getElementById('loanAmount').value) || 0;
  const annualRate = FIXED_RATE / 100; // rate is fixed, not read from the form
  const n = parseInt(document.getElementById('tenure').value) || 0;
  const disbDateStr = document.getElementById('disbDate').value;
  const disbDate = new Date(disbDateStr);

  // --- Step 2: Validate inputs ---
  if (P <= 0 || n <= 0) {
    alert('Please enter a valid Loan Amount and Tenure.');
    return;
  }

  // --- Step 3: Calculate Monthly EMI using the PMT formula ---
  // PMT formula: EMI = P × r × (1+r)^n / ((1+r)^n - 1)
  const monthlyRate = annualRate / 12;
  let emi;
  if (monthlyRate === 0) {
    // No interest: just divide principal by months
    emi = P / n;
  } else {
    emi = P * monthlyRate * Math.pow(1 + monthlyRate, n) / (Math.pow(1 + monthlyRate, n) - 1);
  }
  emi = Math.ceil(emi); // Round up to nearest rupee

  // --- Step 4: Build Amortization Schedule row by row ---
  let balance = P;
  let totalInterest = 0;
  const rows = [];
  let prevDate = disbDate;

  for (let i = 1; i <= n; i++) {
    const emiDate = addMonths(disbDate, i);

    // Interest for this month using actual days / 360
    const d360 = days360(prevDate, emiDate);
    const interest = Math.round(balance * annualRate * d360 / 360);

    // Principal = EMI minus interest (but on last EMI, pay off remaining balance)
    let principal;
    if (i === n) {
      principal = balance; // Pay off everything
    } else {
      principal = Math.min(Math.max(0, emi - interest), balance);
    }

    const emiActual = principal + interest;
    const pos = Math.round(balance - principal); // POS = Principal Outstanding after payment

    totalInterest += interest;

    rows.push({
      sr: i,
      date: emiDate,
      pos: pos,
      interest: interest,
      principal: principal,
      emi: emiActual,
      cashflow: emiActual
    });

    balance = balance - principal;
    prevDate = emiDate;
  }

  // Save for PDF / CSV download
  scheduleData = rows;

  // --- Step 5: Calculate summary figures ---
  const totalRepayment = P + totalInterest;
  // Flat ROI: simple interest rate equivalent
  const roiFlat = (totalInterest / P / n) * 12 * 100;
  const simpleInterest = P * annualRate; // Annual SI for first year

  reportMeta = {
    productType: document.getElementById('productType').selectedOptions[0].text,
    loanAmount: P, tenure: n, rate: annualRate * 100,
    fee: parseFloat(document.getElementById('processingFee').value) || 0,
    disbDate: disbDate, emi: emi, totalInterest: totalInterest,
    totalRepayment: totalRepayment, roiFlat: roiFlat
  };

  // --- Step 6: Update the Summary Cards ---
  document.getElementById('s-emi').textContent      = '₹ ' + formatINR(emi);
  document.getElementById('s-interest').textContent = '₹ ' + formatINR(totalInterest);
  document.getElementById('s-total').textContent    = '₹ ' + formatINR(totalRepayment);
  document.getElementById('s-disbursal').textContent= '₹ ' + formatINR(P);
  document.getElementById('s-subvention').textContent = '₹ 0';
  document.getElementById('s-si').textContent       = '₹ ' + formatINR(simpleInterest);
  document.getElementById('s-roi-float').textContent = (annualRate * 100).toFixed(2) + '%';
  document.getElementById('s-roi-flat').textContent  = roiFlat.toFixed(2) + '%';

  // --- Step 7: Render Amortization Table ---
  const tbody = document.getElementById('amortBody');
  tbody.innerHTML = ''; // Clear old rows

  let totalI = 0, totalP = 0, totalE = 0, totalC = 0;

  rows.forEach(function(row) {
    totalI += row.interest;
    totalP += row.principal;
    totalE += row.emi;
    totalC += row.cashflow;

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + row.sr + '</td>' +
      '<td>' + formatDate(row.date) + '</td>' +
      '<td>' + formatINR(row.pos) + '</td>' +
      '<td>' + formatINR(row.interest) + '</td>' +
      '<td>' + formatINR(row.principal) + '</td>' +
      '<td>' + formatINR(row.emi) + '</td>' +
      '<td>' + formatINR(row.cashflow) + '</td>';
    tbody.appendChild(tr);
  });

  // Add totals row
  const totalRow = document.createElement('tr');
  totalRow.className = 'total-row';
  totalRow.innerHTML =
    '<td colspan="2">Total</td>' +
    '<td>–</td>' +
    '<td>' + formatINR(totalI) + '</td>' +
    '<td>' + formatINR(totalP) + '</td>' +
    '<td>' + formatINR(totalE) + '</td>' +
    '<td>' + formatINR(totalC) + '</td>';
  tbody.appendChild(totalRow);
}

/* ------------------------------------
   DOWNLOAD CSV FUNCTION
   ------------------------------------ */
function downloadCSV() {
  if (scheduleData.length === 0) {
    alert('Please click CALCULATE first.');
    return;
  }

  // Build CSV text
  let csv = 'Sr. No.,Date,POS (Rs),Interest (Rs),Principal (Rs),EMI (Rs),Cashflow (Rs)\n';

  scheduleData.forEach(function(row) {
    csv +=
      row.sr + ',' +
      formatDate(row.date) + ',' +
      Math.round(row.pos) + ',' +
      Math.round(row.interest) + ',' +
      Math.round(row.principal) + ',' +
      Math.round(row.emi) + ',' +
      Math.round(row.cashflow) + '\n';
  });

  // Create a download link and click it
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Auxilo_Amortization_Schedule.csv';
  link.click();
  URL.revokeObjectURL(url);
}


/* ------------------------------------
   DOWNLOAD PDF FUNCTION
   (PDF default font has no rupee symbol, so "Rs." is used)
   ------------------------------------ */
function downloadPDF() {
  if (scheduleData.length === 0) {
    alert('Please click CALCULATE first.');
    return;
  }
  if (!window.jspdf) {
    alert('PDF library could not be loaded. Please check your internet connection and try again.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const m = reportMeta;
  const pageW = doc.internal.pageSize.getWidth();
  const rs = function (v) { return 'Rs. ' + formatINR(v); };

  // Header band
  doc.setFillColor(13, 31, 60);
  doc.rect(0, 0, pageW, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AUXILO - EMI & SI Calculator for Institutes', 30, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Loan Amortization Report  |  Generated on ' + formatDate(new Date()), 30, 46);

  // Loan details + summary (two-column table)
  doc.setTextColor(0, 0, 0);
  doc.autoTable({
    startY: 76,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [13, 31, 60] },
    head: [['Loan Details', '', 'Calculation Summary', '']],
    body: [
      ['Product Type', m.productType, 'EMI Amount', rs(m.emi)],
      ['Loan Amount', rs(m.loanAmount), 'Total Interest', rs(m.totalInterest)],
      ['Tenure', m.tenure + ' months', 'Total Repayment', rs(m.totalRepayment)],
      ['Interest Rate (Fixed)', m.rate.toFixed(2) + '% p.a.', 'ROI % (Flat)', m.roiFlat.toFixed(2) + '%'],
      ['Processing / Other Fee', rs(m.fee), 'Disbursal Amount', rs(m.loanAmount)],
      ['Disbursement Date', formatDate(m.disbDate), 'Subvention Amount', 'Rs. 0']
    ],
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 244, 250] },
      2: { fontStyle: 'bold', fillColor: [240, 244, 250] }
    }
  });

  // Amortization schedule
  let totalI = 0, totalP = 0, totalE = 0, totalC = 0;
  const body = scheduleData.map(function (r) {
    totalI += r.interest; totalP += r.principal; totalE += r.emi; totalC += r.cashflow;
    return [r.sr, formatDate(r.date), formatINR(r.pos), formatINR(r.interest),
            formatINR(r.principal), formatINR(r.emi), formatINR(r.cashflow)];
  });
  body.push([
    { content: 'Total', colSpan: 2, styles: { halign: 'left' } },
    '-', formatINR(totalI), formatINR(totalP), formatINR(totalE), formatINR(totalC)
  ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Amortization Schedule', 30, doc.lastAutoTable.finalY + 24);

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 32,
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 4, halign: 'right' },
    headStyles: { fillColor: [13, 31, 60], halign: 'right' },
    head: [['Sr. No.', 'Date', 'POS (Rs)', 'Interest (Rs)', 'Principal (Rs)', 'EMI (Rs)', 'Cashflow (Rs)']],
    body: body,
    didParseCell: function (data) {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [225, 232, 245];
      }
    }
  });

  // Footer: note + page numbers
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text('The EMI and interest calculations are indicative. Actual values may vary.', 30, pageH - 20);
    doc.text('Page ' + p + ' of ' + pages, pageW - 30, pageH - 20, { align: 'right' });
  }

  doc.save('Auxilo_Amortization_Schedule.pdf');
}

/* ------------------------------------
   RUN CALCULATE ON PAGE LOAD
   so the table is already filled in
   ------------------------------------ */
window.onload = function() {
  document.getElementById('interestRate').value = FIXED_RATE; // lock the fixed rate
  calculate();
};
