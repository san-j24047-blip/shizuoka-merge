const dropBtn = document.getElementById('drop-btn');

dropBtn.addEventListener('click', () => {

});

window.addEventListener('keydown', (event) => {
    if (event.key === '1') {
        selectedType = 0;
        console.log('タイプを 0 に変更しました');
    } else if (event.key === '2') {
        selectedType = 1;
        console.log('タイプを 1 に変更しました');
    } else if (event.key === '3') {
        selectedType = 2;
        console.log('タイプを 2 に変更しました');
    }
    
    if (event.code === 'Space') {
        const radius = Math.random() * 40 + 10;
        const x = Math.random() * canvas.width;
        const y = Math.random() * (canvas.height / 2);
        const speedX = 0;
        const speedY = 0;
        const type = Math.floor(Math.random() * 3);

        parts.push(new Part(x, y, radius, speedX, speedY, weight, type));
    }
});