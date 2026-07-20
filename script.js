// =============================================
// Semiconductor SPC Simulator - script.js
// =============================================

let chart;
let allData = [];           
let displayedData = [];     
let currentWafer = 0;
let intervalId = null;
let isRunning = false;
let studentSeed = 12345678;

const maxWafers = 3000;
const windowSize = 100;
const ctx = document.getElementById('mainChart');

function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// === ALL VALUES DERIVED FROM STUDENT NUMBER ===
// Update specification display
function updateSpecificationDisplay(params) {
    const tolerance = 0.7; // ±0.25 nm (you can make this dynamic too)
    const lower = (params.baseMean - tolerance).toFixed(3);
    const upper = (params.baseMean + tolerance).toFixed(3);
    
    document.getElementById('specText').innerHTML = `
        Target = <strong>${params.baseMean.toFixed(3)} nm</strong><br>
        LSL = ${lower} nm | USL = ${upper} nm<br>
        <small>±${tolerance} nm tolerance</small>
    `;
}

function getStudentParameters(studentId) {
    let num = parseInt(studentId.replace(/\D/g, '').slice(0, 8) || "12345678");
    
    // Fully derived base mean thickness from student number
    const baseMean = 10.0 + ((num % 2500) / 250);           // Range ≈ 4.00 to 8.00 nm
    const tolerance = 0.7; // ±0.25 nm (you can make this dynamic too)
    const yMin = (baseMean - tolerance*1.1).toFixed(3);
    const yMax = (baseMean + tolerance*1.1).toFixed(3);

    // Dynamic Y-axis limits derived from baseMean
   // const yMin = parseFloat((baseMean - 1.6).toFixed(1));
    //const yMax = parseFloat((baseMean + 1.6).toFixed(1));

    return { 
        baseMean: parseFloat(baseMean.toFixed(3)), 
        yMin, 
        yMax, 
        seed: num 
    };
}

function preGenerateAllData(studentId) {
    allData = [];
    const params = getStudentParameters(studentId);
    const baseSeed = params.seed;
    
    for (let wafer = 1; wafer <= maxWafers; wafer++) {
        ['A', 'B', 'C'].forEach(machine => {
            const offset = parseFloat(document.getElementById(`dial${machine}`).value);
            
            const seed = baseSeed + (wafer * 17) + (machine.charCodeAt(0) * 11);
            const noise = (seededRandom(seed) - 0.5) * 0.72;
            
            const meanVal = params.baseMean + 
                           (offset * 0.092) + 
                           noise + 
                           (machine === 'B' ? (seededRandom(baseSeed + wafer) * 0.22) : 0);
            
            allData.push({
                index: allData.length + 1,
                wafer: wafer,
                machine: machine,
                mean: parseFloat(meanVal.toFixed(4))
            });
        });
    }
}

function regenerateMachineData(machine, params) {
    const offset = parseFloat(document.getElementById(`dial${machine}`).value);
    const baseSeed = params.seed;
    const startIdx = currentWafer * 3;
    
    for (let i = 0; i < maxWafers - currentWafer; i++) {
        const waferNum = currentWafer + i + 1;
        const globalIdx = startIdx + (i * 3) + (['A','B','C'].indexOf(machine));
        
        const seed = baseSeed + (waferNum * 17) + (machine.charCodeAt(0) * 11);
        const noise = (seededRandom(seed) - 0.5) * 0.72;
        
        const meanVal = params.baseMean + 
                       (offset * 0.092) + 
                       noise + 
                       (machine === 'B' ? (seededRandom(baseSeed + waferNum) * 0.22) : 0);
        
        if (allData[globalIdx]) {
            allData[globalIdx].mean = parseFloat(meanVal.toFixed(4));
        }
    }
}

function createChart(params) {
    if (chart) chart.destroy();
    
    chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'All Machines',
                borderColor: '#60a5fa',
                backgroundColor: '#60a5fa',
                data: [],
                pointRadius: 3.5,
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
                    title: { display: true, text: 'Gate Oxide Thickness (nm)' },
                    min: params.yMin,
                    max: params.yMax,
                    ticks: { stepSize: 0.2 }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function updateGraph() {
    const visiblePoints = [];
    const start = Math.max(0, displayedData.length - windowSize);
    
    for (let i = start; i < displayedData.length; i++) {
        visiblePoints.push({
            x: displayedData[i].index,
            y: displayedData[i].mean
        });
    }
    
    chart.data.datasets[0].data = visiblePoints;
    const minX = Math.max(0, displayedData.length - windowSize);
    chart.options.scales.x.min = minX;
    chart.options.scales.x.max = minX + windowSize;
    chart.update('none');
}

function startFactory() {
    
    const studentInput = document.getElementById('studentId').value.trim();
    const params = getStudentParameters(studentInput);
    updateSpecificationDisplay(params);
    studentSeed = parseInt(studentInput.replace(/\D/g, '') || "12345678");  
    preGenerateAllData(studentInput);
    
    displayedData = allData.slice(0, 90);
    currentWafer = 30;
    
    createChart(params);
    updateGraph();
    
    document.getElementById('downloadBtn').disabled = false;

    intervalId = setInterval(() => {
        if (currentWafer >= maxWafers) {
            clearInterval(intervalId);
            isRunning = false;
            document.getElementById('pauseBtn').disabled = true;
            return;
        }
        
        const nextStart = currentWafer * 3;
        const nextPoints = allData.slice(nextStart, nextStart + 3);
        displayedData.push(...nextPoints);
        
        currentWafer++;
        updateGraph();
    }, 1000);
}

// ====================== Event Listeners ======================

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
    const params = getStudentParameters(document.getElementById('studentId').value);
    updateSpecificationDisplay(params);
    clearInterval(intervalId);
    isRunning = false;
    displayedData = [];
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('downloadBtn').disabled = true;
    createChart(params);
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    if (allData.length === 0) return;
    let csv = "Index,Machine,Mean_Thickness_nm,Wafer\n";
    allData.forEach(row => {
        csv += `${row.index},${row.machine},${row.mean},${row.wafer}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPC_Variable_Data_${document.getElementById('studentId').value || 'student'}.csv`;
    a.click();
});

// Live dial updates
['A','B','C'].forEach(m => {
    const dial = document.getElementById(`dial${m}`);
    const span = document.getElementById(`value${m}`);
    
    dial.addEventListener('input', () => {
        span.textContent = parseFloat(dial.value).toFixed(1);
        
        if (isRunning && allData.length > 0) {
            const params = getStudentParameters(document.getElementById('studentId').value);
            regenerateMachineData(m, params);
            
            const start = Math.max(0, displayedData.length - windowSize);
            for (let i = start; i < displayedData.length; i++) {
                const globalIdx = displayedData[i].index - 1;
                if (allData[globalIdx]) {
                    displayedData[i].mean = allData[globalIdx].mean;
                }
            }
            updateGraph();
        }
    });
});