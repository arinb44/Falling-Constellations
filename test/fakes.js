// Minimal Canvas 2D stand-in that counts draw calls; enough to run the draw functions in Bun.
export function fakeCtx() {
  const calls = { stroke: 0, drawImage: 0, fillRect: 0, gradients: 0 };
  return {
    calls,
    globalAlpha: 1, lineCap: '', lineWidth: 1, strokeStyle: '', fillStyle: '', globalCompositeOperation: '',
    beginPath() {}, moveTo() {}, lineTo() {}, setTransform() {},
    stroke() { calls.stroke++; },
    drawImage() { calls.drawImage++; },
    fillRect() { calls.fillRect++; },
    createLinearGradient() { calls.gradients++; return { addColorStop() {} }; },
    createRadialGradient() { calls.gradients++; return { addColorStop() {} }; }
  };
}
export const fakeSprites = () => [0, 1, 2, 3].map(() => ({ canvas: {}, size: 10 }));
