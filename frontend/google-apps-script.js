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
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, message: 'OK' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    writeSheet(ss, 'Customers', 
      ['Name', 'Phone', 'Address', 'City', 'ID Type', 'ID Number', 'Created'],
      (data.customers || []).map(c => [c.name, c.phone, c.address, c.city, c.idType, c.idNumber, c.createdAt])
    );

    writeSheet(ss, 'Loans',
      ['Loan#', 'Customer', 'Phone', 'Principal', 'Interest%', 'Type', 'Status', 'Start Date'],
      (data.loans || []).map(l => [l.loanNumber, l.customerName, l.customerPhone, l.principalAmount, l.interestRate, l.tenureUnit, l.status, l.startDate])
    );

    writeSheet(ss, 'Payments',
      ['Date', 'Customer', 'Phone', 'Loan#', 'Amount', 'Mode', 'Collected By'],
      (data.payments || []).map(p => [p.collectedAt, p.customerName, p.customerPhone, p.loanNumber, p.amount, p.paymentMode, p.collectedByName])
    );

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function writeSheet(ss, name, headers, rows) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setBackground('#1a73e8').setFontColor('white').setFontWeight('bold');
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}
