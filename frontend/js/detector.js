const detectedList=document.getElementById("detectedList");
const errorList=document.getElementById("errorList");

function mockDetect(){

const detected=[

    "Milk",

    "Bread"

];

    detectedList.innerHTML="";

    errorList.innerHTML="";

    detected.forEach(item=>{

    let li=document.createElement("li");

    li.innerHTML="✅ "+item;

    detectedList.appendChild(li);

});

    const missing=

    order.filter(item=>!detected.includes(item));

    missing.forEach(item=>{

    let li=document.createElement("li");

    li.innerHTML="❌ "+item;

    errorList.appendChild(li);

});

}