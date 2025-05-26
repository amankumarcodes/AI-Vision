let model;
let webcamElement;
let canvasElement;
let ctx;
let stats = {
    objectsDetected: 0,
    fps: 0,
    lastDetectionTime: 0
};

const elements = {
    startButton: document.getElementById('start-button'),
    stopButton: document.getElementById('stop-button'),
    status: document.getElementById('status'),
    statusIndicator: document.getElementById('status-indicator'),
    objectsCount: document.getElementById('objects-count'),
    fpsElement: document.getElementById('fps'),
    objectsList: document.getElementById('objects-list'),
    loadingIndicator: document.getElementById('loading-indicator')
};

document.addEventListener('DOMContentLoaded', async () => {
    webcamElement = document.getElementById('webcam');
    canvasElement = document.getElementById('output-canvas');
    ctx = canvasElement.getContext('2d');

    try {
        model = await cocoSsd.load();
        elements.loadingIndicator.style.display = 'none';
        elements.startButton.disabled = false;
    } catch (error) {
        console.error('Model load error:', error);
        elements.status.textContent = 'Error: Model failed to load';
        elements.statusIndicator.style.backgroundColor = '#ef4444';
    }

    elements.startButton.addEventListener('click', startDetection);
    elements.stopButton.addEventListener('click', stopDetection);
});

async function startDetection() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: 1280, height: 720 }
        });
        
        webcamElement.srcObject = stream;
        await new Promise(resolve => webcamElement.onloadedmetadata = resolve);
        await webcamElement.play();

        canvasElement.width = webcamElement.videoWidth;
        canvasElement.height = webcamElement.videoHeight;

        elements.startButton.disabled = true;
        elements.stopButton.disabled = false;
        updateStatus('running', '#10b981');

        detectFrame();
        setInterval(updateFPS, 1000);
    } catch (error) {
        console.error('Webcam error:', error);
        updateStatus('error', '#ef4444');
    }
}

function stopDetection() {
    if (webcamElement.srcObject) {
        webcamElement.srcObject.getTracks().forEach(track => track.stop());
    }
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    elements.startButton.disabled = false;
    elements.stopButton.disabled = true;
    updateStatus('stopped', '#ef4444');
    elements.objectsList.innerHTML = '';
    elements.objectsCount.textContent = '0';
}

async function detectFrame() {
    if (!model || !webcamElement.srcObject) return;

    const startTime = performance.now();

    try {
        const tensor = tf.tidy(() => {
            return tf.browser.fromPixels(webcamElement)
                .resizeBilinear([640, 480])
                .div(255.0)
                .expandDims(0);
        });

        const predictions = await model.detect(tensor);
        tensor.dispose();

        const filtered = predictions.filter(p => p.score >= 0.65);
        stats.objectsDetected = filtered.length;

        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        renderPredictions(filtered);
        updateObjectsList(filtered);

        stats.fps = 0.8 * stats.fps + 0.2 * (1000 / (performance.now() - startTime));
        elements.fpsElement.textContent = Math.round(stats.fps);
        elements.objectsCount.textContent = filtered.length;

        requestAnimationFrame(detectFrame);
    } catch (error) {
        console.error('Detection error:', error);
        updateStatus('error', '#ef4444');
    }
}

function renderPredictions(predictions) {
    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const hue = stringToHue(prediction.class);
        const color = `hsl(${hue}, 70%, 50%)`;

        // Draw bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        // Draw label background
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.3)`;
        ctx.fillRect(x, y - 20, ctx.measureText(prediction.class).width + 10, 20);

        // Draw label text
        ctx.fillStyle = 'white';
        ctx.font = '14px Inter';
        ctx.fillText(`${prediction.class} (${Math.round(prediction.score * 100)}%)`, x + 5, y - 5);
    });
}

function updateObjectsList(predictions) {
    const counts = predictions.reduce((acc, p) => {
        acc[p.class] = (acc[p.class] || 0) + 1;
        return acc;
    }, {});

    elements.objectsList.innerHTML = Object.entries(counts)
        .map(([className, count]) => `
            <div class="object-card p-3 flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white" 
                     style="background: linear-gradient(135deg, hsl(${stringToHue(className)}, 70%, 50%), hsl(${(stringToHue(className) + 30) % 360}, 70%, 50%)">
                    ${className.charAt(0).toUpperCase()}
                </div>
                <div class="flex-1">${className}</div>
                <div class="px-2 py-1 rounded-full bg-primary/10 text-primary text-sm">${count}</div>
            </div>
        `).join('');
}

function stringToHue(str) {
    return Array.from(str).reduce((hash, char) => char.charCodeAt(0) + (hash << 5) - hash, 0) % 360;
}

function updateStatus(status, color) {
    elements.status.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    elements.statusIndicator.style.backgroundColor = color;
}

function updateFPS() {
    elements.fpsElement.textContent = Math.round(stats.fps);
}