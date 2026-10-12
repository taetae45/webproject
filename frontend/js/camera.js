const cameraSelect = document.getElementById("cameraSelect");
const video = document.getElementById("video");

async function loadCamera() {
    if (!navigator.mediaDevices?.enumerateDevices) {
        throw new Error("This browser does not support camera access.");
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === "videoinput");
    cameraSelect.innerHTML = "";

    cameras.forEach(camera => {
        const option = document.createElement("option");
        option.value = camera.deviceId;
        option.text = camera.label || "Camera";
        cameraSelect.appendChild(option);
    });

    if (cameras.length === 0) {
        const option = document.createElement("option");
        option.text = "No camera found";
        option.disabled = true;
        cameraSelect.appendChild(option);
    }
}

async function startCamera() {
    const selectedDevice = cameraSelect.value;
    const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedDevice ? { deviceId: { exact: selectedDevice } } : true
    });
    video.srcObject = stream;
    await video.play();
}

loadCamera().catch(error => console.error("Cannot list cameras:", error));
