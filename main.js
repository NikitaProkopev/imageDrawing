const countOfImages = 18;

const imagesContainer = document.getElementById('images-container');
const canvasWorker = new Worker('./canvasWorker.js');

const images = [];

for (let i = 0; i < countOfImages; i++) {
    let img = document.createElement('img');
    let div = document.createElement('div');
    img.className = 'jewelry-image';
    imagesContainer.appendChild(img);
    images.push(img);
}

prepareImages(images);

async function prepareImages(imagesList) {
    for (let i = 0; i < imagesList.length; i++) {
        await new Promise(function (resolve) {

            const img = document.createElement('img');
            const canvas = document.createElement('canvas');

            canvas.width = 960;
            canvas.height = 1440;

            const offscreenCanvas = canvas.transferControlToOffscreen();

            img.src = `./imageDrawing/images/${i + 1}.jpg`;
            img.onload = () => {
                createImageBitmap(img).then(bitmap => {
                    canvasWorker.postMessage(
                        { canvas: offscreenCanvas, bitmap, index: i }
                        ,[offscreenCanvas, bitmap]
                    );
                })

                canvasWorker.onmessage = (e) => {
                    imagesList[e.data.index].src = URL.createObjectURL(e.data.imageData);
                    resolve();
                }
            }
        })
    }

}

