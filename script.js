let model;
let isDetecting = false;
let fps = 0;

const elements = {
    loading: document.getElementById('loading'),
    webcam: document.getElementById('webcam'),
    canvas: document.getElementById('canvas'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    status: document.getElementById('status'),
    objectCount: document.getElementById('objectCount'),
    fps: document.getElementById('fps'),
    objectsList: document.getElementById('objectsList')
};

async function initialize() {
    try {
        model = await cocoSsd.load();
        elements.loading.style.display = 'none';
        elements.startBtn.disabled = false;
        updateStatus('Ready');
    } catch (error) {
        updateStatus('Model load failed');
        console.error('Model loading error:', error);
    }
}

async function startDetection() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: 1280, height: 720 }
        });
        
        elements.webcam.srcObject = stream;
        await new Promise(resolve => elements.webcam.onloadedmetadata = resolve);
        
        elements.canvas.width = elements.webcam.videoWidth;
        elements.canvas.height = elements.webcam.videoHeight;
        
        elements.startBtn.disabled = true;
        elements.stopBtn.disabled = false;
        updateStatus('Detecting');
        
        isDetecting = true;
        detectionLoop();
    } catch (error) {
        updateStatus('Camera error');
        console.error('Webcam error:', error);
    }
}

function stopDetection() {
    isDetecting = false;
    if (elements.webcam.srcObject) {
        elements.webcam.srcObject.getTracks().forEach(track => track.stop());
    }
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;
    updateStatus('Stopped');
    clearCanvas();
    elements.objectsList.innerHTML = '';
}

async function detectionLoop() {
    const ctx = elements.canvas.getContext('2d');
    let lastFrameTime = performance.now();

    while (isDetecting) {
        const startTime = performance.now();
        
        try {
            const predictions = await model.detect(elements.webcam);
            const validPredictions = predictions.filter(p => p.score >= 0.65);
            
            ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
            drawPredictions(ctx, validPredictions);
            updateUI(validPredictions);
            
            // Calculate FPS
            const frameTime = performance.now() - startTime;
            fps = 0.8 * fps + 0.2 * (1000 / frameTime);
            elements.fps.textContent = Math.round(fps);
            
            // Maintain ~30fps
            await new Promise(resolve => setTimeout(resolve, 33 - frameTime));
        } catch (error) {
            console.error('Detection error:', error);
            updateStatus('Detection error');
            break;
        }
    }
}

function drawPredictions(ctx, predictions) {
    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const hue = stringToHue(prediction.class);
        
        // Draw bounding box
        ctx.strokeStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        // Draw label
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.3)`;
        ctx.fillRect(x, y - 20, ctx.measureText(prediction.class).width + 10, 20);
        ctx.fillStyle = 'white';
        ctx.font = '14px Inter';
        ctx.fillText(`${prediction.class} (${Math.round(prediction.score * 100)}%)`, x + 5, y - 5);
    });
}

function updateUI(predictions) {
    // Update object count
    elements.objectCount.textContent = predictions.length;

    // Update objects list
    const counts = predictions.reduce((acc, p) => {
        acc[p.class] = (acc[p.class] || 0) + 1;
        return acc;
    }, {});

    elements.objectsList.innerHTML = Object.entries(counts)
        .map(([className, count]) => `
            <div class="flex justify-between items-center p-2 bg-white/5 rounded">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-sm flex items-center justify-center text-white"
                         style="background: hsl(${stringToHue(className)}, 70%, 50%)">
                        ${className[0].toUpperCase()}
                    </div>
                    <span>${className}</span>
                </div>
                <span class="text-primary">${count}</span>
            </div>
        `).join('');
}

function stringToHue(str) {
    return Array.from(str).reduce((hash, char) => char.charCodeAt(0) + (hash << 5) - hash, 0) % 360;
}

function updateStatus(text) {
    elements.status.textContent = text;
}

function clearCanvas() {
    elements.canvas.getContext('2d').clearRect(0, 0, elements.canvas.width, elements.canvas.height);
}

// Event Listeners
elements.startBtn.addEventListener('click', startDetection);
elements.stopBtn.addEventListener('click', stopDetection);

// Initialize app
window.addEventListener('load', initialize);