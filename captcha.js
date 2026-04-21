const { createCanvas } = require('canvas');

function generateCaptcha() {
    const width = 200;
    const height = 80;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    // Noise - lines
    for (let i = 0; i < 15; i++) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.stroke();
    }

    // Characters
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let text = '';
    for (let i = 0; i < 5; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    ctx.font = 'bold 40px Inter';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const x = (width / (text.length + 1)) * (i + 1);
        const y = height / 2 + (Math.random() - 0.5) * 10;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((Math.random() - 0.5) * 0.4);
        
        // Shadow/Distortion effect
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillText(char, 2, 2);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(char, 0, 0);
        ctx.restore();
    }

    // Extra grain noise
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (Math.random() > 0.95) {
            data[i] = 255;     // red
            data[i + 1] = 255; // green
            data[i + 2] = 255; // blue
        }
    }
    ctx.putImageData(imageData, 0, 0);

    return {
        image: canvas.toDataURL(),
        text: text
    };
}

module.exports = generateCaptcha;
