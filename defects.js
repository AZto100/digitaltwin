// =============================================
// Defects Per Wafer (Attribute Data) - Binomial
// =============================================

let defectChart;
let allDefectData = [];     
let displayedDefectData = [];
let currentWafer = 0;
let intervalId = null;
let isRunning = false;
let studentSeed = 12345678;

const maxWafers = 3000;
const windowSize = 100;
const ctx = document.getElementById('defectChart');

// Simple Binomial random generator (using normal approximation for large n)
function binomialRandom(n, p, seed) {
    // For performance with large n, use normal approximation
    if (n > 50) {
        const mean = n * p;
        const variance = n * p * (1 - p);
        let val = mean + Math.sqrt(variance) * (seededRandom(seed) - 0.5) * 2.8;
        return Math.max(0, Math.round(val));
    }
    
    // Exact binomial for small n
    let count = 0;
    for (let i = 0; i < n; i++) {
        if (seededRandom(seed + i) < p) count++;
    }
    return count;
}

function seededRandom(seed) {
    let x = Math.sin(seed++) * 10110;
    return x - Math.floor(x);
}

function getStudentParameters(studentId) {
    let num = parseInt(studentId.replace(/\D/g, '').slice(0, 8) || "12345678");
    
    // Base defect probability derived from student number (1% to 12%)
    const defectProbability = 0.01 + (num % 1100) / 11000;   // ~0.01 to ~0.11
    
    // Number of "opportunities" (e.g., critical inspection points per wafer)
    const nTrials = 30 + (num % 60);   // 80 to 140 trials
    
    return { 
        p: parseFloat(defectProbability.toFixed(4)), 
        n: nTrials, 
        seed: num 
    };
}

function preGenerateDefectData(studentId) {
    allDefectData = [];
    const params = getStudentParameters(studentId);
    const baseSeed = params.seed;
    
    for (let wafer = 1; wafer <= maxWafers; wafer++) {
        let ii = 0;
        ['A', 'B', 'C'].forEach(machine => {
            const offset = parseFloat(document.getElementById(`dial${machine}`).value);
            
            // Adjust probability based on dial offset
            let effectiveP = 0.04 + 0.042*ii + (offset * 0.008);
            
            effectiveP = Math.max(0.005, Math.min(0.005, effectiveP)); // clamp
            
            const seed = baseSeed + wafer * 23 + machine.charCodeAt(0) * 17;
            const defects = binomialRandom(40, effectiveP, seed)*ii;
            ii=ii+1;
            
            allDefectData.push({
                index: allDefectData.length + 1,
                ii: ii,
                wafer: wafer,
                machine: machine,
                defects: defects,
                p: parseFloat(effectiveP.toFixed(4))
            });
        });
    }
}

function createDefectChart() {
    if (defectChart) defectChart.destroy();
    
    defectChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Defects per Wafer',
                borderColor: '#f87171',
                backgroundColor: '#f87171',
                data: [],
                pointRadius: 4,
                showLine: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: { 
                    title: { display: true, text: 'Data Point Index' },
                    min: 0,
                    max: windowSize
                },
                y: { 
                    title: { display: true, text: 'Number of Defects' },
                    min: 0,
                    max: 10,
                    ticks: { stepSize: 2 }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ... (keep updateDefectGraph, startFactory, and event listeners from previous version)

function updateDefectGraph() {
    const visiblePoints = [];
    const start = Math.max(0, displayedDefectData.length - windowSize);
    
    for (let i = start; i < displayedDefectData.length; i++) {
        visiblePoints.push({
            x: displayedDefectData[i].index,
            y: displayedDefectData[i].defects
        });
    }
    
    defectChart.data.datasets[0].data = visiblePoints;
    const minX = Math.max(0, displayedDefectData.length - windowSize);
    defectChart.options.scales.x.min = minX;
    defectChart.options.scales.x.max = minX + windowSize;
    defectChart.update('none');
}

function startFactory() {
    const studentInput = document.getElementById('studentId').value.trim();
    studentSeed = parseInt(studentInput.replace(/\D/g, '') || "12345678");
    
    preGenerateDefectData(studentInput);
    
    displayedDefectData = allDefectData.slice(0, 90);
    currentWafer = 30;
    
    createDefectChart();
    updateDefectGraph();
    
    document.getElementById('downloadBtn').disabled = false;

    intervalId = setInterval(() => {
        if (currentWafer >= maxWafers) {
            clearInterval(intervalId);
            isRunning = false;
            document.getElementById('pauseBtn').disabled = true;
            return;
        }
        
        const nextStart = currentWafer * 3;
        const nextPoints = allDefectData.slice(nextStart, nextStart + 3);
        displayedDefectData.push(...nextPoints);
        
        currentWafer++;
        updateDefectGraph();
    }, 1000);
}

// Event Listeners (same as before)
document.getElementById('startBtn').addEventListener('click', () => {
    if (isRunning) return;
    isRunning = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    startFactory();
});

document.getElementById('pauseBtn').addEventListener('click', () => {
    clearInterval(intervalId);
    isRunning = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
});

document.getElementById('resetBtn').addEventListener('click', () => {
    clearInterval(intervalId);
    isRunning = false;
    displayedDefectData = [];
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('downloadBtn').disabled = true;
    createDefectChart();
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    if (allDefectData.length === 0) return;
    let csv = "Index,Machine,Defects,Wafer,DefectProbability\n";
    allDefectData.forEach(row => {
        csv += `${row.index},${row.ii},${row.machine},${row.defects},${row.wafer},${row.p || ''}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPC_Defects_Binomial_${document.getElementById('studentId').value || 'student'}.csv`;
    a.click();
});

// Live dial display
['A','B','C'].forEach(m => {
    const dial = document.getElementById(`dial${m}`);
    const span = document.getElementById(`value${m}`);
    dial.addEventListener('input', () => span.textContent = parseFloat(dial.value).toFixed(1));
});