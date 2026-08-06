const orderList=document.getElementById("orderList");

const order=[

    "Milk",

    "Bread",

    "Water"

];

    function loadOrder(){

    orderList.innerHTML="";

    order.forEach(item=>{

    let li=document.createElement("li");

    li.innerHTML="⬜ "+item;

    orderList.appendChild(li);

});

}

loadOrder();