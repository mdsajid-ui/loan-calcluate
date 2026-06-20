/* ============================================
   AUXILO EMI CALCULATOR – JAVASCRIPT
   script.js
   ============================================ */

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

/* ------------------------------------
   MAIN CALCULATE FUNCTION
   ------------------------------------ */
function calculate() {

  // --- Step 1: Read inputs from the form ---
  const P = parseFloat(document.getElementById('loanAmount').value) || 0;
  const annualRate = parseFloat(document.getElementById('interestRate').value) / 100 || 0;
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

  // Save for CSV download
  scheduleData = rows;

  // --- Step 5: Calculate summary figures ---
  const totalRepayment = P + totalInterest;
  // Flat ROI: simple interest rate equivalent
  const roiFlat = (totalInterest / P / n) * 12 * 100;
  const simpleInterest = P * annualRate; // Annual SI for first year

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
   RUN CALCULATE ON PAGE LOAD
   so the table is already filled in
   ------------------------------------ */
window.onload = function() {
  calculate();
};
