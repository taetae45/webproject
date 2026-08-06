const cameraSelect = document.getElementById("cameraSelect");
const video = document.getElementById("video");

async function loadCamera(){

const devices =
await navigator.mediaDevices.enumerateDevices();

const cameras =
devices.filter(device=>device.kind==="videoinput");

    cameraSelect.innerHTML="";

    cameras.forEach(camera=>{

    const option=document.createElement("option");

    option.value=camera.deviceId;

    option.text=camera.label || "Camera";

    cameraSelect.appendChild(option);

});

}

    async function startCamera(){

    const stream=
    await navigator.mediaDevices.getUserMedia({

video:{

    deviceId:cameraSelect.value

}

});

    video.srcObject=stream;

}

loadCamera();