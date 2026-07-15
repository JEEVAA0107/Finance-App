// ============================================================
// LoanFlow Pro — Google Apps Script
// SETUP (do this once):
// 1. Go to script.google.com → New Project
// 2. Paste ALL this code → Save (Ctrl+S)
// 3. Click Deploy → New Deployment
//    - Type: Web App
//    - Execute as: Me
//    - Access: Anyone
// 4. Click Deploy → Copy the URL → paste in app Settings
// ============================================================

// PASTE YOUR SPREADSHEET ID HERE (from the URL of your Google Sheet)
const SPREADSHEET_ID = '';
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, message: 'OK' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SPREADSHEET_ID && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE'
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();

    writeSheet(ss, 'Customers',
      ['Name', 'Phone', 'Address', 'City', 'ID Type', 'ID Number', 'Created'],
      (data.customers || []).map(c => [c.name, c.phone, c.address, c.city, c.idType, c.idNumber, c.createdAt])
    );

    const interestLoans = (data.loans || []).filter(l => l.interestType !== 'WITHOUT_INTEREST');
    const deductionLoans = (data.loans || []).filter(l => l.interestType === 'WITHOUT_INTEREST');

    writeSheet(ss, 'Loans (Interest)',
      ['Loan#', 'Customer', 'Phone', 'Principal', 'Interest%', 'Frequency', 'Status', 'Start Date'],
      interestLoans.map(l => [l.loanNumber, l.customerName, l.customerPhone, l.principalAmount, l.interestRate, l.tenureUnit, l.status, l.startDate])
    );

    writeSheet(ss, 'Loans (Deduction)',
      ['Loan#', 'Customer', 'Phone', 'Loan Amount', 'Advance Deduction', 'Disbursed Amount', 'Weeks', 'Status', 'Start Date'],
      deductionLoans.map(l => {
        const principal = Number(l.principalAmount) || 0;
        const fee = Number(l.processingFee) || 0;
        const disbursed = principal - fee;
        return [l.loanNumber, l.customerName, l.customerPhone, principal, fee, disbursed, l.tenure, l.status, l.startDate];
      })
    );

    writeSheet(ss, 'Payments',
      ['Date', 'Customer', 'Phone', 'Loan#', 'Amount', 'Mode', 'Collected By'],
      (data.payments || []).map(p => [p.collectedAt, p.customerName, p.customerPhone, p.loanNumber, p.amount, p.paymentMode, p.collectedByName])
    );

    writeSummarySheet(ss, data);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function writeSummarySheet(ss, data) {
  let sheet = ss.getSheetByName('Summary');
  if (!sheet) {
    sheet = ss.insertSheet('Summary');
  } else {
    sheet.clearContents();
  }

  const totalCustomers = (data.customers || []).length;
  const totalLoans = (data.loans || []).length;

  const totalDisbursed = (data.loans || []).reduce(function (sum, l) {
    const isWithoutInterest = l.interestType === 'WITHOUT_INTEREST';
    const actualDisbursed = isWithoutInterest ? (Number(l.principalAmount) - (Number(l.processingFee) || 0)) : Number(l.principalAmount);
    return sum + (actualDisbursed || 0);
  }, 0);

  const totalCollected = (data.payments || []).reduce(function (sum, p) {
    return sum + (Number(p.amount) || 0);
  }, 0);

  const totalOutstanding = (data.loans || []).reduce(function (sum, l) {
    var outstanding = l.outstandingPrincipal !== null && l.outstandingPrincipal !== undefined ? Number(l.outstandingPrincipal) : Number(l.principalAmount);
    return sum + (l.status === 'ACTIVE' || l.status === 'DEFAULTED' ? outstanding : 0);
  }, 0);

  const headers = ['Financial Metric', 'Value / Details'];
  const rows = [
    ['Total Customers Registered', totalCustomers],
    ['Total Loans Issued', totalLoans],
    ['Total Capital Disbursed', '₹' + totalDisbursed.toLocaleString('en-IN')],
    ['Total Payments Collected', '₹' + totalCollected.toLocaleString('en-IN')],
    ['Estimated Outstanding Balance', '₹' + totalOutstanding.toLocaleString('en-IN')],
    ['Last Updated', new Date().toLocaleString('en-IN')]
  ];

  sheet.appendRow(headers);
  for (var i = 0; i < rows.length; i++) {
    sheet.appendRow(rows[i]);
  }

  // Apply styling
  sheet.getRange(1, 1, 1, 2).setBackground('#1e3a8a').setFontColor('white').setFontWeight('bold');
  sheet.getRange(2, 1, rows.length, 1).setFontWeight('bold');
  sheet.getRange(2, 2, rows.length, 1).setHorizontalAlignment('right');
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 200);
}

function writeSheet(ss, name, headers, rows) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setBackground('#1a73e8').setFontColor('white').setFontWeight('bold');
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}
