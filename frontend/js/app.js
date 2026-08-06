const startBtn=document.getElementById("startBtn");

const resetBtn=document.getElementById("resetBtn");

const nextBtn=document.getElementById("nextBtn");

    startBtn.onclick=()=>{

    startCamera();

    mockDetect();

}

    resetBtn.onclick=()=>{

    location.reload();

}

    nextBtn.onclick=()=>{

    alert("Next Order");

}