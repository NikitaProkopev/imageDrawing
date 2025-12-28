onmessage = async function(e) {

    const { canvas, bitmap, index } = e.data;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    const imageAspectRatio = Math.round(bitmap.height / bitmap.width * 10) / 10;
    const canvasAspectRatio = canvas.height / canvas.width;
    let maxAxis = "x";
    let drawingImageWidth, drawingImageHeight;
    let drawingImageX = 0, drawingImageY = 0;

    if (imageAspectRatio < canvasAspectRatio) {
        drawingImageWidth = canvas.width;
        drawingImageHeight = Math.round(drawingImageWidth * imageAspectRatio);
        if (drawingImageHeight / 2 % 1 !== 0) {
            drawingImageHeight--;
        }
        drawingImageY = (canvas.height - drawingImageHeight) / 2;
        maxAxis = "x"
    } else if (imageAspectRatio > canvasAspectRatio) {
        drawingImageHeight = canvas.height;
        drawingImageWidth = Math.round(drawingImageHeight / imageAspectRatio);
        if (drawingImageWidth / 2 % 1 !== 0) {
            drawingImageWidth--;
        }
        drawingImageX = (canvas.width - drawingImageWidth) / 2;
        maxAxis = "y"
    } else {
        drawingImageWidth = canvas.width;
        drawingImageHeight = canvas.height;
    }

    context.drawImage(bitmap, drawingImageX, drawingImageY, drawingImageWidth, drawingImageHeight);

    if (canvasAspectRatio !== imageAspectRatio) {
        const baseImageOnCanvasConfig = {
            x: drawingImageX,
            y: drawingImageY,
            width: drawingImageWidth,
            height: drawingImageHeight,
        }

        createAndRenderAdditionalParts(canvas, context, baseImageOnCanvasConfig, maxAxis);
    }

    postMessage({ imageData: await canvas.convertToBlob({ type: "image/png" }), index });
}

function createYAdditionalParts(canvas, context, imageConfig) {
    const { x, y, width, height } = imageConfig;

    let topBuffer = context.createImageData(width, y);
    let firstPixelsRow = context.getImageData(x, y, width, 1);

    const mostPopularPixels = {};

    for (let i = 0; i < firstPixelsRow.data.length; i += 4) {
        const r = firstPixelsRow.data[i];
        const g = firstPixelsRow.data[i + 1];
        const b = firstPixelsRow.data[i + 2];
        const a = firstPixelsRow.data[i + 3];

        const keyName = `${r},${g},${b},${a}`;

        mostPopularPixels[keyName] = (mostPopularPixels[keyName] || 0) + 1;
    }

    let calculatedIntervals = calculateJewelryIntervals(mostPopularPixels, firstPixelsRow, context, canvas);
    const jewleriesColors = [];

    let preparedIntervals = [...calculatedIntervals];

    for (let i = preparedIntervals.length - 2; i >= 0; i -= 2) {
        if (preparedIntervals[i] - preparedIntervals[i - 1] < 5) {
            preparedIntervals.splice(i - 1, 2);
        }
    }

    let recalculatedIntervals = [...preparedIntervals];

    for(let j = 0; j < recalculatedIntervals.length; j += 2) {
        const firstPixelInIntervalIndex = (recalculatedIntervals[j] - 1) * 4;
        const lastPixelInIntervalIndex = (recalculatedIntervals[j + 1]) * 4;
        jewleriesColors.push(firstPixelsRow.data.slice(firstPixelInIntervalIndex, lastPixelInIntervalIndex))
    }

    jewleriesColors.forEach((colors, i) => {
        const pixelNearIntervalIndex = recalculatedIntervals[i * 2] <= 1 ? recalculatedIntervals[i * 2 + 1] - 1 : recalculatedIntervals[i * 2] - 1;
        const pixelNearInterval = firstPixelsRow.data.slice(pixelNearIntervalIndex * 4, (pixelNearIntervalIndex + 1) * 4);

        let toEnd = false;
        const maxDiff = 75;
        for (let colorIndex = 0; colorIndex < colors.length; colorIndex += 4) {
            const pixelDiff = pixelNearInterval.reduce((accum, item, index) => {
                return accum + Math.abs(item - colors[colorIndex + index]);
            }, 0);
            if (pixelDiff < maxDiff) {
                    recalculatedIntervals[i * 2] += 1;
            } else {
                toEnd = true;
                break;
            }
        }
        if (toEnd) {
            for (let colorIndex = colors.length - 5; colorIndex < colors.length; colorIndex -= 4) {
                const pixelDiff = pixelNearInterval.reduce((accum, item, index) => {
                    return accum + Math.abs(item - colors[colorIndex + index]);
                }, 0);
                if (pixelDiff < maxDiff) {
                    recalculatedIntervals[(i * 2) + 1] -= 1;
                } else {
                    break;
                }
            }
        }

    })
    recalculatedIntervals = recalculatedIntervals.sort((a, b) => a - b);

    for (let i = recalculatedIntervals.length - 2; i >= 0; i -= 2) {
        if (Math.abs(recalculatedIntervals[i] - recalculatedIntervals[i + 1]) <= 2) {
            recalculatedIntervals.splice(i, 2);
        }
    }
    let calculatedJewelryParts;
    if (recalculatedIntervals.length !== 0) {
        calculatedJewelryParts = calculateJewelriesPars(recalculatedIntervals, firstPixelsRow, context, imageConfig); // null or data
        if (calculatedJewelryParts) {
            clearNewBackground(preparedIntervals, firstPixelsRow, imageConfig.width);
        }
    }
    // for (let i = 0; i < recalculatedIntervals.length; i += 2) {
    //     console.log(recalculatedIntervals[i], recalculatedIntervals[i + 1], 'preparedIntervals[i] preparedIntervals[i + 1]')
    //     for (let j = recalculatedIntervals[i]; j < recalculatedIntervals[i + 1]; j++) {
    //         firstPixelsRow.data[j * 4] = 255;
    //         firstPixelsRow.data[j * 4 + 1] = firstPixelsRow.data[j * 4 + 2] = i * 25;
    //     }
    // }

    for (let i = 0; i < y; i++) {
        topBuffer.data.set(firstPixelsRow.data, i * firstPixelsRow.data.length);
    }

    topBuffer = randomizeGeneratedPartBackground(topBuffer, firstPixelsRow, width)

    if (calculatedJewelryParts) {
        topBuffer = drawNewJewelryParts(topBuffer, calculatedJewelryParts, context, imageConfig, recalculatedIntervals);
    }

    const lastPixelsRow = context.getImageData(x, y + height - 1, width, 1);
    const bottomPartHeight = canvas.height - y - height;
    let bottomBuffer = context.createImageData(width, bottomPartHeight);

    for (let i = 0; i < y; i++) {
        bottomBuffer.data.set(lastPixelsRow.data, i * lastPixelsRow.data.length);
    }

    bottomBuffer = randomizeGeneratedPartBackground(bottomBuffer, lastPixelsRow, width)

    return { topBuffer, bottomBuffer };
}

function createXAdditionalParts(canvas, context, imageConfig) {

    const { x, width, height } = imageConfig;

    const partWidth = (canvas.width - width) / 2;

    const leftBuffer = context.createImageData(partWidth, height);
    const firstPixelsColumn = context.getImageData(x, 0, 1, height);

    for (let i = 0; i < firstPixelsColumn.data.length / 4; i++) {

        const srcIndex = i * 4;
        const pixel = firstPixelsColumn.data.slice(srcIndex, srcIndex + 4);

        for(let j = 0; j < partWidth; j++) {
            leftBuffer.data.set(pixel, (i * partWidth + j) * 4);
        }
    }

    const rightBuffer = context.createImageData(partWidth, height);
    const lastPixelsColumn = context.getImageData(x + width - 1, 0, 1, height);
    for (let i = 0; i < lastPixelsColumn.data.length / 4; i++) {

        const srcIndex = i * 4;
        const pixel = lastPixelsColumn.data.slice(srcIndex, srcIndex + 4);

        for(let j = 0; j < partWidth; j++) {
            rightBuffer.data.set(pixel, (i * partWidth + j) * 4);
        }
    }

    return { leftBuffer, rightBuffer };
}

function createAndRenderAdditionalParts(canvas, context, baseImageOnCanvasConfig, maxAxis) {

    const { y, width, height } = baseImageOnCanvasConfig;
    switch (maxAxis) {
        case "x": {
            let { topBuffer, bottomBuffer } = createYAdditionalParts(canvas, context, baseImageOnCanvasConfig);

            context.putImageData(topBuffer, 0, 0);
            context.putImageData(bottomBuffer, 0, y + height);
            // TODO return blur
            blurGeneratedImagePart(context, baseImageOnCanvasConfig);
            break;
        }
        case "y": {
            const { leftBuffer, rightBuffer } = createXAdditionalParts(canvas, context, baseImageOnCanvasConfig);

            const partWidth = (canvas.width - width) / 2;

            context.putImageData(leftBuffer, 0, 0);
            context.putImageData(rightBuffer, partWidth + width, 0);
            break;
        }
    }
}

function findNearestPixelByColor(currentPixel, mostPopularPixels) {
    const mostPopularPixelKeys = Object.keys(mostPopularPixels);

    const nearestPixel = mostPopularPixelKeys.reduce((accum, key) => {
        const currentPixelColor = key.split(',').map(Number);
        const diff = currentPixelColor.reduce((accum, item, index) => {
            return accum + Math.abs(item - currentPixel[index]);
        }, 0);
        accum.push([diff, key]);
        return accum;
    }, [])
        .sort((a, b) => a[0] - b[0]);

    return nearestPixel[0][1];
}

function cloneImageData(originalImageData, context) {
    const result = context.createImageData(originalImageData.width, originalImageData.height);
    result.data.set(originalImageData.data);
    return result;
}

function calculateIntervals(array) {
    const calculatedIntervals = [];
    const preparedArray = [];
    const result = [];

    array.forEach((item, index) => {
        if (index === array.length - 1) {
            return;
        }
        if (array[index + 1] - item === 1 || (index !== 0 && item - array[index - 1] === 1)) {
            preparedArray.push(item);
        }
    })

    let prevMin = preparedArray[0];

    for (let i = 0; i < preparedArray.length; i++) {
        if (i !== preparedArray.length - 1) {

            if (preparedArray[i] + 1 < preparedArray[i + 1]) {
                if (prevMin === preparedArray[i]) {
                    continue;
                }
                calculatedIntervals.push(prevMin, preparedArray[i]);
                prevMin = preparedArray[i + 1];
            }
        }


        if (i === preparedArray.length - 1) {
            calculatedIntervals.push(prevMin, preparedArray[i]);
        }
    }

    for(let i = 0; i < calculatedIntervals.length; i += 2) {
        if (calculatedIntervals[i] + 1 !== calculatedIntervals[i + 1]) {
            result.push(calculatedIntervals[i], calculatedIntervals[i + 1]);
        }
    }

    return result;
}

function getAvgColorOnRowInterval(pixelsRow, start, end) {
    let avgColor = [0, 0, 0, 0];

    for (let j = start * 4; j < end * 4; j += 4) {
        avgColor[0] += pixelsRow.data[j]
        avgColor[1] += pixelsRow.data[j + 1]
        avgColor[2] += pixelsRow.data[j + 2]
        avgColor[3] += pixelsRow.data[j + 3]
    }

    return avgColor.map(item => Math.round(item / (end - start)));
}

function compareToBackground(pixelsRow, preparedPixelRow, interval, prevEnd, nextStart) {
    const avgDiapasonColor = getAvgColorOnRowInterval(
        preparedPixelRow,
        interval[0],
        interval[1]
    );

    const betweenStartAndPrevIntervalPixelIndex = Math.round((prevEnd + interval[0]) / 2);
    const betweenEndAndNextIntervalsPixelIndex = Math.round(
        (nextStart + interval[1]) / 2
    );

    const betweenStartAndPrevIntervalPixel = [
        pixelsRow.data[betweenStartAndPrevIntervalPixelIndex * 4],
        pixelsRow.data[betweenStartAndPrevIntervalPixelIndex * 4 + 1],
        pixelsRow.data[betweenStartAndPrevIntervalPixelIndex * 4 + 2],
        pixelsRow.data[betweenStartAndPrevIntervalPixelIndex * 4 + 3],
    ];

    const betweenEndAndNextIntervalsPixel = [
        pixelsRow.data[betweenEndAndNextIntervalsPixelIndex * 4],
        pixelsRow.data[betweenEndAndNextIntervalsPixelIndex * 4 + 1],
        pixelsRow.data[betweenEndAndNextIntervalsPixelIndex * 4 + 2],
        pixelsRow.data[betweenEndAndNextIntervalsPixelIndex * 4 + 3],
    ];

    const diffBetweenAvg = avgDiapasonColor.reduce((accum, item, index) => {
        return accum + Math.abs(item - avgDiapasonColor[index])
    }, 0);

    const diffStartAvgAndBetweenPixels = avgDiapasonColor.reduce((accum, item, index) => {
        accum[0] += Math.abs(item - betweenStartAndPrevIntervalPixel[index]);
        accum[1] += Math.abs(item - betweenEndAndNextIntervalsPixel[index]);
        return accum;
    }, [0, 0]);

    const minDiff = Math.min(...diffStartAvgAndBetweenPixels);

    return minDiff < 5
}

function calculateJewelryIntervals(mostPopularPixels, firstPixelsRow, context, canvas) {

    const value = 1;
    const mostPopularPixelKeys = Object.keys(mostPopularPixels).sort((a, b) => mostPopularPixels[b] - mostPopularPixels[a]);
    let mostPopularPixelsCopy;
    let calculatedIntervals;

    for (let i = value; i <= value; i++) {

        mostPopularPixelsCopy = { ...mostPopularPixels };

        mostPopularPixelKeys.forEach((key, index) => {
            if (index === 0) {
                return;
            }
            const currentPixel = key.split(',').map(Number);
            const prevPixel = mostPopularPixelKeys[index - 1].split(',').map(Number);

            const diff = currentPixel.reduce((accum, item, index) => {
                return accum + Math.abs(item - prevPixel[index]);
            }, 0);

            if (diff < i) {
                mostPopularPixelsCopy[key] += mostPopularPixelsCopy[mostPopularPixelKeys[index - 1]];
                delete mostPopularPixelsCopy[mostPopularPixelKeys[index - 1]];
            }
        })

        const notChangedPixelIndexes = [];

        const firstPixelsRowCopy = cloneImageData(firstPixelsRow, context);

        for (let j = 0; j < firstPixelsRowCopy.data.length; j += 4) {
            const currentPixel = firstPixelsRowCopy.data.slice(j, j + 4);

            if (j === 0) {
                const nextPixel = firstPixelsRowCopy.data.slice(j + 4, j + 8);
                const nearestPixelKeyNext = findNearestPixelByColor(nextPixel, mostPopularPixelsCopy);
                if (mostPopularPixelsCopy[nearestPixelKeyNext] > i) {
                    firstPixelsRowCopy.data.set(currentPixel, j);

                } else {
                    notChangedPixelIndexes.push(0);
                }
            } else {
                const nearestPixelKey = findNearestPixelByColor(currentPixel, mostPopularPixelsCopy);


                if (mostPopularPixelsCopy[nearestPixelKey] > i) {
                    firstPixelsRowCopy.data.set(currentPixel, j);
                } else {
                    notChangedPixelIndexes.push(j / 4);
                }
            }
        }

        calculatedIntervals = calculateIntervals(notChangedPixelIndexes);
        let intervalsLength = calculatedIntervals.length;

        const neededToRemoveIntervalsIndexes = [];
        for(let intervalArrayIndex = 0; intervalArrayIndex < intervalsLength; intervalArrayIndex += 2) {
            const prevEnd = intervalArrayIndex === 0 ? 0 : calculatedIntervals[intervalArrayIndex - 1];
            const nextStart = intervalArrayIndex === intervalsLength - 2 ? canvas.width - 1 : calculatedIntervals[intervalArrayIndex + 2];
            const interval = [calculatedIntervals[intervalArrayIndex], calculatedIntervals[intervalArrayIndex + 1]]

            if (compareToBackground(firstPixelsRow, firstPixelsRowCopy, interval, prevEnd, nextStart)) {
                neededToRemoveIntervalsIndexes.push(intervalArrayIndex);
            }
        }

        for (let needToRemoveIntervalIndex = neededToRemoveIntervalsIndexes.length - 1; needToRemoveIntervalIndex >= 0; needToRemoveIntervalIndex--) {
            calculatedIntervals.splice(neededToRemoveIntervalsIndexes[needToRemoveIntervalIndex], 2)
        }
        //
        // intervalsLength = calculatedIntervals.length;
        //
        // let notChangedWidth = 0;
        //
        // for (let k = 0; k < intervalsLength; k += 2) {
        //     const start = calculatedIntervals[k];
        //     const end = calculatedIntervals[k + 1];
        //     notChangedWidth += end - start;
        //
        // }
        // if (notChangedWidth === 0) {
        //     break;
        // }
        // if (intervalsLength <= 8 && notChangedWidth < canvas.width * 0.25) {
        //
        //     for (let intervalArrayIndex = 0; intervalArrayIndex < intervalsLength; intervalArrayIndex += 2) {
        //
        //         if (intervalArrayIndex === intervalsLength - 2) {
        //             calculatedIntervals[intervalArrayIndex + 1] += 2;
        //         }
        //
        //         if (intervalArrayIndex === 0) {
        //             if (calculatedIntervals[intervalArrayIndex] === 0) {
        //             } else {
        //                 calculatedIntervals[intervalArrayIndex] -= 1;
        //             }
        //         } else {
        //             calculatedIntervals[intervalArrayIndex - 1] -= 1;
        //             calculatedIntervals[intervalArrayIndex] -= 1;
        //         }
        //
        //     }
        //     break;
        // }
        //
        // firstPixelsRow = firstPixelsRowCopy;

    }

    return calculatedIntervals;
}

function calculateJewelriesPars(recalcIntervals, firstPixelsRow, context, imageConfig) {

    const { x, y, width } = imageConfig;

    let jewelryPixelsByIntervals = []

    for (let intervalIndex = 0; intervalIndex < recalcIntervals.length; intervalIndex += 2) {

        const start = recalcIntervals[intervalIndex];
        const end = recalcIntervals[intervalIndex + 1];

        const nearestPixelIndex = calculatePixelIndexNearJewelryInterval(recalcIntervals, intervalIndex, width)
        const nearestPixel = getPixelByIndex(nearestPixelIndex * 4, firstPixelsRow);

        let intervalWidth = end - start >= 15 ? end - start : 15;

        let calculatedSearchStart = start - intervalWidth * 5;
        let calculatedSearchEnd = end + intervalWidth * 5;
        let firstRowsHeight = intervalWidth * 5;

        if (firstRowsHeight < 100) {
            firstRowsHeight = 100;
        }
        if (firstRowsHeight > 200) {
            firstRowsHeight = 200;
        }

        const firstImagePixelsRow = context.getImageData(x, y, width, firstRowsHeight);

        if (!jewelryPixelsByIntervals[intervalIndex / 2]) {
            jewelryPixelsByIntervals.push({
                foundedJewelryPixels: [],
            })
        }


        if (intervalIndex === 0) {
            if (calculatedSearchStart < 0) {
                calculatedSearchStart = 0;
            }
        }
        else {
            if (calculatedSearchStart < recalcIntervals[intervalIndex - 1]) {
                calculatedSearchStart = recalcIntervals[intervalIndex - 1] + 1;
            }
        }


        if (intervalIndex === recalcIntervals.length - 2) {
            if (calculatedSearchEnd > width - 1) {
                calculatedSearchEnd = width - 1;
            }
        } else {
            if (calculatedSearchEnd > recalcIntervals[intervalIndex + 2]) {
                calculatedSearchEnd = recalcIntervals[intervalIndex + 2] - 1;
            }
        }

        for (let jewelryPixelIndex = start; jewelryPixelIndex < end; jewelryPixelIndex++) {
            const pixel = getPixelByIndex(jewelryPixelIndex * 4, firstPixelsRow);

            const diffBetweenPixelAndNearest = differenceBetweenPixels(pixel, nearestPixel);

            if (diffBetweenPixelAndNearest < 100) {
                continue;
            }

            for (let i = 0; i < firstRowsHeight; i++) {
                if (!jewelryPixelsByIntervals[intervalIndex / 2].foundedJewelryPixels[i]) {
                    jewelryPixelsByIntervals[intervalIndex / 2].foundedJewelryPixels[i] = [];
                }
                for (let j = calculatedSearchStart; j <= calculatedSearchEnd; j++) {
                    const pixelStartPosition = ((i) * width * 4) + j * 4;
                    const mainImagePixel = getPixelByIndex(pixelStartPosition, firstImagePixelsRow);

                    const diff = differenceBetweenPixels(pixel, mainImagePixel);

                    if (diff < 50) {
                        jewelryPixelsByIntervals[intervalIndex / 2].foundedJewelryPixels[i].push(j);
                        // firstImagePixelsRow.data[pixelStartPosition] = 255;
                        // firstImagePixelsRow.data[pixelStartPosition + 1] = 0;
                        // firstImagePixelsRow.data[pixelStartPosition + 2] = 0;
                        // firstImagePixelsRow.data[pixelStartPosition + 3] = 255;
                    }
                }

            }
        }
        context.putImageData(firstImagePixelsRow, x, y);

    }

    jewelryPixelsByIntervals = jewelryPixelsByIntervals.map((jewelryPixelsByInterval) => {

        const calculatedMinMax = jewelryPixelsByInterval.foundedJewelryPixels.map((jewelryPixelsRow) => {
            const calculatedMin = Math.min(...jewelryPixelsRow);
            const calculatedMax = Math.max(...jewelryPixelsRow);

            return {
                min: calculatedMin > width ? width + 1 : calculatedMin,
                max: calculatedMax < 0 ? -1 : calculatedMax
            }
        });

        const maxValue = calculatedMinMax.reduce((accum, item, index) => {
            if (item.max > accum.max) {
                accum.max = item.max;
                accum.index = index;
            }
            return accum;
        }, { max: Number.MIN_VALUE, index: -1});
        const minValue = calculatedMinMax.reduce((accum, item, index) => {
            if (item.min < accum.min) {
                accum.min = item.min;
                accum.index = index;
            }
            return accum;
        }, { min: Number.MAX_VALUE, index: -1});

        return {
            foundedJewelryPixels: calculatedMinMax,
            minValue,
            maxValue,
        }
    })

    let countOfEmpties = 0;

    jewelryPixelsByIntervals.forEach((jewelryPixelsByInterval) => {
        jewelryPixelsByInterval.foundedJewelryPixels.forEach((jewelryPixelsRow) => {
            if (jewelryPixelsRow.max === -1 && jewelryPixelsRow.min === width + 1) {
                countOfEmpties++;
            }
        })
    })

    const countOfRows = jewelryPixelsByIntervals.reduce((accum, item) => {
        return accum + item.foundedJewelryPixels.length;
    }, 0)

    if (Math.round((countOfEmpties / countOfRows) * 100) > 25) {
        return null
    }

    return jewelryPixelsByIntervals;
}

function differenceBetweenPixels(pixel1, pixel2) {
    return pixel1.reduce((accum, item, index) => {
        return accum + Math.abs(item - pixel2[index]);
    }, 0);
}

function getPixelByIndex(startPixelPosition, pixelsRow) {
    return [
        pixelsRow.data[startPixelPosition],
        pixelsRow.data[startPixelPosition + 1],
        pixelsRow.data[startPixelPosition + 2],
        pixelsRow.data[startPixelPosition + 3],
    ]
}

function calculatePixelIndexNearJewelryInterval(recalcIntervals, intervalIndex, width, diapason = 10) {
    if (intervalIndex === 0) {
        if (recalcIntervals[intervalIndex] !== 0) {
            return recalcIntervals[intervalIndex] - diapason < 0 ? 0 : recalcIntervals[intervalIndex] - diapason;
        } else {
            return recalcIntervals[intervalIndex + 1] + diapason
        }
    }

    if (intervalIndex === recalcIntervals.length - 2) {
        if (recalcIntervals[intervalIndex + 1] !== width) {
            return recalcIntervals[intervalIndex + 1] + diapason > width ? width - 1 : recalcIntervals[intervalIndex + 1] + diapason;
        } else {
            return recalcIntervals[intervalIndex + 1] - diapason;
        }
    }

    return recalcIntervals[intervalIndex] + diapason;
}

function clearNewBackground(recalcIntervals, firstPixelsRow, imageWidth) {

    for (let intervalIndex = 0; intervalIndex < recalcIntervals.length; intervalIndex += 2) {
        const defaultDiapasonValue = 5;
        const intervalStart = recalcIntervals[intervalIndex] - defaultDiapasonValue < 0
            ? 0
            : recalcIntervals[intervalIndex] - defaultDiapasonValue;
        const intervalEnd = recalcIntervals[intervalIndex + 1] + defaultDiapasonValue > imageWidth
            ? imageWidth
            : recalcIntervals[intervalIndex + 1] + defaultDiapasonValue;

        const bgPixel = getPixelByIndex(intervalEnd * 4, firstPixelsRow)

        for (let i = intervalStart; i <= intervalEnd; i++) {
            const randomizedValue = bgPixel.map((item) => randomizePixelColorChanelValue(item))

            firstPixelsRow.data[i * 4] = randomizedValue[0];
            firstPixelsRow.data[i * 4 + 1] = randomizedValue[1];
            firstPixelsRow.data[i * 4 + 2] = randomizedValue[2];
            firstPixelsRow.data[i * 4 + 3] = randomizedValue[3];
        }
    }

    return firstPixelsRow
}

function randomizePixelColorChanelValue(pixelColorChanelValue, diapasonValue = 3) {
    const pixelRandomizeValue = Math.round(Math.random() * diapasonValue * 2) - diapasonValue;

    if (pixelColorChanelValue + pixelRandomizeValue < 0) {
        return pixelColorChanelValue + Math.abs(pixelRandomizeValue);
    }
    if (pixelRandomizeValue > 255) {
        return pixelColorChanelValue - pixelRandomizeValue;
    }

    return pixelColorChanelValue + pixelRandomizeValue;
}

function randomizeGeneratedPartBackground(background, firstPixelsRow, width) {
    const partHeight = background.data.length / 4 / width;

    for (let i = 0; i < partHeight; i++) {
        let baseRandomizeValue = 50;

        for (let j = 0; j < width; j++) {
            const pixelFromBackgroundStartPosition = (i * width + j) * 4;
            // if (baseRandomizeValue > maxMinRandomValue || b
            // aseRandomizeValue < -maxMinRandomValue) {
            //     baseRandomizeValue = baseRandomizeValue > 0 ? maxMinRandomValue : -maxMinRandomValue;
            // }

            let randomizedValue = Math.round(Math.random() * baseRandomizeValue - baseRandomizeValue / 2);
            let originalRowPixelPosition = j + randomizedValue
            if (originalRowPixelPosition < 0) {
                originalRowPixelPosition = 0;
            }
            if (originalRowPixelPosition > width) {
                originalRowPixelPosition = width;
            }


            let originalRowPixel = getPixelByIndex(originalRowPixelPosition * 4, background);
            background.data[pixelFromBackgroundStartPosition] = originalRowPixel[0];
            background.data[pixelFromBackgroundStartPosition + 1] = originalRowPixel[1];
            background.data[pixelFromBackgroundStartPosition + 2] = originalRowPixel[2];
            background.data[pixelFromBackgroundStartPosition + 3] = originalRowPixel[3];
        }
    }

    return background;
}

function drawNewJewelryParts(buffer, calculatedJewelryParts, context, imageConfig, jewelryIntervals) {
    const {x, y: imageY, width} = imageConfig;

    const maxOriginImageHeight = Math.max(...calculatedJewelryParts.map((jewelryPart) => jewelryPart.foundedJewelryPixels.length));
    const originalImagePart = context.getImageData(x, imageY, width, maxOriginImageHeight);

    for (let [jewelryPartIndex, jewelryPart] of calculatedJewelryParts.entries()) {
        const pasteCount = Math.ceil(imageY / jewelryPart.foundedJewelryPixels.length);
        const toLeft = jewelryPart.minValue.index < jewelryPart.maxValue.index;

        const minMaxDiff = jewelryPart.maxValue.max - jewelryPart.minValue.min;

        for (let pasteIndex = 0; pasteIndex < pasteCount; pasteIndex++) {
            let isBreaked = false;
            for (let jewelryPixelsRowIndex = jewelryPart.foundedJewelryPixels.length -1; jewelryPixelsRowIndex >= 0 ; jewelryPixelsRowIndex--) {
                const jewelryPixelsInterval = jewelryPart.foundedJewelryPixels[jewelryPixelsRowIndex];
                if (jewelryPixelsInterval.min > width && jewelryPixelsInterval.max === -1) {
                    continue;
                }
                const jewelriesPixelsRow = [];

                for (let i = jewelryPixelsInterval.min; i <= jewelryPixelsInterval.max; i++) {
                    const pixelFromOriginalImageStartPosition = (jewelryPixelsRowIndex * width + i) * 4;
                    jewelriesPixelsRow.push(getPixelByIndex(pixelFromOriginalImageStartPosition, originalImagePart));
                }

                const jewelryPartLength = jewelryIntervals[jewelryPartIndex * 2 + 1] - jewelryIntervals[jewelryPartIndex * 2];
                const startInputPosition = {
                    x: jewelryPixelsInterval.min + (toLeft
                        ? -minMaxDiff + jewelryPartLength - (minMaxDiff - jewelryPartLength) * pasteIndex
                        : minMaxDiff - Math.round(jewelryPartLength * 0.85) + (minMaxDiff - Math.round(jewelryPartLength * 1.15)) * pasteIndex),
                    y: imageY - (pasteIndex * jewelryPart.foundedJewelryPixels.length) - (jewelryPart.foundedJewelryPixels.length - 1 - jewelryPixelsRowIndex),
                }

                if (startInputPosition.y < 0 || startInputPosition.x > width) {
                    isBreaked = true;
                    break;
                }

                jewelriesPixelsRow.forEach((jewelryPixel, index) => {
                    if (startInputPosition.x + index > 960) {
                        isBreaked = true;
                        return;
                    }
                    const pixelPosition = ((startInputPosition.y * width) + startInputPosition.x + index) * 4
                    buffer.data[pixelPosition] = jewelryPixel[0];
                    buffer.data[pixelPosition + 1] = jewelryPixel[1];
                    buffer.data[pixelPosition + 2] = jewelryPixel[2];
                    buffer.data[pixelPosition + 3] = jewelryPixel[3];
                })

                if (isBreaked) {
                    break;
                }
            }
            if (isBreaked) {
                break;
            }
        }

    }
    return buffer;
}

function blurGeneratedImagePart(context, imageConfig) {

    const kernel = gaussianKernel(35);

    const parts = []

    if (imageConfig.y > 0) {
        parts.push(
            {x: 0, y: 0, width: imageConfig.width, height: imageConfig.y},
            {x: 0, y: imageConfig.y + imageConfig.height, width: imageConfig.width, height: imageConfig.y}
        )
    } else {
        parts.push(
            {x: 0, y: 0, width: imageConfig.x, height: imageConfig.height},
            {x: imageConfig.x + imageConfig.width, y: 0, width: imageConfig.x, height: imageConfig.height}
        )
    }

    parts.forEach((part) => {
        const {x, y, height, width} = part;
        const img = context.getImageData(x, y, width, height);
        const src = img.data;
        const tmp = new Uint8ClampedArray(src.length);
        const dst = img.data;

        convolve1D(src, tmp, width, height, kernel, true);

        convolve1D(tmp, dst, width, height, kernel, false);

        context.putImageData(img, x, y);
    })

}



function gaussianKernel(radius, sigma = radius / 3) {
    const size = radius * 2 + 1;
    const kernel = new Array(size);
    const twoSigmaSq = 2 * sigma * sigma;
    let sum = 0;

    for (let i = -radius; i <= radius; i++) {
        const value = Math.exp(-(i * i) / twoSigmaSq);
        kernel[i + radius] = value;
        sum += value;
    }

    return kernel.map(v => v / sum);
}

function convolve1D(src, dst, w, h, kernel, horizontal) {
    const radius = kernel.length >> 1;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, a = 0;

            for (let k = -radius; k <= radius; k++) {
                let px = horizontal ? x + k : x;
                let py = horizontal ? y : y + k;

                if (px < 0) px = 0;
                if (px >= w) px = w - 1;
                if (py < 0) py = 0;
                if (py >= h) py = h - 1;

                const index = (py * w + px) * 4;
                const weight = kernel[k + radius];

                r += src[index] * weight;
                g += src[index + 1] * weight;
                b += src[index + 2] * weight;
                a += src[index + 3] * weight;
            }

            const index = (y * w + x) * 4;
            dst[index] = r;
            dst[index + 1] = g;
            dst[index + 2] = b;
            dst[index + 3] = a;
        }
    }
}


