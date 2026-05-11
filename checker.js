const GALION_MAPPING = {
    "G-PL-01": { label: "Net Revenue (CA Net)", qbo_headers: ["Total Income", "Total Revenue", "Income"] },
    "G-PL-02": { label: "COGS (Coût des Ventes)", qbo_headers: ["Total Cost of Goods Sold", "Cost of Goods Sold"] },
    "G-PL-04": { label: "Masse Salariale", qbo_headers: ["Total Payroll Expenses", "Total Salaries", "Total Wages", "Payroll Expenses"] },
    "G-PL-05": { label: "Marketing & Sales", qbo_headers: ["Total Advertising/Promotional", "Total Marketing", "Advertising", "Promotional"] },
    "G-BS-01": { label: "Trésorerie (Cash)", qbo_headers: ["Total Bank Accounts", "Total Cash and Cash Equivalents", "Bank Accounts"] },
    "G-BS-02": { label: "Créances Clients", qbo_headers: ["Total Accounts Receivable", "Accounts Receivable"] },
    "G-BS-03": { label: "Dettes Fournisseurs", qbo_headers: ["Total Accounts Payable", "Accounts Payable"] },
    "G-BS-04": { label: "Dettes Fiscales/Soc.", qbo_headers: ["Total Other Current Liabilities", "Total Taxes Payable", "Other Current Liabilities"] },
};

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const results = document.getElementById('results');
const analysisBody = document.getElementById('analysis-body');
const scoreValue = document.getElementById('score-value');
const scoreBar = document.getElementById('score-bar');
const scoreText = document.getElementById('score-text');
const gapCount = document.getElementById('gap-count');

// Event Listeners
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-emerald', 'bg-emerald/5');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-emerald', 'bg-emerald/5');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-emerald', 'bg-emerald/5');
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/json") {
        handleFile(file);
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            analyzeQBO(json);
        } catch (err) {
            alert("Invalid JSON file. Please provide a valid QuickBooks export.");
        }
    };
    reader.readAsText(file);
}

function analyzeQBO(data) {
    // Recursive flattener for QBO JSON
    const extractHeaders = (rows, headers = {}) => {
        if (!rows || !rows.Row) return headers;
        rows.Row.forEach(row => {
            if (row.Header && row.Header.ColData) {
                const hName = row.Header.ColData[0].value;
                headers[hName] = true;
            }
            if (row.Rows) extractHeaders(row.Rows, headers);
        });
        return headers;
    };

    const qboHeaders = data.Rows ? extractHeaders(data.Rows) : {};
    
    // Check for "Crédit d'Impôt" specifically (French Nuance)
    let hasTaxCredit = false;
    Object.keys(qboHeaders).forEach(h => {
        if (h.toLowerCase().includes("crédit d'impôt") || h.toLowerCase().includes("tax credit")) {
            hasTaxCredit = true;
        }
    });

    let foundCount = 0;
    const totalFields = Object.keys(GALION_MAPPING).length;
    analysisBody.innerHTML = '';

    Object.entries(GALION_MAPPING).forEach(([id, spec]) => {
        const match = spec.qbo_headers.find(h => qboHeaders[h]);
        const status = match ? 'FOUND' : 'MISSING';
        if (match) foundCount++;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition';
        tr.innerHTML = `
            <td class="px-6 py-4 mono text-xs text-slate-400">${id}</td>
            <td class="px-6 py-4 font-bold text-sm">${spec.label}</td>
            <td class="px-6 py-4">
                <span class="text-[10px] font-bold px-2 py-1 rounded ${match ? 'bg-emerald/10 text-emerald' : 'bg-red-50 text-red-500'}">
                    ${status}
                </span>
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-500">
                ${match ? `Mapped to "${match}"` : `Logic gap: ${spec.label} not detected in QBO export.`}
            </td>
        `;
        analysisBody.appendChild(tr);
    });

    // Tax Credit Check (G-PL-09)
    const taxTr = document.createElement('tr');
    taxTr.className = 'bg-emerald/5';
    taxTr.innerHTML = `
        <td class="px-6 py-4 mono text-xs text-emerald">G-PL-09</td>
        <td class="px-6 py-4 font-bold text-sm text-emerald">French Tax Credits (CIR/CII)</td>
        <td class="px-6 py-4">
            <span class="text-[10px] font-bold px-2 py-1 rounded ${hasTaxCredit ? 'bg-emerald text-white' : 'bg-amber-100 text-amber-600'}">
                ${hasTaxCredit ? 'DETECTED' : 'OPTIONAL'}
            </span>
        </td>
        <td class="px-6 py-4 text-xs font-medium text-slate-500">
            ${hasTaxCredit ? 'Identified CIR/CII rows. These will be isolated from EBITDA.' : 'No Tax Credits detected. Ensure they aren\'t buried in "Other Income".'}
        </td>
    `;
    analysisBody.appendChild(taxTr);

    // Update UI
    const score = Math.round((foundCount / totalFields) * 100);
    scoreValue.innerText = `${score}%`;
    scoreBar.style.width = `${score}%`;
    gapCount.innerText = `${totalFields - foundCount} Found`;
    
    if (score === 100) {
        scoreText.innerText = "Excellent. Your export is perfectly compatible with the Galion Standard.";
        gapCount.className = "text-emerald";
    } else if (score > 70) {
        scoreText.innerText = "Almost ready. A few minor mapping gaps detected.";
        gapCount.className = "text-amber-500";
    } else {
        scoreText.innerText = "Critical gaps detected. Manual intervention required for standard reports.";
        gapCount.className = "text-red";
    }

    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth' });
}

function loadMock() {
    const mockData = {
        "Rows": {
            "Row": [
                {
                    "Header": { "ColData": [{ "value": "Total Income" }] },
                    "Summary": { "ColData": [{}, { "value": "85000" }] },
                    "type": "Section"
                },
                {
                    "Header": { "ColData": [{ "value": "Total Payroll Expenses" }] },
                    "Summary": { "ColData": [{}, { "value": "32000" }] },
                    "type": "Section"
                },
                {
                    "Header": { "ColData": [{ "value": "Total Bank Accounts" }] },
                    "Summary": { "ColData": [{}, { "value": "450000" }] },
                    "type": "Section"
                },
                {
                    "Header": { "ColData": [{ "value": "Crédit d'Impôt Recherche" }] },
                    "Summary": { "ColData": [{}, { "value": "4500" }] },
                    "type": "Section"
                }
            ]
        }
    };
    analyzeQBO(mockData);
}
